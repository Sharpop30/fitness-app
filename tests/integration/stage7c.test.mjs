// Integration, stage 7c against the LOCAL stack: who asked, in AUDIT_ENTRIES (migration 0020; team decision 02.10.2026,
// from the security review; ERD logical v3). Both rows of a request carry the verified identity user and the business;
// a visitor's request, with no identity user, carries neither.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, psql } from "../system/demo-users.mjs";

before(async () => { await demoTokens(); });

const rowsOf = (requestFilter) => psql(`select coalesce("authUserID"::text,'-') || '|' || coalesce("BusinessID"::text,'-') from audit_entries
  where "requestID" = (select "requestID" from audit_entries where ${requestFilter} order by "createdAt" desc limit 1) order by "createdAt"`).split("\n");

test("a signed-in coach's request: both audit rows name the identity user and the business", async () => {
  const w = await freshWorld(1);
  const r = await call(w.coachToken, "S02", "trainees", "list_trainees");
  assert.equal(r.ok, true);
  const [auth, business] = psql(`select "authUserID" || '|' || "BusinessID" from coaches where "CoachID" = '${w.coachID}'`).split("|");
  assert.deepEqual(rowsOf(`caller = 'S02' and "actionName" = 'list_trainees'`), [`${auth}|${business}`, `${auth}|${business}`]);
});

test("a visitor's invite check, with no identity user: the audit rows name no one", async () => {
  await call(null, "S22", "trainees", "check_invite", { token: "no-such-token" });
  assert.deepEqual(rowsOf(`caller = 'S22' and "actionName" = 'check_invite'`), ["-|-", "-|-"]);
});
