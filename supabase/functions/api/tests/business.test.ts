// Unit tests for M15 business, home.get_owner_home, the owner's reach in the existing actions, and the role the
// Orchestrator chooses (stage 4e plan, tasks 4 and 6-8), with the real modules over an in-memory Repository (synthetic).
// Sources: usecase-12 sections 4, 6, 13; doc-module-map v11 sections 2 (rules 5, 9, 10) and 4 (the role, business, home,
// the structure of each reply); stage 4e plan, decisions 4, 5, 7, 8, 10 and execution decisions 2, 3.
import { assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef, type Modules } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { business } from "../modules/business.ts";
import { challenges } from "../modules/challenges.ts";
import { classes } from "../modules/classes.ts";
import { coins } from "../modules/coins.ts";
import { home } from "../modules/home.ts";
import { payments } from "../modules/payments.ts";
import { progress } from "../modules/progress.ts";
import { results } from "../modules/results.ts";
import { settings } from "../modules/settings.ts";
import { trainees } from "../modules/trainees.ts";
import type { Actor, CoachJoinResult, GroupClass, NewInvite, PaymentRequest, Redemption, TraineeListRow } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const B1 = U(100), B2 = U(200);
const K1 = U(1), K2 = U(2), K3 = U(3); // K1 is the owner's own coach role; K2 joined B1; K3 is of another business
const T1 = U(11), T2 = U(12), T3 = U(13);
const COACH_OF: Record<string, string> = { [T1]: K1, [T2]: K2, [T3]: K3 };
const BUSINESS_OF: Record<string, string> = { [K1]: B1, [K2]: B1, [K3]: B2 };

const owner: Actor = { role: "owner", roles: ["owner", "coach"], businessID: B1, coachID: K1, traineeID: null, fullName: "בעלים (test)" };
const otherOwner: Actor = { role: "owner", roles: ["owner", "coach"], businessID: B2, coachID: K3, traineeID: null };
const coachK2: Actor = { role: "coach", roles: ["coach"], businessID: B1, coachID: K2, traineeID: null };
const newcomer: Actor = { role: "trainee", roles: ["trainee"], businessID: null, coachID: "", traineeID: null, authUserID: U(90), email: "shira@example.com" };

const MODULES: Modules = { business, challenges, classes, coins, home, payments, progress, results, settings, trainees, invite_channel: sender(true) };

function sender(works: boolean): ModuleDef {
  return { id: "I03", actions: { send_invite: async () => (works ? ok(null) : fail("INVITE_DELIVERY_FAILED")) } };
}

const now = () => new Date().toISOString();
const soon = () => new Date(Date.now() + 60_000).toISOString();

