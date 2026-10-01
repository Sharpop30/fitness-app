// System test, usecase-06 instant feedback and a coach's note (requirement 21), end to end through the one Endpoint
// against the LOCAL stack. Clusters (doc-module-map section 6): normal, edge (a), failure (b).
// Data: a fresh coach and trainee marked "(test)" (stage 4b plan, decision 9).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, lastAudit, psql, workoutDaysAgo } from "./demo-users.mjs";

let w, t;
const text = (key) => psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey"='${key}'`);
// The sets as S14 fills them in, with an optional change per set.
const asPlanned = async (change = (s) => s) => {
  const workout = (await call(t.token, "S14", "programs", "get_active_program")).data.workouts[0];
  return workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, n) =>
    change({ ExerciseID: i.ExerciseID, setNumber: n + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true })));
};
const save = async (sets) => call(t.token, "S14", "results", "log_workout", { workoutID: t.workoutID, sets });

before(async () => { await demoTokens(); w = await freshWorld(1); [t] = w.trainees; });

test("normal: saving a workout shows the feedback at once, with the sets done and the coins", async () => {
  workoutDaysAgo(t.traineeID, t.workoutID, 3, [[ID.squat, 5, 60], [ID.pushup, 10, 0]]);
  const r = await save(await asPlanned());
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.feedback, {
    done: 5, total: 5, records: [], coins: Number(text("coinsWorkout")), goal: false, challenge: false, text: text("feedbackFull"),
  });
});

test("normal: breaking a record is highlighted, with the record text", async () => {
  const r = await save(await asPlanned((s) => (s.ExerciseID === ID.squat ? { ...s, weight: 70 } : s)));
  assert.deepEqual(r.data.feedback.records, ["סקוואט"]);
  assert.equal(r.data.feedback.text, text("feedbackRecord"));
});

test("edge a: a partial workout gets the partial text", async () => {
  const r = await save(await asPlanned((s) => (s.ExerciseID === ID.pushup && s.setNumber === 2 ? { ...s, isDone: false } : s)));
  assert.deepEqual([r.data.feedback.done, r.data.feedback.total], [4, 5]);
  assert.equal(r.data.feedback.text, text("feedbackPartial"));
});

test("normal: the coach's note on a workout is seen by the trainee", async () => {
  const log = (await call(w.coachToken, "S06", "results", "list_results", { traineeID: t.traineeID })).data[0];
  const r = await call(w.coachToken, "S06", "feedback", "add_coach_note", { workoutLogID: log.WorkoutLogID, noteText: "שמור על הגב (test)" });
  assert.equal(r.ok, true);
  const notes = await call(t.token, "S16", "feedback", "get_workout_notes");
  assert.deepEqual(notes.data, [{ WorkoutLogID: log.WorkoutLogID, noteText: "שמור על הגב (test)" }]);
  // Step 9 and UC9 v3 step 2 (stage 4c): the note also reaches the trainee's home as a message.
  const messages = await call(t.token, "S13", "notifications", "list_notifications");
  assert.deepEqual(messages.data.map((m) => m.messageText), ["המאמן הוסיף הערה לאימון שלך"]);
});

test("failure b: an empty note, or one longer than noteMaxLength, is NOTE_INVALID, logged, and not saved", async () => {
  const log = (await call(w.coachToken, "S06", "results", "list_results", { traineeID: t.traineeID })).data[0];
  const max = Number(text("noteMaxLength"));
  for (const noteText of ["   ", "x".repeat(max + 1)]) {
    const r = await call(w.coachToken, "S06", "feedback", "add_coach_note", { workoutLogID: log.WorkoutLogID, noteText });
    assert.equal(r.error.code, "NOTE_INVALID");
    // The request and the reply; for the long note, the settings request for noteMaxLength sits between them.
    const rows = lastAudit("S06", "add_coach_note");
    assert.deepEqual([rows[0], rows.at(-1)], ["true:-", "false:NOTE_INVALID"]);
  }
  assert.equal((await call(t.token, "S16", "feedback", "get_workout_notes")).data.length, 1);
});
