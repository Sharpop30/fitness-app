// M15 business: the coaches of the business, inviting and joining, the coach card, and the measures of the business.
// Requirement 15, in part: a business owner with several coaches (story-15, usecase-12 steps 3-9; alternatives a-e, g).
// Acceptance (UC12 section 13): an invited coach who joins appears in the list; the owner of one business gets
// NOT_ALLOWED for another; the coach card has no workout results and no notes (rule 5).
// The card and the measures are made of existing actions, through the Orchestrator (map v11, business).
import { type ErrorCode, fail, ok, type Reply } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// One item: the data of a reply that worked, or null for one that failed (UC12 g, as get_trainee_card).
const dataOf = <T>(r: Reply): T | null => (r.ok ? (r.data as T) : null);

type TraineeRow = { TraineeID: string | null; CoachID: string; fullName: string; isActive: boolean; joined: boolean; hasProgram: boolean };
type PaymentRow = { status: string; amount: number; invoiceNumber: number | null };
type ClassRow = { startsAt: string; status: string };

// The invite's validity, from the SETTINGS of the business (UC12 step 4; CLAUDE.md rule 8).
async function inviteValidDays(ctx: ModuleContext): Promise<number | ErrorCode> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key: "inviteValidDays" } });
  if (!r.ok) return r.error!.code;
  const days = Number((r.data as Record<string, string>).inviteValidDays);
  return Number.isInteger(days) && days > 0 ? days : "VALUE_NOT_SET";
}

// An invite token as newToken makes it: 24 random bytes in hex. Anything else is not a token (map v13, check).
const TOKEN = /^[0-9a-f]{48}$/;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const isOwner = (ctx: ModuleContext) => ctx.actor.role === "owner" && !!ctx.actor.businessID;

