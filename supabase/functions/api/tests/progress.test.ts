// Unit tests for M05 progress, against an in-memory Repository (synthetic data), with the real settings module
// behind the Orchestrator. Sources: usecase-05 sections 4, 6, 13; usecase-06 step 3; usecase-09 step 4, alternative b,
// section 13; doc-module-map v5 section 4 (detect_personal_records); Business Logic rules 5, 7, 8.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail } from "../errors.ts";
import { progress } from "../modules/progress.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type Exercise, StorageUnavailable, type WorkoutLog } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), TRAINEE = U(11), OTHER_TRAINEE = U(12);
const SQUAT = U(21), PUSHUP = U(22), BENCH = U(23);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const otherCoach: Actor = { role: "coach", businessID: OTHER_COACH, coachID: OTHER_COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: TRAINEE };

const exercises: Exercise[] = [
  { ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null },
  { ExerciseID: PUSHUP, exerciseName: "שכיבות סמיכה", isBodyweight: true, videoType: null, videoUrl: null },
  { ExerciseID: BENCH, exerciseName: "לחיצת חזה", isBodyweight: false, videoType: null, videoUrl: null },
];
const nameOf = (id: string) => exercises.find((e) => e.ExerciseID === id)!.exerciseName;

// Noon in Israel, n days before today in Israel, so day counting does not depend on the hour the test runs.
const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const daysAgo = (n: number) => `${ISRAEL_DAY.format(new Date(Date.now() - n * 86_400_000))}T09:00:00+00:00`;

type S = [exerciseID: string, reps: number, weight: number, isDone?: boolean];
let seq = 500;
const log = (traineeID: string, ago: number, sets: S[]): WorkoutLog => ({
  WorkoutLogID: U(seq++), TraineeID: traineeID, WorkoutID: U(41), workoutName: "אימון A", performedAt: daysAgo(ago),
  sets: sets.map(([ExerciseID, reps, weight, isDone = true], i) =>
    ({ SetResultID: U(seq++), ExerciseID, setNumber: i + 1, reps, weight, isDone, isCorrected: false, exerciseName: nameOf(ExerciseID) })),
});

function world(logs: WorkoutLog[], opts: { settings?: Record<string, string>; storageDown?: boolean } = {}) {
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const newestFirst = (a: WorkoutLog, b: WorkoutLog) => b.performedAt.localeCompare(a.performedAt);
  return fakeRepo({
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [TRAINEE, OTHER_TRAINEE].includes(t)),
    listResults: async (t) => (down(), structuredClone(logs.filter((l) => l.TraineeID === t).sort(newestFirst))),
    getWorkoutLog: async (id) => (down(), structuredClone(logs.find((l) => l.WorkoutLogID === id) ?? null)),
    getExercisesByID: async (ids) => (down(), exercises.filter((e) => ids.includes(e.ExerciseID))),
    getBusinessSettings: async () => (down(), opts.settings ?? { streakGapDays: "3" }),
  });
}

const ask = (w: ReturnType<typeof world>, actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}) =>
  handle({ caller, module: "progress", action, payload }, actor, w.repo, { progress, settings });
const chart = (w: ReturnType<typeof world>, actor: Actor, payload: Record<string, unknown> = {}) => ask(w, actor, "S21", "get_progress_chart", payload);
const records = (w: ReturnType<typeof world>, workoutLogID: string) =>
  ask(w, trainee, "M06", "detect_personal_records", { workoutLogID, traineeID: TRAINEE });
const streak = (w: ReturnType<typeof world>, actor: Actor = trainee) => ask(w, actor, "M13", "get_streak", { traineeID: TRAINEE });

// ---- get_progress_chart (UC5) ----

