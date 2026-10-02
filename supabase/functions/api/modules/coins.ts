// M07 coins: coins for events, the personal goal, the reward catalog and redeeming.
// Requirements 6 and 24 (story-06, usecase-07). Business Logic rules 4, 5, 7; CLAUDE.md rule 8.
// Acceptance (UC7 section 13): saving a workout grows the balance; passing the personal goal credits it and the
// feedback says so; correcting a result does not change the balance; redeeming lowers it and shows to the coach;
// a balance below the price refuses the redemption. The attendance event arrives with classes, in stage 4c.
import { type ErrorCode, fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isID = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// Each event comes from one module only, and its amount is in SETTINGS (stage 4b plan, execution decision 1).
const EVENTS: Record<string, { caller: string; setting: string }> = {
  workout: { caller: "M04", setting: "coinsWorkout" },
  challenge: { caller: "M08", setting: "coinsChallenge" },
  attendance: { caller: "M11", setting: "coinsAttendance" },
};

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

// A number of coins from SETTINGS, through the Orchestrator. Missing or not a whole positive number is VALUE_NOT_SET
// (UC7 c); a failure of the inner request keeps its own code.
async function coinsFor(ctx: ModuleContext, key: string): Promise<number | ErrorCode> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key } });
  if (!r.ok) return r.error!.code;
  const n = Number((r.data as Record<string, string>)[key]);
  return Number.isInteger(n) && n > 0 ? n : "VALUE_NOT_SET";
}

// The catalog and the redemptions to deliver, as S10 shows them (module map, coins.manage_rewards).
async function catalog(ctx: ModuleContext) {
  const [rewards, redemptions] = await Promise.all([ctx.repo.listRewards(ctx.actor.coachID), ctx.repo.listRedemptions(ctx.actor.coachID)]);
  return { rewards, redemptions };
}

