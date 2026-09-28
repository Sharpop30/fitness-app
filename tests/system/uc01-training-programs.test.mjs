// System Test, usecase-01 end to end (doc-module-map section 6): norm, edge, failure, against the LOCAL stack.
// The coach works on S04, the trainee reads on S14, both through the one Endpoint.
// Norm and edge use Maya (no program in the demo data) and Itai; the history check uses Noa and restores her program.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, ID, lastAudit, psql, strangerCoachToken } from "./demo-users.mjs";

let t, stranger;
before(async () => {
  t = await demoTokens();
  stranger = await strangerCoachToken();
});
const coach = (action, payload) => call(t.coach, "S04", "programs", action, payload);
const mayaSees = () => call(t.maya, "S14", "programs", "get_active_program");

// ---- norm ----
test("norm: the coach builds and saves a program, and the trainee sees it", async () => {
  assert.equal((await coach("get_active_program", { traineeID: ID.maya })).error.code, "NO_ACTIVE_PROGRAM");
  assert.equal((await coach("start_new_program", { traineeID: ID.maya })).ok, true);
  const draft = (await coach("get_active_program", { traineeID: ID.maya })).data;
  assert.deepEqual(draft.workouts.map((w) => [w.workoutName, w.items.length]), [["אימון A", 0]]);

  const workouts = [
    { ...draft.workouts[0], items: [
      { WorkoutItemID: "new1", ExerciseID: ID.squat, targetSets: 3, targetReps: 10, targetWeight: 40 },
      { WorkoutItemID: "new2", ExerciseID: ID.pushup, targetSets: 3, targetReps: 12, targetWeight: 0 }] },
    { WorkoutID: "wNew", workoutName: "אימון B", items: [
      { WorkoutItemID: "new3", ExerciseID: ID.row, targetSets: 4, targetReps: 8, targetWeight: 30 }] },
  ];
  assert.equal((await coach("save_program", { traineeID: ID.maya, workouts })).ok, true);

  const seen = (await mayaSees()).data;
  assert.deepEqual(seen.workouts.map((w) => [w.workoutName, w.items.map((i) => [i.exerciseName, i.targetSets, i.targetReps, i.targetWeight])]), [
    ["אימון A", [["סקוואט", 3, 10, 40], ["שכיבות סמיכה", 3, 12, 0]]],
    ["אימון B", [["חתירה בכבל", 4, 8, 30]]],
  ]);
});

test("norm: the coach swaps an exercise, and the trainee sees the new one in the same place", async () => {
  const before = (await mayaSees()).data.workouts[0].items;
  const r = await coach("swap_exercise", { traineeID: ID.maya, workoutItemID: before[0].WorkoutItemID, exerciseID: ID.lunge });
  assert.equal(r.ok, true);
  const after = (await mayaSees()).data.workouts[0].items;
  assert.deepEqual(after.map((i) => [i.WorkoutItemID, i.sortOrder, i.exerciseName]),
    [[before[0].WorkoutItemID, 0, "מכרעים"], [before[1].WorkoutItemID, 1, "שכיבות סמיכה"]]);
});

test("norm: swapping an exercise that has results leaves the results in the history", async () => {
  const count = () => psql(`select count(*) || ':' || sum("weight") from set_results where "ExerciseID"='${ID.squat}'`);
  const results = count();
  assert.equal((await coach("swap_exercise", { traineeID: ID.noa, workoutItemID: ID.noaSquatItem, exerciseID: ID.lunge })).ok, true);
  assert.equal(count(), results);
  assert.equal((await coach("swap_exercise", { traineeID: ID.noa, workoutItemID: ID.noaSquatItem, exerciseID: ID.squat })).ok, true);
});

// ---- edge ----
test("edge a: a trainee with no program is told it is being prepared (NO_ACTIVE_PROGRAM)", async () => {
  // The coach's view of this case opens the norm test; here, the trainee's own view (test-only direct update).
  psql(`update programs set "isActive"=false where "TraineeID"='${ID.maya}'`);
  assert.equal((await mayaSees()).error.code, "NO_ACTIVE_PROGRAM");
  psql(`update programs set "isActive"=true where "ProgramID"=(select "ProgramID" from programs where "TraineeID"='${ID.maya}' order by "createdAt" desc limit 1)`);
});

test("edge e: a new program replaces the active one; the old one is kept inactive with its workouts", async () => {
  const old = (await coach("get_active_program", { traineeID: ID.itai })).data;
  assert.equal((await coach("start_new_program", { traineeID: ID.itai })).ok, true);
  const now = (await coach("get_active_program", { traineeID: ID.itai })).data;
  assert.notEqual(now.ProgramID, old.ProgramID);
  assert.deepEqual(now.inactive.map((x) => x.programName), ["תוכנית אימון"]);
  assert.equal(psql(`select count(*) from programs where "TraineeID"='${ID.itai}' and "isActive"`), "1");
  assert.equal(psql(`select count(*) from workout_items wi join workouts w using ("WorkoutID") where w."ProgramID"='${old.ProgramID}'`), "2");
});

// ---- failure ----
test("failure b: a missing or negative target stops the save with PROGRAM_INVALID, and nothing is saved", async () => {
  const before = JSON.stringify((await mayaSees()).data.workouts);
  const workouts = (await mayaSees()).data.workouts;
  workouts[0].items[0].targetSets = 0;
  assert.equal((await coach("save_program", { traineeID: ID.maya, workouts })).error.code, "PROGRAM_INVALID");
  workouts[0].items[0].targetSets = 3;
  workouts[1].items[0].targetWeight = -10;
  assert.equal((await coach("save_program", { traineeID: ID.maya, workouts })).error.code, "PROGRAM_INVALID");
  assert.equal(JSON.stringify((await mayaSees()).data.workouts), before);
  assert.deepEqual(lastAudit("S04", "save_program"), ["true:-", "false:PROGRAM_INVALID"]);
});

test("failure d: a coach who is not the trainee's coach is refused with NOT_ALLOWED, and it is logged", async () => {
  const r = await call(stranger, "S04", "programs", "get_active_program", { traineeID: ID.noa });
  assert.deepEqual(r, { ok: false, data: null, error: { code: "NOT_ALLOWED" } });
  assert.deepEqual(lastAudit("S04", "get_active_program"), ["true:-", "false:NOT_ALLOWED"]);
  assert.equal((await call(stranger, "S04", "programs", "start_new_program", { traineeID: ID.noa })).error.code, "NOT_ALLOWED");
  assert.equal(psql(`select "ProgramID" from programs where "TraineeID"='${ID.noa}' and "isActive"`), ID.noaProgram);
});

// failure c (the database not answering) is covered at Unit level: programs.test.ts, "UC1 c".
