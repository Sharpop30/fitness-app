// Unit tests for M06 feedback, against an in-memory Repository (synthetic data), with the real progress and settings
// modules behind the Orchestrator. Sources: usecase-06 sections 4, 6, 13; doc-module-map v5 section 4 (the contract
// with results); stage 4b plan, decision 10; Business Logic rule 5; CLAUDE.md rule 8.
import { assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef, type Modules } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { feedback } from "../modules/feedback.ts";
import { progress } from "../modules/progress.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type CoachNote, type Exercise, StorageUnavailable, type WorkoutLog } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), TRAINEE = U(11), OTHER_TRAINEE = U(12);
const SQUAT = U(21);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const otherCoach: Actor = { role: "coach", coachID: OTHER_COACH, traineeID: null };
const trainee: Actor = { role: "trainee", coachID: COACH, traineeID: TRAINEE };
const squat: Exercise = { ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null };

const TEXTS = { feedbackFull: "כל הכבוד (test)", feedbackPartial: "עבודה טובה (test)", feedbackRecord: "שיא (test)", noteMaxLength: "20" };

let seq = 600;
const log = (traineeID: string, performedAt: string, sets: [weight: number, isDone: boolean][]): WorkoutLog => ({
  WorkoutLogID: U(seq++), TraineeID: traineeID, WorkoutID: U(41), workoutName: "אימון A", performedAt,
  sets: sets.map(([weight, isDone], i) =>
    ({ SetResultID: U(seq++), ExerciseID: SQUAT, setNumber: i + 1, reps: 8, weight, isDone, isCorrected: false, exerciseName: "סקוואט" })),
});

function world(logs: WorkoutLog[], opts: { settings?: Record<string, string>; storageDown?: boolean } = {}) {
  const notes: (CoachNote & { CoachID: string })[] = [];
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const w = fakeRepo({
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [TRAINEE, OTHER_TRAINEE].includes(t)),
    getWorkoutLog: async (id) => (down(), structuredClone(logs.find((l) => l.WorkoutLogID === id) ?? null)),
    listResults: async (t) => (down(), structuredClone(logs.filter((l) => l.TraineeID === t))),
    getExercisesByID: async () => (down(), [squat]),
    getCoachSettings: async () => (down(), opts.settings ?? TEXTS),
    addCoachNote: async (WorkoutLogID, CoachID, noteText) => { down(); notes.push({ WorkoutLogID, CoachID, noteText, createdAt: "2026-09-28" }); },
    listCoachNotes: async (t) => (down(), notes.filter((n) => logs.find((l) => l.WorkoutLogID === n.WorkoutLogID)?.TraineeID === t)),
  });
  return { ...w, notes };
}

const ask = (w: ReturnType<typeof world>, actor: Actor, caller: string, action: string, payload: Record<string, unknown>, extra: Modules = {}) =>
  handle({ caller, module: "feedback", action, payload }, actor, w.repo, { feedback, progress, settings, ...extra });
const build = (w: ReturnType<typeof world>, l: WorkoutLog, extra: Modules = {}) =>
  ask(w, trainee, "M04", "build_feedback", { workoutLogID: l.WorkoutLogID, traineeID: l.TraineeID }, extra);

// ---- build_feedback (UC6 steps 1-5) ----

Deno.test("UC6 step 5: a workout done in full gets the coach's full text, with no records", async () => {
  const today = log(TRAINEE, "2026-09-28", [[60, true], [60, true]]);
  const w = world([log(TRAINEE, "2026-09-20", [[60, true]]), today]);
  assertEquals(await build(w, today), ok({ records: [], text: "כל הכבוד (test)" }));
});

Deno.test("UC6 a: a partial workout gets the encouraging partial text", async () => {
  const today = log(TRAINEE, "2026-09-28", [[60, true], [60, false]]);
  const w = world([log(TRAINEE, "2026-09-20", [[60, true]]), today]);
  assertEquals(await build(w, today), ok({ records: [], text: "עבודה טובה (test)" }));
});

Deno.test("UC6 section 13: a record is named, with the record text (through progress.detect_personal_records)", async () => {
  const today = log(TRAINEE, "2026-09-28", [[70, true], [60, false]]);
  const w = world([log(TRAINEE, "2026-09-20", [[65, true]]), today]);
  assertEquals(await build(w, today), ok({ records: ["סקוואט"], text: "שיא (test)" }));
  // Feedback asked progress through the Orchestrator: a request row and a reply row, with the same requestID.
  const rows = w.audits.filter((a) => a.caller === "M06" && a.moduleName === "progress");
  assertEquals(rows.length, 2);
  assertEquals(new Set(w.audits.map((a) => a.requestID)).size, 1);
});

