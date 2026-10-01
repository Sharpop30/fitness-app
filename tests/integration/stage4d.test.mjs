// Stage 4d Integration (doc-module-map section 6; stage 4d plan, task 9): the payments, invoices and settings actions and the
// trainee card through the envelope, the Registry and the Audit Log, against the LOCAL stack. Writes go only to a fresh
// coach and trainees "(test)" (stage 4d plan, decision 10), so the file passes on a used database too.
// Stage 5: the payment gateway (I02) is built, and pay_demo goes through to the invoice (report 4d, gap 3).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, demoTokens, freshWorld, ID, lastAudit, paymentRequest, psql } from "../system/demo-users.mjs";

let t;
let w;
before(async () => { t = await demoTokens(); w = await freshWorld(2); });

const trail = (caller, action) =>
  psql(`select caller || '>' || "moduleName" || '.' || "actionName" || ':' || "isOk" || ':' || coalesce("errorCode",'-') from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");
const requestIDs = (caller, action) =>
  psql(`select count(distinct "requestID") from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)`);

test("every payments, invoices and settings screen action goes through the envelope and leaves two audit rows", async () => {
  const [a] = w.trainees;
  const paid = paymentRequest(w.coachID, a.traineeID, { paid: true, daysAgo: 3 });
  const open = paymentRequest(w.coachID, a.traineeID, { paymentType: "pack10", amount: 600 });
  const cases = [
    // [token, caller, module, action, payload, expected: true or an error code]
    [w.coachToken, "S08", "payments", "create_payment_request", { traineeID: a.traineeID, paymentType: "monthly" }, true],
    [w.coachToken, "S08", "payments", "create_payment_request", { traineeID: a.traineeID, paymentType: "yearly" }, "VALUE_NOT_SET"],
    [w.coachToken, "S08", "payments", "list_payments", { traineeID: a.traineeID }, true],
    [w.coachToken, "S08", "invoices", "list_invoices", {}, true],
    [w.coachToken, "S08", "trainees", "list_trainees", {}, true],
    [a.token, "S19", "payments", "list_payments", {}, true],
    [a.token, "S19", "invoices", "list_invoices", {}, true],
    [a.token, "S19", "payments", "pay_demo", { paymentRequestID: paid }, "PAYMENT_ALREADY_PAID"],
    // Stage 5: I02 is built, so the demo payment goes through (or declines when the function is served in decline mode).
    [a.token, "S19", "payments", "pay_demo", { paymentRequestID: open }, process.env.PAYMENT_GATEWAY_MODE === "decline" ? "PAYMENT_GATEWAY_UNAVAILABLE" : true],
    [w.coachToken, "S12", "settings", "get_settings", {}, true],
    [w.coachToken, "S12", "settings", "update_settings", { values: { pricePack10: "650" } }, true],
    [w.coachToken, "S12", "settings", "update_settings", { values: { pricePack10: "0" } }, "VALUE_NOT_SET"],
    [w.coachToken, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID }, true],
    [w.coachToken, "S06", "settings", "get_settings", { key: "noteMaxLength" }, true],
    [w.coachToken, "S01", "home", "get_coach_home", {}, true],
  ];
  for (const [token, caller, module, action, payload, expected] of cases) {
    const r = await call(token, caller, module, action, payload);
    const label = `${caller} ${module}.${action} ${JSON.stringify(payload)}`;
    if (expected === true) assert.equal(r.ok, true, `${label}: ${JSON.stringify(r.error)}`);
    else assert.equal(r.error?.code, expected, label);
    const own = trail(caller, action).filter((row) => row.startsWith(`${caller}>`)).map((row) => row.split(":").slice(1).join(":"));
    assert.deepEqual(own, ["true:-", expected === true ? "true:-" : `false:${expected}`], label);
  }
  assert.equal(psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey"='pricePack10'`), "650");
});

test("S19: pay_demo asks payment_gateway.charge and invoices.create_invoice as M09 under one requestID; paid, with its invoice", {
  skip: process.env.PAYMENT_GATEWAY_MODE === "decline" && "the function is served in decline mode",
}, async () => {
  const [, b] = w.trainees;
  const open = paymentRequest(w.coachID, b.traineeID);
  const r = await call(b.token, "S19", "payments", "pay_demo", { paymentRequestID: open });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  const trailRows = trail("S19", "pay_demo");
  for (const row of ["M09>payment_gateway.charge:true:-", "M09>invoices.create_invoice:true:-", "S19>payments.pay_demo:true:-"]) {
    assert.ok(trailRows.includes(row), trailRows.join("\n"));
  }
  assert.equal(requestIDs("S19", "pay_demo"), "1");
  assert.equal(psql(`select "status" from payment_requests where "PaymentRequestID"='${open}'`), "paid");
  assert.equal(psql(`select "invoiceNumber" from invoices where "PaymentRequestID"='${open}'`), String(r.data.invoiceNumber));
});

