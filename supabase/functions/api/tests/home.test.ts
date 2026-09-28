// Unit tests for M13 home, with stand-ins for the modules it reads (answering one action each) and the real settings
// module, behind the Orchestrator. Sources: usecase-09 sections 4, 6, 7, 13; usecase-04 step 8; doc-module-map v5
// section 4 (home, and the structure of get_trainee_home and get_coach_home); stage 4b plan, task 7 and decision 10.
import { assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef, type Modules } from "../orchestrator.ts";
import { fail, ok, type Reply } from "../errors.ts";
import { home } from "../modules/home.ts";
import { settings } from "../modules/settings.ts";
import type { Actor } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), TRAINEE = U(11);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const trainee: Actor = { role: "trainee", coachID: COACH, traineeID: TRAINEE };
const A = U(41), B = U(42);
const TODAY = new Date().toISOString();

// A module answering the given actions with fixed replies.
const stand = (id: string, answers: Record<string, Reply>): ModuleDef =>
  ({ id, actions: Object.fromEntries(Object.entries(answers).map(([a, r]) => [a, async () => r])) });

const traineeModules = (over: Modules = {}): Modules => ({
  progress: stand("M05", { get_streak: ok({ streak: 3, streakGapDays: 3 }) }),
  coins: stand("M07", { get_balance: ok({ balance: 75, history: [], rewards: [], goal: null }) }),
  programs: stand("M03", { get_active_program: ok({ workouts: [{ WorkoutID: A, workoutName: "אימון A" }, { WorkoutID: B, workoutName: "אימון B" }] }) }),
  results: stand("M04", { list_results: ok([{ WorkoutID: A }, { WorkoutID: B }, { WorkoutID: A }]) }), // newest first
  challenges: stand("M08", { get_current_challenge: ok({ challengeName: "שלושה אימונים (test)", progress: { value: 2, target: 3, exempt: false } }) }),
  ...over,
});

function world(values: Record<string, string> = { reminderText: "יום טוב (test)", spotOfferHours: "2" }) {
  return fakeRepo({ getCoachSettings: async () => values });
}
const traineeHome = (w: ReturnType<typeof world>, modules: Modules, actor: Actor = trainee) =>
  handle({ caller: "S13", module: "home", action: "get_trainee_home", payload: {} }, actor, w.repo, { home, settings, ...modules });
const coachHome = (w: ReturnType<typeof world>, modules: Modules, actor: Actor = coach) =>
  handle({ caller: "S01", module: "home", action: "get_coach_home", payload: {} }, actor, w.repo, { home, settings, ...modules });

// ---- get_trainee_home (UC9) ----

Deno.test("UC9 section 13: the trainee's home has the reminder, streak, coins, next workout and challenge progress", async () => {
  const r = await traineeHome(world(), traineeModules());
  assertEquals(r, ok({
    reminder: "יום טוב (test)", streak: 3, streakGapDays: 3, coins: 75,
    nextWorkout: { WorkoutID: B, workoutName: "אימון B" }, // the last workout done was A
    nextClass: null, // no classes module in this test
    challenge: { challengeName: "שלושה אימונים (test)", value: 2, target: 3, exempt: false },
    offers: [],
  }));
});

Deno.test("UC9 c: an item that fails is left out, and the rest of the home still comes", async () => {
  const r = await traineeHome(world(), traineeModules({
    progress: stand("M05", { get_streak: fail("STORAGE_UNAVAILABLE") }),
    coins: stand("M07", { get_balance: fail("VALUE_NOT_SET") }),
  }));
  const d = r.data as Record<string, unknown>;
  assertEquals([r.ok, d.streak, d.streakGapDays, d.coins], [true, null, null, null]);
  assertEquals((d.nextWorkout as { WorkoutID: string }).WorkoutID, B);
});

Deno.test("UC9 steps 2-4: every item is asked through the Orchestrator as M13, under one requestID", async () => {
  const w = world();
  await traineeHome(w, traineeModules());
  const asked = w.audits.filter((a) => a.caller === "M13").map((a) => `${a.moduleName}.${a.actionName}`);
  for (const action of ["progress.get_streak", "coins.get_balance", "programs.get_active_program", "results.list_results",
    "classes.list_upcoming_classes", "challenges.get_current_challenge", "settings.get_settings"]) {
    assertEquals(asked.includes(action), true, action);
  }
  assertEquals(new Set(w.audits.map((a) => a.requestID)).size, 1);
});

Deno.test("the next workout: the one after the last done, round again after the last; the first when none was done", async () => {
  const program = traineeModules().programs;
  const next = async (logs: { WorkoutID: string }[]) =>
    ((await traineeHome(world(), traineeModules({ results: stand("M04", { list_results: ok(logs) }), programs: program }))).data as
      { nextWorkout: { WorkoutID: string } | null }).nextWorkout?.WorkoutID;
  assertEquals(await next([{ WorkoutID: B }]), A);
  assertEquals(await next([]), A);
  assertEquals(await next([{ WorkoutID: U(99) }]), A); // a workout of an old program
});

