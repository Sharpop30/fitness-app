// Unit tests for M04 results, against an in-memory Repository (synthetic data), with the real programs module
// behind the Orchestrator. Sources: usecase-03 sections 4, 6, 7, 13; doc-module-map section 2, Business Logic
// rules 4, 5; stage 4a plan, decision 6.
import { assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef, type Modules } from "../orchestrator.ts";
import { fail, ok, type Reply } from "../errors.ts";
import { results } from "../modules/results.ts";
import { programs } from "../modules/programs.ts";
import { type Actor, type Program, type SetEntry, StorageUnavailable, type WorkoutLog } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), TRAINEE = U(11), OTHER_TRAINEE = U(12), STRANGER = U(13);
const SQUAT = U(21), PUSHUP = U(22), WORKOUT = U(41), OLD_WORKOUT = U(49);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const otherCoach: Actor = { role: "coach", businessID: OTHER_COACH, coachID: OTHER_COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: TRAINEE };
const otherTrainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: OTHER_TRAINEE };

const program: Program = {
  ProgramID: U(31), TraineeID: TRAINEE, programName: "תוכנית אימון", isActive: true, createdAt: "2026-09-01",
  workouts: [{ WorkoutID: WORKOUT, workoutName: "אימון A", sortOrder: 0, items: [
    { WorkoutItemID: U(51), ExerciseID: SQUAT, sortOrder: 0, targetSets: 2, targetReps: 8, targetWeight: 60, exerciseName: "סקוואט", hasVideo: false },
    { WorkoutItemID: U(52), ExerciseID: PUSHUP, sortOrder: 1, targetSets: 1, targetReps: 10, targetWeight: 0, exerciseName: "שכיבות סמיכה", hasVideo: false }] }],
};

// The sets as S14 fills them in: every set as planned (UC3 step 3).
const asPlanned = (): SetEntry[] => program.workouts[0].items.flatMap((i) =>
  Array.from({ length: i.targetSets }, (_, s) => ({ ExerciseID: i.ExerciseID, setNumber: s + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true })));

function world(opts: { storageDown?: boolean } = {}) {
  const logs: WorkoutLog[] = [];
  let seq = 700;
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const { repo, audits } = fakeRepo({
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [TRAINEE, OTHER_TRAINEE].includes(t)),
    getActiveProgram: async (t) => (down(), t === TRAINEE ? structuredClone(program) : null),
    listInactivePrograms: async () => (down(), []),
    logWorkout: async (traineeID, workoutID, sets) => {
      down();
      const WorkoutLogID = U(seq++);
      logs.push({ WorkoutLogID, TraineeID: traineeID, WorkoutID: workoutID, workoutName: "אימון A", performedAt: "2026-09-28",
        sets: sets.map((s) => ({ ...s, SetResultID: U(seq++), exerciseName: "x", isCorrected: false })) });
      return WorkoutLogID;
    },
    getWorkoutLog: async (id) => (down(), structuredClone(logs.find((l) => l.WorkoutLogID === id) ?? null)),
    // As results_correct in migration 0007: the sets sent are marked corrected.
    correctResults: async (id, corrections) => {
      down();
      const log = logs.find((l) => l.WorkoutLogID === id)!;
      for (const c of corrections) Object.assign(log.sets.find((s) => s.SetResultID === c.SetResultID)!, { ...c, isCorrected: true });
    },
    listResults: async (t) => (down(), structuredClone(logs.filter((l) => l.TraineeID === t))),
  });
  return { repo, audits, logs };
}

const ask = (w: ReturnType<typeof world>, actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}, extra: Modules = {}) =>
  handle({ caller, module: "results", action, payload }, actor, w.repo, { results, programs, ...extra });
const logWorkout = (w: ReturnType<typeof world>, sets: unknown, workoutID = WORKOUT, extra: Modules = {}) =>
  ask(w, trainee, "S14", "log_workout", { workoutID, sets }, extra);
const feedbackOf = (r: Reply) => (r.data as { feedback: Record<string, unknown> }).feedback;

// Stand-ins for the stage 4b modules, answering one action each.
const answering = (id: string, action: string, reply: Reply): ModuleDef => ({ id, actions: { [action]: async () => reply } });

