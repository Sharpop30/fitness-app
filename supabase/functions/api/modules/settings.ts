// M14 settings: the reference values the coach changes without code.
// Stage 1 builds get_settings only, as the one real action the contract test routes to.
// Requirement: doc-mlp-scope, values kept in a reference table (stories 2, 5, 6, 21, 25, 30).
import { fail, ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

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
  },
};
