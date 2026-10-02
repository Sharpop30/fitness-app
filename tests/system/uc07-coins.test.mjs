// System test, usecase-07 coins, personal goal and rewards (requirements 6, 24), end to end through the one Endpoint
// against the LOCAL stack. Clusters (doc-module-map section 6): normal, edge (b), failure (a, c).
// The attendance event arrives with classes in stage 4c. Data: a fresh coach and trainees marked "(test)" (decision 9).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, lastAudit, psql } from "./demo-users.mjs";

let w;
const setting = (key) => Number(psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey"='${key}'`));
const balance = async (t) => (await call(t.token, "S18", "coins", "get_balance")).data.balance;
const saveWorkout = async (t, squatWeight = 60) => {
  const workout = (await call(t.token, "S14", "programs", "get_active_program")).data.workouts[0];
  const sets = workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, n) =>
    ({ ExerciseID: i.ExerciseID, setNumber: n + 1, reps: i.targetReps, weight: i.ExerciseID === ID.squat ? squatWeight : i.targetWeight, isDone: true })));
  return call(t.token, "S14", "results", "log_workout", { workoutID: t.workoutID, sets });
};

before(async () => { await demoTokens(); w = await freshWorld(3); });

test("normal: saving a workout grows the balance by coinsWorkout, and the history shows it", async () => {
  const [t] = w.trainees;
  assert.equal(await balance(t), 0);
  await saveWorkout(t);
  const r = await call(t.token, "S18", "coins", "get_balance");
  assert.equal(r.data.balance, setting("coinsWorkout"));
  assert.deepEqual(r.data.history.map((h) => [h.eventType, h.amount]), [["workout", setting("coinsWorkout")]]);
});

test("normal: passing the personal goal credits coinsGoal, the feedback says so, and the goal closes", async () => {
  const [t] = w.trainees;
  assert.equal((await call(w.coachToken, "S07", "coins", "set_personal_goal", { traineeID: t.traineeID, exerciseID: ID.squat, targetWeight: 65 })).ok, true);
  assert.equal((await call(t.token, "S18", "coins", "get_balance")).data.goal.targetWeight, 65);
  const was = await balance(t);
  const r = await saveWorkout(t, 67.5);
  assert.deepEqual([r.data.feedback.coins, r.data.feedback.goal], [setting("coinsWorkout"), true]);
  assert.equal(r.data.feedback.goalCoins, setting("coinsGoal")); // map v13: S15 names the goal coins
  const after = (await call(t.token, "S18", "coins", "get_balance")).data;
  assert.equal(after.balance, was + setting("coinsWorkout") + setting("coinsGoal"));
  assert.equal(after.goal, null); // closed, waiting for the coach to set a new one
});

test("normal: redeeming lowers the balance; the coach sees it to deliver and marks it delivered", async () => {
  const [t] = w.trainees;
  const added = await call(w.coachToken, "S10", "coins", "manage_rewards", { op: "add", rewardName: "בקבוק (test)", priceCoins: 15 });
  const reward = added.data.rewards.find((r) => r.rewardName === "בקבוק (test)");
  const was = await balance(t);
  const r = await call(t.token, "S18", "coins", "redeem_reward", { rewardID: reward.RewardID });
  assert.deepEqual(r.data, { balance: was - 15 });
  const list = (await call(w.coachToken, "S10", "coins", "manage_rewards", { op: "list" })).data.redemptions;
  assert.deepEqual(list.map((x) => [x.rewardName, x.status]), [["בקבוק (test)", "pending"]]);
  assert.equal((await call(w.coachToken, "S10", "coins", "mark_reward_delivered", { redemptionID: list[0].RedemptionID })).ok, true);
  const again = (await call(w.coachToken, "S10", "coins", "manage_rewards", { op: "list" })).data.redemptions;
  assert.equal(again[0].status, "delivered");
});

test("edge b: correcting a result does not credit again, and the balance does not change", async () => {
  const [t] = w.trainees;
  const was = await balance(t);
  const log = (await call(t.token, "S16", "results", "list_results")).data[0];
  const sets = log.sets.map((s) => ({ ...s, reps: s.reps + 1 }));
  assert.equal((await call(t.token, "S16", "results", "correct_result", { workoutLogID: log.WorkoutLogID, sets })).ok, true);
  assert.equal(await balance(t), was);
});

test("failure a: a price above the balance is COINS_INSUFFICIENT, logged, and nothing is debited", async () => {
  const t = w.trainees[1];
  const added = await call(w.coachToken, "S10", "coins", "manage_rewards", { op: "add", rewardName: "יקר (test)", priceCoins: 10000 });
  const reward = added.data.rewards.find((r) => r.rewardName === "יקר (test)");
  await saveWorkout(t);
  const was = await balance(t);
  const r = await call(t.token, "S18", "coins", "redeem_reward", { rewardID: reward.RewardID });
  assert.equal(r.error.code, "COINS_INSUFFICIENT");
  assert.deepEqual(lastAudit("S18", "redeem_reward"), ["true:-", "false:COINS_INSUFFICIENT"]);
  assert.equal(await balance(t), was);
});

test("failure c: with no coinsWorkout in SETTINGS the workout is saved, nothing is credited, and VALUE_NOT_SET is logged", async () => {
  const t = w.trainees[2];
  // This test coach's SETTINGS only; renamed rather than deleted (CLAUDE.md rule 9).
  psql(`update settings set "settingKey"='coinsWorkout-removed (test)' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey"='coinsWorkout'`);
  const r = await saveWorkout(t);
  assert.equal(r.ok, true);
  assert.equal(r.data.feedback.coins, 0);
  assert.equal(await balance(t), 0);
  const logged = psql(`select count(*) from audit_entries where caller='M04' and "moduleName"='coins' and "actionName"='award'
    and "errorCode"='VALUE_NOT_SET' and "requestID" = (select "requestID" from audit_entries where caller='S14' and "actionName"='log_workout' order by "createdAt" desc limit 1)`);
  assert.equal(logged, "1");
});
