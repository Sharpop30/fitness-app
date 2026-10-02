// System Test, usecase-04 steps 1-3 and 6 end to end (doc-module-map section 6; stage 4a plan, task 7): norm, edge,
// failure, against the LOCAL stack. The coach invites on S02 and reads the list there. Joining (steps 4-5) is in
// uc04-join.test.mjs (stage 5).
// Stage 4d (plan, task 10) adds step 7: the trainee card on S03, on a fresh coach and trainee "(test)".
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, EMAIL, freshWorld, ID, paymentRequest, psql, strangerCoachToken, workoutDaysAgo } from "./demo-users.mjs";

let t, stranger;
before(async () => {
  t = await demoTokens();
  stranger = await strangerCoachToken();
});
const invite = (payload) => call(t.coach, "S02", "trainees", "invite_trainee", payload);
const listed = async (name) => (await call(t.coach, "S02", "trainees", "list_trainees")).data.find((x) => x.fullName === name);
const invitesNamed = (name) => psql(`select count(*) from invites where "inviteeName"='${name}'`);

// ---- norm ----
test("norm: an invite by link appears in the list as invited, not joined, with no program", async () => {
  const name = `דנה (test ${Date.now()})`;
  const r = await invite({ name, email: "", channel: "link" });
  assert.equal(r.ok, true);
  assert.match(r.data.link, /^http:\/\/localhost:5174\/fitness-app\/\?join=[0-9a-f]{48}$/); // SITE_URL (stage 5)
  const row = await listed(name);
  assert.deepEqual([row.TraineeID, row.joined, row.hasProgram], [null, false, false]);
  assert.equal(psql(`select "InviteID" from invites where "inviteeName"='${name}'`), row.InviteID);
});

// ---- edge ----
test("edge e: a coach with no trainees gets an empty list, for the screen to explain how to invite the first", async () => {
  const r = await call(stranger, "S02", "trainees", "list_trainees");
  assert.deepEqual(r, { ok: true, data: [], error: null });
});

// ---- failure ----
test("failure b: a bad contact detail creates no invite (INVITE_INVALID)", async () => {
  const name = `בלי מייל (test ${Date.now()})`;
  assert.equal((await invite({ name, email: "not-an-email", channel: "email" })).error.code, "INVITE_INVALID");
  assert.equal((await invite({ name: "", email: "", channel: "link" })).error.code, "INVITE_INVALID");
  assert.equal(invitesNamed(name), "0");
  assert.equal(await listed(name), undefined);
});

test("failure c: when the channel does not send, INVITE_DELIVERY_FAILED, and the invite stays open in the list", async () => {
  // Stage 5: the channel refuses an address the identity service already knows (execution decision 3).
  const name = `במייל (test ${Date.now()})`;
  assert.equal((await invite({ name, email: EMAIL.itai, channel: "email" })).error.code, "INVITE_DELIVERY_FAILED");
  assert.equal(psql(`select status || ':' || "inviteeEmail" from invites where "inviteeName"='${name}'`), `open:${EMAIL.itai}`);
  assert.equal((await listed(name)).joined, false);
});

// ---- step 7, the trainee card (stage 4d) ----
test("norm step 7: the coach opens the trainee card and sees program, coins, streak, payments and goal from the database", async () => {
  const w = await freshWorld(1);
  const [a] = w.trainees;
  workoutDaysAgo(a.traineeID, a.workoutID, 0, [[ID.squat, 5, 60]]);
  psql(`insert into coin_transactions ("TraineeID","eventType","eventRef","amount") values ('${a.traineeID}','workout','card-test-${a.traineeID}',10)`);
  paymentRequest(w.coachID, a.traineeID, { paid: true, daysAgo: 5 });
  paymentRequest(w.coachID, a.traineeID);
  await call(w.coachToken, "S07", "coins", "set_personal_goal", { traineeID: a.traineeID, exerciseID: ID.squat, targetWeight: 80 });
  const r = await call(w.coachToken, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  const d = r.data;
  assert.equal(d.trainee.TraineeID, a.traineeID);
  assert.deepEqual([d.coins, d.streak, d.openPayments, d.payments, d.workouts], [10, 1, 1, 2, 1]);
  assert.deepEqual([d.goal.exerciseName, d.goal.targetWeight], ["סקוואט", 80]);
});

test("edge step 7: a trainee with no program and nothing else has an empty card, not a failure", async () => {
  const w = await freshWorld(1);
  const [a] = w.trainees;
  psql(`update programs set "isActive"=false where "TraineeID"='${a.traineeID}'`);
  const d = (await call(w.coachToken, "S03", "trainees", "get_trainee_card", { traineeID: a.traineeID })).data;
  assert.deepEqual([d.coins, d.streak, d.openPayments, d.payments, d.workouts, d.goal], [0, 0, 0, 0, 0, null]);
});

test("failure step 7 and rule 5: another coach's trainee card is NOT_ALLOWED", async () => {
  const r = await call(stranger, "S03", "trainees", "get_trainee_card", { traineeID: ID.noa });
  assert.equal(r.error?.code, "NOT_ALLOWED");
});
