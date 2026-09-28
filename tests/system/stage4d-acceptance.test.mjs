// Stage 4d acceptance (CLAUDE.md sections 6 and 9; stage 4d plan, task 12), against the LOCAL stack.
// With the full regression (Unit, Integration, System) green on a clean database, this file adds: every request of the
// stage's screens leaves audit rows with one requestID (9.3); values read from SETTINGS at run time (9.4, rule 8); and
// the coach scenario of the plan through the one Endpoint. 9.1, 9.6 and 9.7 run in stage4a-acceptance.test.mjs, which
// reads every module file, payments.ts and invoices.ts included. Changes to SETTINGS are to a fresh coach only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, paymentRequest, psql } from "./demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(2); });

// ---- 9.3: every request leaves audit rows with a shared requestID ----
test("9.3: each request of S01, S03, S08, S12 and S19 leaves its audit rows under one requestID, inner requests included", async () => {
  const [a] = w.trainees;
  const open = paymentRequest(w.coachID, a.traineeID);
  const asked = [
    [t.coach, "S01", "home", "get_coach_home", {}], [w.coachToken, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID }],
    [w.coachToken, "S08", "payments", "create_payment_request", { traineeID: a.traineeID, paymentType: "monthly" }],
    [w.coachToken, "S08", "payments", "list_payments", {}], [w.coachToken, "S08", "invoices", "list_invoices", {}],
    [w.coachToken, "S12", "settings", "get_settings", {}], [w.coachToken, "S12", "settings", "update_settings", { values: { coinsGoal: "30" } }],
    [a.token, "S19", "payments", "list_payments", {}], [a.token, "S19", "invoices", "list_invoices", {}],
    [a.token, "S19", "payments", "pay_demo", { paymentRequestID: open }],
  ];
  for (const [token, caller, module, action, payload] of asked) {
    const before = Number(psql(`select count(*) from audit_entries`));
    await call(token, caller, module, action, payload);
    const ids = psql(`select count(distinct "requestID") from (select "requestID" from audit_entries order by "createdAt" desc limit ${Number(psql(`select count(*) from audit_entries`)) - before}) x`);
    assert.equal(ids, "1", `${caller} ${module}.${action}`);
  }
});

// ---- 9.4: SETTINGS at run time (CLAUDE.md rule 8) ----
test("9.4: a price changed on S12 sets the amount of the next request, with no code change", async () => {
  const [a] = w.trainees;
  const amountAt = async (value) => {
    assert.equal((await call(w.coachToken, "S12", "settings", "update_settings", { values: { priceMonthly: value } })).ok, true);
    await call(w.coachToken, "S08", "payments", "create_payment_request", { traineeID: a.traineeID, paymentType: "monthly" });
    return psql(`select "amount" from payment_requests where "TraineeID"='${a.traineeID}' order by "createdAt" desc limit 1`);
  };
  assert.equal(await amountAt("350"), "350");
  assert.equal(await amountAt("420"), "420");
  await call(w.coachToken, "S12", "settings", "update_settings", { values: { priceMonthly: "350" } });
});

// ---- the coach scenario of the plan (task 12), through the Endpoint ----
test("the coach sees open payments at home, opens a card, asks for a payment, reads payments and invoices, and saves a setting", async () => {
  const [, b] = w.trainees;
  const coach = (caller, module, action, payload = {}) => call(w.coachToken, caller, module, action, payload);
  const paid = paymentRequest(w.coachID, b.traineeID, { paid: true, daysAgo: 1 });
  const homeBefore = (await coach("S01", "home", "get_coach_home")).data.openPayments;

  const cardBefore = (await coach("S03", "trainees", "get_trainee_card", { traineeID: b.traineeID })).data;
  assert.equal((await coach("S08", "payments", "create_payment_request", { traineeID: b.traineeID, paymentType: "pack10" })).ok, true);
  const cardAfter = (await coach("S03", "trainees", "get_trainee_card", { traineeID: b.traineeID })).data;
  assert.deepEqual([cardAfter.openPayments - cardBefore.openPayments, cardAfter.payments - cardBefore.payments], [1, 1]);
  assert.equal((await coach("S01", "home", "get_coach_home")).data.openPayments, homeBefore + 1);

  const pays = (await coach("S08", "payments", "list_payments", { traineeID: b.traineeID })).data;
  const number = Number(psql(`select "invoiceNumber" from invoices where "PaymentRequestID"='${paid}'`));
  assert.equal(pays.find((p) => p.PaymentRequestID === paid).invoiceNumber, number);
  assert.ok((await coach("S08", "invoices", "list_invoices")).data.some((i) => i.invoiceNumber === number && i.isDemo));

  assert.equal((await coach("S12", "settings", "update_settings", { values: { reminderText: "בוקר טוב (test)" } })).ok, true);
  assert.equal((await coach("S12", "settings", "get_settings")).data.reminderText, "בוקר טוב (test)");
});
