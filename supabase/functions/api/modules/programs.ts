// M03 programs: build a program and swap an exercise in place.
// Requirement 1, training programs (story-01, usecase-01). Business Logic rules 1, 2, 3, 5, 6 (doc-module-map section 2).
// Acceptance (UC1 section 13): the saved program, and a swapped exercise in the same place, reach the trainee;
// results of the old exercise stay in the history.
import { fail, ok, type Reply } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";
import type { WorkoutDraft } from "../repository.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The names a new program opens with, as in the prototype.
const NEW_PROGRAM_NAME = "תוכנית אימון";
const FIRST_WORKOUT_NAME = "אימון A";

// Rule 5: a coach acts only on their own trainees; a trainee only on themselves. Null means NOT_ALLOWED.
async function traineeInReach(ctx: ModuleContext, payload: Record<string, unknown>): Promise<string | null> {
  const { actor } = ctx;
  if (actor.role === "trainee") {
    const asked = payload.traineeID ?? actor.traineeID;
    return asked === actor.traineeID ? actor.traineeID : null;
  }
  const id = payload.traineeID;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return (await ctx.repo.isActiveTraineeOfCoach(id, actor.coachID)) ? id : null;
}

// Rule 3, and UC1 step 6: every exercise has a full, positive target, and comes from the coach's list. An exercise appears
// once in a workout: its sets are numbered per exercise, so a second item could not be logged (code review, 7c).
function validWorkouts(value: unknown, exerciseIDs: Set<string>): WorkoutDraft[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const isCount = (n: unknown) => Number.isInteger(n) && (n as number) > 0;
  for (const w of value) {
    if (typeof w?.WorkoutID !== "string" || typeof w.workoutName !== "string" || !w.workoutName.trim()) return null;
    if (!Array.isArray(w.items) || w.items.length === 0) return null;
    if (new Set(w.items.map((i: { ExerciseID?: unknown }) => i?.ExerciseID)).size !== w.items.length) return null;
    for (const i of w.items) {
      if (typeof i?.WorkoutItemID !== "string" || !exerciseIDs.has(i.ExerciseID)) return null;
      if (!isCount(i.targetSets) || !isCount(i.targetReps)) return null;
      if (typeof i.targetWeight !== "number" || !Number.isFinite(i.targetWeight) || i.targetWeight < 0) return null;
    }
  }
  return value as WorkoutDraft[];
}

async function withTrainee(ctx: ModuleContext, payload: Record<string, unknown>, then: (traineeID: string) => Promise<Reply>) {
  const traineeID = await traineeInReach(ctx, payload);
  return traineeID ? then(traineeID) : fail("NOT_ALLOWED");
}

export const programs: ModuleDef = {
  id: "M03",
  actions: {
    get_active_program: (ctx, payload) =>
      withTrainee(ctx, payload, async (traineeID) => {
        const program = await ctx.repo.getActiveProgram(traineeID);
        if (!program) return fail("NO_ACTIVE_PROGRAM"); // UC1 alternative a
        return ok({ ...program, inactive: await ctx.repo.listInactivePrograms(traineeID) });
      }),

    save_program: (ctx, payload) =>
      withTrainee(ctx, payload, async (traineeID) => {
        const program = await ctx.repo.getActiveProgram(traineeID);
        if (!program) return fail("NO_ACTIVE_PROGRAM");
        const exercises = await ctx.repo.listExercisesForCoach(ctx.actor.coachID);
        const workouts = validWorkouts(payload.workouts, new Set(exercises.map((e) => e.ExerciseID)));
        if (!workouts) return fail("PROGRAM_INVALID"); // UC1 alternative b
        await ctx.repo.saveProgram(program.ProgramID, workouts); // all or nothing (UC1 section 7)
        return ok(null);
      }),

    swap_exercise: (ctx, payload) =>
      withTrainee(ctx, payload, async (traineeID) => {
        const program = await ctx.repo.getActiveProgram(traineeID);
        if (!program) return fail("NO_ACTIVE_PROGRAM");
        const workout = program.workouts.find((w) => w.items.some((i) => i.WorkoutItemID === payload.workoutItemID));
        const item = workout?.items.find((i) => i.WorkoutItemID === payload.workoutItemID);
        const exercise = (await ctx.repo.listExercisesForCoach(ctx.actor.coachID)).find((e) => e.ExerciseID === payload.exerciseID);
        if (!item || !exercise) return fail("PROGRAM_INVALID");
        // Once per workout (code review, 7c): not an exercise another item of the same workout already holds.
        if (workout!.items.some((i) => i.WorkoutItemID !== item.WorkoutItemID && i.ExerciseID === exercise.ExerciseID)) return fail("PROGRAM_INVALID");
        await ctx.repo.swapExercise(item.WorkoutItemID, exercise.ExerciseID); // rule 2: same place, results untouched
        return ok({ ...item, ExerciseID: exercise.ExerciseID, exerciseName: exercise.exerciseName, hasVideo: exercise.videoType !== null });
      }),

    start_new_program: (ctx, payload) =>
      withTrainee(ctx, payload, async (traineeID) => {
        await ctx.repo.startNewProgram(traineeID, NEW_PROGRAM_NAME, FIRST_WORKOUT_NAME); // rule 1, UC1 alternative e
        return ok(null);
      }),
  },
};
