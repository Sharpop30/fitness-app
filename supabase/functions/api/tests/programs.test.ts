// Unit tests for M03 programs and M02 exercises.list_exercises, against an in-memory Repository (synthetic data).
// Sources: usecase-01 sections 4, 6, 13; doc-module-map section 2, Business Logic rules 1, 2, 3, 5, 6.
import { assertEquals } from "jsr:@std/assert@1";
import { handle, type Modules } from "../orchestrator.ts";
import { fail } from "../errors.ts";
import { programs } from "../modules/programs.ts";
import { exercises } from "../modules/exercises.ts";
import { type Actor, type Exercise, type Program, type Repository, StorageUnavailable, type WorkoutDraft } from "../repository.ts";
import { stage4bNotUsed, stage4cNotUsed, stage4dNotUsed, stage5NotUsed, stage4eNotUsed } from "./fake-repo.ts";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COACH = U(1), OTHER_COACH = U(2), TRAINEE = U(11), OTHER_TRAINEE = U(12), STRANGER = U(13);
const SQUAT = U(21), BENCH = U(22), LUNGE = U(23), FOREIGN = U(24);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: TRAINEE };

const notUsed = () => Promise.reject(new Error("not used in programs tests"));

interface Row { ProgramID: string; TraineeID: string; programName: string; isActive: boolean; createdAt: string; workouts: WorkoutDraft[] }

function world(opts: { storageDown?: boolean } = {}) {
  const trainees = [{ id: TRAINEE, coach: COACH }, { id: OTHER_TRAINEE, coach: COACH }, { id: STRANGER, coach: OTHER_COACH }];
  const list: (Exercise & { coach: string | null })[] = [
    { ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, videoType: "youtube", videoUrl: "x", coach: null },
    { ExerciseID: BENCH, exerciseName: "לחיצת חזה", isBodyweight: false, videoType: null, videoUrl: null, coach: null },
    { ExerciseID: LUNGE, exerciseName: "מכרעים", isBodyweight: false, videoType: null, videoUrl: null, coach: COACH },
    { ExerciseID: FOREIGN, exerciseName: "של מאמן אחר", isBodyweight: false, videoType: null, videoUrl: null, coach: OTHER_COACH },
  ];
  const results = [{ ExerciseID: SQUAT, weight: 60 }]; // a result logged on the squat item
  const rows: Row[] = [{
    ProgramID: U(31), TraineeID: TRAINEE, programName: "תוכנית אימון", isActive: true, createdAt: "2026-09-01",
    workouts: [{ WorkoutID: U(41), workoutName: "אימון A", items: [
      { WorkoutItemID: U(51), ExerciseID: SQUAT, targetSets: 3, targetReps: 8, targetWeight: 60 },
      { WorkoutItemID: U(52), ExerciseID: BENCH, targetSets: 3, targetReps: 8, targetWeight: 40 }] }],
  }];
  let seq = 100;
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const name = (id: string) => list.find((e) => e.ExerciseID === id)!;
  const toProgram = (r: Row): Program => ({
    ...r, workouts: r.workouts.map((w, wi) => ({ WorkoutID: w.WorkoutID, workoutName: w.workoutName, sortOrder: wi,
      items: w.items.map((i, ii) => ({ ...i, sortOrder: ii, exerciseName: name(i.ExerciseID).exerciseName, hasVideo: name(i.ExerciseID).videoType !== null })) })),
  });
  const repo: Repository = {
    findActorByAuthUser: () => Promise.resolve(coach),
    isRegistered: () => Promise.resolve(true),
    writeAudit: () => Promise.resolve(),
    getBusinessSettings: () => Promise.resolve({}),
    isActiveTraineeOfCoach: async (t, c) => (down(), trainees.some((x) => x.id === t && x.coach === c)),
    listExercisesForCoach: async (c) => (down(), list.filter((e) => e.coach === null || e.coach === c).map(({ coach: _, ...e }) => e)),
    getActiveProgram: async (t) => { down(); const r = rows.find((x) => x.TraineeID === t && x.isActive); return r ? toProgram(r) : null; },
    listInactivePrograms: async (t) => (down(), rows.filter((x) => x.TraineeID === t && !x.isActive).map(({ programName, createdAt }) => ({ programName, createdAt }))),
    saveProgram: async (id, workouts) => { down(); rows.find((x) => x.ProgramID === id)!.workouts = structuredClone(workouts); },
    swapExercise: async (itemID, exID) => {
      down();
      for (const r of rows) for (const w of r.workouts) for (const i of w.items) if (i.WorkoutItemID === itemID) i.ExerciseID = exID;
    },
    startNewProgram: async (t, programName, workoutName) => {
      down();
      rows.forEach((x) => { if (x.TraineeID === t) x.isActive = false; });
      const id = U(seq++);
      rows.push({ ProgramID: id, TraineeID: t, programName, isActive: true, createdAt: "2026-09-28", workouts: [{ WorkoutID: U(seq++), workoutName, items: [] }] });
      return id;
    },
    // Stage 4a and 4b operations, not reached by the programs tests.
    listTraineesForCoach: notUsed, createInvite: notUsed, createExercise: notUsed, getExerciseInReach: notUsed, attachVideo: notUsed,
    logWorkout: notUsed, getWorkoutLog: notUsed, correctResults: notUsed, listResults: notUsed,
    ...stage4bNotUsed,
    ...stage4cNotUsed,
    ...stage4dNotUsed,
    ...stage5NotUsed,
    ...stage4eNotUsed,
  };
  return { repo, rows, results };
}