function world(opts: { join?: CoachJoinResult; failing?: string } = {}) {
  const invites: (NewInvite & { businessID: string })[] = [];
  const joins: string[] = [];
  const row = (TraineeID: string, fullName: string, hasProgram: boolean): TraineeListRow =>
    ({ TraineeID, InviteID: null, fullName, isActive: true, joined: true, hasProgram });
  const TRAINEES: Record<string, TraineeListRow[]> = {
    [K1]: [row(T1, "נועה (test)", true)],
    [K2]: [row(T2, "איתי (test)", false), { TraineeID: null, InviteID: U(50), fullName: "רון (test)", isActive: true, joined: false, hasProgram: false }],
    [K3]: [row(T3, "זר (test)", true)],
  };
  const pay = (id: number, CoachID: string, TraineeID: string, amount: number, paid: boolean): PaymentRequest => ({
    PaymentRequestID: U(id), CoachID, TraineeID, fullName: "x (test)", paymentType: "monthly", amount,
    status: paid ? "paid" : "open", createdAt: now(), paidAt: paid ? now() : null, invoiceNumber: paid ? id : null,
  });
  const PAYMENTS = [pay(61, K1, T1, 350, true), pay(62, K2, T2, 600, false), pay(63, K3, T3, 999, true)];
  const klass = (CoachID: string, capacity: number, registered: number): GroupClass => ({
    ClassID: U(70 + capacity), CoachID, startsAt: soon(), place: "סטודיו (test)", capacity, status: "active",
    registrations: Array.from({ length: registered }, (_, i) => ({
      ClassRegistrationID: U(80 + i), TraineeID: T1, fullName: "x", status: "registered" as const, waitlistPosition: null, offerExpiresAt: null, attended: null,
    })),
  });
  const CLASSES: Record<string, GroupClass[]> = { [K1]: [klass(K1, 8, 2)], [K2]: [klass(K2, 4, 1)], [K3]: [klass(K3, 9, 9)] };
  const redemption = (n: number, status: "pending" | "delivered"): Redemption =>
    ({ RedemptionID: U(n), TraineeID: T1, fullName: "x", RewardID: U(91), rewardName: "x", status, deliveredAt: null, createdAt: now() });
  const REDEMPTIONS: Record<string, Redemption[]> = { [K1]: [redemption(95, "pending"), redemption(96, "delivered")], [K2]: [], [K3]: [redemption(97, "pending")] };

  const w = fakeRepo({
    getBusinessSettings: async (b) => (b === B1 ? { inviteValidDays: "7", streakGapDays: "3" } : { inviteValidDays: "3", streakGapDays: "3" }),
    coachesInReach: async (b, c) => {
      if (!b) return null;
      const ids = Object.keys(BUSINESS_OF).filter((k) => BUSINESS_OF[k] === b);
      if (c === undefined || c === null || c === "") return ids;
      return typeof c === "string" && ids.includes(c) ? [c] : null;
    },
    listBusinessCoaches: async (b) => (b === B1 ? [{ CoachID: K1, fullName: "בעלים (test)" }, { CoachID: K2, fullName: "מאמן (test)" }] : [{ CoachID: K3, fullName: "זר (test)" }]),
    listOpenCoachInvites: async (b) => (b === B1 ? [{ CoachInviteID: U(55), inviteeName: "שירה (test)" }] : []),
    createCoachInvite: async (businessID, invite) => (invites.push({ ...invite, businessID }), U(56)),
    acceptCoachInvite: async (token) => (joins.push(token), opts.join ?? { status: "joined", coachID: U(4) }),
    listTraineesForCoach: async (c) => {
      if (opts.failing === "trainees") throw new Error("down");
      return TRAINEES[c] ?? [];
    },
    listPaymentRequests: async (c) => PAYMENTS.filter((p) => p.CoachID === c),
    listClasses: async (c) => CLASSES[c] ?? [],
    listRedemptions: async (c) => REDEMPTIONS[c] ?? [],
    getChallengeForWeek: async (c, weekStart) =>
      c === K1 ? { ChallengeID: U(98), challengeName: "x", challengeType: "count", targetValue: 3, ExerciseID: null, exerciseName: null, extraPrize: null, weekStart } : null,
    listCompletions: async () => [{ TraineeID: T1, fullName: "נועה (test)", completedAt: now(), prizeDeliveredAt: null }],
    countWorkoutsSince: async (ids) => Object.fromEntries(ids.map((id) => [id, id === T1 ? 2 : 0])),
    businessOfTrainee: async (t) => BUSINESS_OF[COACH_OF[t]] ?? null,
    listResults: async (t) => (t === T1 ? [{ WorkoutLogID: U(99), TraineeID: T1, WorkoutID: U(98), workoutName: "x", performedAt: now(), sets: [] }] : []),
    isActiveTraineeOfCoach: async (t, c) => COACH_OF[t] === c,
  });
  return { ...w, invites, joins };
}

const ask = (w: ReturnType<typeof world>, caller: string, module: string, action: string, actor: Actor, payload: Record<string, unknown> = {}, modules = MODULES) =>
  handle({ caller, module, action, payload }, actor, w.repo, modules);

// ---- The role (map v11, "the role"; stage 4e plan, decision 4) ----

