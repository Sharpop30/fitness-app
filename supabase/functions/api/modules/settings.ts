// M14 settings: the reference values of the business, which its owner changes without code (map v11, rule 9).
// Requirement: doc-mlp-scope, values kept in a reference table (stories 2, 5, 6, 15, 21, 25, 30).
// Stage 1 builds get_settings; stage 4d builds update_settings (module map v8, its contract); stage 5 builds
// get_error_texts, for S23 after signing in and S22 before joining (module map v3 and v10). Stage 4e moves SETTINGS
// to the business: the owner changes them, and the coach and the trainee read them (UC12 step 10, alternative f).
import { fail, ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

// Coins may be zero; every other number is a price, a window or a limit, and must be positive (stage 4d plan, decision 4).
const WHOLE_OR_ZERO = new Set(["coinsWorkout", "coinsGoal", "coinsChallenge", "coinsAttendance"]);
const POSITIVE = new Set([
  "priceMonthly", "pricePack10", "cancelHours", "streakGapDays", "videoMaxSeconds", "spotOfferHours", "inviteValidDays", "noteMaxLength",
  "videoMaxMegabytes",
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
      if (!ctx.actor.businessID) return fail("NOT_ALLOWED");
      const values = await ctx.repo.getBusinessSettings(ctx.actor.businessID);
      const key = typeof payload.key === "string" ? payload.key : null;
      // All the values, and whether this person may change them (map v11: canEdit, true for the owner).
      if (key === null) return ok({ ...values, canEdit: ctx.actor.role === "owner" });
      // "Not yet" is its own code: a missing value is never invented (CLAUDE.md rule 8).
      return key in values ? ok({ [key]: values[key] }) : fail("VALUE_NOT_SET");
    },

    // The human text of every error code, from ERROR_CODES (map section 4: the texts live there, never in code).
    async get_error_texts(ctx) {
      return ok(await ctx.repo.listErrorTexts());
    },

    // Only the business's existing keys; one bad value saves nothing, and a key not sent stays as it is (4d, execution
    // decision 5). The owner only (rule 9); the coach has no Registry row for it (UC12 f).
    async update_settings(ctx, payload) {
      if (ctx.actor.role !== "owner" || !ctx.actor.businessID) return fail("NOT_ALLOWED");
      const sent = payload.values;
      if (typeof sent !== "object" || sent === null || Array.isArray(sent)) return fail("VALUE_NOT_SET");
      const current = await ctx.repo.getBusinessSettings(ctx.actor.businessID);
      const values: Record<string, string> = {};
      for (const [key, raw] of Object.entries(sent)) {
        if (!(key in current)) return fail("NOT_ALLOWED");
        const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
        if (!isValid(key, value)) return fail("VALUE_NOT_SET");
        values[key] = value;
      }
      await ctx.repo.updateBusinessSettings(ctx.actor.businessID, values);
      return ok(null);
    },
  },
};