const modules: Modules = { programs, exercises };
const ask = (repo: Repository, actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}, module = "programs") =>
  handle({ caller, module, action, payload }, actor, repo, modules);

Deno.test("get_active_program: the coach gets the program with exercise names, video flags and the inactive list", async () => {
  const { repo } = world();
  const r = await ask(repo, coach, "S04", "get_active_program", { traineeID: TRAINEE });
  const data = r.data as Program & { inactive: unknown[] };
  assertEquals(r.ok, true);
  assertEquals(data.workouts[0].items.map((i) => [i.exerciseName, i.hasVideo]), [["סקוואט", true], ["לחיצת חזה", false]]);
  assertEquals(data.inactive, []);
});

Deno.test("UC1 a: a trainee with no program gets NO_ACTIVE_PROGRAM", async () => {
  const { repo } = world();
  assertEquals(await ask(repo, coach, "S04", "get_active_program", { traineeID: OTHER_TRAINEE }), fail("NO_ACTIVE_PROGRAM"));
});

Deno.test("rule 5 / UC1 d: a coach on another coach's trainee, and a trainee on someone else, get NOT_ALLOWED", async () => {
  const { repo } = world();
  assertEquals(await ask(repo, coach, "S04", "get_active_program", { traineeID: STRANGER }), fail("NOT_ALLOWED"));
  assertEquals(await ask(repo, coach, "S04", "save_program", { traineeID: STRANGER, workouts: [] }), fail("NOT_ALLOWED"));
  assertEquals(await ask(repo, coach, "S04", "get_active_program", { traineeID: "t1" }), fail("NOT_ALLOWED"));
  assertEquals(await ask(repo, trainee, "S14", "get_active_program", { traineeID: OTHER_TRAINEE }), fail("NOT_ALLOWED"));
  assertEquals((await ask(repo, trainee, "S14", "get_active_program")).ok, true); // their own, with no traineeID
});

Deno.test("save_program: a valid program is saved and the trainee sees it", async () => {
  const { repo } = world();
  const workouts = [{ WorkoutID: U(41), workoutName: "אימון A", items: [
    { WorkoutItemID: U(51), ExerciseID: SQUAT, targetSets: 4, targetReps: 6, targetWeight: 70 },
    { WorkoutItemID: "new-1", ExerciseID: LUNGE, targetSets: 3, targetReps: 10, targetWeight: 0 }] }];
  assertEquals((await ask(repo, coach, "S04", "save_program", { traineeID: TRAINEE, workouts })).ok, true);
  const seen = await ask(repo, trainee, "S14", "get_active_program");
  assertEquals((seen.data as Program).workouts[0].items.map((i) => [i.exerciseName, i.targetSets, i.targetWeight]), [["סקוואט", 4, 70], ["מכרעים", 3, 0]]);
});