Deno.test("UC5 steps 3-5: the top weight of each workout, oldest first; a set not done does not count", async () => {
  const w = world([
    log(TRAINEE, 7, [[SQUAT, 8, 60], [SQUAT, 8, 62.5]]),
    log(TRAINEE, 2, [[SQUAT, 8, 65], [SQUAT, 3, 90, false]]),
  ]);
  const r = await chart(w, trainee);
  assertEquals(r.ok, true);
  const d = r.data as { selected: string; isBodyweight: boolean; points: { value: number }[] };
  assertEquals(d.selected, SQUAT);
  assertEquals(d.isBodyweight, false);
  assertEquals(d.points.map((p) => p.value), [62.5, 65]);
});

Deno.test("UC5 section 13: the coach sees the same chart as the trainee", async () => {
  const w = world([log(TRAINEE, 3, [[SQUAT, 8, 60]]), log(TRAINEE, 1, [[SQUAT, 8, 65]])]);
  const byTrainee = await chart(w, trainee);
  const byCoach = await chart(w, coach, { traineeID: TRAINEE });
  assertEquals(byCoach, byTrainee);
});

Deno.test("UC5 section 13: an exercise swapped out keeps its history in the chart", async () => {
  const w = world([log(TRAINEE, 9, [[BENCH, 8, 40]]), log(TRAINEE, 1, [[SQUAT, 8, 60]])]);
  const d = (await chart(w, trainee)).data as { exercises: { ExerciseID: string }[] };
  assertEquals(d.exercises.map((e) => e.ExerciseID), [SQUAT, BENCH]);
  const bench = (await chart(w, trainee, { exerciseID: BENCH })).data as { selected: string; points: { value: number }[] };
  assertEquals(bench.selected, BENCH);
  assertEquals(bench.points.map((p) => p.value), [40]);
});

Deno.test("UC5 step 2: by default the first exercise of the latest workout; an unknown exercise falls back to it", async () => {
  const w = world([log(TRAINEE, 1, [[BENCH, 8, 40], [SQUAT, 8, 60]])]);
  assertEquals(((await chart(w, trainee)).data as { selected: string }).selected, BENCH);
  assertEquals(((await chart(w, trainee, { exerciseID: U(99) })).data as { selected: string }).selected, BENCH);
});

Deno.test("UC5 b: a bodyweight exercise is charted in reps", async () => {
  const w = world([log(TRAINEE, 4, [[PUSHUP, 10, 0], [PUSHUP, 12, 0]]), log(TRAINEE, 1, [[PUSHUP, 15, 0]])]);
  const d = (await chart(w, trainee)).data as { isBodyweight: boolean; points: { value: number }[] };
  assertEquals(d.isBodyweight, true);
  assertEquals(d.points.map((p) => p.value), [12, 15]);
});

Deno.test("UC5 a: no workouts yet gives an empty chart", async () => {
  const r = await chart(world([]), trainee);
  assertEquals(r.data, { exercises: [], selected: null, isBodyweight: false, points: [] });
});

