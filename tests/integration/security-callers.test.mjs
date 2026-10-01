// Security review 1, finding 1: from outside, only a screen may be the caller. A signed-in person who declares a module
// (M01 to M14) or "system" is refused with CALLER_INVALID before the Orchestrator, logged, and nothing is written.
// Against the LOCAL stack, on a fresh coach and trainee "(test)".
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, paymentRequest, psql } from "../system/demo-users.mjs";

let w, a;
before(async () => { await demoTokens(); w = await freshWorld(1); [a] = w.trainees; });

const MODULE_ONLY = [
  // [caller, module, action, payload]: every row of the Registry a module has, as a browser might try it
  ["M04", "coins", "award", () => ({ traineeID: a.traineeID, reason: "workout", eventRef: "x" })],
  ["M11", "coins", "award", () => ({ traineeID: a.traineeID, reason: "attendance", eventRef: `probe-${Date.now()}` })],
  ["M08", "coins", "award", () => ({ traineeID: a.traineeID, reason: "challenge", eventRef: `probe-${Date.now()}` })],
  ["M09", "invoices", "create_invoice", () => ({ paymentRequestID: paymentRequest(w.coachID, a.traineeID), amount: 1 })],
  ["M09", "payment_gateway", "charge", () => ({ paymentRequestID: a.traineeID, amount: 1 })],
  ["M01", "invite_channel", "send_invite", () => ({ name: "x", email: "x@example.com", link: "http://x" })],
  ["M11", "notifications", "notify_in_app", () => ({ traineeID: a.traineeID, messageText: "probe" })],
  ["M04", "challenges", "check_progress", () => ({ workoutLogID: a.traineeID, traineeID: a.traineeID })],
  ["M04", "feedback", "build_feedback", () => ({ workoutLogID: a.traineeID, traineeID: a.traineeID })],
];

test("a trainee declaring a module reaches no module-only action: CALLER_INVALID, logged, and nothing written", async () => {
  const coins = () => psql(`select count(*) from coin_transactions where "TraineeID"='${a.traineeID}'`);
  const notes = () => psql(`select count(*) from notifications where "TraineeID"='${a.traineeID}'`);
  const invoices = () => psql(`select count(*) from invoices i join payment_requests p using ("PaymentRequestID") where p."TraineeID"='${a.traineeID}'`);
  const before = [coins(), notes(), invoices()];
  for (const [caller, module, action, payload] of MODULE_ONLY) {
    const r = await call(a.token, caller, module, action, payload());
    assert.equal(r.error?.code, "CALLER_INVALID", `${caller} ${module}.${action}`);
    const rows = psql(`select "isOk" || ':' || coalesce("errorCode",'-') from audit_entries where caller='${caller}' and "actionName"='${action}'
                       and "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
                       order by "createdAt"`).split("\n");
    assert.deepEqual(rows, ["true:-", "false:CALLER_INVALID"], `${caller} ${module}.${action}`);
  }
  assert.deepEqual([coins(), notes(), invoices()], before);
});

test("every module ID and system are refused from outside, for a coach too; a screen still works", async () => {
  // Map v11: M01 to M15, and S28 is past the last screen (S27).
  for (const caller of [...Array.from({ length: 15 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`), "system", "I02", "S28", 7]) {
    assert.equal((await call(w.coachToken, caller, "settings", "get_settings")).error?.code, "CALLER_INVALID", String(caller));
  }
  assert.equal((await call(w.coachToken, "S12", "settings", "get_settings")).ok, true);
  assert.equal((await call(w.coachToken, undefined, "settings", "get_settings")).error?.code, "CALLER_MISSING");
});
