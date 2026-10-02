// Stage 7 plan, task 19: the local check of demo.unload() (0017), run by hand on a clean database, never with the regular
// tests: load, unload, then zero rows marked "(דוגמה)" in every text column (AUDIT_ENTRIES stay, and the reference tables
// hold no demo rows), then load again for the regular tests.   node tests/system/demo-unload-check.mjs
import assert from "node:assert/strict";
import { demoTokens, psql } from "./demo-users.mjs";

const counts = () => psql(`select json_build_object('businesses', (select count(*) from businesses), 'coaches', (select count(*) from coaches),
  'trainees', (select count(*) from trainees), 'invites', (select count(*) from invites), 'settings', (select count(*) from settings),
  'exercises', (select count(*) from exercises))`);
const marked = () => Number(psql(`create temp table _n (k int);
  do $$ declare r record; k int; begin
    for r in select table_name, column_name from information_schema.columns
      where table_schema = 'public' and data_type = 'text' and table_name not in ('audit_entries', 'error_codes', 'registry_entries') loop
      execute format('insert into _n select count(*) from %I where %I like %L', r.table_name, r.column_name, '%(דוגמה)%');
    end loop; end $$;
  select sum(k) from _n;`).split("\n").pop());

await demoTokens();
console.log("loaded:  ", counts(), "marked:", marked());
console.log("unload:  ", psql("select demo.unload()"));
console.log("after:   ", counts());
assert.equal(marked(), 0);
assert.equal(psql(`select count(*) from coaches where "CoachID"::text like 'd0000000%'`), "0");
assert.equal(psql("select demo.load()"), "t");
console.log("reloaded:", counts(), "marked:", marked());
