// M04 results: entering the results of a workout and correcting them.
// Requirement 12, results entry (story-12, usecase-03). Business Logic rules 4, 5 (doc-module-map section 2).
// Acceptance (UC3 section 13): a workout done as planned is saved in one request and the coach sees it;
// a correction shows to the coach with isCorrected, and the coins do not change.
import { fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";
import type { Program, SetCorrection, SetEntry } from "../repository.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rule 5: a coach reads only their own trainees; a trainee only themselves. Null means NOT_ALLOWED.
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

// Rule 4 and UC3 alternative b: reps a whole number, reps and weight not negative, and nothing that is not a number.
const isReps = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
const isWeight = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

// The sets of one workout, each for an exercise in it, each set number once. Null means RESULT_INVALID.
function validSets(value: unknown, exerciseIDs: Set<string>): SetEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const seen = new Set<string>();
  const sets: SetEntry[] = [];
  for (const s of value) {
    if (typeof s?.ExerciseID !== "string" || !exerciseIDs.has(s.ExerciseID)) return null;
    if (!Number.isInteger(s.setNumber) || s.setNumber <= 0 || !isReps(s.reps) || !isWeight(s.weight)) return null;
    if (s.isDone !== undefined && typeof s.isDone !== "boolean") return null;
    const key = `${s.ExerciseID}#${s.setNumber}`;
    if (seen.has(key)) return null;
    seen.add(key);
    // UC3 alternative a: a set not done is kept, marked as not done.
    sets.push({ ExerciseID: s.ExerciseID, setNumber: s.setNumber, reps: s.reps, weight: s.weight, isDone: s.isDone ?? true });
  }
  return sets;
}

// Values only, before the program is read: a bad value stops the save at step 5.
const valuesValid = (value: unknown) =>
  Array.isArray(value) && value.length > 0 && value.every((s) => isReps(s?.reps) && isWeight(s?.weight));

export const results: ModuleDef = {
  id: "M04",
  actions: {
    // UC3 steps 5-8. The trainee saves their own workout; the save is atomic.
    async log_workout(ctx, payload) {
      if (!ctx.actor.traineeID) return fail("NOT_ALLOWED");
      if (!valuesValid(payload.sets)) return fail("RESULT_INVALID");

      // UC3 step 2 and alternative d: the workout must be in the trainee's active program, read through programs.
      const active = await ctx.call({ module: "programs", action: "get_active_program", payload: {} });
      if (!active.ok) return fail(active.error!.code);
      const workout = (active.data as Program).workouts.find((w) => w.WorkoutID === payload.workoutID);
      if (!workout) return fail("NO_ACTIVE_PROGRAM");

      const sets = validSets(payload.sets, new Set(workout.items.map((i) => i.ExerciseID)));
      if (!sets) return fail("RESULT_INVALID");
      const workoutLogID = await ctx.repo.logWorkout(ctx.actor.traineeID, workout.WorkoutID, sets);

      // UC3 step 7, through the Orchestrator. A failure there does not undo the save (UC3 section 7):
      // its fields come back empty, with no queue (stage 4a plan, decision 6).
      const ask = async (module: string, action: string, extra: Record<string, unknown> = {}) => {
        const r = await ctx.call({ module, action, payload: { workoutLogID, traineeID: ctx.actor.traineeID, ...extra } });
        return r.ok && r.data && typeof r.data === "object" ? r.data as Record<string, unknown> : {};
      };
      const built = await ask("feedback", "build_feedback");
      const awarded = await ask("coins", "award", { reason: "workout", eventRef: workoutLogID });
      const checked = await ask("challenges", "check_progress");

      return ok({
        WorkoutLogID: workoutLogID,
        feedback: {
          done: sets.filter((s) => s.isDone).length,
          total: sets.length,
          records: Array.isArray(built.records) ? built.records : [],
          coins: typeof awarded.coins === "number" ? awarded.coins : 0,
          goal: awarded.goal === true,
          goalCoins: typeof awarded.goalCoins === "number" ? awarded.goalCoins : 0, // map v13
          challenge: checked.challenge === true,
          challengeCoins: typeof checked.coins === "number" ? checked.coins : 0, // map v13
          text: typeof built.text === "string" ? built.text : "", // empty when feedback failed (module map v4)
        },
      });
    },

    // UC3 c1-c2 and alternative e. Only a set whose value changed is marked isCorrected; coins are not asked (rule 4).
    async correct_result(ctx, payload) {
      const id = payload.workoutLogID;
      if (typeof id !== "string" || !UUID.test(id)) return fail("NOT_ALLOWED");
      const log = await ctx.repo.getWorkoutLog(id);
      if (!log || log.TraineeID !== ctx.actor.traineeID) return fail("NOT_ALLOWED");

      const fixed = payload.sets;
      if (!Array.isArray(fixed) || fixed.length === 0) return fail("RESULT_INVALID");
      const byID = new Map(log.sets.map((s) => [s.SetResultID, s]));
      const changed: SetCorrection[] = [];
      for (const f of fixed) {
        const was = byID.get(f?.SetResultID);
        if (!was) return fail("NOT_ALLOWED"); // a set of another workout
        if (!isReps(f.reps) || !isWeight(f.weight)) return fail("RESULT_INVALID");
        if (f.isDone !== undefined && typeof f.isDone !== "boolean") return fail("RESULT_INVALID");
        const isDone = f.isDone ?? was.isDone;
        if (f.reps !== was.reps || f.weight !== was.weight || isDone !== was.isDone) {
          changed.push({ SetResultID: was.SetResultID, reps: f.reps, weight: f.weight, isDone });
        }
      }
      if (changed.length) await ctx.repo.correctResults(log.WorkoutLogID, changed);
      return ok(null);
    },

    // UC3 step 9: the trainee's own workouts, or the coach's trainee's, newest first.
    async list_results(ctx, payload) {
      // The owner, through M15 (map v11; rule 5): how many workouts each active trainee of the business saved since the
      // given time, and nothing of the sets.
      if (ctx.actor.role === "owner") {
        const coaches = await ctx.repo.coachesInReach(ctx.actor.businessID, payload.coachID);
        if (!coaches) return fail("NOT_ALLOWED");
        const since = typeof payload.since === "string" && Number.isFinite(Date.parse(payload.since))
          ? new Date(payload.since).toISOString() : new Date(0).toISOString();
        const trainees: { TraineeID: string; CoachID: string }[] = [];
        for (const CoachID of coaches) {
          for (const t of await ctx.repo.listTraineesForCoach(CoachID)) if (t.TraineeID && t.joined && t.isActive) trainees.push({ TraineeID: t.TraineeID, CoachID });
        }
        const counts = await ctx.repo.countWorkoutsSince(trainees.map((t) => t.TraineeID), since);
        return ok(trainees.map((t) => ({ ...t, workouts: counts[t.TraineeID] ?? 0 })));
      }
      const traineeID = await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");
      const logs = await ctx.repo.listResults(traineeID);
      return ok(logs.map(({ TraineeID: _, ...log }) => log));
    },
  },
};
