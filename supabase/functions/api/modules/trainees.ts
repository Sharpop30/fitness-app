// M01 trainees: inviting a trainee and the coach's trainee list.
// Requirement 19, unified operations (story-19, usecase-04 steps 1-3, 6; alternatives b, c, e).
// Stage 4a builds list_trainees and invite_trainee; accept_invite and get_trainee_card come later (stage 4a plan, decisions 3, 6).
// Acceptance (UC4 section 13): an invite appears in the list as "invited"; a bad contact detail creates nothing;
// a channel that fails leaves the invite open.
import { type ErrorCode, fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// The invite's validity comes from SETTINGS, through the Orchestrator (CLAUDE.md rule 8). A value missing or not a
// number of days is VALUE_NOT_SET; a failure of the inner request keeps its own code.
async function inviteValidDays(ctx: ModuleContext): Promise<number | ErrorCode> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key: "inviteValidDays" } });
  if (!r.ok) return r.error!.code;
  const days = Number((r.data as Record<string, string>).inviteValidDays);
  return Number.isInteger(days) && days > 0 ? days : "VALUE_NOT_SET";
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const trainees: ModuleDef = {
  id: "M01",
  actions: {
    // Joined trainees, and open invites as "invited" (UC4 step 6). An empty list is UC4 alternative e, for the screen.
    async list_trainees(ctx) {
      return ok(await ctx.repo.listTraineesForCoach(ctx.actor.coachID));
    },

    async invite_trainee(ctx, payload) {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const email = typeof payload.email === "string" ? payload.email.trim() : "";
      const channel = payload.channel;
      // UC4 alternative b: a missing name, an unknown channel, or a bad email creates nothing.
      if (!name || (channel !== "link" && channel !== "email")) return fail("INVITE_INVALID");
      if ((channel === "email" || email) && !EMAIL.test(email)) return fail("INVITE_INVALID");

      const days = await inviteValidDays(ctx);
      if (typeof days === "string") return fail(days);

      const token = newToken();
      await ctx.repo.createInvite(ctx.actor.coachID, {
        inviteeName: name,
        inviteeEmail: email || null,
        token,
        expiresAt: new Date(Date.now() + days * DAY_MS).toISOString(),
      });
      // Relative until the site address is decided in stage 5 (stage 4a plan, decision 9).
      const link = `#join-${token}`;

      if (channel === "email") {
        const sent = await ctx.call({ module: "invite_channel", action: "send_invite", payload: { name, email, link } });
        // UC4 alternative c: the invite stays open, and the coach can send again or copy the link.
        if (!sent.ok) return fail("INVITE_DELIVERY_FAILED");
      }
      return ok({ link });
    },
  },
};
