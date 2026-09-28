// M14 settings: the reference values the coach changes without code.
// Requirement: doc-mlp-scope, values kept in a reference table (stories 2, 5, 6, 21, 25, 30).
// Stage 1 builds get_settings; stage 4d builds update_settings (module map v8, its contract).
import { fail, ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

// Coins may be zero; every other number is a price, a window or a limit, and must be positive (stage 4d plan, decision 4).
const WHOLE_OR_ZERO = new Set(["coinsWorkout", "coinsGoal", "coinsChallenge", "coinsAttendance"]);
const POSITIVE = new Set([
  "priceMonthly", "pricePack10", "cancelHours", "streakGapDays", "videoMaxSeconds", "spotOfferHours", "inviteValidDays", "noteMaxLength",
]);

function isValid(key: string, value: string): boolean {
  if (WHOLE_OR_ZERO.has(key) || POSITIVE.has(key)) {
    if (!/^\d+$/.test(value)) return false;
    return WHOLE_OR_ZERO.has(key) || Number(value) > 0;
  }
  return value !== ""; // a text: the feedback texts and the reminder
}

export const settings: ModuleDef = {
  id: "M14",
  actions: {
    async get_settings(ctx, payload) {
      const values = await ctx.repo.getCoachSettings(ctx.actor.coachID);
      const key = typeof payload.key === "string" ? payload.key : null;
      if (key === null) return ok(values);
      // "Not yet" is its own code: a missing value is never invented (CLAUDE.md rule 8).
      return key in values ? ok({ [key]: values[key] }) : fail("VALUE_NOT_SET");
    },

    // Only the coach's existing keys; one bad value saves nothing, and a key not sent stays as it is (execution decision 5).
    async update_settings(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const sent = payload.values;
      if (typeof sent !== "object" || sent === null || Array.isArray(sent)) return fail("VALUE_NOT_SET");
      const current = await ctx.repo.getCoachSettings(ctx.actor.coachID);
      const values: Record<string, string> = {};
      for (const [key, raw] of Object.entries(sent)) {
        if (!(key in current)) return fail("NOT_ALLOWED");
        const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
        if (!isValid(key, value)) return fail("VALUE_NOT_SET");
        values[key] = value;
      }
      await ctx.repo.updateCoachSettings(ctx.actor.coachID, values);
      return ok(null);
    },
  },
};
