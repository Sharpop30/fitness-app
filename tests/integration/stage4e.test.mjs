// Stage 4e Integration (doc-module-map v11 section 6; stage 4e plan, task 12): the business and the owner through the
// envelope, the Registry and the Audit Log, against the LOCAL stack. Writes go to fresh businesses "(test)" only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, coachJoins, demoTokens, freshWorld, psql } from "../system/demo-users.mjs";

let w;
before(async () => { await demoTokens(); w = await freshWorld(1); });

const trail = (caller, action) =>
  psql(`select string_agg(caller || '>' || "moduleName" || '.' || "actionName" || ':' || "isOk" || ':' || coalesce("errorCode",'-'), E'\\n' order by "createdAt", "AuditEntryID")
        from audit_entries where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}'
        order by "createdAt" desc limit 1)`).split("\n");

test("0013 and 0014: 29 tables with RLS, a business for every coach, SETTINGS by business, and the Registry of map v11", () => {
  assert.equal(psql(`select count(*) from pg_tables where schemaname = 'public'`), "29");
  assert.equal(psql(`select count(*) from pg_tables where schemaname = 'public' and not rowsecurity`), "0");
  assert.equal(psql(`select count(*) from coaches where "BusinessID" is null`), "0");
  assert.equal(psql(`select count(*) from information_schema.columns where table_name = 'settings' and column_name = 'CoachID'`), "0");
  assert.equal(psql(`select "isActive" from registry_entries where caller='S12' and "actionName"='update_settings' and "allowedRole"='coach'`), "f");
  assert.equal(psql(`select count(*) from registry_entries where "allowedRole" = 'owner' and "isActive"`), "9");
  assert.equal(psql(`select count(*) from error_codes`), "28");
});

test("rule 10: the browser key reads none of the new tables and cannot run the coach join function", async () => {
  for (const table of ["businesses", "owners", "coach_invites"]) {
    const rows = await (await fetch(`${API}/rest/v1/${table}?select=*`, { headers: { apikey: ANON } })).json();
    assert.deepEqual(rows, [], table);
  }
  const rpc = await fetch(`${API}/rest/v1/rpc/business_accept_coach_invite`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: "x", p_auth: w.coachID, p_name: "x", p_email: "x" }),
  });
  assert.ok(rpc.status >= 400, `coach join function with the browser key: ${rpc.status}`);
});

test("S24: get_owner_home asks five modules as M13, and they ask on, all under one requestID", async () => {
  const r = await call(w.coachToken, "S24", "home", "get_owner_home");
  assert.equal(r.ok, true, JSON.stringify(r.error));
  const rows = trail("S24", "get_owner_home");
  for (const row of ["M13>payments.list_payments:true:-", "M13>classes.list_upcoming_classes:true:-", "M13>coins.manage_rewards:true:-",
    "M13>trainees.list_trainees:true:-", "M13>business.list_coaches:true:-", "M15>trainees.list_trainees:true:-"]) {
    assert.ok(rows.includes(row), `${row}\n${rows.join("\n")}`);
  }
  assert.equal(rows[0], "S24>home.get_owner_home:true:-");
  assert.equal(rows.at(-1), "S24>home.get_owner_home:true:-");
});

test("S27 and S26: the card and the measures ask through M15 only, and every row is ok", async () => {
  for (const [caller, action, payload] of [["S27", "get_coach_card", { coachID: w.coachID }], ["S26", "get_kpis", {}]]) {
    const r = await call(w.coachToken, caller, "business", action, payload);
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const rows = trail(caller, action);
    assert.ok(rows.slice(1, -1).every((x) => x.startsWith("M15>") || x.startsWith("M05>")), rows.join("\n"));
    assert.ok(rows.every((x) => x.includes(":true:")), rows.join("\n"));
  }
});

test("S22: a newcomer joins as a coach with two Audit rows, and is then a coach of this business", async () => {
  const { coachID, token } = await coachJoins(w.coachToken);
  assert.deepEqual(trail("S22", "accept_coach_invite"), ["S22>business.accept_coach_invite:true:-", "S22>business.accept_coach_invite:true:-"]);
  assert.equal(psql(`select "BusinessID" from coaches where "CoachID"='${coachID}'`), w.businessID);
  const me = await call(token, "S23", "trainees", "get_me");
  assert.deepEqual([me.data.roles, me.data.role], [["coach"], "coach"]);
});

test("UC12 f: a coach's update_settings is refused by the Registry and logged; S12 still reads, without canEdit", async () => {
  const { token } = await coachJoins(w.coachToken);
  assert.equal((await call(token, "S12", "settings", "update_settings", { values: { priceMonthly: "1" } })).error?.code, "ACTION_NOT_ALLOWED");
  assert.deepEqual(trail("S12", "update_settings"), ["S12>settings.update_settings:true:-", "S12>settings.update_settings:false:ACTION_NOT_ALLOWED"]);
  const read = await call(token, "S12", "settings", "get_settings");
  assert.equal(read.data.canEdit, false);
  assert.equal((await call(w.coachToken, "S12", "settings", "get_settings")).data.canEdit, true);
});
