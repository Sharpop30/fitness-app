// Stage 1 acceptance (CLAUDE.md section 6): an allowed request passes and is logged; a request with no
// caller, an invalid caller, or no Registry row is rejected with the right code and is logged.
// Runs against the LOCAL stack only (supabase start + functions serve). Synthetic test data, marked "(test)".
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

const API = process.env.API_URL ?? "http://127.0.0.1:54321";
const ENDPOINT = `${API}/functions/v1/api`;
// Local-only demo keys printed by `supabase status`; never a cloud key.
const status = JSON.parse(execSync("supabase status -o json", { encoding: "utf8" }));
const SERVICE = status.SERVICE_ROLE_KEY;
const ANON = status.ANON_KEY;
const psql = (sql) => {
  const c = execSync("docker ps --format '{{.Names}}' | grep supabase_db_fitness-app", { encoding: "utf8" }).trim();
  return execSync(`docker exec ${c} psql -U postgres -tAc ${JSON.stringify(sql)}`, { encoding: "utf8" }).trim();
};

let coachToken, traineeToken;
const stamp = Date.now();

async function makeUser(email) {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: `test-only-${stamp}`, email_confirm: true }),
  });
  const u = await res.json();
  const login = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: `test-only-${stamp}` }),
  });
  return { id: u.id, token: (await login.json()).access_token };
}

before(async () => {
  const coach = await makeUser(`coach-${stamp}@test.local`);
  const trainee = await makeUser(`trainee-${stamp}@test.local`);
  // Stage 4e: a coach belongs to a business (0013), here a business of one.
  const businessID = psql(`insert into businesses ("businessName") values ('מאמן (test)') returning "BusinessID"`).split("\n")[0];
  const coachID = psql(`insert into coaches ("BusinessID","authUserID","fullName","email") values ('${businessID}','${coach.id}','מאמן (test)','coach-${stamp}@test.local') returning "CoachID"`).split("\n")[0];
  psql(`insert into trainees ("CoachID","authUserID","fullName","email") values ('${coachID}','${trainee.id}','מתאמן (test)','trainee-${stamp}@test.local')`);
  psql(`insert into settings ("BusinessID","settingKey","settingValue") values ('${businessID}','cancelHours','24')`);
  coachToken = coach.token;
  traineeToken = trainee.token;
});

const call = async (envelope, token = coachToken) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(envelope),
  });
  return res.json();
};
const auditRows = (caller, action) =>
  Number(psql(`select count(*) from audit_entries where caller='${caller}' and "actionName"='${action}'`));

test("allowed request passes and is logged with a shared requestID", async () => {
  const before = auditRows("S12", "get_settings");
  const r = await call({ caller: "S12", module: "settings", action: "get_settings", payload: {}, lang: "he" });
  assert.equal(r.ok, true);
  assert.equal(r.data.cancelHours, "24");
  assert.equal(auditRows("S12", "get_settings") - before, 2);
  const shared = psql(`select count(distinct "requestID") from (select "requestID" from audit_entries where caller='S12' order by "createdAt" desc limit 2) t`);
  assert.equal(shared, "1");
});

test("missing value returns VALUE_NOT_SET, not an invented value", async () => {
  const r = await call({ caller: "S12", module: "settings", action: "get_settings", payload: { key: "streakGapDays" } });
  assert.deepEqual(r.error, { code: "VALUE_NOT_SET" });
});

test("no caller is rejected with CALLER_MISSING and logged", async () => {
  const before = auditRows("-", "get_settings");
  const r = await call({ module: "settings", action: "get_settings" });
  assert.deepEqual(r.error, { code: "CALLER_MISSING" });
  assert.equal(auditRows("-", "get_settings") - before, 2);
});

test("invalid caller is rejected with CALLER_INVALID and logged", async () => {
  const before = auditRows("S99", "get_settings");
  const r = await call({ caller: "S99", module: "settings", action: "get_settings" });
  assert.deepEqual(r.error, { code: "CALLER_INVALID" });
  assert.equal(auditRows("S99", "get_settings") - before, 2);
});

test("no Registry row is rejected with ACTION_NOT_ALLOWED and logged", async () => {
  // S01 may not call settings.get_settings: there is no such row.
  const before = auditRows("S01", "get_settings");
  const r = await call({ caller: "S01", module: "settings", action: "get_settings" });
  assert.deepEqual(r.error, { code: "ACTION_NOT_ALLOWED" });
  assert.equal(auditRows("S01", "get_settings") - before, 2);
});

test("a trainee cannot use a coach screen's row", async () => {
  const r = await call({ caller: "S12", module: "settings", action: "get_settings" }, traineeToken);
  assert.deepEqual(r.error, { code: "ACTION_NOT_ALLOWED" });
});

test("no identity is rejected with NOT_ALLOWED and logged", async () => {
  const before = auditRows("S12", "get_settings");
  const r = await call({ caller: "S12", module: "settings", action: "get_settings" }, null);
  assert.deepEqual(r.error, { code: "NOT_ALLOWED" });
  assert.equal(auditRows("S12", "get_settings") - before, 2);
});

test("every error code in the database matches the code list", async () => {
  const db = psql(`select string_agg("errorCode", ',') from error_codes`).split(",").sort();
  const src = execSync("grep -o '\"[A-Z_]*\"' supabase/functions/api/errors.ts", { encoding: "utf8" })
    .split("\n").filter(Boolean).map((s) => s.replaceAll('"', "")).sort();
  assert.deepEqual(db, src);
});
