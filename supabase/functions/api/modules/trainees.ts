// M01 trainees: inviting a trainee and the coach's trainee list.
// Requirement 19, unified operations (story-19, usecase-04 steps 1-3, 6; alternatives b, c, e).
// Stage 4a builds list_trainees and invite_trainee; stage 4d builds get_trainee_card (UC4 step 7). accept_invite comes
// with the identity service, in stage 5 (stage 4a plan, decisions 3, 6).
// Acceptance (UC4 section 13): an invite appears in the list as "invited"; a bad contact detail creates nothing;
// a channel that fails leaves the invite open; the trainee card shows program, coins, streak and payments in one screen.
import { type ErrorCode, fail, ok, type Reply } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

// One item of the card: the data of a reply that worked, or null for one that failed (as home, UC9 c).
const dataOf = <T>(r: Reply): T | null => (r.ok ? (r.data as T) : null);

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

    // UC4 step 7, made of existing actions through the Orchestrator (module map v8, its contract).
    async get_trainee_card(ctx, payload) {
      const traineeID = payload.traineeID;
      if (ctx.actor.role !== "coach" || typeof traineeID !== "string" || !UUID.test(traineeID)) return fail("NOT_ALLOWED");
      if (!(await ctx.repo.isActiveTraineeOfCoach(traineeID, ctx.actor.coachID))) return fail("NOT_ALLOWED"); // rule 5
      const trainee = (await ctx.repo.listTraineesForCoach(ctx.actor.coachID)).find((t) => t.TraineeID === traineeID);
      if (!trainee) return fail("NOT_ALLOWED");

      const ask = (module: string, action: string) => ctx.call({ module, action, payload: { traineeID } });
      const [program, balance, payments, streak] = await Promise.all([
        ask("programs", "get_active_program"),
        ask("coins", "get_balance"),
        ask("payments", "list_payments"),
        ask("progress", "get_streak"),
      ]);

      // No active program is a trainee without one, not a failure of the card (stage 4d plan, execution decision 4).
      const workouts = program.ok
        ? (program.data as { workouts: unknown[] }).workouts.length
        : program.error?.code === "NO_ACTIVE_PROGRAM" ? 0 : null;
      const coins = dataOf<{ balance: number; goal: unknown }>(balance);
      const list = dataOf<{ status: string }[]>(payments);

      return ok({
        trainee: { TraineeID: trainee.TraineeID, fullName: trainee.fullName, isActive: trainee.isActive },
        coins: coins?.balance ?? null,
        streak: dataOf<{ streak: number }>(streak)?.streak ?? null,
        openPayments: list ? list.filter((p) => p.status === "open").length : null,
        workouts,
        payments: list ? list.length : null,
        goal: coins?.goal ?? null,
      });
    },
  },
};
