// Stage 3 Integration (doc-module-map section 6): the programs and exercises actions through the envelope,
// the Registry and the Audit Log, against the LOCAL stack with the demo data. Read-only except one save of the same program.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, demoTokens, freshWorld, ID, lastAudit, psql } from "../system/demo-users.mjs";

let t;
before(async () => { t = await demoTokens(); });

test("every programs action and exercises.list_exercises passes the envelope and leaves two audit rows", async () => {
  // A fresh world "(test)" (stage 7b, task 15): Noa's demo program changes across runs of other tests on one database.
  const w = await freshWorld(1), [a] = w.trainees;
  const program = await call(w.coachToken, "S04", "programs", "get_active_program", { traineeID: a.traineeID });
  assert.equal(program.ok, true);
  assert.deepEqual(lastAudit("S04", "get_active_program"), ["true:-", "true:-"]);

  const list = await call(w.coachToken, "S04", "exercises", "list_exercises");
  assert.equal(list.ok, true);
  assert.equal(list.data.filter((e) => e.isPrepared).length, 8); // the ready-made list; tests add exercises of the coach (map v13.1)
  assert.deepEqual(lastAudit("S04", "list_exercises"), ["true:-", "true:-"]);

  const save = await call(w.coachToken, "S04", "programs", "save_program", { traineeID: a.traineeID, workouts: program.data.workouts });
  assert.deepEqual(save, { ok: true, data: null, error: null });
  assert.deepEqual(lastAudit("S04", "save_program"), ["true:-", "true:-"]);

  const second = program.data.workouts[0].items[1].WorkoutItemID; // the second item, sortOrder 1
  const swap = await call(w.coachToken, "S04", "programs", "swap_exercise", { traineeID: a.traineeID, workoutItemID: second, exerciseID: ID.bench });
  assert.equal(swap.ok, true);
  assert.equal(swap.data.sortOrder, 1);
  assert.deepEqual(lastAudit("S04", "swap_exercise"), ["true:-", "true:-"]);
});

test("the reply follows the map: workouts with items carrying exerciseName and hasVideo, and inactive", async () => {
  const r = await call(t.coach, "S04", "programs", "get_active_program", { traineeID: ID.noa });
  assert.deepEqual(r.data.workouts.map((w) => w.workoutName), ["אימון A", "אימון B"]);
  assert.deepEqual(Object.keys(r.data.workouts[0].items[0]).sort(),
    ["ExerciseID", "WorkoutItemID", "exerciseName", "hasVideo", "sortOrder", "targetReps", "targetSets", "targetWeight"]);
  assert.deepEqual(r.data.inactive.map((x) => x.programName), ["תוכנית קודמת"]);
});

test("S14: a trainee gets their own program, and NOT_ALLOWED for someone else's, logged", async () => {
  const own = await call(t.noa, "S14", "programs", "get_active_program");
  assert.equal(own.data.TraineeID, ID.noa);
  const other = await call(t.noa, "S14", "programs", "get_active_program", { traineeID: ID.itai });
  assert.deepEqual(other, { ok: false, data: null, error: { code: "NOT_ALLOWED" } });
  assert.deepEqual(lastAudit("S14", "get_active_program"), ["true:-", "false:NOT_ALLOWED"]);
});

test("no Registry row: S05 saving a program, and a trainee on S04, get ACTION_NOT_ALLOWED", async () => {
  const s05 = await call(t.coach, "S05", "programs", "save_program", { traineeID: ID.noa, workouts: [] });
  assert.equal(s05.error.code, "ACTION_NOT_ALLOWED");
  const s04 = await call(t.noa, "S04", "programs", "save_program", { traineeID: ID.noa, workouts: [] });
  assert.equal(s04.error.code, "ACTION_NOT_ALLOWED");
});

test("a malformed trainee ID is NOT_ALLOWED, not a database error", async () => {
  const r = await call(t.coach, "S04", "programs", "get_active_program", { traineeID: "t1" });
  assert.equal(r.error.code, "NOT_ALLOWED");
});

test("the program functions are closed to the browser: the public key cannot call them", async () => {
  const res = await fetch(`${API}/rest/v1/rpc/program_start_new`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_trainee: ID.noa, p_program_name: "x", p_workout_name: "x" }),
  });
  assert.notEqual(res.status, 200);
  assert.equal(psql(`select count(*) from programs where "TraineeID"='${ID.noa}' and "isActive"`), "1");
  assert.equal(psql(`select "ProgramID" from programs where "TraineeID"='${ID.noa}' and "isActive"`), ID.noaProgram);
});