Deno.test("UC3 steps 5-6: a workout done as planned is saved in one request, and the coach sees it", async () => {
  const w = world();
  const r = await logWorkout(w, asPlanned());
  assertEquals(r.ok, true);
  assertEquals(w.logs.length, 1);
  assertEquals(feedbackOf(r).done, 3);
  assertEquals(feedbackOf(r).total, 3);
  const seen = await ask(w, coach, "S06", "list_results", { traineeID: TRAINEE });
  assertEquals((seen.data as WorkoutLog[]).map((l) => [l.WorkoutLogID, l.sets.length]), [[(r.data as { WorkoutLogID: string }).WorkoutLogID, 3]]);
});

Deno.test("UC3 a: a set not done is saved as not done, and the feedback counts done against total", async () => {
  const w = world();
  const sets = asPlanned();
  sets[1].isDone = false;
  sets[2].isDone = false;
  const r = await logWorkout(w, sets);
  assertEquals([feedbackOf(r).done, feedbackOf(r).total], [1, 3]);
  assertEquals(w.logs[0].sets.map((s) => s.isDone), [true, false, false]);
});

Deno.test("rule 4 / UC3 b: a negative, empty or non-numeric result is RESULT_INVALID, and nothing is saved", async () => {
  const w = world();
  const bad: Record<string, unknown>[] = [{ weight: -5 }, { reps: -1 }, { reps: null }, { reps: "8" }, { weight: "60" }, { reps: 7.5 }, { reps: undefined }];
  for (const over of bad) {
    const sets = asPlanned().map((s, i) => (i === 0 ? { ...s, ...over } : s));
    assertEquals(await logWorkout(w, sets), fail("RESULT_INVALID"));
  }
  assertEquals(await logWorkout(w, []), fail("RESULT_INVALID"));
  assertEquals(await logWorkout(w, "all done"), fail("RESULT_INVALID"));
  assertEquals(w.logs, []);
});

Deno.test("a set of an exercise outside the workout, or the same set twice, is RESULT_INVALID", async () => {
  const w = world();
  assertEquals(await logWorkout(w, asPlanned().map((s, i) => (i === 0 ? { ...s, ExerciseID: U(99) } : s))), fail("RESULT_INVALID"));
  assertEquals(await logWorkout(w, asPlanned().map((s, i) => (i === 1 ? { ...s, setNumber: 1 } : s))), fail("RESULT_INVALID"));
  assertEquals(w.logs, []);
});

Deno.test("UC3 d: a workout that is not in the active program, or a trainee with none, is NO_ACTIVE_PROGRAM", async () => {
  const w = world();
  assertEquals(await logWorkout(w, asPlanned(), OLD_WORKOUT), fail("NO_ACTIVE_PROGRAM"));
  assertEquals(await ask(w, otherTrainee, "S14", "log_workout", { workoutID: WORKOUT, sets: asPlanned() }), fail("NO_ACTIVE_PROGRAM"));
  assertEquals(w.logs, []);
});

Deno.test("UC3 step 7: feedback, coins and challenges are asked through the Orchestrator, as M04, in one request", async () => {
  const w = world();
  await logWorkout(w, asPlanned());
  const inner = w.audits.filter((a) => a.caller === "M04");
  assertEquals([...new Set(inner.map((a) => `${a.moduleName}.${a.actionName}`))],
    ["programs.get_active_program", "feedback.build_feedback", "coins.award", "challenges.check_progress"]);
  assertEquals(new Set(w.audits.map((a) => a.requestID)).size, 1);
});

Deno.test("decision 6 / UC3 section 7: when feedback, coins and challenges fail, the save stands and their fields are empty", async () => {
  const w = world(); // none of the three is in this test's modules
  const r = await logWorkout(w, asPlanned());
  assertEquals(r.ok, true);
  assertEquals(w.logs.length, 1);
  assertEquals(feedbackOf(r), { done: 3, total: 3, records: [], coins: 0, goal: false, goalCoins: 0, challenge: false, challengeCoins: 0, text: "" });
});

Deno.test("map v13: the coins for the goal and for the challenge reach S15 in the feedback", async () => {
  const w = world();
  const r = await logWorkout(w, asPlanned(), WORKOUT, {
    feedback: answering("M06", "build_feedback", ok({ records: [], text: "כל הכבוד" })),
    coins: answering("M07", "award", ok({ coins: 10, goal: true, goalCoins: 30 })),
    challenges: answering("M08", "check_progress", ok({ challenge: true, coins: 50 })),
  });
  assertEquals(feedbackOf(r), { done: 3, total: 3, records: [], coins: 10, goal: true, goalCoins: 30, challenge: true, challengeCoins: 50, text: "כל הכבוד" });
});