Deno.test("UC9 a: a new trainee with no program and no workouts gets a home with no next workout", async () => {
  const r = await traineeHome(world(), traineeModules({
    programs: stand("M03", { get_active_program: fail("NO_ACTIVE_PROGRAM") }),
    results: stand("M04", { list_results: ok([]) }),
    progress: stand("M05", { get_streak: ok({ streak: 0, streakGapDays: 3 }) }),
    challenges: stand("M08", { get_current_challenge: ok(null) }),
  }));
  const d = r.data as Record<string, unknown>;
  assertEquals([d.nextWorkout, d.streak, d.challenge], [null, 0, null]);
});

Deno.test("UC9 d, decision 10: a reminder text missing from SETTINGS is left empty, not made up", async () => {
  const d = (await traineeHome(world({}), traineeModules())).data as Record<string, unknown>;
  assertEquals(d.reminder, "");
});

Deno.test("stage 4c: a registered class is the next class, and an offered spot comes with spotOfferHours", async () => {
  const classes = stand("M11", { list_upcoming_classes: ok({ classes: [
    { ClassID: U(61), startsAt: "2099-10-02T15:00:00Z", place: "סטודיו", status: "active", myStatus: "registered" },
    { ClassID: U(62), startsAt: "2099-10-01T15:00:00Z", place: "פארק", status: "active", myStatus: "offered" },
    { ClassID: U(63), startsAt: "2099-09-30T15:00:00Z", place: "סטודיו", status: "active", myStatus: null },
  ] }) });
  const d = (await traineeHome(world(), traineeModules({ classes }))).data as Record<string, unknown>;
  assertEquals(d.nextClass, { startsAt: "2099-10-02T15:00:00Z", place: "סטודיו" });
  assertEquals(d.offers, [{ ClassID: U(62), startsAt: "2099-10-01T15:00:00Z", hours: 2 }]);
});

Deno.test("stage 4c execution decision 7: a cancelled class, or one that started, is not the next class", async () => {
  const classes = stand("M11", { list_upcoming_classes: ok({ classes: [
    { ClassID: U(61), startsAt: "2099-10-01T15:00:00Z", place: "בוטל", status: "cancelled", myStatus: "registered" },
    { ClassID: U(62), startsAt: "2000-01-01T15:00:00Z", place: "עבר", status: "active", myStatus: "registered" },
    { ClassID: U(63), startsAt: "2099-10-05T15:00:00Z", place: "סטודיו", status: "active", myStatus: "registered" },
  ] }) });
  const d = (await traineeHome(world(), traineeModules({ classes }))).data as Record<string, unknown>;
  assertEquals(d.nextClass, { startsAt: "2099-10-05T15:00:00Z", place: "סטודיו" });
});

Deno.test("rule 5: a coach asking for the trainee home, or a trainee for the coach home, is NOT_ALLOWED", async () => {
  assertEquals(await traineeHome(world(), traineeModules(), coach), fail("NOT_ALLOWED"));
  assertEquals(await coachHome(world(), {}, trainee), fail("NOT_ALLOWED"));
});

// ---- get_coach_home (UC4 step 8; module map v5) ----

Deno.test("module map v5: the coach's home counts active trainees, rewards to deliver and the challenge's completions", async () => {
  const r = await coachHome(world(), {
    trainees: stand("M01", { list_trainees: ok([
      { joined: true, isActive: true }, { joined: true, isActive: true }, { joined: true, isActive: false }, { joined: false, isActive: true },
    ]) }),
    coins: stand("M07", { manage_rewards: ok({ rewards: [], redemptions: [{ status: "pending" }, { status: "delivered" }] }) }),
    challenges: stand("M08", { get_current_challenge: ok({ challengeName: "שלושה אימונים (test)" }), list_completions: ok([{}, {}]) }),
  });
  // No payments or classes module answers here: their items come back empty (UC9 c).
  assertEquals(r, ok({ activeTrainees: 2, openPayments: null, classesToday: null, lateRequests: null, rewardsToDeliver: 1,
    challenge: { challengeName: "שלושה אימונים (test)", completions: 2 } }));
});

Deno.test("stage 4c and 4d shape: open payments, today's classes and late cancel requests are counted", async () => {
  const d = (await coachHome(world(), {
    payments: stand("M09", { list_payments: ok([{ status: "open" }, { status: "paid" }, { status: "open" }]) }),
    classes: stand("M11", { list_upcoming_classes: ok({ classes: [
      { startsAt: TODAY, status: "active" }, { startsAt: TODAY, status: "cancelled" }, { startsAt: "2099-01-01T10:00:00Z", status: "active" },
    ], lateRequests: [{}] }) }),
    challenges: stand("M08", { get_current_challenge: ok(null), list_completions: ok([]) }),
  })).data as Record<string, unknown>;
  assertEquals([d.openPayments, d.classesToday, d.lateRequests, d.challenge], [2, 1, 1, null]);
});
