// System Test, usecase-03 end to end (doc-module-map section 6; stage 4a plan, task 7): norm, edge, failure,
// against the LOCAL stack. The trainee saves on S14 and corrects on S16; the coach reads on S06; one Endpoint.
// Noa logs on her active program; the "no program" case switches Maya's off and back, test-only, as uc01 does.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, ID, psql } from "./demo-users.mjs";

let t;
before(async () => { t = await demoTokens(); });

// S14 fills every set from the target (UC3 step 3).
async function planned(workoutID = ID.noaWorkoutB) {
  const program = await call(t.noa, "S14", "programs", "get_active_program");
  const workout = program.data.workouts.find((w) => w.WorkoutID === workoutID);
  return workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, s) =>
    ({ ExerciseID: i.ExerciseID, setNumber: s + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true, isCorrected: false })));
}
const save = (sets, workoutID = ID.noaWorkoutB) => call(t.noa, "S14", "results", "log_workout", { workoutID, sets });
const coachSees = async (logID) =>
  (await call(t.coach, "S06", "results", "list_results", { traineeID: ID.noa })).data.find((l) => l.WorkoutLogID === logID);
const logCount = () => psql(`select count(*) from workout_logs where "TraineeID"='${ID.noa}'`);
const coinRows = () => psql(`select count(*) from coin_transactions where "TraineeID"='${ID.noa}'`);

// ---- norm ----
test("norm: a workout done as planned is saved in one request, and the coach sees it with the date", async () => {
  const sets = await planned();
  const r = await save(sets);
  assert.equal(r.ok, true);
  assert.deepEqual([r.data.feedback.done, r.data.feedback.total], [sets.length, sets.length]);
  const seen = await coachSees(r.data.WorkoutLogID);
  assert.equal(seen.workoutName, "אימון B");
  assert.equal(new Date(seen.performedAt).toDateString(), new Date().toDateString());
  assert.deepEqual(seen.sets.map((s) => [s.ExerciseID, s.setNumber, s.reps, s.weight]), sets.map((s) => [s.ExerciseID, s.setNumber, s.reps, s.weight]));
});

// ---- edge ----
test("edge a: an exercise not done is kept as not done, and the feedback counts the sets done", async () => {
  const sets = await planned();
  const skipped = sets[0].ExerciseID;
  for (const s of sets) if (s.ExerciseID === skipped) s.isDone = false;
  const r = await save(sets);
  const notDone = sets.filter((s) => !s.isDone).length;
  assert.deepEqual([r.data.feedback.done, r.data.feedback.total], [sets.length - notDone, sets.length]);
  const seen = await coachSees(r.data.WorkoutLogID);
  assert.deepEqual(seen.sets.filter((s) => !s.isDone).map((s) => s.ExerciseID), Array(notDone).fill(skipped));
});

test("edge e: a correction after the coach saw the result shows the new value, marked, and the coins do not change", async () => {
  const r = await save(await planned());
  const first = await coachSees(r.data.WorkoutLogID);
  assert.equal(first.sets.some((s) => s.isCorrected), false);

  const mine = (await call(t.noa, "S16", "results", "list_results")).data.find((l) => l.WorkoutLogID === r.data.WorkoutLogID);
  const sets = structuredClone(mine.sets);
  sets[1].reps += 2;
  const coins = coinRows();
  assert.equal((await call(t.noa, "S16", "results", "correct_result", { workoutLogID: r.data.WorkoutLogID, sets })).ok, true);

  const after = await coachSees(r.data.WorkoutLogID);
  assert.deepEqual(after.sets.map((s) => [s.reps, s.isCorrected]), first.sets.map((s, i) => (i === 1 ? [s.reps + 2, true] : [s.reps, false])));
  assert.equal(coinRows(), coins);
});

// ---- failure ----
test("failure b: a negative or non-numeric value stops the save with RESULT_INVALID, and nothing is saved", async () => {
  const before = logCount();
  for (const over of [{ weight: -10 }, { reps: "שמונה" }, { reps: null }]) {
    const sets = await planned();
    Object.assign(sets[0], over);
    assert.equal((await save(sets)).error.code, "RESULT_INVALID");
  }
  assert.equal(logCount(), before);
});

test("failure d: a workout outside the active program, or a trainee with no program, is NO_ACTIVE_PROGRAM", async () => {
  const before = logCount();
  assert.equal((await save(await planned(), "d0000000-0000-4000-8000-000000004003")).error.code, "NO_ACTIVE_PROGRAM"); // Itai's workout
  assert.equal(logCount(), before);

  // Maya has no program in the demo data; uc01 may have given her one, so switch it off for this check (test-only).
  const active = psql(`select "ProgramID" from programs where "TraineeID"='${ID.maya}' and "isActive"`);
  if (active) psql(`update programs set "isActive"=false where "ProgramID"='${active}'`);
  const r = await call(t.maya, "S14", "results", "log_workout", { workoutID: ID.noaWorkoutB, sets: [{ ExerciseID: ID.squat, setNumber: 1, reps: 8, weight: 60, isDone: true }] });
  if (active) psql(`update programs set "isActive"=true where "ProgramID"='${active}'`);
  assert.equal(r.error.code, "NO_ACTIVE_PROGRAM");
});
