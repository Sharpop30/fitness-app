// System test, usecase-05 progress chart and personal record (requirement 4), end to end through the one Endpoint
// against the LOCAL stack. Clusters (doc-module-map section 6): normal, edge (a, b), failure (d).
// Data: a fresh coach and trainees marked "(test)" (stage 4b plan, decision 9).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, lastAudit, workoutDaysAgo } from "./demo-users.mjs";

let w;
before(async () => { await demoTokens(); w = await freshWorld(3); });

test("normal: the coach and the trainee see the same chart of the top weight per workout, oldest first", async () => {
  const [t] = w.trainees;
  workoutDaysAgo(t.traineeID, t.workoutID, 9, [[ID.squat, 5, 60], [ID.squat, 5, 60]]);
  workoutDaysAgo(t.traineeID, t.workoutID, 5, [[ID.squat, 5, 62.5], [ID.squat, 3, 80, false]]); // a set not done does not count
  workoutDaysAgo(t.traineeID, t.workoutID, 1, [[ID.squat, 5, 65]]);
  const mine = await call(t.token, "S21", "progress", "get_progress_chart", {});
  const coach = await call(w.coachToken, "S21", "progress", "get_progress_chart", { traineeID: t.traineeID });
  assert.equal(mine.ok, true);
  assert.deepEqual(coach.data, mine.data);
  assert.equal(mine.data.selected, ID.squat);
  // The record is the highest point, which S21 marks.
  assert.deepEqual(mine.data.points.map((p) => p.value), [60, 62.5, 65]);
});

test("normal: a corrected result changes the chart (UC5 section 13)", async () => {
  const [t] = w.trainees;
  const before = (await call(t.token, "S21", "progress", "get_progress_chart", {})).data.points.at(-1).value;
  const log = (await call(t.token, "S16", "results", "list_results")).data[0];
  const sets = log.sets.map((s) => ({ ...s, weight: s.weight + 5 }));
  assert.equal((await call(t.token, "S16", "results", "correct_result", { workoutLogID: log.WorkoutLogID, sets })).ok, true);
  const after = (await call(t.token, "S21", "progress", "get_progress_chart", {})).data.points.at(-1).value;
  assert.equal(after, before + 5);
});

test("edge a: a trainee with no workouts gets an empty chart, for the screen's first-workouts message", async () => {
  const r = await call(w.trainees[1].token, "S21", "progress", "get_progress_chart", {});
  assert.deepEqual(r.data, { exercises: [], selected: null, isBodyweight: false, points: [] });
});

test("edge b: a bodyweight exercise is charted in reps (team decision)", async () => {
  const t = w.trainees[2];
  workoutDaysAgo(t.traineeID, t.workoutID, 3, [[ID.pushup, 10, 0], [ID.pushup, 12, 0]]);
  workoutDaysAgo(t.traineeID, t.workoutID, 1, [[ID.pushup, 15, 0]]);
  const r = await call(t.token, "S21", "progress", "get_progress_chart", { exerciseID: ID.pushup });
  assert.equal(r.data.isBodyweight, true);
  assert.deepEqual(r.data.points.map((p) => p.value), [12, 15]);
});

test("failure d: a trainee asking for another trainee's chart is refused and logged, NOT_ALLOWED", async () => {
  const r = await call(w.trainees[1].token, "S21", "progress", "get_progress_chart", { traineeID: w.trainees[0].traineeID });
  assert.equal(r.error.code, "NOT_ALLOWED");
  assert.deepEqual(lastAudit("S21", "get_progress_chart"), ["true:-", "false:NOT_ALLOWED"]);
});
