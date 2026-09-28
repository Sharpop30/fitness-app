// Unit tests for M01 trainees, against an in-memory Repository (synthetic data).
// Sources: usecase-04 steps 1-3, 6, alternatives b, c, e; doc-module-map section 4; CLAUDE.md rule 8.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef, type Modules } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { trainees } from "../modules/trainees.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type NewInvite, StorageUnavailable, type TraineeListRow } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const DAY_MS = 24 * 60 * 60 * 1000;

function world(opts: { settings?: Record<string, string>; storageDown?: boolean } = {}) {
  const invites: (NewInvite & { coachID: string })[] = [];
  const list: TraineeListRow[] = [
    { TraineeID: U(11), InviteID: null, fullName: "נועה", isActive: true, joined: true, hasProgram: true },
    { TraineeID: null, InviteID: U(61), fullName: "רון", isActive: true, joined: false, hasProgram: false },
  ];
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const { repo, audits } = fakeRepo({
    getCoachSettings: async () => (down(), opts.settings ?? { inviteValidDays: "7" }),
    listTraineesForCoach: async (c) => (down(), c === COACH ? list : []),
    createInvite: async (coachID, invite) => { down(); invites.push({ coachID, ...invite }); return U(62); },
  });
  return { repo, audits, invites };
}

// The invite channel (I03) comes in stage 5; these stand in for it.
const channel = (reply: ReturnType<typeof ok | typeof fail>, seen: unknown[] = []): ModuleDef =>
  ({ id: "I03", actions: { send_invite: async (_ctx, payload) => (seen.push(payload), reply) } });

const invite = (w: ReturnType<typeof world>, payload: Record<string, unknown>, extra: Modules = {}) =>
  handle({ caller: "S02", module: "trainees", action: "invite_trainee", payload }, coach, w.repo, { trainees, settings, ...extra });

Deno.test("list_trainees: the coach's joined trainees and open invites, as the Repository gives them", async () => {
  const w = world();
  const r = await handle({ caller: "S02", module: "trainees", action: "list_trainees" }, coach, w.repo, { trainees });
  assertEquals(r.ok, true);
  assertEquals((r.data as TraineeListRow[]).map((t) => [t.fullName, t.joined, t.hasProgram]), [["נועה", true, true], ["רון", false, false]]);
});

Deno.test("UC4 steps 1-3: an invite by link is saved open, valid for the days in SETTINGS, and returns a link", async () => {
  const w = world();
  const before = Date.now();
  const r = await invite(w, { name: " דנה ", email: "", channel: "link" });
  assertEquals(r.ok, true);
  const link = (r.data as { link: string }).link;
  assert(link.startsWith("#join-"));
  assertEquals(w.invites.length, 1);
  const saved = w.invites[0];
  assertEquals([saved.coachID, saved.inviteeName, saved.inviteeEmail], [COACH, "דנה", null]);
  assertEquals(link, `#join-${saved.token}`);
  const days = (Date.parse(saved.expiresAt) - before) / DAY_MS;
  assert(days > 6.99 && days < 7.01, `expires in ${days} days`);
});

Deno.test("every invite gets its own token", async () => {
  const w = world();
  await invite(w, { name: "א", channel: "link" });
  await invite(w, { name: "ב", channel: "link" });
  assert(w.invites[0].token !== w.invites[1].token);
});

Deno.test("UC4 b: a missing name, an unknown channel or a bad email is INVITE_INVALID, and nothing is saved", async () => {
  const w = world();
  for (const payload of [
    { name: "  ", channel: "link" },
    { name: "דנה", channel: "sms" },
    { name: "דנה", email: "", channel: "email" },
    { name: "דנה", email: "dana@", channel: "email" },
    { name: "דנה", email: "not an email", channel: "link" },
  ]) {
    assertEquals(await invite(w, payload), fail("INVITE_INVALID"));
  }
  assertEquals(w.invites, []);
});

Deno.test("rule 8: with no invite validity in SETTINGS, or a value that is not a number of days, VALUE_NOT_SET", async () => {
  for (const values of [{}, { inviteValidDays: "soon" }, { inviteValidDays: "0" }] as Record<string, string>[]) {
    const w = world({ settings: values });
    assertEquals(await invite(w, { name: "דנה", channel: "link" }), fail("VALUE_NOT_SET"));
    assertEquals(w.invites, []);
  }
});

Deno.test("UC4 c: when the email channel fails, INVITE_DELIVERY_FAILED, and the invite stays open", async () => {
  const unbuilt = world(); // no invite_channel module yet: the Orchestrator answers ACTION_NOT_ALLOWED
  assertEquals(await invite(unbuilt, { name: "דנה", email: "dana@example.com", channel: "email" }), fail("INVITE_DELIVERY_FAILED"));
  assertEquals(unbuilt.invites.length, 1);

  const failing = world();
  const r = await invite(failing, { name: "דנה", email: "dana@example.com", channel: "email" }, { invite_channel: channel(fail("UNEXPECTED_ERROR")) });
  assertEquals(r, fail("INVITE_DELIVERY_FAILED"));
  assertEquals(failing.invites.length, 1);
});