test("S03: get_trainee_card asks programs, coins, payments and progress as M01, all under one requestID", async () => {
  const [a] = w.trainees;
  const r = await call(w.coachToken, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID });
  assert.equal(r.ok, true);
  assert.equal(r.data.workouts, 1);
  const rows = trail("S03", "get_trainee_card");
  for (const expected of ["M01>programs.get_active_program:true:-", "M01>coins.get_balance:true:-", "M01>payments.list_payments:true:-", "M01>progress.get_streak:true:-"]) {
    assert.ok(rows.includes(expected), rows.join("\n"));
  }
  assert.equal(requestIDs("S03", "get_trainee_card"), "1");
});

test("S01: the coach's home reads payments as M13, with no refused rows left (stage 4b report, gap 7)", async () => {
  const r = await call(w.coachToken, "S01", "home", "get_coach_home");
  assert.equal(r.ok, true);
  const rows = trail("S01", "get_coach_home");
  assert.ok(rows.includes("M13>payments.list_payments:true:-"), rows.join("\n"));
  assert.ok(!rows.some((row) => row.endsWith("ACTION_NOT_ALLOWED")), rows.join("\n"));
  assert.equal(r.data.openPayments, Number(psql(`select count(*) from payment_requests where "CoachID"='${w.coachID}' and "status"='open'`)));
});

test("no Registry row: create_invoice and charge from a screen, and the wrong role on a screen, get ACTION_NOT_ALLOWED", async () => {
  const [a] = w.trainees;
  const refused = [
    [a.token, "S19", "invoices", "create_invoice", { paymentRequestID: w.coachID, amount: 1 }],
    [a.token, "S19", "payment_gateway", "charge", { paymentRequestID: w.coachID, amount: 1 }],
    [w.coachToken, "S08", "invoices", "create_invoice", { paymentRequestID: w.coachID, amount: 1 }],
    [a.token, "S08", "payments", "create_payment_request", {}],
    [a.token, "S12", "settings", "update_settings", { values: { priceMonthly: "1" } }],
    [a.token, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID }],
    [w.coachToken, "S19", "payments", "pay_demo", {}],
  ];
  for (const [token, caller, module, action, payload] of refused) {
    const r = await call(token, caller, module, action, payload);
    assert.equal(r.error?.code, "ACTION_NOT_ALLOWED", `${caller} ${module}.${action}`);
    assert.deepEqual(lastAudit(caller, action), ["true:-", "false:ACTION_NOT_ALLOWED"], `${caller} ${module}.${action}`);
  }
});

test("rule 5: the demo coach and a demo trainee cannot reach the fresh coach's trainees and requests", async () => {
  const [a] = w.trainees;
  const open = paymentRequest(w.coachID, a.traineeID);
  assert.equal((await call(t.coach, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID })).error?.code, "NOT_ALLOWED");
  assert.equal((await call(t.coach, "S08", "payments", "list_payments", { traineeID: a.traineeID })).error?.code, "NOT_ALLOWED");
  assert.equal((await call(t.coach, "S08", "payments", "create_payment_request", { traineeID: a.traineeID, paymentType: "monthly" })).error?.code, "NOT_ALLOWED");
  assert.equal((await call(t.noa, "S19", "payments", "pay_demo", { paymentRequestID: open })).error?.code, "NOT_ALLOWED");
});

test("the payment and settings tables are closed to the browser: the public key reads nothing and writes nothing", async () => {
  const rest = (table, init = {}) => fetch(`${API}/rest/v1/${table}`, {
    ...init, headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  });
  for (const table of ["payment_requests", "invoices", "settings"]) {
    const r = await rest(`${table}?select=*`);
    assert.deepEqual(r.ok ? await r.json() : [], [], table);
  }
  const before = psql(`select count(*) from invoices`);
  await rest("invoices", { method: "POST", body: JSON.stringify({ PaymentRequestID: ID.coach, amount: 1 }) });
  assert.equal(psql(`select count(*) from invoices`), before);
});