Deno.test("UC3 step 7: what feedback, coins and challenges answer reaches the trainee; one failing does not hide the others", async () => {
  const w = world();
  const r = await logWorkout(w, asPlanned(), WORKOUT, {
    feedback: answering("M06", "build_feedback", ok({ records: ["סקוואט"], text: "שיא חדש" })),
    coins: answering("M07", "award", fail("STORAGE_UNAVAILABLE")),
    challenges: answering("M08", "check_progress", ok({ challenge: true, coins: 50 })),
  });
  assertEquals(feedbackOf(r), { done: 3, total: 3, records: ["סקוואט"], coins: 0, goal: false, goalCoins: 0, challenge: true, challengeCoins: 50, text: "שיא חדש" });
  assertEquals(w.logs.length, 1);
});

Deno.test("rule 4 / UC3 e: a correction marks isCorrected only on the set that changed, and does not ask for coins", async () => {
  const w = world();
  const logID = ((await logWorkout(w, asPlanned())).data as { WorkoutLogID: string }).WorkoutLogID;
  const listed = ((await ask(w, trainee, "S16", "list_results")).data as WorkoutLog[])[0];
  const sets = structuredClone(listed.sets);
  sets[0].weight = 62.5;
  w.audits.length = 0;
  assertEquals(await ask(w, trainee, "S16", "correct_result", { workoutLogID: logID, sets }), ok(null));
  const seen = ((await ask(w, coach, "S06", "list_results", { traineeID: TRAINEE })).data as WorkoutLog[])[0];
  assertEquals(seen.sets.map((s) => [s.weight, s.isCorrected]), [[62.5, true], [60, false], [0, false]]);
  assertEquals(w.audits.some((a) => a.moduleName === "coins"), false);
});

Deno.test("a correction that changes nothing marks nothing", async () => {
  const w = world();
  const logID = ((await logWorkout(w, asPlanned())).data as { WorkoutLogID: string }).WorkoutLogID;
  assertEquals((await ask(w, trainee, "S16", "correct_result", { workoutLogID: logID, sets: structuredClone(w.logs[0].sets) })).ok, true);
  assertEquals(w.logs[0].sets.some((s) => s.isCorrected), false);
});

Deno.test("rule 4: a negative correction is RESULT_INVALID, and the result is unchanged", async () => {
  const w = world();
  const logID = ((await logWorkout(w, asPlanned())).data as { WorkoutLogID: string }).WorkoutLogID;
  const sets = structuredClone(w.logs[0].sets);
  sets[0].reps = -1;
  assertEquals(await ask(w, trainee, "S16", "correct_result", { workoutLogID: logID, sets }), fail("RESULT_INVALID"));
  assertEquals(w.logs[0].sets[0].reps, 8);
});

Deno.test("rule 5: a trainee on someone else's workout, and a coach on another coach's trainee, get NOT_ALLOWED", async () => {
  const w = world();
  const logID = ((await logWorkout(w, asPlanned())).data as { WorkoutLogID: string }).WorkoutLogID;
  const sets = structuredClone(w.logs[0].sets);
  sets[0].weight = 100;
  assertEquals(await ask(w, otherTrainee, "S16", "correct_result", { workoutLogID: logID, sets }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "S16", "correct_result", { workoutLogID: U(999), sets }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, trainee, "S16", "correct_result", { workoutLogID: logID, sets: [{ ...sets[0], SetResultID: U(998) }] }), fail("NOT_ALLOWED"));
  assertEquals(w.logs[0].sets[0].weight, 60);
  assertEquals(await ask(w, otherTrainee, "S16", "list_results", { traineeID: TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, otherCoach, "S06", "list_results", { traineeID: TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, coach, "S06", "list_results", { traineeID: STRANGER }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, coach, "S14", "log_workout", { workoutID: WORKOUT, sets: asPlanned() }), fail("NOT_ALLOWED")); // a coach has no workout of their own
});

Deno.test("UC3 c: a database that fails gives STORAGE_UNAVAILABLE, without throwing, and nothing half saved", async () => {
  const w = world({ storageDown: true });
  assertEquals(await logWorkout(w, asPlanned()), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await ask(w, trainee, "S16", "list_results"), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await ask(w, trainee, "S16", "correct_result", { workoutLogID: U(900), sets: [] }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(w.logs, []);
});
