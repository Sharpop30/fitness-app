// System Test, usecase-02 end to end (doc-module-map section 6; stage 4d plan, task 10): norm, edge, failure, against the
// LOCAL stack, on a fresh coach and trainees "(test)" (decision 10). The payment gateway (I02) is built in stage 5
// (decision 1): until then the demo payment ends in alternative c, and the payment that goes through is in the unit tests.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, paymentRequest, psql } from "./demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(2); });

const request = (traineeID, paymentType = "monthly") =>
  call(w.coachToken, "S08", "payments", "create_payment_request", { traineeID, paymentType });
const price = (key) => psql(`select "settingValue" from settings where "CoachID"='${w.coachID}' and "settingKey"='${key}'`);

// ---- norm ----
test("norm steps 1-4 and a: the coach creates a request at the price in SETTINGS, and both see it open", async () => {
  const [a] = w.trainees;
  assert.equal((await request(a.traineeID, "pack10")).ok, true);
  const mine = (await call(a.token, "S19", "payments", "list_payments")).data;
  assert.deepEqual(mine.map((p) => [p.paymentType, p.amount, p.status, p.invoiceNumber]), [["pack10", Number(price("pricePack10")), "open", null]]);
  const coachSees = (await call(w.coachToken, "S08", "payments", "list_payments", { traineeID: a.traineeID })).data;
  assert.deepEqual(coachSees.map((p) => p.PaymentRequestID), mine.map((p) => p.PaymentRequestID));
  assert.equal((await call(w.coachToken, "S01", "home", "get_coach_home")).data.openPayments, 1);
});

test("norm step 10: a paid request shows its demo invoice, numbered, to the coach and the trainee; the coach sees the list by trainee", async () => {
  const [, b] = w.trainees;
  const id = paymentRequest(w.coachID, b.traineeID, { paid: true, daysAgo: 2 });
  const number = Number(psql(`select "invoiceNumber" from invoices where "PaymentRequestID"='${id}'`));
  const row = (await call(b.token, "S19", "payments", "list_payments")).data.find((p) => p.PaymentRequestID === id);
  assert.deepEqual([row.status, row.invoiceNumber], ["paid", number]);
  const inv = (await call(b.token, "S19", "invoices", "list_invoices")).data;
  assert.deepEqual(inv.map((i) => [i.invoiceNumber, i.paymentType, i.amount, i.isDemo]), [[number, "monthly", 350, true]]);
  const byTrainee = (await call(w.coachToken, "S08", "invoices", "list_invoices", { traineeID: b.traineeID })).data;
  assert.deepEqual(byTrainee.map((i) => i.invoiceNumber), [number]);
  assert.ok(byTrainee[0].fullName.includes("(test)"));
});

// ---- edge ----
test("edge, rule 8 (9.4): a new price in S12 changes the next request, and not the ones made before", async () => {
  const [a] = w.trainees;
  const before = (await call(a.token, "S19", "payments", "list_payments")).data.length;
  assert.equal((await call(w.coachToken, "S12", "settings", "update_settings", { values: { priceMonthly: "410" } })).ok, true);
  await request(a.traineeID, "monthly");
  const list = (await call(a.token, "S19", "payments", "list_payments")).data;
  assert.equal(list.length, before + 1);
  assert.equal(list.find((p) => p.paymentType === "monthly").amount, 410);
  assert.equal(list.find((p) => p.paymentType === "pack10").amount, Number(price("pricePack10")));
});

// ---- failure ----
test("failure b: paying a paid request is PAYMENT_ALREADY_PAID, with no second invoice", async () => {
  const [, b] = w.trainees;
  const id = paymentRequest(w.coachID, b.traineeID, { paid: true });
  assert.equal((await call(b.token, "S19", "payments", "pay_demo", { paymentRequestID: id })).error?.code, "PAYMENT_ALREADY_PAID");
  assert.equal(psql(`select count(*) from invoices where "PaymentRequestID"='${id}'`), "1");
});

test("failure c: the gateway does not answer (not built until stage 5): PAYMENT_GATEWAY_UNAVAILABLE, open, no invoice", async () => {
  const [a] = w.trainees;
  const id = paymentRequest(w.coachID, a.traineeID);
  assert.equal((await call(a.token, "S19", "payments", "pay_demo", { paymentRequestID: id })).error?.code, "PAYMENT_GATEWAY_UNAVAILABLE");
  assert.equal(psql(`select "status" || ':' || count(i.*) from payment_requests p left join invoices i using ("PaymentRequestID")
                     where p."PaymentRequestID"='${id}' group by p."status"`), "open:0");
});

test("failure d: with no price for the type, no request is made (VALUE_NOT_SET)", async () => {
  const [a] = w.trainees;
  psql(`update settings set "settingValue"='' where "CoachID"='${w.coachID}' and "settingKey"='pricePack10'`); // this fresh coach only
  const count = () => psql(`select count(*) from payment_requests where "TraineeID"='${a.traineeID}'`);
  const before = count();
  assert.equal((await request(a.traineeID, "pack10")).error?.code, "VALUE_NOT_SET");
  assert.equal(count(), before);
});

test("failure e: a trainee cannot see or pay another trainee's requests, and a coach cannot reach another coach's", async () => {
  const [a, b] = w.trainees;
  const id = paymentRequest(w.coachID, a.traineeID);
  assert.equal((await call(b.token, "S19", "payments", "pay_demo", { paymentRequestID: id })).error?.code, "NOT_ALLOWED");
  const seen = (await call(b.token, "S19", "payments", "list_payments", { traineeID: a.traineeID })).data;
  assert.ok(seen.every((p) => p.PaymentRequestID !== id));
  assert.equal((await call(t.coach, "S08", "payments", "list_payments", { traineeID: a.traineeID })).error?.code, "NOT_ALLOWED");
});

test("UC2 section 13: no card detail anywhere in the payment tables", async () => {
  const cols = psql(`select string_agg(column_name, ',') from information_schema.columns where table_name in ('payment_requests','invoices')`);
  assert.doesNotMatch(cols, /card|cvv|expir|pan\b/i);
});