export const coins: ModuleDef = {
  id: "M07",
  actions: {
    // UC7 steps 3-5, asked by results, challenges and classes only (Registry). One award per event (step 4, UC7 b):
    // a second request for the same eventRef is COINS_ALREADY_AWARDED, and credits nothing.
    // For a workout, the personal goal is checked too: reached, it is credited once and closed (UC7 step 1).
    async award(ctx, payload) {
      const event = EVENTS[String(payload.reason)];
      if (!event || event.caller !== ctx.caller) return fail("NOT_ALLOWED");
      const traineeID = await traineeInReach(ctx, payload);
      const eventRef = typeof payload.eventRef === "string" ? payload.eventRef.trim() : "";
      if (!traineeID || !eventRef) return fail("NOT_ALLOWED");

      // A workout is credited only to its own trainee; the eventRef is the WorkoutLogID (module map v4, section 4).
      const log = payload.reason === "workout" && isID(eventRef) ? await ctx.repo.getWorkoutLog(eventRef) : null;
      if (payload.reason === "workout" && log?.TraineeID !== traineeID) return fail("NOT_ALLOWED");

      const amount = await coinsFor(ctx, event.setting);
      if (typeof amount === "string") return fail(amount);
      if (!(await ctx.repo.awardCoins(traineeID, String(payload.reason), eventRef, amount))) return fail("COINS_ALREADY_AWARDED");

      let goal = false;
      let goalCoins = 0; // map v13: the coins credited for the goal in this workout, for S15
      const active = log ? await ctx.repo.getActiveGoal(traineeID) : null;
      if (log && active) {
        // The top weight in the goal's exercise, or the top reps for a bodyweight one (stage 4b plan, decision 6).
        const done = log.sets.filter((s) => s.ExerciseID === active.ExerciseID && s.isDone);
        const best = Math.max(-1, ...done.map((s) => (active.isBodyweight ? s.reps : s.weight)));
        if (best >= active.targetWeight) {
          // The goal coins go to the balance; the feedback shows the workout's coins and marks the goal (decision 2).
          const forGoal = await coinsFor(ctx, "coinsGoal");
          if (typeof forGoal === "number") goal = await ctx.repo.achieveGoal(active.PersonalGoalID, forGoal);
          if (goal && typeof forGoal === "number") goalCoins = forGoal;
        }
      }
      return ok({ coins: amount, goal, goalCoins });
    },

    // UC7 step 6: the balance is the sum of the ledger, never stored (rule 7). With the active catalog and goal.
    async get_balance(ctx, payload) {
      const traineeID = await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");
      const [history, rewards, active] = await Promise.all([
        ctx.repo.listCoinTransactions(traineeID), ctx.repo.listRewards(ctx.actor.coachID), ctx.repo.getActiveGoal(traineeID),
      ]);
      const goal = active && { PersonalGoalID: active.PersonalGoalID, ExerciseID: active.ExerciseID, exerciseName: active.exerciseName, targetWeight: active.targetWeight };
      return ok({ balance: history.reduce((sum, t) => sum + t.amount, 0), history, rewards, goal: goal ?? null });
    },

    // UC7 step 1. Changing the active goal updates it; a reached goal is closed, and a new one is set here (decision 6).
    async set_personal_goal(ctx, payload) {
      const traineeID = ctx.actor.role === "coach" ? await traineeInReach(ctx, payload) : null;
      if (!traineeID) return fail("NOT_ALLOWED");
      const target = payload.targetWeight;
      if (!isID(payload.exerciseID) || typeof target !== "number" || !Number.isFinite(target) || target <= 0) return fail("PROGRAM_INVALID");
      if (!(await ctx.repo.getExerciseInReach(payload.exerciseID, ctx.actor.coachID))) return fail("NOT_ALLOWED");
      await ctx.repo.setPersonalGoal(traineeID, payload.exerciseID, target);
      return ok(null);
    },

    // UC7 steps 2 and 9. op "add" adds a reward; a missing name or price is VALUE_NOT_SET (module map v5, decision 7).
    async manage_rewards(ctx, payload) {
      // The owner, through M13 (map v11): the list only, as the redemptions of every coach of the business and their state.
      if (ctx.actor.role === "owner") {
        if (payload.op !== undefined && payload.op !== "list") return fail("NOT_ALLOWED");
        const coaches = await ctx.repo.coachesInReach(ctx.actor.businessID, payload.coachID);
        if (!coaches) return fail("NOT_ALLOWED");
        const redemptions = [];
        for (const CoachID of coaches) {
          redemptions.push(...(await ctx.repo.listRedemptions(CoachID)).map((r) => ({ RedemptionID: r.RedemptionID, CoachID, status: r.status })));
        }
        return ok({ redemptions });
      }
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      if (payload.op === "add") {
        const name = typeof payload.rewardName === "string" ? payload.rewardName.trim() : "";
        const price = payload.priceCoins;
        if (!name || !Number.isInteger(price) || (price as number) <= 0) return fail("VALUE_NOT_SET");
        await ctx.repo.addReward(ctx.actor.coachID, name, price as number);
      }
      return ok(await catalog(ctx));
    },

    // UC7 steps 7-8 and alternative a. Atomic: the balance check, the debit and the redemption (decision 4).
    async redeem_reward(ctx, payload) {
      if (!ctx.actor.traineeID || !isID(payload.rewardID)) return fail("NOT_ALLOWED");
      const r = await ctx.repo.redeemReward(ctx.actor.traineeID, payload.rewardID);
      if (r.status === "insufficient") return fail("COINS_INSUFFICIENT");
      if (r.status === "no_reward") return fail("NOT_ALLOWED");
      return ok({ balance: r.balance });
    },

    // UC7 step 9 and alternative e: the coach marks a redemption of their own trainee delivered.
    async mark_reward_delivered(ctx, payload) {
      if (ctx.actor.role !== "coach" || !isID(payload.redemptionID)) return fail("NOT_ALLOWED");
      if (!(await ctx.repo.markRewardDelivered(payload.redemptionID, ctx.actor.coachID))) return fail("NOT_ALLOWED");
      return ok(null);
    },
  },
};
