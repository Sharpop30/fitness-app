// M05 progress: the progress chart, personal records and the streak.
// Requirements 4 (story-04, usecase-05) and 25 (story-25, usecase-09 step 4). Business Logic rules 5, 7, 8.
// Nothing here is stored: the chart, the record and the streak are computed from the results each time (rule 7).
// Acceptance (UC5 section 13): the coach and the trainee see the same points, a swapped exercise keeps its history,
// the record is marked. (UC9 section 13): three workouts with a rest day make a streak of 3; four days without reset it.
import { fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";
import type { WorkoutLog } from "../repository.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

// Rule 5: a coach reads only their own trainees; a trainee only themselves. Null means NOT_ALLOWED.
// For a module caller (feedback, trainees, home) the actor is still the person who made the request.
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

// Days are counted in Israel time, so a late workout is not moved to the next day (stage 4b plan, decision 8).
const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const dayKey = (at: string | number) => ISRAEL_DAY.format(new Date(at));
const daysBetween = (later: string, earlier: string) => Math.round((Date.parse(later) - Date.parse(earlier)) / DAY_MS);

// The value of one exercise in one workout: the top weight, or the top reps for a bodyweight exercise (UC5 b).
// Only sets that were done count. Null when the workout has no done set of the exercise.
function topValue(log: WorkoutLog, exerciseID: string, isBodyweight: boolean): number | null {
  const done = log.sets.filter((s) => s.ExerciseID === exerciseID && s.isDone);
  return done.length ? Math.max(...done.map((s) => (isBodyweight ? s.reps : s.weight))) : null;
}

async function bodyweightOf(ctx: ModuleContext, exerciseIDs: string[]): Promise<Map<string, boolean>> {
  return new Map((await ctx.repo.getExercisesByID(exerciseIDs)).map((e) => [e.ExerciseID, e.isBodyweight]));
}

export const progress: ModuleDef = {
  id: "M05",
  actions: {
    // UC5 steps 1-6. The same answer for the coach and for the trainee.
    async get_progress_chart(ctx, payload) {
      const traineeID = await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");
      const logs = await ctx.repo.listResults(traineeID); // newest first

      // Every exercise with results, a swapped one included (UC5 section 13), in the order of the latest workouts.
      const names = new Map<string, string>();
      for (const log of logs) for (const s of log.sets) if (!names.has(s.ExerciseID)) names.set(s.ExerciseID, s.exerciseName);
      const exercises = [...names].map(([ExerciseID, exerciseName]) => ({ ExerciseID, exerciseName }));
      // UC5 a: no workouts yet; the screen says the chart comes after the first ones.
      if (exercises.length === 0) return ok({ exercises: [], selected: null, isBodyweight: false, points: [] });

      // UC5 step 2: the asked exercise, or else the first exercise of the latest workout (sets come in workout order).
      const asked = typeof payload.exerciseID === "string" && names.has(payload.exerciseID) ? payload.exerciseID : null;
      const selected = asked ?? exercises[0].ExerciseID;
      const isBodyweight = (await bodyweightOf(ctx, [selected])).get(selected) ?? false;

      const points = logs.slice().reverse().flatMap((log) => {
        const value = topValue(log, selected, isBodyweight);
        return value === null ? [] : [{ date: log.performedAt, value }];
      });
      return ok({ exercises, selected, isBodyweight, points });
    },

    // UC6 step 3, asked by feedback only (Registry). A record beats every earlier workout in the same exercise;
    // the first workout in an exercise is not a record (module map v5, section 4).
    async detect_personal_records(ctx, payload) {
      const traineeID = await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");
      const id = payload.workoutLogID;
      if (typeof id !== "string" || !UUID.test(id)) return fail("NOT_ALLOWED");
      const log = await ctx.repo.getWorkoutLog(id);
      if (!log || log.TraineeID !== traineeID) return fail("NOT_ALLOWED");

      const earlier = (await ctx.repo.listResults(traineeID))
        .filter((l) => l.WorkoutLogID !== log.WorkoutLogID && l.performedAt < log.performedAt);
      const inLog = [...new Set(log.sets.map((s) => s.ExerciseID))];
      const bodyweight = await bodyweightOf(ctx, inLog);

      const records: string[] = [];
      for (const exerciseID of inLog) {
        const bw = bodyweight.get(exerciseID) ?? false;
        const now = topValue(log, exerciseID, bw);
        const before = earlier.map((l) => topValue(l, exerciseID, bw)).filter((v): v is number => v !== null);
        if (now !== null && before.length > 0 && now > Math.max(...before)) {
          records.push(log.sets.find((s) => s.ExerciseID === exerciseID)!.exerciseName);
        }
      }
      return ok({ records });
    },

    // UC9 step 4 and alternative b, asked by trainees and home only (Registry). Business Logic rule 8: the streak
    // counts the days with a workout, and holds while at most streakGapDays days pass between them.
    async get_streak(ctx, payload) {
      // The owner, through M15 (map v11): a trainee of any coach of the business (rule 5).
      const traineeID = ctx.actor.role === "owner"
        ? (typeof payload.traineeID === "string" && UUID.test(payload.traineeID) && ctx.actor.businessID &&
            (await ctx.repo.businessOfTrainee(payload.traineeID)) === ctx.actor.businessID ? payload.traineeID : null)
        : await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");

      const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key: "streakGapDays" } });
      if (!r.ok) return fail(r.error!.code);
      const streakGapDays = Number((r.data as Record<string, string>).streakGapDays);
      if (!Number.isInteger(streakGapDays) || streakGapDays < 0) return fail("VALUE_NOT_SET");

      const days = [...new Set((await ctx.repo.listResults(traineeID)).map((l) => dayKey(l.performedAt)))].sort().reverse();
      // "Up to N days between workouts": a gap of N rest days is N + 1 calendar days apart.
      const holds = (later: string, earlier: string) => daysBetween(later, earlier) <= streakGapDays + 1;
      let streak = 0;
      if (days.length > 0 && holds(dayKey(Date.now()), days[0])) {
        streak = 1;
        while (streak < days.length && holds(days[streak - 1], days[streak])) streak++;
      }
      return ok({ streak, streakGapDays });
    },
  },
};