Deno.test("UC4 step 3: by email, the channel gets the name, the address and the link, through the Orchestrator as M01", async () => {
  const w = world();
  const seen: unknown[] = [];
  const r = await invite(w, { name: "דנה", email: "dana@example.com", channel: "email" }, { invite_channel: channel(ok(null), seen) });
  assertEquals(r.ok, true);
  assertEquals(seen, [{ name: "דנה", email: "dana@example.com", link: (r.data as { link: string }).link }]);
  const inner = w.audits.filter((a) => a.moduleName === "invite_channel");
  assertEquals(inner.map((a) => a.caller), ["M01", "M01"]);
  assertEquals(new Set(w.audits.map((a) => a.requestID)).size, 1);
});

Deno.test("UC4 section 7: a database that fails gives STORAGE_UNAVAILABLE, without throwing", async () => {
  const w = world({ storageDown: true });
  assertEquals(await handle({ caller: "S02", module: "trainees", action: "list_trainees" }, coach, w.repo, { trainees }), fail("STORAGE_UNAVAILABLE"));
  // Reading SETTINGS fails inside the inner request; its code comes back, not VALUE_NOT_SET.
  assertEquals(await invite(w, { name: "דנה", channel: "link" }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(w.invites, []);
});

// ---- get_trainee_card (UC4 step 7; module map v8; stage 4d plan, execution decision 4) ----

// Stand-ins for the four modules the card reads, answering one action each.
const answer = (id: string, action: string, reply: ReturnType<typeof ok | typeof fail>): ModuleDef =>
  ({ id, actions: { [action]: async () => reply } });

const cardModules = (over: Modules = {}): Modules => ({
  programs: answer("M03", "get_active_program", ok({ workouts: [{}, {}, {}] })),
  coins: answer("M07", "get_balance", ok({ balance: 75, goal: { exerciseName: "סקוואט (test)", targetWeight: 80 } })),
  payments: answer("M09", "list_payments", ok([{ status: "open" }, { status: "paid" }])),
  progress: answer("M05", "get_streak", ok({ streak: 4, streakGapDays: 3 })),
  ...over,
});

function cardWorld() {
  const w = world();
  w.repo.isActiveTraineeOfCoach = async (t, c) => c === COACH && t === U(11);
  return w;
}
const card = (w: ReturnType<typeof world>, modules: Modules, traineeID: string = U(11), actor: Actor = coach) =>
  handle({ caller: "S03", module: "trainees", action: "get_trainee_card", payload: { traineeID } }, actor, w.repo, { trainees, ...modules });

Deno.test("UC4 step 7: the card shows program, coins, streak, payments and goal, made of existing actions", async () => {
  const w = cardWorld();
  assertEquals(await card(w, cardModules()), ok({
    trainee: { TraineeID: U(11), fullName: "נועה", isActive: true },
    coins: 75, streak: 4, openPayments: 1, workouts: 3, payments: 2,
    goal: { exerciseName: "סקוואט (test)", targetWeight: 80 },
  }));
  // One Audit trail: the screen's request and the four inner requests share one requestID.
  const id = w.audits.find((a) => a.caller === "S03")!.requestID;
  const inner = new Set(w.audits.filter((a) => a.requestID === id && a.caller === "M01").map((a) => a.moduleName));
  assertEquals(inner, new Set(["programs", "coins", "payments", "progress"]));
});

Deno.test("execution decision 4: no active program is 0 workouts; an item that fails comes back empty, and the rest still comes", async () => {
  const d = (await card(cardWorld(), cardModules({
    programs: answer("M03", "get_active_program", fail("NO_ACTIVE_PROGRAM")),
    payments: answer("M09", "list_payments", fail("STORAGE_UNAVAILABLE")),
  }))).data as Record<string, unknown>;
  assertEquals([d.workouts, d.openPayments, d.payments, d.coins, d.streak], [0, null, null, 75, 4]);
  const e = (await card(cardWorld(), cardModules({ programs: answer("M03", "get_active_program", fail("STORAGE_UNAVAILABLE")) }))).data as Record<string, unknown>;
  assertEquals(e.workouts, null);
  const g = (await card(cardWorld(), cardModules({ coins: answer("M07", "get_balance", ok({ balance: 0, goal: null })) }))).data as Record<string, unknown>;
  assertEquals(g.goal, null);
});

Deno.test("rule 5: a trainee of another coach, a bad ID, or a trainee asking, is NOT_ALLOWED", async () => {
  const w = cardWorld();
  assertEquals(await card(w, cardModules(), U(99)), fail("NOT_ALLOWED"));
  assertEquals(await card(w, cardModules(), "not-an-id"), fail("NOT_ALLOWED"));
  assertEquals(await card(w, cardModules(), U(11), { role: "trainee", coachID: COACH, traineeID: U(11) }), fail("NOT_ALLOWED"));
});
