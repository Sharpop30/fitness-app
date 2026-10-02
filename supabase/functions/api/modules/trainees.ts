// M01 trainees: inviting a trainee and the coach's trainee list.
// Requirement 19, unified operations (story-19, usecase-04 steps 1-3, 6; alternatives b, c, e).
// Stage 4a builds list_trainees and invite_trainee; stage 4d builds get_trainee_card (UC4 step 7); stage 5 builds
// accept_invite and get_me, with the identity service (UC4 steps 4, 5; module map v9).
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

// An invite token as newToken makes it: 24 random bytes in hex. Anything else is not a token (map v13, check).
const TOKEN = /^[0-9a-f]{48}$/;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const trainees: ModuleDef = {
  id: "M01",
  actions: {
    // Joined trainees, and open invites as "invited" (UC4 step 6). An empty list is UC4 alternative e, for the screen.
    async list_trainees(ctx, payload) {
      // The owner, through M13 and M15 (map v11): the trainees of every coach of the business, or of the coach asked.
      if (ctx.actor.role === "owner") {
        const coaches = await ctx.repo.coachesInReach(ctx.actor.businessID, payload.coachID);
        if (!coaches) return fail("NOT_ALLOWED");
        const rows = [];
        for (const CoachID of coaches) rows.push(...(await ctx.repo.listTraineesForCoach(CoachID)).map((t) => ({ ...t, CoachID })));
        return ok(rows);
      }
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
      // The full link to the site (stage 5 plan, decision 2). A query, not a #, because the identity service adds the
      // sign-in after a # when the email's button returns here.
      const site = Deno.env.get("SITE_URL");
      if (!site) return fail("VALUE_NOT_SET");

      const token = newToken();
      await ctx.repo.createInvite(ctx.actor.coachID, {
        inviteeName: name,
        inviteeEmail: email || null,
        token,
        expiresAt: new Date(Date.now() + days * DAY_MS).toISOString(),
      });
      const url = new URL(site);
      url.searchParams.set("join", token);
      const link = url.toString();

      if (channel === "email") {
        const sent = await ctx.call({ module: "invite_channel", action: "send_invite", payload: { name, email, link } });
        // UC4 alternative c: the invite stays open, and the coach can send again or copy the link.
        if (!sent.ok) return fail("INVITE_DELIVERY_FAILED");
      }
      return ok({ link });
    },

    // Map v13 (usecase-04 v4, step 4): S22 checks the invite when it opens, before signing up, so a link that
    // expired leaves no identity user behind. Anyone holding the link may ask, signed in or not. Expired, used and unknown
    // are one code, so the reply does not tell whether a token ever existed.
    async check_invite(ctx, payload) {
      const token = typeof payload.token === "string" ? payload.token : "";
      if (!TOKEN.test(token)) return fail("INVITE_EXPIRED");
      const fullName = await ctx.repo.inviteByToken(token);
      return fullName === null ? fail("INVITE_EXPIRED") : ok({ fullName });
    },

    // UC4 steps 4, 5, alternatives a, d (stage 5 plan, decision 3). Only a newcomer: signed in with the identity service,
    // not yet a coach or a trainee. The email is the identity service's; the name from the form, or the invite's.
    async accept_invite(ctx, payload) {
      const { authUserID, email } = ctx.actor;
      if (ctx.actor.role !== "trainee" || ctx.actor.traineeID || !authUserID || !email) return fail("NOT_ALLOWED"); // UC4 d
      if (typeof payload.token !== "string" || !payload.token) return fail("INVITE_EXPIRED");
      const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
      const joined = await ctx.repo.acceptInvite(payload.token, authUserID, fullName, email);
      if (joined.status === "taken") return fail("NOT_ALLOWED");
      if (joined.status === "expired") return fail("INVITE_EXPIRED"); // UC4 a; used is the same (execution decision 2)
      return ok({ TraineeID: joined.traineeID });
    },

    // S23 after signing in: who this is (stage 5 plan, decision 1), with every role (map v11). A newcomer, who has no
    // business yet, is not anyone yet.
    async get_me(ctx) {
      if (!ctx.actor.businessID) return fail("NOT_ALLOWED");
      const roles = ctx.actor.roles?.length ? ctx.actor.roles : [ctx.actor.role];
      return ok({ roles, role: roles[0], traineeID: roles[0] === "trainee" ? ctx.actor.traineeID : null, fullName: ctx.actor.fullName ?? "" });
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
