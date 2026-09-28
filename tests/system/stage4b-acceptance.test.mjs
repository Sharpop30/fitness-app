// Stage 4b acceptance (CLAUDE.md sections 6 and 9; stage 4b plan, task 13), against the LOCAL stack.
// With the full regression (Unit, Integration, System) green on a clean database, this file adds: every request of the
// stage's screens leaves audit rows with one requestID (9.3); values read from SETTINGS at run time (9.4, rule 8);
// and the coach scenario of the plan through the one Endpoint. 9.1, 9.6 and 9.7 run in stage4a-acceptance.test.mjs,
// which reads every module file, the new ones included. Direct changes to SETTINGS are to a fresh "(test)" coach only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, psql, workoutDaysAgo } from "./demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(1); });

const setting = (key, value) => psql(`update settings set "settingValue" = '${value}' where "CoachID" = '${w.coachID}' and "settingKey" = '${key}'`);
const saveWorkout = async (trainee) => {
  const workout = (await call(trainee.token, "S14", "programs", "get_active_program")).data.workouts[0];
  const sets = workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, n) =>
    ({ ExerciseID: i.ExerciseID, setNumber: n + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true })));
  return call(trainee.token, "S14", "results", "log_workout", { workoutID: trainee.workoutID, sets });
};

// ---- 9.3: every request leaves audit rows with a shared requestID ----
test("9.3: each request of the stage's screens leaves its audit rows under one requestID, inner requests included", async () => {
  const asked = [
    [t.coach, "S06", "feedback", "get_workout_notes", { traineeID: ID.noa }], [t.coach, "S09", "challenges", "get_current_challenge", {}],
    [t.coach, "S10", "coins", "manage_rewards", { op: "list" }], [t.coach, "S21", "progress", "get_progress_chart", { traineeID: ID.noa }],
    [t.noa, "S18", "coins", "get_balance", {}], [t.noa, "S20", "challenges", "get_current_challenge", {}], [t.noa, "S16", "feedback", "get_workout_notes", {}],
  ];
  for (const [token, caller, module, action, payload] of asked) {
    const before = Number(psql(`select count(*) from audit_entries`));
    await call(token, caller, module, action, payload);
    const ids = psql(`select count(distinct "requestID") from (select "requestID" from audit_entries order by "createdAt" desc limit ${Number(psql(`select count(*) from audit_entries`)) - before}) x`);
    assert.equal(ids, "1", `${caller} ${module}.${action}`);
  }
});

// ---- 9.4: SETTINGS at run time (CLAUDE.md rule 8) ----
test("9.4: the coins of a workout, the streak gap and the longest note follow SETTINGS, with no code change", async () => {
  const [trainee] = w.trainees;
  setting("coinsWorkout", "7");
  assert.equal((await saveWorkout(trainee)).data.feedback.coins, 7);
  setting("coinsWorkout", "12");
  assert.equal((await saveWorkout(trainee)).data.feedback.coins, 12);

  workoutDaysAgo(trainee.traineeID, trainee.workoutID, 3, [[ID.squat, 5, 60]]); // today and 3 days ago: 2 rest days between
  const streak = async () => (await call(trainee.token, "S13", "home", "get_trainee_home")).data.streak;
  setting("streakGapDays", "3");
  assert.equal(await streak(), 2);
  setting("streakGapDays", "1");
  assert.equal(await streak(), 1);

  const log = (await call(w.coachToken, "S06", "results", "list_results", { traineeID: trainee.traineeID })).data[0];
  const note = (text) => call(w.coachToken, "S06", "feedback", "add_coach_note", { workoutLogID: log.WorkoutLogID, noteText: text });
  setting("noteMaxLength", "5");
  assert.equal((await note("שש אותיות")).error.code, "NOTE_INVALID");
  setting("noteMaxLength", "50");
  assert.equal((await note("שש אותיות")).ok, true);
});

// ---- the coach scenario of the plan (task 13), through the Endpoint ----
test("the coach creates a challenge on an exercise picked from S09's list, adds a reward, sets a goal, and notes a workout", async () => {
  const [trainee] = w.trainees;
  const pick = (await call(w.coachToken, "S09", "exercises", "list_exercises")).data.find((e) => e.ExerciseID === ID.squat);
  assert.ok(pick, "S09 lists the exercises (module map v5)");
  assert.equal((await call(w.coachToken, "S09", "challenges", "create_challenge",
    { challengeName: "סקוואט 70 (test)", challengeType: "exercise", exerciseID: pick.ExerciseID, targetValue: 70 })).ok, true);
  const seen = (await call(trainee.token, "S20", "challenges", "get_current_challenge")).data;
  assert.deepEqual([seen.exerciseName, seen.progress.exempt], ["סקוואט", false]);

  const rewards = (await call(w.coachToken, "S10", "coins", "manage_rewards", { op: "add", rewardName: "חולצה (test)", priceCoins: 40 })).data.rewards;
  assert.ok(rewards.some((r) => r.rewardName === "חולצה (test)"));
  assert.ok((await call(trainee.token, "S18", "coins", "get_balance")).data.rewards.some((r) => r.rewardName === "חולצה (test)"));

  assert.equal((await call(w.coachToken, "S07", "coins", "set_personal_goal", { traineeID: trainee.traineeID, exerciseID: ID.squat, targetWeight: 75 })).ok, true);
  assert.equal((await call(trainee.token, "S18", "coins", "get_balance")).data.goal.targetWeight, 75);

  const log = (await call(w.coachToken, "S06", "results", "list_results", { traineeID: trainee.traineeID })).data[0];
  assert.equal((await call(w.coachToken, "S06", "feedback", "add_coach_note", { workoutLogID: log.WorkoutLogID, noteText: "יפה (test)" })).ok, true);
  assert.ok((await call(trainee.token, "S16", "feedback", "get_workout_notes")).data.some((n) => n.noteText === "יפה (test)"));

  const chart = (await call(w.coachToken, "S21", "progress", "get_progress_chart", { traineeID: trainee.traineeID })).data;
  assert.ok(chart.points.length >= 1);
});