Deno.test("UC5 d, rule 5: a trainee asking for another's chart, and a coach for another coach's trainee, get NOT_ALLOWED", async () => {
  const w = world([log(OTHER_TRAINEE, 1, [[SQUAT, 8, 60]])]);
  assertEquals(await chart(w, trainee, { traineeID: OTHER_TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await chart(w, otherCoach, { traineeID: TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await chart(w, coach, {}), fail("NOT_ALLOWED"));
});

Deno.test("UC5 c: the database failing gives STORAGE_UNAVAILABLE, without throwing", async () => {
  assertEquals(await chart(world([], { storageDown: true }), trainee), fail("STORAGE_UNAVAILABLE"));
});

// ---- detect_personal_records (UC6 step 3; module map v5) ----

Deno.test("UC6 step 3: beating every earlier workout in an exercise is a record; equal is not", async () => {
  const today = log(TRAINEE, 0, [[SQUAT, 8, 70], [BENCH, 8, 40]]);
  const w = world([log(TRAINEE, 6, [[SQUAT, 8, 60], [BENCH, 8, 40]]), log(TRAINEE, 3, [[SQUAT, 8, 65]]), today]);
  assertEquals((await records(w, today.WorkoutLogID)).data, { records: ["סקוואט"] });
});

Deno.test("module map v5: the first workout in an exercise is not a record", async () => {
  const today = log(TRAINEE, 0, [[SQUAT, 8, 100]]);
  assertEquals((await records(world([today]), today.WorkoutLogID)).data, { records: [] });
});

Deno.test("module map v5: only earlier workouts count, and a bodyweight exercise is compared in reps", async () => {
  const past = log(TRAINEE, 5, [[PUSHUP, 10, 0]]);
  const later = log(TRAINEE, 1, [[PUSHUP, 30, 0]]);
  const w = world([past, later]);
  assertEquals((await records(w, past.WorkoutLogID)).data, { records: [] });
  assertEquals((await records(w, later.WorkoutLogID)).data, { records: ["שכיבות סמיכה"] });
});

Deno.test("rule 5: a workout of another trainee is NOT_ALLOWED", async () => {
  const theirs = log(OTHER_TRAINEE, 0, [[SQUAT, 8, 60]]);
  assertEquals(await records(world([theirs]), theirs.WorkoutLogID), fail("NOT_ALLOWED"));
});

// ---- get_streak (UC9 step 4, alternative b; rule 8) ----

Deno.test("UC9 section 13: three workouts with a rest day between them make a streak of 3", async () => {
  const w = world([log(TRAINEE, 4, [[SQUAT, 8, 60]]), log(TRAINEE, 2, [[SQUAT, 8, 60]]), log(TRAINEE, 0, [[SQUAT, 8, 60]])]);
  assertEquals((await streak(w)).data, { streak: 3, streakGapDays: 3 });
});

Deno.test("UC9 b: the streak holds with up to streakGapDays rest days, and two workouts on one day count once", async () => {
  const w = world([log(TRAINEE, 8, [[SQUAT, 8, 60]]), log(TRAINEE, 4, [[SQUAT, 8, 60]]), log(TRAINEE, 4, [[BENCH, 8, 40]])]);
  // 3 rest days between the two workout days, and 3 full days since the last one.
  assertEquals((await streak(w)).data, { streak: 2, streakGapDays: 3 });
});

Deno.test("UC9 section 13: four days without a workout reset the streak", async () => {
  const w = world([log(TRAINEE, 7, [[SQUAT, 8, 60]]), log(TRAINEE, 5, [[SQUAT, 8, 60]])]);
  assertEquals((await streak(w)).data, { streak: 0, streakGapDays: 3 });
});

Deno.test("rule 8: streakGapDays is read from SETTINGS, and changing it changes the streak", async () => {
  const logs = [log(TRAINEE, 6, [[SQUAT, 8, 60]]), log(TRAINEE, 2, [[SQUAT, 8, 60]])];
  assertEquals((await streak(world(logs, { settings: { streakGapDays: "3" } }))).data, { streak: 2, streakGapDays: 3 });
  assertEquals((await streak(world(logs, { settings: { streakGapDays: "1" } }))).data, { streak: 1, streakGapDays: 1 });
});

Deno.test("rule 8: streakGapDays missing from SETTINGS is VALUE_NOT_SET, not an invented value", async () => {
  assertEquals(await streak(world([], { settings: {} })), fail("VALUE_NOT_SET"));
  assertEquals(await streak(world([], { settings: { streakGapDays: "soon" } })), fail("VALUE_NOT_SET"));
});

Deno.test("UC9 a, rule 5: a new trainee has a streak of 0; a coach's streak for another coach's trainee is NOT_ALLOWED", async () => {
  assertEquals((await streak(world([]))).data, { streak: 0, streakGapDays: 3 });
  assertEquals(await streak(world([]), otherCoach), fail("NOT_ALLOWED"));
  assertEquals((await streak(world([log(TRAINEE, 0, [[SQUAT, 8, 60]])]), coach)).data, { streak: 1, streakGapDays: 3 });
});