export const business: ModuleDef = {
  id: "M15",
  actions: {
    // UC12 steps 3-5 and alternatives b, c. The same contract as a trainee invite (stage 4e plan, decision 10).
    async invite_coach(ctx, payload) {
      if (!isOwner(ctx)) return fail("NOT_ALLOWED");
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const email = typeof payload.email === "string" ? payload.email.trim() : "";
      const channel = payload.channel;
      if (!name || (channel !== "link" && channel !== "email")) return fail("INVITE_INVALID");
      if ((channel === "email" || email) && !EMAIL.test(email)) return fail("INVITE_INVALID");

      const days = await inviteValidDays(ctx);
      if (typeof days === "string") return fail(days);
      const site = Deno.env.get("SITE_URL");
      if (!site) return fail("VALUE_NOT_SET");

      const token = newToken();
      await ctx.repo.createCoachInvite(ctx.actor.businessID!, {
        inviteeName: name,
        inviteeEmail: email || null,
        token,
        expiresAt: new Date(Date.now() + days * DAY_MS).toISOString(),
      });
      // SITE_URL?coach=token (map v11): S22 joins as a coach by it.
      const url = new URL(site);
      url.searchParams.set("coach", token);
      const link = url.toString();

      if (channel === "email") {
        const sent = await ctx.call({ module: "invite_channel", action: "send_invite", payload: { name, email, link } });
        if (!sent.ok) return fail("INVITE_DELIVERY_FAILED"); // UC12 c: the invite stays open
      }
      return ok({ link });
    },

    // Map v13 (usecase-12 v3, step 6): S22 checks the invite when it opens, before signing up, so a link that
    // expired leaves no identity user behind. Anyone holding the link may ask, signed in or not. Expired, used and unknown
    // are one code, so the reply does not tell whether a token ever existed.
    async check_coach_invite(ctx, payload) {
      const token = typeof payload.token === "string" ? payload.token : "";
      if (!TOKEN.test(token)) return fail("INVITE_EXPIRED");
      const fullName = await ctx.repo.coachInviteByToken(token);
      return fullName === null ? fail("INVITE_EXPIRED") : ok({ fullName });
    },

    // UC12 steps 6, 7 and alternatives a, d. Only a newcomer: signed in, not yet an owner, a coach or a trainee.
    async accept_coach_invite(ctx, payload) {
      const { authUserID, email } = ctx.actor;
      if (ctx.actor.role !== "trainee" || ctx.actor.traineeID || ctx.actor.businessID || !authUserID || !email) return fail("NOT_ALLOWED");
      if (typeof payload.token !== "string" || !payload.token) return fail("INVITE_EXPIRED");
      const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
      const joined = await ctx.repo.acceptCoachInvite(payload.token, authUserID, fullName, email);
      if (joined.status === "taken") return fail("NOT_ALLOWED");
      if (joined.status === "expired") return fail("INVITE_EXPIRED");
      return ok({ CoachID: joined.coachID });
    },

    // UC12 steps 3, 8 and alternative e: the coaches, the owner among them when a coach, and the open invites.
    async list_coaches(ctx) {
      if (!isOwner(ctx)) return fail("NOT_ALLOWED");
      const businessID = ctx.actor.businessID!;
      const [coaches, invites, trainees] = await Promise.all([
        ctx.repo.listBusinessCoaches(businessID),
        ctx.repo.listOpenCoachInvites(businessID),
        ctx.call({ module: "trainees", action: "list_trainees", payload: {} }),
      ]);
      const list = dataOf<TraineeRow[]>(trainees);
      const count = (coachID: string) => list ? list.filter((t) => t.CoachID === coachID && t.joined && t.isActive).length : null;
      return ok([
        ...coaches.map((c) => ({ CoachID: c.CoachID, CoachInviteID: null, fullName: c.fullName, joined: true, trainees: count(c.CoachID) })),
        ...invites.map((i) => ({ CoachID: null, CoachInviteID: i.CoachInviteID, fullName: i.inviteeName, joined: false, trainees: 0 })),
      ]);
    },

    // UC12 step 8: a coach of the business. Names and sums only: no results, notes or goals (rule 5).
    async get_coach_card(ctx, payload) {
      if (!isOwner(ctx)) return fail("NOT_ALLOWED");
      const reach = await ctx.repo.coachesInReach(ctx.actor.businessID, payload.coachID);
      const coachID = typeof payload.coachID === "string" ? payload.coachID : "";
      if (!coachID || !reach) return fail("NOT_ALLOWED");
      const coach = (await ctx.repo.listBusinessCoaches(ctx.actor.businessID!)).find((c) => c.CoachID === coachID);
      if (!coach) return fail("NOT_ALLOWED");

      const ask = (module: string, action: string) => ctx.call({ module, action, payload: { coachID } });
      const [trainees, payments, classes] = await Promise.all([
        ask("trainees", "list_trainees"), ask("payments", "list_payments"), ask("classes", "list_upcoming_classes"),
      ]);
      const joined = (dataOf<TraineeRow[]>(trainees) ?? []).filter((t) => t.TraineeID && t.joined && t.isActive);
      const streaks = await Promise.all(joined.map((t) =>
        ctx.call({ module: "progress", action: "get_streak", payload: { traineeID: t.TraineeID } })));
      const paid = dataOf<PaymentRow[]>(payments);
      const k = dataOf<{ classes: ClassRow[] }>(classes);
      const now = Date.now();

      return ok({
        coach: { CoachID: coach.CoachID, fullName: coach.fullName },
        trainees: dataOf<TraineeRow[]>(trainees) === null ? null : joined.map((t, i) => ({
          TraineeID: t.TraineeID, fullName: t.fullName, hasProgram: t.hasProgram,
          streak: dataOf<{ streak: number }>(streaks[i])?.streak ?? null,
        })),
        income: paid ? paid.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0) : null,
        upcomingClasses: k ? k.classes.filter((x) => x.status === "active" && Date.parse(x.startsAt) > now).length : null,
      });
    },

    // UC12 step 9: the measures of doc-okr-kpi that the saved data can give, for the whole business. The targets are
    // not set yet, so they are not in the reply (map v11).
    async get_kpis(ctx) {
      if (!isOwner(ctx)) return fail("NOT_ALLOWED");
      const ask = (module: string, action: string, payload: Record<string, unknown> = {}) => ctx.call({ module, action, payload });
      const [trainees, payments, completions, results] = await Promise.all([
        ask("trainees", "list_trainees"),
        ask("payments", "list_payments"),
        ask("challenges", "list_completions"),
        ask("results", "list_results", { since: new Date(Date.now() - 7 * DAY_MS).toISOString() }),
      ]);
      const active = dataOf<TraineeRow[]>(trainees)?.filter((t) => t.TraineeID && t.joined && t.isActive) ?? null;
      const pay = dataOf<PaymentRow[]>(payments);
      const done = dataOf<unknown[]>(completions);
      const logged = dataOf<{ workouts: number }[]>(results);
      return ok({
        activeTrainees: active ? active.length : null,
        withProgram: active ? active.filter((t) => t.hasProgram).length : null,
        invoicedPayments: pay ? pay.filter((p) => p.invoiceNumber !== null).length : null,
        allPayments: pay ? pay.length : null,
        challengeCompletions: done ? done.length : null,
        loggedThisWeek: logged ? logged.filter((t) => t.workouts > 0).length : null,
      });
    },
  },
};
