// M02 exercises. Stage 3 builds list_exercises only, the one S04 needs (stage 3 plan, decision 4).
// Requirements 1 and 10 (story-01, story-10; usecase-01 step 4). The rest of the module comes in stage 4a.
import { ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

export const exercises: ModuleDef = {
  id: "M02",
  actions: {
    // The ready-made list and the coach's own exercises, active only.
    async list_exercises(ctx) {
      return ok(await ctx.repo.listExercisesForCoach(ctx.actor.coachID));
    },
  },
};