Deno.test("rule 3 / UC1 b: a missing or non-positive target, an empty workout or a foreign exercise is PROGRAM_INVALID", async () => {
  const { repo, rows } = world();
  const before = structuredClone(rows[0].workouts);
  const item = (over: Record<string, unknown>) => ({ WorkoutItemID: U(51), ExerciseID: SQUAT, targetSets: 3, targetReps: 8, targetWeight: 60, ...over });
  const bad = [
    [{ WorkoutID: U(41), workoutName: "A", items: [item({ targetSets: 0 })] }],
    [{ WorkoutID: U(41), workoutName: "A", items: [item({ targetReps: -1 })] }],
    [{ WorkoutID: U(41), workoutName: "A", items: [item({ targetWeight: -5 })] }],
    [{ WorkoutID: U(41), workoutName: "A", items: [item({ targetReps: undefined })] }],
    [{ WorkoutID: U(41), workoutName: "A", items: [item({ ExerciseID: FOREIGN })] }],
    [{ WorkoutID: U(41), workoutName: "A", items: [] }],
    [],
  ];
  for (const workouts of bad) {
    assertEquals(await ask(repo, coach, "S04", "save_program", { traineeID: TRAINEE, workouts }), fail("PROGRAM_INVALID"));
  }
  assertEquals(rows[0].workouts, before); // nothing was saved
  // bodyweight: weight 0 is valid
  assertEquals((await ask(repo, coach, "S04", "save_program", { traineeID: TRAINEE, workouts: [{ WorkoutID: U(41), workoutName: "A", items: [item({ targetWeight: 0 })] }] })).ok, true);
});

Deno.test("rule 2: a swap keeps the place in the order and leaves past results alone", async () => {
  const { repo, results } = world();
  const r = await ask(repo, coach, "S04", "swap_exercise", { traineeID: TRAINEE, workoutItemID: U(51), exerciseID: LUNGE });
  assertEquals(r.ok, true);
  const seen = (await ask(repo, trainee, "S14", "get_active_program")).data as Program;
  assertEquals(seen.workouts[0].items.map((i) => [i.WorkoutItemID, i.sortOrder, i.exerciseName]), [[U(51), 0, "מכרעים"], [U(52), 1, "לחיצת חזה"]]);
  assertEquals(results, [{ ExerciseID: SQUAT, weight: 60 }]);
});

Deno.test("swap_exercise: an item outside the program or a foreign exercise is PROGRAM_INVALID", async () => {
  const { repo } = world();
  assertEquals(await ask(repo, coach, "S04", "swap_exercise", { traineeID: TRAINEE, workoutItemID: "new-1", exerciseID: LUNGE }), fail("PROGRAM_INVALID"));
  assertEquals(await ask(repo, coach, "S04", "swap_exercise", { traineeID: TRAINEE, workoutItemID: U(51), exerciseID: FOREIGN }), fail("PROGRAM_INVALID"));
});

Deno.test("rule 1 / UC1 e: a new program makes the previous one inactive, and it is kept", async () => {
  const { repo, rows } = world();
  assertEquals((await ask(repo, coach, "S04", "start_new_program", { traineeID: TRAINEE })).ok, true);
  assertEquals(rows.filter((x) => x.TraineeID === TRAINEE && x.isActive).length, 1);
  const data = (await ask(repo, coach, "S04", "get_active_program", { traineeID: TRAINEE })).data as Program & { inactive: { programName: string }[] };
  assertEquals(data.workouts.map((w) => [w.workoutName, w.items.length]), [["אימון A", 0]]);
  assertEquals(data.inactive.map((x) => x.programName), ["תוכנית אימון"]);
});

Deno.test("UC1 c: the database not answering is STORAGE_UNAVAILABLE, returned and not thrown", async () => {
  const { repo } = world({ storageDown: true });
  assertEquals(await ask(repo, coach, "S04", "save_program", { traineeID: TRAINEE, workouts: [] }), fail("STORAGE_UNAVAILABLE"));
});

Deno.test("exercises.list_exercises: the ready-made list and the coach's own, not another coach's", async () => {
  const { repo } = world();
  const r = await ask(repo, coach, "S04", "list_exercises", {}, "exercises");
  assertEquals((r.data as Exercise[]).map((e) => e.ExerciseID).sort(), [SQUAT, BENCH, LUNGE].sort());
});
