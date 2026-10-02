// Stage 5 Integration (doc-module-map v9 section 6; stage 5 plan, task 9): the interfaces through the envelope, the
// Registry and the Audit Log, against the LOCAL stack. Writes go to a fresh coach "(test)" and new identity users only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, demoTokens, freshEmail, freshPassword, freshWorld, ID, ownExercise, psql, signUp, tokenOf } from "../system/demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(1); });

const trail = (caller, action) =>
  psql(`select string_agg(caller || '>' || "moduleName" || '.' || "actionName" || ':' || "isOk" || ':' || coalesce("errorCode",'-'), E'\\n' order by "createdAt", "AuditEntryID")
        from audit_entries where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}'
        order by "createdAt" desc limit 1)`).split("\n");
const requestIDs = (caller, action) =>
  psql(`select count(distinct "requestID") from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)`);

test("S02: an email invite leaves rows of M01 toward settings and invite_channel under one requestID, all ok", async () => {
  const r = await call(w.coachToken, "S02", "trainees", "invite_trainee", { name: "במייל (test)", email: freshEmail("mail"), channel: "email" });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  const rows = trail("S02", "invite_trainee");
  assert.ok(rows.includes("M01>invite_channel.send_invite:true:-") && rows.at(-1) === "S02>trainees.invite_trainee:true:-", rows.join("\n"));
  assert.equal(requestIDs("S02", "invite_trainee"), "1");
});

test("S22: a newcomer's accept_invite goes through the envelope with two Audit rows; anything else of theirs is refused and logged", async () => {
  const link = (await call(w.coachToken, "S02", "trainees", "invite_trainee", { name: "מצטרף (test)", channel: "link" })).data.link;
  const token = await signUp(freshEmail("newcomer"), freshPassword());
  const r = await call(token, "S22", "trainees", "accept_invite", { token: tokenOf(link) });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.deepEqual(trail("S22", "accept_invite"), ["S22>trainees.accept_invite:true:-", "S22>trainees.accept_invite:true:-"]);

  const stranger = await signUp(freshEmail("stranger"), freshPassword());
  assert.equal((await call(stranger, "S04", "programs", "get_active_program")).error?.code, "NOT_ALLOWED");
  assert.deepEqual(trail("S04", "get_active_program"), ["S04>programs.get_active_program:true:-", "S04>programs.get_active_program:false:NOT_ALLOWED"]);
});

test("S23: get_me for the coach and for a trainee, with two Audit rows", async () => {
  const coach = (await call(t.coach, "S23", "trainees", "get_me")).data;
  // Map v11: the demo coach is also the owner of the demo business; roles lists both, owner first.
  assert.deepEqual([coach.roles, coach.role, coach.traineeID], [["owner", "coach"], "owner", null]);
  const noa = (await call(t.noa, "S23", "trainees", "get_me")).data;
  assert.deepEqual([noa.role, noa.traineeID], ["trainee", ID.noa]);
  assert.deepEqual(trail("S23", "get_me"), ["S23>trainees.get_me:true:-", "S23>trainees.get_me:true:-"]);
});

test("S05: prepare_upload asks settings as M02 under one requestID, and answers an address the browser reaches", async () => {
  const own = await ownExercise(t.coach); // map v13, rule 12
  const r = await call(t.coach, "S05", "exercises", "prepare_upload", { exerciseID: own, contentType: "video/mp4", seconds: 30, megabytes: 5 });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.ok(r.data.uploadUrl.startsWith(`${API}/storage/v1/`), r.data.uploadUrl);
  assert.ok(r.data.path.startsWith(`${ID.coach}/${own}/`));
  assert.equal(requestIDs("S05", "prepare_upload"), "1");
});

test("Registry: a screen never reaches an interface, and a trainee cannot prepare an upload", async () => {
  for (const [token, caller, module, action, payload] of [
    [t.coach, "S02", "invite_channel", "send_invite", { name: "x", email: "x@example.com", link: "http://x" }],
    [t.noa, "S19", "payment_gateway", "charge", { paymentRequestID: ID.noa, amount: 1 }],
    [t.noa, "S05", "exercises", "prepare_upload", { exerciseID: ID.press, contentType: "video/mp4", seconds: 30, megabytes: 5 }],
    [t.coach, "S23", "trainees", "accept_invite", { token: "x" }],
  ]) {
    assert.equal((await call(token, caller, module, action, payload)).error?.code, "ACTION_NOT_ALLOWED", `${caller} ${module}.${action}`);
  }
});

test("rule 10 and I04: the browser key cannot write to the bucket, run the join function, or read the tables", async () => {
  const put = await fetch(`${API}/storage/v1/object/videos/${ID.coach}/x/direct.mp4`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "video/mp4" }, body: new Uint8Array(10),
  });
  assert.ok(put.status >= 400, `upload with the browser key: ${put.status}`);
  const rpc = await fetch(`${API}/rest/v1/rpc/trainees_accept_invite`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: "x", p_auth: ID.coach, p_name: "x", p_email: "x" }),
  });
  assert.ok(rpc.status >= 400, `join function with the browser key: ${rpc.status}`);
  const rows = await (await fetch(`${API}/rest/v1/invites?select=token`, { headers: { apikey: ANON } })).json();
  assert.deepEqual(rows, []);
});

test("get_error_texts: from S23 after signing in, and from S22 for a newcomer, the 28 texts of ERROR_CODES", async () => {
  const coach = await call(t.coach, "S23", "settings", "get_error_texts");
  assert.equal(Object.keys(coach.data).length, 28);
  assert.equal(coach.data.INVITE_EXPIRED, psql(`select "humanText" from error_codes where "errorCode"='INVITE_EXPIRED'`));
  const newcomer = await signUp(freshEmail("texts"), freshPassword());
  assert.deepEqual((await call(newcomer, "S22", "settings", "get_error_texts")).data, coach.data);
  assert.equal((await call(newcomer, "S22", "settings", "get_settings")).error?.code, "NOT_ALLOWED");
});