Deno.test("UC6 section 7: when progress fails, the feedback still answers, without records", async () => {
  const today = log(TRAINEE, "2026-09-28", [[70, true]]);
  const w = world([log(TRAINEE, "2026-09-20", [[65, true]]), today]);
  const broken: ModuleDef = { id: "M05", actions: { detect_personal_records: async () => fail("STORAGE_UNAVAILABLE") } };
  assertEquals(await build(w, today, { progress: broken }), ok({ records: [], text: "כל הכבוד (test)" }));
});

Deno.test("UC6 d, decision 10: a text missing from SETTINGS is VALUE_NOT_SET, never a text made up in code", async () => {
  const today = log(TRAINEE, "2026-09-28", [[60, true]]);
  assertEquals(await build(world([today], { settings: { feedbackPartial: "x" } }), today), fail("VALUE_NOT_SET"));
  assertEquals(await build(world([today], { settings: { feedbackFull: "  " } }), today), fail("VALUE_NOT_SET"));
});

Deno.test("rule 5: feedback on another trainee's workout is NOT_ALLOWED", async () => {
  const theirs = log(OTHER_TRAINEE, "2026-09-28", [[60, true]]);
  const w = world([theirs]);
  assertEquals(await ask(w, trainee, "M04", "build_feedback", { workoutLogID: theirs.WorkoutLogID, traineeID: TRAINEE }), fail("NOT_ALLOWED"));
});

// ---- add_coach_note and get_workout_notes (UC6 steps 7-9) ----

Deno.test("UC6 section 13: a coach's note is seen by the trainee, and by the coach", async () => {
  const l = log(TRAINEE, "2026-09-28", [[60, true]]);
  const w = world([l]);
  assertEquals(await ask(w, coach, "S06", "add_coach_note", { workoutLogID: l.WorkoutLogID, noteText: "  שיא יפה  " }), ok(null));
  assertEquals(w.notes[0].noteText, "שיא יפה");
  assertEquals(w.notes[0].CoachID, COACH);
  const expected = ok([{ WorkoutLogID: l.WorkoutLogID, noteText: "שיא יפה" }]);
  assertEquals(await ask(w, trainee, "S16", "get_workout_notes", {}), expected);
  assertEquals(await ask(w, coach, "S06", "get_workout_notes", { traineeID: TRAINEE }), expected);
});

Deno.test("UC6 b: an empty note, or one longer than noteMaxLength from SETTINGS, is NOTE_INVALID and not saved", async () => {
  const l = log(TRAINEE, "2026-09-28", [[60, true]]);
  const w = world([l]);
  assertEquals(await ask(w, coach, "S06", "add_coach_note", { workoutLogID: l.WorkoutLogID, noteText: "   " }), fail("NOTE_INVALID"));
  assertEquals(await ask(w, coach, "S06", "add_coach_note", { workoutLogID: l.WorkoutLogID, noteText: "x".repeat(21) }), fail("NOTE_INVALID"));
  assertEquals(await ask(w, coach, "S06", "add_coach_note", { workoutLogID: l.WorkoutLogID, noteText: "x".repeat(20) }), ok(null));
  assertEquals(w.notes.length, 1);
});

Deno.test("rule 8: noteMaxLength missing from SETTINGS is VALUE_NOT_SET", async () => {
  const l = log(TRAINEE, "2026-09-28", [[60, true]]);
  assertEquals(await ask(world([l], { settings: {} }), coach, "S06", "add_coach_note", { workoutLogID: l.WorkoutLogID, noteText: "טוב" }), fail("VALUE_NOT_SET"));
});

Deno.test("rule 5: a note by another coach, and notes of another trainee, are NOT_ALLOWED", async () => {
  const l = log(TRAINEE, "2026-09-28", [[60, true]]);
  const w = world([l]);
  assertEquals(await ask(w, otherCoach, "S06", "add_coach_note", { workoutLogID: l.WorkoutLogID, noteText: "טוב" }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "S16", "get_workout_notes", { traineeID: OTHER_TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, otherCoach, "S06", "get_workout_notes", { traineeID: TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(w.notes.length, 0);
});

Deno.test("the database failing gives STORAGE_UNAVAILABLE, without throwing", async () => {
  const l = log(TRAINEE, "2026-09-28", [[60, true]]);
  assertEquals(await ask(world([l], { storageDown: true }), trainee, "S16", "get_workout_notes", {}), fail("STORAGE_UNAVAILABLE"));
});
