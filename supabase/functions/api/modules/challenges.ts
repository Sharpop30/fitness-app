// M08 challenges: the weekly challenge and its automatic completion.
// Requirement 5 (story-05, usecase-08). Business Logic rule 5; CLAUDE.md rule 8.
// Acceptance (UC8 section 13): all trainees see the challenge; a trainee who reaches the target is marked complete and
// gets coins with no report of their own; a second challenge in the same week is refused; the week ends and it closes.
// The week starts on Sunday (UC8, team decision) and closes by its date, with no scheduled job (UC8 section 4).
import { fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";
import type { Challenge } from "../repository.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isID = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const DAY_MS = 24 * 60 * 60 * 1000;

// Days and weeks in Israel time (stage 4b plan, decision 8).
const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const dayKey = (at: string | number) => ISRAEL_DAY.format(new Date(at));
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
const thisSunday = () => { const today = dayKey(Date.now()); return addDays(today, -new Date(today).getUTCDay()); };

// Rule 5: a coach reads only their own trainees; a trainee only themselves. Null means NOT_ALLOWED.
async function traineeInReach(ctx: ModuleContext, payload: Record<string, unknown>): Promise<string | null> {
  const { actor } = ctx;
  if (actor.role === "trainee") {
    const asked = payload.traineeID ?? actor.traineeID;
    return asked === actor.traineeID ? actor.traineeID : null;
  }
  return isID(payload.traineeID) && (await ctx.repo.isActiveTraineeOfCoach(payload.traineeID, actor.coachID))
    ? payload.traineeID : null;
}

// UC8 steps 4 and 6, from this week's workouts only (alternative c). "count" is the number of workouts; "exercise" the top
// weight in the exercise, or the top reps for a bodyweight one (execution decision 5). A trainee whose active program
// does not have the exercise is exempt (UC8 step 4, team decision).
async function progressOf(ctx: ModuleContext, c: Challenge, traineeID: string) {
  const end = addDays(c.weekStart, 6);
  const week = (await ctx.repo.listResults(traineeID)).filter((l) => { const d = dayKey(l.performedAt); return d >= c.weekStart && d <= end; });
  if (c.challengeType === "count") return { value: week.length, target: c.targetValue, exempt: false };

  const program = await ctx.repo.getActiveProgram(traineeID);
  const inPlan = program?.workouts.some((w) => w.items.some((i) => i.ExerciseID === c.ExerciseID)) ?? false;
  if (!inPlan) return { value: 0, target: c.targetValue, exempt: true };
  const [exercise] = await ctx.repo.getExercisesByID([c.ExerciseID!]);
  const done = week.flatMap((l) => l.sets).filter((s) => s.ExerciseID === c.ExerciseID && s.isDone);
  const value = done.length ? Math.max(...done.map((s) => (exercise?.isBodyweight ? s.reps : s.weight))) : 0;
  return { value, target: c.targetValue, exempt: false };
}

export const challenges: ModuleDef = {
  id: "M08",
  actions: {
    // UC8 steps 1-3 and alternatives a, e. One challenge a week, for the week of today.
    async create_challenge(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const name = typeof payload.challengeName === "string" ? payload.challengeName.trim() : "";
      const type = payload.challengeType;
      const target = payload.targetValue;
      if (!name || (type !== "count" && type !== "exercise")) return fail("CHALLENGE_INVALID");
      if (typeof target !== "number" || !Number.isFinite(target) || target <= 0 || (type === "count" && !Number.isInteger(target))) {
        return fail("CHALLENGE_INVALID");
      }
      let exerciseID: string | null = null;
      if (type === "exercise") {
        if (!isID(payload.exerciseID)) return fail("CHALLENGE_INVALID");
        if (!(await ctx.repo.getExerciseInReach(payload.exerciseID, ctx.actor.coachID))) return fail("NOT_ALLOWED");
        exerciseID = payload.exerciseID;
      }
      const prize = typeof payload.extraPrize === "string" && payload.extraPrize.trim() ? payload.extraPrize.trim() : null;
      const created = await ctx.repo.createChallenge(ctx.actor.coachID, {
        challengeName: name, challengeType: type, targetValue: target, ExerciseID: exerciseID, extraPrize: prize, weekStart: thisSunday(),
      });
      return created ? ok(null) : fail("CHALLENGE_EXISTS");
    },

    // Map v13, rule 11 (usecase-08 v3, the change): only this week's challenge. The name and the prize always; the target
    // only while no one completed. The type and the exercise are not in the input. Completions and coins stay as they are.
    async update_challenge(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const c = await ctx.repo.getChallengeForWeek(ctx.actor.coachID, thisSunday());
      if (!c) return fail("NOT_ALLOWED"); // no challenge this week, or the week closed (alternative g)
      const name = payload.challengeName === undefined ? c.challengeName : typeof payload.challengeName === "string" ? payload.challengeName.trim() : "";
      if (!name) return fail("CHALLENGE_INVALID");
      const prize = payload.extraPrize === undefined ? c.extraPrize
        : typeof payload.extraPrize === "string" && payload.extraPrize.trim() ? payload.extraPrize.trim() : null;
      const target = payload.targetValue === undefined ? c.targetValue : payload.targetValue;
      if (typeof target !== "number" || !Number.isFinite(target) || target <= 0 || (c.challengeType === "count" && !Number.isInteger(target))) {
        return fail("CHALLENGE_INVALID"); // alternative e
      }
      if (target !== c.targetValue && (await ctx.repo.listCompletions(c.ChallengeID)).length > 0) return fail("CHALLENGE_INVALID"); // alternative f
      await ctx.repo.updateChallenge(c.ChallengeID, { challengeName: name, extraPrize: prize, targetValue: target });
      return ok(null);
    },

    // UC8 step 4: this week's challenge of the coach, with its end and coins; for a trainee, their own progress.
    // After Saturday there is no current challenge: the week closed (alternative b).
    async get_current_challenge(ctx) {
      const c = await ctx.repo.getChallengeForWeek(ctx.actor.coachID, thisSunday());
      if (!c) return ok(null);
      const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key: "coinsChallenge" } });
      // The coins are shown, not credited here: a value missing from SETTINGS shows as none, and coins.award refuses it.
      const n = r.ok ? Number((r.data as Record<string, string>).coinsChallenge) : NaN;
      const coins = Number.isInteger(n) && n > 0 ? n : null;
      const progress = ctx.actor.traineeID ? await progressOf(ctx, c, ctx.actor.traineeID) : null;
      return ok({ ...c, end: addDays(c.weekStart, 6), coins, progress });
    },

    // UC8 steps 5-8, asked by results only (Registry) after a workout is saved. A trainee who reached the target is
    // marked complete once, then credited through coins.award. A failed credit keeps the completion (alternative d);
    // there is no queue (module map v4).
    async check_progress(ctx, payload) {
      const traineeID = await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");
      const c = await ctx.repo.getChallengeForWeek(ctx.actor.coachID, thisSunday());
      if (!c) return ok({ challenge: false });
      const p = await progressOf(ctx, c, traineeID);
      if (p.exempt || p.value < p.target) return ok({ challenge: false });

      const completionID = await ctx.repo.addCompletion(c.ChallengeID, traineeID);
      if (!completionID) return ok({ challenge: false }); // completed before: once only
      const awarded = await ctx.call({ module: "coins", action: "award", payload: { traineeID, reason: "challenge", eventRef: completionID } });
      // Map v13: the coins credited for completing, for S15; a failed credit is 0, and the completion stays (alternative d).
      const coins = awarded.ok && typeof (awarded.data as { coins?: unknown })?.coins === "number" ? (awarded.data as { coins: number }).coins : 0;
      return ok({ challenge: true, coins });
    },

    // UC8 step 9: who completed this week's challenge.
    async list_completions(ctx, payload) {
      // The owner, through M15 (map v11): who completed this week's challenge of every coach of the business.
      if (ctx.actor.role === "owner") {
        const coaches = await ctx.repo.coachesInReach(ctx.actor.businessID, payload.coachID);
        if (!coaches) return fail("NOT_ALLOWED");
        const rows = [];
        for (const CoachID of coaches) {
          const c = await ctx.repo.getChallengeForWeek(CoachID, thisSunday());
          if (c) rows.push(...(await ctx.repo.listCompletions(c.ChallengeID)).map((x) => ({ TraineeID: x.TraineeID, CoachID, completedAt: x.completedAt })));
        }
        return ok(rows);
      }
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const c = await ctx.repo.getChallengeForWeek(ctx.actor.coachID, thisSunday());
      return ok(c ? await ctx.repo.listCompletions(c.ChallengeID) : []);
    },

    // UC8 step 9: the coach hands over the extra prize, on this week's challenge (execution decision 7).
    async mark_prize_delivered(ctx, payload) {
      if (ctx.actor.role !== "coach" || !isID(payload.traineeID)) return fail("NOT_ALLOWED");
      const c = await ctx.repo.getChallengeForWeek(ctx.actor.coachID, thisSunday());
      if (!c || !(await ctx.repo.markPrizeDelivered(c.ChallengeID, payload.traineeID))) return fail("NOT_ALLOWED");
      return ok(null);
    },
  },
};
