// Stage 4e acceptance (CLAUDE.md v8 section 6; stage 4e plan, "the separation tests"): an owner does not see another
// business, a coach does not see another coach, the owner gets no results, notes or goals, and a coach changes no
// settings. Against the LOCAL stack, on two fresh businesses "(test)"; each business's coach is also its owner (rule 9).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, coachJoins, demoTokens, freshWorld, lastAudit, paymentRequest, psql, traineeOfCoach } from "./demo-users.mjs";

let a, b, second, secondTrainee;
before(async () => {
  await demoTokens();
  a = await freshWorld(1);
  b = await freshWorld(1);
  second = await coachJoins(a.coachToken); // a second coach in business A
  secondTrainee = await traineeOfCoach(second.coachID);
  paymentRequest(a.coachID, a.trainees[0].traineeID, { amount: 350, paid: true });
  paymentRequest(b.coachID, b.trainees[0].traineeID, { amount: 999, paid: true });
});

test("owner A asks for the coach card of business B's coach: NOT_ALLOWED, and an Audit row", async () => {
  assert.equal((await call(a.coachToken, "S27", "business", "get_coach_card", { coachID: b.coachID })).error?.code, "NOT_ALLOWED");
  assert.deepEqual(lastAudit("S27", "get_coach_card"), ["true:-", "false:NOT_ALLOWED"]);
});

test("owner A's overview and measures count business A only", async () => {
  const home = (await call(a.coachToken, "S24", "home", "get_owner_home")).data;
  assert.deepEqual([home.incomeMonth, home.coaches, home.activeTrainees], [350, 2, 2]);
  const kpis = (await call(a.coachToken, "S26", "business", "get_kpis")).data;
  assert.deepEqual([kpis.activeTrainees, kpis.allPayments], [2, 1]);
  const coaches = (await call(a.coachToken, "S25", "business", "list_coaches")).data.map((c) => c.CoachID);
  assert.equal(coaches.includes(b.coachID), false);
});

test("coach A2, in the same business as coach A, cannot open coach A's trainee or their results (rule 5)", async () => {
  const traineeID = a.trainees[0].traineeID;
  assert.equal((await call(second.token, "S03", "trainees", "get_trainee_card", { traineeID })).error?.code, "NOT_ALLOWED");
  assert.equal((await call(second.token, "S06", "results", "list_results", { traineeID })).error?.code, "NOT_ALLOWED");
  assert.equal((await call(a.coachToken, "S03", "trainees", "get_trainee_card", { traineeID: secondTrainee.traineeID })).error?.code, "NOT_ALLOWED");
});

test("a coach asking for S24, S25, S26 or S27 gets ACTION_NOT_ALLOWED, with an Audit row", async () => {
  for (const [caller, module, action, payload] of [
    ["S24", "home", "get_owner_home", {}], ["S25", "business", "list_coaches", {}], ["S26", "business", "get_kpis", {}],
    ["S27", "business", "get_coach_card", { coachID: second.coachID }],
  ]) {
    assert.equal((await call(second.token, caller, module, action, payload)).error?.code, "ACTION_NOT_ALLOWED", caller);
    assert.deepEqual(lastAudit(caller, action), ["true:-", "false:ACTION_NOT_ALLOWED"], caller);
  }
});

test("a coach asking update_settings from S12: ACTION_NOT_ALLOWED, an Audit row, and the value unchanged", async () => {
  const value = () => psql(`select "settingValue" from settings where "BusinessID"='${a.businessID}' and "settingKey"='priceMonthly'`);
  const before = value();
  assert.equal((await call(second.token, "S12", "settings", "update_settings", { values: { priceMonthly: "1" } })).error?.code, "ACTION_NOT_ALLOWED");
  assert.deepEqual(lastAudit("S12", "update_settings"), ["true:-", "false:ACTION_NOT_ALLOWED"]);
  assert.equal(value(), before);
});

test("no reply to the owner carries results, notes or goals", async () => {
  for (const [caller, module, action, payload] of [
    ["S24", "home", "get_owner_home", {}], ["S25", "business", "list_coaches", {}], ["S26", "business", "get_kpis", {}],
    ["S27", "business", "get_coach_card", { coachID: a.coachID }], ["S27", "business", "get_coach_card", { coachID: second.coachID }],
  ]) {
    const r = await call(a.coachToken, caller, module, action, payload);
    assert.equal(r.ok, true, `${caller} ${JSON.stringify(r.error)}`);
    assert.equal(/"(reps|weight|sets|noteText|targetWeight|goal|PersonalGoalID|WorkoutLogID)"/.test(JSON.stringify(r.data)), false, caller);
  }
});

test("the owner changes priceMonthly: both coaches of A get it on a new request, and business B does not", async () => {
  const before = psql(`select "settingValue" from settings where "BusinessID"='${b.businessID}' and "settingKey"='priceMonthly'`);
  assert.equal((await call(a.coachToken, "S12", "settings", "update_settings", { values: { priceMonthly: "455" } })).ok, true);
  for (const [token, traineeID] of [[a.coachToken, a.trainees[0].traineeID], [second.token, secondTrainee.traineeID]]) {
    assert.equal((await call(token, "S08", "payments", "create_payment_request", { traineeID, paymentType: "monthly" })).ok, true);
    assert.equal(Number(psql(`select amount from payment_requests where "TraineeID"='${traineeID}' order by "createdAt" desc limit 1`)), 455);
  }
  assert.equal(psql(`select "settingValue" from settings where "BusinessID"='${b.businessID}' and "settingKey"='priceMonthly'`), before);
});