Deno.test("the role: owner first where the owner has a row; the coach's row otherwise; as the owner, no coach of its own", async () => {
  const seen: Actor[] = [];
  const spy: ModuleDef = { id: "M99", actions: { look: async (ctx) => (seen.push(ctx.actor), ok(null)) } };
  const rows = new Set(["S12/owner", "S12/coach", "S01/coach"]);
  const { repo } = fakeRepo({ isRegistered: async (caller, _m, _a, role) => rows.has(`${caller}/${role}`) });
  await handle({ caller: "S12", module: "spy", action: "look" }, owner, repo, { spy });
  await handle({ caller: "S01", module: "spy", action: "look" }, owner, repo, { spy });
  assertEquals(seen.map((a) => [a.role, a.coachID, a.businessID]), [["owner", "", B1], ["coach", K1, B1]]);
  // No row for any of the person's roles: refused, and logged.
  const w = fakeRepo({ isRegistered: async () => false });
  assertEquals(await handle({ caller: "S24", module: "spy", action: "look" }, coachK2, w.repo, { spy }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(w.audits.map((a) => a.errorCode), [null, "ACTION_NOT_ALLOWED"]);
});

// ---- home.get_owner_home (UC12 step 2) ----

Deno.test("UC12 section 13: the overview sums every coach of the business, and none of another", async () => {
  const r = await ask(world(), "S24", "home", "get_owner_home", owner);
  assertEquals(r, ok({
    incomeMonth: 350, paidMonth: 1, openPayments: 1, openAmount: 600,
    coaches: 2, pendingCoaches: 1, activeTrainees: 2,
    classesWeek: { registered: 3, capacity: 12 },
    rewardsToDeliver: 1,
  }));
  const other = await ask(world(), "S24", "home", "get_owner_home", otherOwner);
  assertEquals([(other.data as Record<string, unknown>).incomeMonth, (other.data as Record<string, unknown>).coaches], [999, 1]);
});

Deno.test("UC12 g: an inner request that fails leaves its field empty, and the rest of the overview still comes", async () => {
  const r = await ask(world({ failing: "trainees" }), "S24", "home", "get_owner_home", owner);
  const d = r.data as Record<string, unknown>;
  assertEquals([r.ok, d.activeTrainees, d.incomeMonth], [true, null, 350]);
});

Deno.test("a coach does not get the owner's home", async () => {
  assertEquals(await ask(world(), "S24", "home", "get_owner_home", coachK2), fail("NOT_ALLOWED"));
});

// ---- business.list_coaches, invite_coach, accept_coach_invite (UC12 steps 3-7) ----

Deno.test("list_coaches: the coaches with their trainees, the owner among them, and the open invite as not joined", async () => {
  assertEquals(await ask(world(), "S25", "business", "list_coaches", owner), ok([
    { CoachID: K1, CoachInviteID: null, fullName: "בעלים (test)", joined: true, trainees: 1 },
    { CoachID: K2, CoachInviteID: null, fullName: "מאמן (test)", joined: true, trainees: 1 },
    { CoachID: null, CoachInviteID: U(55), fullName: "שירה (test)", joined: false, trainees: 0 },
  ]));
});

Deno.test("invite_coach: a link SITE_URL?coach=token, valid inviteValidDays days of the business", async () => {
  Deno.env.set("SITE_URL", "https://example.test/app/");
  const w = world();
  const r = await ask(w, "S25", "business", "invite_coach", owner, { name: " שירה ", email: "", channel: "link" });
  const link = new URL((r.data as { link: string }).link);
  assertEquals([link.origin + link.pathname, link.searchParams.get("coach"), w.invites[0].token], ["https://example.test/app/", w.invites[0].token, link.searchParams.get("coach")]);
  assertEquals([w.invites[0].businessID, w.invites[0].inviteeName], [B1, "שירה"]);
  const days = (Date.parse(w.invites[0].expiresAt) - Date.now()) / 86_400_000;
  assertEquals(days > 6.99 && days <= 7, true);
});

Deno.test("UC12 b, c: a bad contact detail creates nothing; a channel that fails is INVITE_DELIVERY_FAILED, the invite stays", async () => {
  Deno.env.set("SITE_URL", "https://example.test/app/");
  const w = world();
  for (const p of [{ name: "", channel: "link" }, { name: "x", channel: "fax" }, { name: "x", email: "no-at", channel: "email" }]) {
    assertEquals(await ask(w, "S25", "business", "invite_coach", owner, p), fail("INVITE_INVALID"), JSON.stringify(p));
  }
  assertEquals(w.invites.length, 0);
  const failing = await ask(w, "S25", "business", "invite_coach", owner, { name: "x", email: "x@example.com", channel: "email" },
    { ...MODULES, invite_channel: sender(false) });
  assertEquals([failing, w.invites.length], [fail("INVITE_DELIVERY_FAILED"), 1]);
});

Deno.test("a coach cannot invite a coach, list the coaches, or open a card", async () => {
  const w = world();
  assertEquals(await ask(w, "S25", "business", "invite_coach", coachK2, { name: "x", channel: "link" }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, "S25", "business", "list_coaches", coachK2), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, "S27", "business", "get_coach_card", coachK2, { coachID: K2 }), fail("NOT_ALLOWED"));
  assertEquals(w.invites.length, 0);
});

Deno.test("accept_coach_invite: a newcomer joins; expired or used is INVITE_EXPIRED; someone already in is NOT_ALLOWED", async () => {
  assertEquals(await ask(world(), "S22", "business", "accept_coach_invite", newcomer, { token: "abc", fullName: "שירה" }), ok({ CoachID: U(4) }));
  assertEquals(await ask(world({ join: { status: "expired" } }), "S22", "business", "accept_coach_invite", newcomer, { token: "abc" }), fail("INVITE_EXPIRED"));
  assertEquals(await ask(world(), "S22", "business", "accept_coach_invite", newcomer, {}), fail("INVITE_EXPIRED"));
  assertEquals(await ask(world({ join: { status: "taken" } }), "S22", "business", "accept_coach_invite", newcomer, { token: "abc" }), fail("NOT_ALLOWED"));
  const w = world();
  assertEquals(await ask(w, "S22", "business", "accept_coach_invite", coachK2, { token: "abc" }), fail("NOT_ALLOWED"));
  assertEquals(w.joins, []);
});

// ---- business.get_coach_card (UC12 step 8; rule 5) ----

Deno.test("get_coach_card: names, programs, streaks, income and upcoming classes; no results, notes or goals", async () => {
  const r = await ask(world(), "S27", "business", "get_coach_card", owner, { coachID: K1 });
  assertEquals(r, ok({
    coach: { CoachID: K1, fullName: "בעלים (test)" },
    trainees: [{ TraineeID: T1, fullName: "נועה (test)", hasProgram: true, streak: 1 }],
    income: 350,
    upcomingClasses: 1,
  }));
  assertEquals(/reps|weight|noteText|goal|sets/i.test(JSON.stringify(r)), false);
});

Deno.test("UC12 section 13: an owner asking for a coach of another business gets NOT_ALLOWED, and it is logged", async () => {
  const w = world();
  assertEquals(await ask(w, "S27", "business", "get_coach_card", owner, { coachID: K3 }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, "S27", "business", "get_coach_card", owner, { coachID: "not-an-id" }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, "S27", "business", "get_coach_card", owner), fail("NOT_ALLOWED"));
  assertEquals(w.audits.filter((a) => a.actionName === "get_coach_card" && !a.isOk).map((a) => a.errorCode), ["NOT_ALLOWED", "NOT_ALLOWED", "NOT_ALLOWED"]);
});

// ---- business.get_kpis (UC12 step 9) ----

Deno.test("get_kpis: the measures of the whole business, without targets", async () => {
  assertEquals(await ask(world(), "S26", "business", "get_kpis", owner), ok({
    activeTrainees: 2, withProgram: 1, invoicedPayments: 1, allPayments: 2, challengeCompletions: 1, loggedThisWeek: 1,
  }));
});

// ---- The owner's reach in the existing actions (stage 4e plan, decision 5) ----

Deno.test("results.list_results for the owner: counts per trainee only, never the sets", async () => {
  const r = await ask(world(), "M15", "results", "list_results", owner, { since: new Date(0).toISOString() });
  assertEquals(r, ok([{ TraineeID: T1, CoachID: K1, workouts: 2 }, { TraineeID: T2, CoachID: K2, workouts: 0 }]));
});

Deno.test("the owner reads only: manage_rewards beyond the list, and a coach outside the business, are NOT_ALLOWED", async () => {
  const w = world();
  // As the screen's request set it: the owner's role, with no coach of its own.
  const asOwner: Actor = { ...owner, coachID: "" };
  assertEquals(await ask(w, "M13", "coins", "manage_rewards", asOwner, { op: "add", rewardName: "x", priceCoins: 5 }), fail("NOT_ALLOWED"));
  for (const [module, action] of [["payments", "list_payments"], ["trainees", "list_trainees"], ["classes", "list_upcoming_classes"], ["challenges", "list_completions"]]) {
    assertEquals(await ask(w, "M15", module, action, asOwner, { coachID: K3 }), fail("NOT_ALLOWED"), action);
  }
  assertEquals(await ask(w, "M15", "progress", "get_streak", asOwner, { traineeID: T3 }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, "M15", "progress", "get_streak", asOwner, { traineeID: T2 }), ok({ streak: 0, streakGapDays: 3 }));
});

Deno.test("decision 6: an owner who is not a coach reads the business the same way, and the settings with canEdit", async () => {
  const ownerOnly: Actor = { role: "owner", roles: ["owner"], businessID: B1, coachID: "", traineeID: null };
  const w = world();
  const home = await ask(w, "S24", "home", "get_owner_home", ownerOnly);
  assertEquals([home.ok, (home.data as Record<string, unknown>).coaches, (home.data as Record<string, unknown>).incomeMonth], [true, 2, 350]);
  assertEquals((await ask(w, "S12", "settings", "get_settings", ownerOnly)).data, { inviteValidDays: "7", streakGapDays: "3", canEdit: true });
  // No coach of their own: a coach's screen gives nothing (no Registry row for the owner, so it is refused).
  const none = fakeRepo({ isRegistered: async (_c, _m, _a, role) => role !== "owner" });
  assertEquals(await handle({ caller: "S01", module: "home", action: "get_coach_home" }, ownerOnly, none.repo, MODULES), fail("ACTION_NOT_ALLOWED"));
});
