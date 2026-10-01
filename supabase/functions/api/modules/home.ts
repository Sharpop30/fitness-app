// M13 home: the coach's home, the trainee's home and the owner's home, made only of existing actions, through the
// Orchestrator. Requirements 19 (story-19, usecase-04 step 6), 25 (story-25, usecase-09) and 15 (story-15, usecase-12
// step 2). No data of its own, and no table.
// Acceptance (UC9 section 13): the trainee sees the next workout, the next class, the challenge progress and the
// streak. UC9 c and section 7: an item that fails is left out, and the rest of the screen still comes.
// Payments are built in 4d and classes in 4c, so every item of both homes now has its source.
import { fail, ok, type Reply } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const dayKey = (at: string | number) => ISRAEL_DAY.format(new Date(at));
const DAY_MS = 24 * 60 * 60 * 1000;

// One item: the data of a reply that worked, or null for one that failed (UC9 c).
const dataOf = <T>(r: Reply): T | null => (r.ok ? (r.data as T) : null);

type ClassRow = { ClassID: string; startsAt: string; place: string; status: string; myStatus?: string };
type Classes = { classes: ClassRow[]; lateRequests?: unknown[] };

export const home: ModuleDef = {
  id: "M13",
  actions: {
    // UC9 steps 1-6.
    async get_trainee_home(ctx: ModuleContext) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID) return fail("NOT_ALLOWED");
      const ask = (module: string, action: string, payload: Record<string, unknown> = {}) => ctx.call({ module, action, payload });

      const [text, streak, balance, program, logs, classes, challenge, offerHours] = await Promise.all([
        ask("settings", "get_settings", { key: "reminderText" }),
        ask("progress", "get_streak", { traineeID }),
        ask("coins", "get_balance"),
        ask("programs", "get_active_program"),
        ask("results", "list_results"),
        ask("classes", "list_upcoming_classes"),
        ask("challenges", "get_current_challenge"),
        ask("settings", "get_settings", { key: "spotOfferHours" }),
      ]);

      // UC9 step 5 and d: the coach's text; a missing one is left empty, never written here (decision 10).
      const reminder = dataOf<Record<string, string>>(text)?.reminderText ?? "";
      const s = dataOf<{ streak: number; streakGapDays: number }>(streak);

      // The next workout: the one after the last workout done from the active program, or its first.
      const workouts = dataOf<{ workouts: { WorkoutID: string; workoutName: string }[] }>(program)?.workouts ?? [];
      const done = dataOf<{ WorkoutID: string }[]>(logs) ?? [];
      const last = done.map((l) => workouts.findIndex((w) => w.WorkoutID === l.WorkoutID)).find((i) => i >= 0) ?? -1;
      const next = workouts.length ? workouts[(last + 1) % workouts.length] : null;

      const mine = dataOf<Classes>(classes)?.classes ?? [];
      // The nearest class the trainee is registered to that has not started (stage 4c plan, execution decision 7).
      const now = Date.now();
      const registered = mine.filter((k) => k.myStatus === "registered" && k.status === "active" && Date.parse(k.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      const hours = Number(dataOf<Record<string, string>>(offerHours)?.spotOfferHours);

      const c = dataOf<{ challengeName: string; progress: { value: number; target: number; exempt: boolean } | null } | null>(challenge);

      return ok({
        reminder,
        streak: s?.streak ?? null,
        streakGapDays: s?.streakGapDays ?? null,
        coins: dataOf<{ balance: number }>(balance)?.balance ?? null,
        nextWorkout: next && { WorkoutID: next.WorkoutID, workoutName: next.workoutName },
        nextClass: registered ? { startsAt: registered.startsAt, place: registered.place } : null,
        challenge: c?.progress ? { challengeName: c.challengeName, ...c.progress } : null,
        offers: Number.isFinite(hours)
          ? mine.filter((k) => k.myStatus === "offered").map((k) => ({ ClassID: k.ClassID, startsAt: k.startsAt, hours }))
          : [],
      });
    },

    // UC4 step 8: what needs the coach's attention today.
    async get_coach_home(ctx: ModuleContext) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const ask = (module: string, action: string, payload: Record<string, unknown> = {}) => ctx.call({ module, action, payload });

      const [trainees, payments, classes, rewards, challenge, completions] = await Promise.all([
        ask("trainees", "list_trainees"),
        ask("payments", "list_payments"),
        ask("classes", "list_upcoming_classes"),
        ask("coins", "manage_rewards", { op: "list" }),
        ask("challenges", "get_current_challenge"),
        ask("challenges", "list_completions"),
      ]);

      const today = dayKey(Date.now());
      const list = dataOf<{ joined: boolean; isActive: boolean }[]>(trainees);
      const open = dataOf<{ status: string }[]>(payments);
      const k = dataOf<Classes>(classes);
      const redemptions = dataOf<{ redemptions: { status: string }[] }>(rewards)?.redemptions;
      const c = dataOf<{ challengeName: string } | null>(challenge);
      const done = dataOf<unknown[]>(completions);

      return ok({
        activeTrainees: list ? list.filter((t) => t.joined && t.isActive).length : null,
        openPayments: open ? open.filter((p) => p.status === "open").length : null,
        classesToday: k ? k.classes.filter((x) => x.status === "active" && dayKey(x.startsAt) === today).length : null,
        lateRequests: k?.lateRequests ? k.lateRequests.length : null,
        rewardsToDeliver: redemptions ? redemptions.filter((r) => r.status === "pending").length : null,
        challenge: c && { challengeName: c.challengeName, completions: done ? done.length : null },
      });
    },

    // UC12 step 2 and alternative g: the business at a glance, for the whole business (map v11).
    async get_owner_home(ctx: ModuleContext) {
      if (ctx.actor.role !== "owner") return fail("NOT_ALLOWED");
      const ask = (module: string, action: string, payload: Record<string, unknown> = {}) => ctx.call({ module, action, payload });

      const [payments, classes, rewards, trainees, coaches] = await Promise.all([
        ask("payments", "list_payments"),
        ask("classes", "list_upcoming_classes"),
        ask("coins", "manage_rewards", { op: "list" }),
        ask("trainees", "list_trainees"),
        ask("business", "list_coaches"),
      ]);

      // This month and this week in Israel time; the week starts on Sunday, as the challenge's (stage 4e plan, decision 7).
      const today = dayKey(Date.now());
      const sunday = new Date(Date.parse(today) - new Date(today).getUTCDay() * DAY_MS).toISOString().slice(0, 10);
      const saturday = new Date(Date.parse(sunday) + 6 * DAY_MS).toISOString().slice(0, 10);
      const pay = dataOf<{ status: string; amount: number; paidAt: string | null }[]>(payments);
      const paidMonth = pay?.filter((p) => p.status === "paid" && p.paidAt && dayKey(p.paidAt).slice(0, 7) === today.slice(0, 7));
      const open = pay?.filter((p) => p.status === "open");
      const week = dataOf<{ classes: { startsAt: string; status: string; capacity: number; registered: number }[] }>(classes)?.classes
        .filter((k) => k.status === "active" && dayKey(k.startsAt) >= sunday && dayKey(k.startsAt) <= saturday);
      const redemptions = dataOf<{ redemptions: { status: string }[] }>(rewards)?.redemptions;
      const list = dataOf<{ joined: boolean; isActive: boolean }[]>(trainees);
      const team = dataOf<{ joined: boolean }[]>(coaches);

      return ok({
        incomeMonth: paidMonth ? paidMonth.reduce((sum, p) => sum + p.amount, 0) : null,
        paidMonth: paidMonth ? paidMonth.length : null,
        openPayments: open ? open.length : null,
        openAmount: open ? open.reduce((sum, p) => sum + p.amount, 0) : null,
        coaches: team ? team.filter((k) => k.joined).length : null,
        pendingCoaches: team ? team.filter((k) => !k.joined).length : null,
        activeTrainees: list ? list.filter((t) => t.joined && t.isActive).length : null,
        classesWeek: week ? { registered: week.reduce((n, k) => n + k.registered, 0), capacity: week.reduce((n, k) => n + k.capacity, 0) } : null,
        rewardsToDeliver: redemptions ? redemptions.filter((r) => r.status === "pending").length : null,
      });
    },
  },
};
