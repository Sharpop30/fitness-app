#!/usr/bin/env bash
# The cloud backup (stage 8 plan, task 3; decision 2, alternative 1; CLAUDE.md section 6, "working against production").
#
#   scripts/backup.sh create <folder>   dumps the cloud database (roles, and the data of every schema the platform does
#                                       not manage: public, auth with the identity users, storage) and the row count of
#                                       every table, packs them, and encrypts the pack into <folder>. openssl asks for
#                                       the encryption password; it is never an argument, a variable or a file.
#   scripts/backup.sh verify <file>     decrypts a backup, loads it into a scratch database in the LOCAL stack
#                                       (supabase start), compares the row count of every table with the cloud's count
#                                       at backup time, and drops the scratch database.
#
# Run from the project folder, before every schema change in the cloud and once a week during the pilot. The cloud is
# only read (CLAUDE.md section 6, rule 4). The backup holds trainees' personal data: keep it only in the private folder
# and in the personal Drive, never in this repository or in the shared Drive. The plain dump lives only in a temporary
# folder that is removed on exit.
set -euo pipefail
# The tools (supabase, node) are in ~/bin on the team's computer (session-state, "tools"), which a new terminal may
# not have on its PATH.
export PATH="$HOME/bin:$PATH"

DB_CONTAINER="supabase_db_fitness-app"
SCRATCH_DB="backup_check"
# Tables the dump leaves out on purpose (the platform keeps them), so their counts are not compared.
SKIP_TABLES="auth.schema_migrations storage.migrations"

COUNTS_SQL="select table_schema || '.' || table_name as t,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n
from information_schema.tables
where table_schema in ('public', 'auth', 'storage') and table_type = 'BASE TABLE'
order by 1"

usage() { echo "usage: scripts/backup.sh create <folder> | verify <file>" >&2; exit 2; }

work=""
cleanup() { [ -n "$work" ] && rm -rf "$work"; }
trap cleanup EXIT
new_work() { umask 077; work=$(mktemp -d); }

create() {
  local folder="$1"
  [ -d "$folder" ] || { echo "No such folder: $folder" >&2; exit 1; }
  new_work
  local stamp; stamp=$(date +%Y%m%d-%H%M)
  local pack="$work/fitness-app-$stamp"
  mkdir "$pack"

  echo "Reading the row counts in the cloud..."
  supabase db query --linked -o json "$COUNTS_SQL" 2>/dev/null \
    | node -e 'const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
               const r = Array.isArray(j) ? j : j.rows;
               for (const x of r) console.log(`${x.t}\t${x.n}`);' > "$pack/counts.tsv"
  echo "Dumping the roles and the data..."
  supabase db dump --linked --role-only -f "$pack/roles.sql" >/dev/null
  supabase db dump --linked --data-only --use-copy -f "$pack/data.sql" >/dev/null

  local out="$folder/fitness-app-$stamp.tar.gz.enc"
  echo "Encrypting. openssl asks for the encryption password twice."
  tar -C "$work" -czf - "fitness-app-$stamp" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -out "$out"
  chmod 600 "$out"
  echo "Backup: $out ($(wc -l < "$pack/counts.tsv" | tr -d ' ') tables, $(du -h "$out" | cut -f1))"
  echo "Copy it to the personal Drive by hand. Then check it: scripts/backup.sh verify \"$out\""
}

psql_local() { docker exec -i "$DB_CONTAINER" psql -U supabase_admin -v ON_ERROR_STOP=1 -q "$@"; }

verify() {
  local file="$1"
  [ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }
  docker exec "$DB_CONTAINER" true 2>/dev/null || { echo "The local stack is not running: supabase start" >&2; exit 1; }
  new_work
  echo "Decrypting. openssl asks for the encryption password."
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$file" | tar -C "$work" -xzf -
  local pack; pack=$(echo "$work"/fitness-app-*)

  echo "Loading into the scratch database $SCRATCH_DB (the local tables, then the cloud data)..."
  psql_local -d postgres -c "drop database if exists $SCRATCH_DB" -c "create database $SCRATCH_DB"
  # The tables come from the local database, which the same migrations built, so the cloud data fits them. The whole
  # structure is copied (extensions included, which the table defaults use); a platform object that cannot be created
  # twice in one cluster only prints an error here, because the row counts below are the check.
  docker exec "$DB_CONTAINER" pg_dump -U supabase_admin --schema-only postgres > "$work/schema.sql"
  docker exec -i "$DB_CONTAINER" psql -U supabase_admin -q -d "$SCRATCH_DB" < "$work/schema.sql" > "$work/schema.log" 2>&1 || true
  psql_local -d "$SCRATCH_DB" < "$pack/data.sql" >/dev/null

  psql_local -d "$SCRATCH_DB" -At -F $'\t' -c "$COUNTS_SQL" > "$work/loaded.tsv"
  psql_local -d postgres -c "drop database $SCRATCH_DB"

  local diff=0 tables=0 rows=0
  while IFS=$'\t' read -r t n; do
    case " $SKIP_TABLES " in *" $t "*) continue;; esac
    local got; got=$(awk -F'\t' -v t="$t" '$1 == t { print $2 }' "$work/loaded.tsv")
    tables=$((tables + 1)); rows=$((rows + n))
    if [ "${got:-missing}" != "$n" ]; then echo "  different: $t cloud $n, loaded ${got:-missing}"; diff=$((diff + 1)); fi
  done < "$pack/counts.tsv"
  if [ "$diff" -eq 0 ]; then
    echo "The backup loads, and the row counts match the cloud: $tables tables, $rows rows."
  else
    echo "$diff table(s) differ. A table that changes all the time (auth.sessions, auth.refresh_tokens, auth.audit_log_entries) may move between the count and the dump; any other difference is a failed backup." >&2
    exit 1
  fi
}

case "${1:-}" in
  create) [ $# -eq 2 ] || usage; create "$2" ;;
  verify) [ $# -eq 2 ] || usage; verify "$2" ;;
  *) usage ;;
esac
