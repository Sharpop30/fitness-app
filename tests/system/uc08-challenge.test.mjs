// System test, usecase-08 weekly challenge and automatic completion (requirement 5), end to end through the one Endpoint
// against the LOCAL stack. Clusters (doc-module-map section 6): normal, edge (b, c), failure (a, e).
// Data: fresh coaches and trainees marked "(test)" (stage 4b plan, decision 9), so the week of the demo challenge is not touched.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, lastAudit, psql, workoutDaysAgo } from "./demo-users.mjs";

let w, other;
const create = (token, payload = {}) => call(token, "S09", "challenges", "create_challenge",
  { challengeName: "שני אימונים (test)", challengeType: "count", targetValue: 2, extraPrize: "חולצה (test)", ...payload });
const saveWorkout = async (t) => {
  const workout = (await call(t.token, "S14", "programs", "get_active_program")).data.workouts[0];
  const sets = workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, n) =>
    ({ ExerciseID: i.ExerciseID, setNumber: n + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true })));
  return call(t.token, "S14", "results", "log_workout", { workoutID: t.workoutID, sets });
};
// Days since this week's Sunday, in Israel time; the week starts on Sunday (UC8, team decision).
const daysIntoWeek = () => Number(psql(`select extract(dow from (now() at time zone 'Asia/Jerusalem')::date)`));

before(async () => { await demoTokens(); w = await freshWorld(2); other = await freshWorld(1); });

test("normal: the coach creates a challenge, and every trainee sees it with their own progress", async () => {
  assert.equal((await create(w.coachToken)).ok, true);
  for (const t of w.trainees) {
    const c = (await call(t.token, "S20", "challenges", "get_current_challenge")).data;
    assert.equal(c.challengeName, "שני אימונים (test)");
    assert.deepEqual(c.progress, { value: 0, target: 2, exempt: false });
    assert.equal(c.coins, Number(psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey"='coinsChallenge'`)));
  }
  // A trainee of another coach does not see it.
  assert.equal((await call(other.trainees[0].token, "S20", "challenges", "get_current_challenge")).data, null);
});

test("edge c: a workout before this week's Sunday does not count", async () => {
  const [t] = w.trainees;
  workoutDaysAgo(t.traineeID, t.workoutID, daysIntoWeek() + 1, [[ID.squat, 5, 60]]); // last Saturday
  assert.equal((await call(t.token, "S20", "challenges", "get_current_challenge")).data.progress.value, 0);
});

test("normal: reaching the target marks the trainee complete and credits coins, with no report of their own", async () => {
  const [t] = w.trainees;
  const first = await saveWorkout(t);
  assert.equal(first.data.feedback.challenge, false);
  const second = await saveWorkout(t);
  assert.equal(second.data.feedback.challenge, true);
  const history = (await call(t.token, "S18", "coins", "get_balance")).data.history;
  assert.equal(history.filter((h) => h.eventType === "challenge").length, 1);
  // Once only: a third workout adds no completion and no credit.
  assert.equal((await saveWorkout(t)).data.feedback.challenge, false);
  assert.equal((await call(t.token, "S18", "coins", "get_balance")).data.history.filter((h) => h.eventType === "challenge").length, 1);
});

test("normal: the coach sees who completed, and marks the extra prize delivered", async () => {
  const [t] = w.trainees;
  const done = (await call(w.coachToken, "S09", "challenges", "list_completions")).data;
  assert.deepEqual(done.map((x) => [x.TraineeID, x.prizeDeliveredAt]), [[t.traineeID, null]]);
  assert.equal((await call(w.coachToken, "S09", "challenges", "mark_prize_delivered", { traineeID: t.traineeID })).ok, true);
  assert.notEqual((await call(w.coachToken, "S09", "challenges", "list_completions")).data[0].prizeDeliveredAt, null);
});

test("failure a: a second challenge in the same week is CHALLENGE_EXISTS, logged", async () => {
  const r = await create(w.coachToken, { challengeName: "עוד אחד (test)" });
  assert.equal(r.error.code, "CHALLENGE_EXISTS");
  assert.deepEqual(lastAudit("S09", "create_challenge"), ["true:-", "false:CHALLENGE_EXISTS"]);
});

test("failure e: a missing or non-positive target is CHALLENGE_INVALID, and nothing is saved", async () => {
  for (const targetValue of [0, -1, null]) {
    assert.equal((await create(other.coachToken, { targetValue })).error.code, "CHALLENGE_INVALID");
  }
  assert.equal(psql(`select count(*) from challenges where "CoachID"='${other.coachID}'`), "0");
});

test("edge, team decision: in an exercise challenge, a trainee whose program lacks the exercise is exempt", async () => {
  assert.equal((await create(other.coachToken, { challengeType: "exercise", exerciseID: ID.bench, targetValue: 50 })).ok, true);
  const c = (await call(other.trainees[0].token, "S20", "challenges", "get_current_challenge")).data;
  assert.deepEqual(c.progress, { value: 0, target: 50, exempt: true });
});

test("edge b: a challenge of last week is closed: there is no current challenge", async () => {
  const past = await freshWorld(1);
  psql(`insert into challenges ("CoachID","challengeName","challengeType","targetValue","weekStart")
        values ('${past.coachID}','שבוע שעבר (test)','count',1,(now() at time zone 'Asia/Jerusalem')::date - ${daysIntoWeek() + 7})`);
  assert.equal((await call(past.trainees[0].token, "S20", "challenges", "get_current_challenge")).data, null);
  assert.equal((await saveWorkout(past.trainees[0])).data.feedback.challenge, false);
});
