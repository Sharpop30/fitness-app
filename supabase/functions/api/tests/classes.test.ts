// Unit tests for M11 classes, against an in-memory Repository (synthetic data) that follows migration 0010, with the real
// notifications and settings modules and a stand-in for coins, behind the Orchestrator.
// Sources: usecase-11 sections 4, 6, 7, 13; doc-module-map v7 section 4 (list_upcoming_classes); stage 4c plan,
// decisions 3 to 8 and execution decisions 1 to 6; Business Logic rules 5, 6; CLAUDE.md rule 8.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { classes } from "../modules/classes.ts";
import { notifications } from "../modules/notifications.ts";
import { settings } from "../modules/settings.ts";
import {
  type Actor, type ClassRegistration, type GroupClass, type LateCancelRequest, type SpotResult, StorageUnavailable,
} from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2);
const NOA = U(11), ITAI = U(12), MAYA = U(13), STRANGER = U(19);
const NAMES: Record<string, string> = { [NOA]: "נועה (test)", [ITAI]: "איתי (test)", [MAYA]: "מאיה (test)", [STRANGER]: "זר (test)" };
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const otherCoach: Actor = { role: "coach", coachID: OTHER_COACH, traineeID: null };
const as = (t: string): Actor => ({ role: "trainee", coachID: t === STRANGER ? OTHER_COACH : COACH, traineeID: t });
const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();
const SETTINGS = { cancelHours: "24", spotOfferHours: "2", coinsAttendance: "5" };

let seq = 700;

// The Repository, following migration 0010: offers that ran out close first, and each free spot goes to the first waiting.
function world(opts: { settings?: Record<string, string>; storageDown?: boolean } = {}) {
  const list: GroupClass[] = [];
  const late: (LateCancelRequest & { createdAt: number })[] = [];
  const notes: { TraineeID: string; messageText: string; NotificationID: string; readAt: string | null }[] = [];
  const awards = new Set<string>();
  const awarded: { traineeID: string; eventRef: string }[] = [];
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const find = (id: string) => list.find((k) => k.ClassID === id);

  function offerSpots(k: GroupClass, hours: number): string[] {
    const now = Date.now();
    for (const r of k.registrations) {
      if (r.status === "offered" && r.offerExpiresAt && Date.parse(r.offerExpiresAt) <= now) { r.status = "cancelled"; r.offerExpiresAt = null; }
    }
    const offered: string[] = [];
    if (k.status !== "active" || Date.parse(k.startsAt) <= now) return offered;
    for (;;) {
      const taken = k.registrations.filter((r) => r.status === "registered" || r.status === "offered").length;
      const next = k.registrations.filter((r) => r.status === "waitlist").sort((a, b) => a.waitlistPosition! - b.waitlistPosition!)[0];
      if (taken >= k.capacity || !next) return offered;
      next.status = "offered";
      next.offerExpiresAt = new Date(Math.min(now + hours * HOUR, Date.parse(k.startsAt))).toISOString();
      offered.push(next.TraineeID);
    }
  }

  const w = fakeRepo({
    getCoachSettings: async () => (down(), opts.settings ?? SETTINGS),
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH ? [NOA, ITAI, MAYA].includes(t) : t === STRANGER),
    publishClass: async (CoachID, startsAt, place, capacity) => {
      down();
      const ClassID = U(seq++);
      list.push({ ClassID, CoachID, startsAt, place, capacity, status: "active", registrations: [] });
      return ClassID;
    },
    getClass: async (id) => (down(), structuredClone(find(id) ?? null)),
    listClasses: async (c, from) => (down(), structuredClone(list.filter((k) => k.CoachID === c && k.startsAt >= from))),
    cancelClass: async (id) => {
      down();
      const k = find(id);
      if (!k || k.status !== "active") return false;
      k.status = "cancelled";
      return true;
    },
    registerForClass: async (id, t, hours): Promise<SpotResult> => {
      down();
      const k = find(id)!;
      if (k.status !== "active" || Date.parse(k.startsAt) <= Date.now()) return { status: "closed", offered: [] };
      const offered = offerSpots(k, hours);
      const cur = k.registrations.find((r) => r.TraineeID === t);
      if (cur && cur.status !== "cancelled") return { status: "already", offered };
      const taken = k.registrations.filter((r) => r.status === "registered" || r.status === "offered").length;
      const status = taken < k.capacity ? "registered" : "waitlist";
      const pos = Math.max(0, ...k.registrations.map((r) => r.waitlistPosition ?? 0)) + 1;
      const row: ClassRegistration = cur ?? { ClassRegistrationID: U(seq++), TraineeID: t, fullName: NAMES[t], status, waitlistPosition: null, offerExpiresAt: null, attended: null };
      Object.assign(row, { status, waitlistPosition: status === "waitlist" ? pos : null, offerExpiresAt: null, attended: null });
      if (!cur) k.registrations.push(row);
      const position = status === "waitlist" ? k.registrations.filter((r) => r.status === "waitlist" && r.waitlistPosition! <= pos).length : null;
      return { status, position, offered };
    },
    releaseSpot: async (id, t, op, hours): Promise<SpotResult> => {
      down();
      const k = find(id);
      if (!k) return { status: "none", offered: [] };
      const offered = offerSpots(k, hours);
      if (op === "expire") return { status: "ok", offered };
      const cur = k.registrations.find((r) => r.TraineeID === t);
      let status: SpotResult["status"] = "ok";
      if (op === "cancel") {
        if (cur && (cur.status === "registered" || cur.status === "waitlist")) cur.status = "cancelled"; else status = "none";
      } else if (cur?.status === "offered") {
        cur.status = op === "accept" ? "registered" : "cancelled";
        cur.offerExpiresAt = null;
      } else status = "expired";
      return { status, offered: [...offered, ...offerSpots(k, hours)] };
    },
    setAttendance: async (id, present) => {
      down();
      const regs = find(id)!.registrations.filter((r) => r.status === "registered");
      regs.forEach((r) => (r.attended = present.includes(r.TraineeID)));
      return regs.filter((r) => r.attended).map(({ ClassRegistrationID, TraineeID }) => ({ ClassRegistrationID, TraineeID }));
    },
    addLateCancelRequest: async (regID) => {
      down();
      if (late.some((q) => q.ClassRegistrationID === regID && q.status === "pending")) return;
      const k = list.find((x) => x.registrations.some((r) => r.ClassRegistrationID === regID))!;
      const r = k.registrations.find((x) => x.ClassRegistrationID === regID)!;
      late.push({ LateCancelRequestID: U(seq++), ClassRegistrationID: regID, ClassID: k.ClassID, CoachID: k.CoachID, TraineeID: r.TraineeID,
        fullName: r.fullName, startsAt: k.startsAt, status: "pending", createdAt: seq });
    },
    listLateCancelRequests: async (c) => (down(), late.filter((q) => q.CoachID === c && q.status === "pending").map(({ createdAt: _, ...q }) => q)),
    getLateCancelRequest: async (id) => { down(); const q = late.find((x) => x.LateCancelRequestID === id); if (!q) return null; const { createdAt: _, ...rest } = q; return { ...rest }; },
    decideLateCancelRequest: async (id, approve) => {
      down();
      const q = late.find((x) => x.LateCancelRequestID === id && x.status === "pending");
      if (!q) return false;
      q.status = approve ? "approved" : "rejected";
      return true;
    },
    addNotification: async (TraineeID, messageText) => { down(); notes.push({ TraineeID, messageText, NotificationID: U(seq++), readAt: null }); },
  });

  // coins stand-in: one award per eventRef (the real rule is tested in coins.test.ts).
  const coins: ModuleDef = {
    id: "M07",
    actions: {
      award: async (ctx, p) => {
        if (ctx.caller !== "M11" || p.reason !== "attendance") return fail("NOT_ALLOWED");
        if (awards.has(String(p.eventRef))) return fail("COINS_ALREADY_AWARDED");
        awards.add(String(p.eventRef));
        awarded.push({ traineeID: String(p.traineeID), eventRef: String(p.eventRef) });
        return ok({ coins: 5 });
      },
    },
  };

  // A class straight in the store, with registrations: [trainee, status][] in order.
  const seed = (startsAt: string, capacity: number, regs: [string, ClassRegistration["status"]][] = [], CoachID = COACH) => {
    const ClassID = U(seq++);
    list.push({
      ClassID, CoachID, startsAt, place: "סטודיו (test)", capacity, status: "active",
      registrations: regs.map(([t, status], i) => ({ ClassRegistrationID: U(seq++), TraineeID: t, fullName: NAMES[t], status,
        waitlistPosition: status === "waitlist" ? i + 1 : null, offerExpiresAt: status === "offered" ? inHours(2) : null, attended: null })),
    });
    return ClassID;
  };
  const ask = (actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}) =>
    handle({ caller, module: "classes", action, payload }, actor, w.repo, { classes, notifications, settings, coins });
  const reg = (id: string, t: string) => find(id)!.registrations.find((r) => r.TraineeID === t);
  const told = (t: string) => notes.filter((n) => n.TraineeID === t).map((n) => n.messageText);
  return { ...w, list, late, notes, awarded, seed, ask, reg, told, find };
}

const coachAsk = (w: ReturnType<typeof world>, action: string, payload: Record<string, unknown> = {}) => w.ask(coach, "S11", action, payload);
const traineeAsk = (w: ReturnType<typeof world>, t: string, action: string, payload: Record<string, unknown> = {}) =>
  w.ask(as(t), action === "respond_to_spot_offer" ? "S13" : "S17", action, payload);

// ---- publish_class (UC11 steps 1-2) ----

Deno.test("UC11 step 1: the coach publishes a class, and it is saved", async () => {
  const w = world();
  assertEquals(await coachAsk(w, "publish_class", { startsAt: inHours(48), place: " פארק (test) ", capacity: 8 }), ok(null));
  assertEquals([w.list.length, w.list[0].place, w.list[0].capacity, w.list[0].status], [1, "פארק (test)", 8, "active"]);
});

Deno.test("stage 4c decision 7: a date and time without a zone is Israel time", async () => {
  const w = world();
  await coachAsk(w, "publish_class", { startsAt: "2099-01-15T18:30:00", place: "פארק", capacity: 8 });  // winter, UTC+2
  await coachAsk(w, "publish_class", { startsAt: "2099-07-15T18:30", place: "פארק", capacity: 8 });     // summer, UTC+3
  assertEquals(w.list.map((k) => k.startsAt), ["2099-01-15T16:30:00.000Z", "2099-07-15T15:30:00.000Z"]);
});

Deno.test("UC11 section 11: a class with no place, no date, a date in the past, or no positive capacity is CLASS_INVALID", async () => {
  const w = world();
  for (const p of [
    { startsAt: inHours(48), place: " ", capacity: 8 },
    { place: "פארק", capacity: 8 },
    { startsAt: "not a date", place: "פארק", capacity: 8 },
    { startsAt: "2099-02-30T10:00", place: "פארק", capacity: 8 },
    { startsAt: inHours(-1), place: "פארק", capacity: 8 },
    { startsAt: inHours(48), place: "פארק", capacity: 0 },
    { startsAt: inHours(48), place: "פארק", capacity: 2.5 },
  ]) assertEquals(await coachAsk(w, "publish_class", p), fail("CLASS_INVALID"));
  assertEquals(w.list.length, 0);
});

Deno.test("rule 5: a trainee cannot publish a class", async () => {
  assertEquals(await traineeAsk(world(), NOA, "publish_class", { startsAt: inHours(48), place: "פארק", capacity: 8 }), fail("NOT_ALLOWED"));
});

// ---- list_upcoming_classes and list_registrations (UC11 steps 3, 8; module map v7) ----

Deno.test("module map v7: the coach sees names, attendance and the waitlist, from three days back, with cancelHours", async () => {
  const w = world();
  const old = w.seed(inHours(-24 * 5), 8, [[NOA, "registered"]]);
  const past = w.seed(inHours(-24 * 2), 8, [[NOA, "registered"]]);
  const next = w.seed(inHours(48), 1, [[ITAI, "registered"], [NOA, "waitlist"]]);
  const d = (await coachAsk(w, "list_upcoming_classes")).data as { classes: { ClassID: string; registered: unknown[]; waitlist: unknown[] }[]; cancelHours: number; lateRequests: unknown[] };
  assertEquals(d.classes.map((k) => k.ClassID), [past, next]);
  assert(!d.classes.some((k) => k.ClassID === old));
  assertEquals(d.classes[1].registered, [{ TraineeID: ITAI, fullName: "איתי (test)", attended: null }]);
  assertEquals(d.classes[1].waitlist, [{ TraineeID: NOA, fullName: "נועה (test)" }]);
  assertEquals([d.cancelHours, d.lateRequests], [24, []]);
});

Deno.test("module map v7 and rule 5: the trainee sees only classes not started, counts without names, and their own place", async () => {
  const w = world();
  w.seed(inHours(-1), 8, [[NOA, "registered"]]);
  const full = w.seed(inHours(48), 2, [[ITAI, "registered"], [MAYA, "offered"], [NOA, "waitlist"]]);
  const d = (await traineeAsk(w, NOA, "list_upcoming_classes")).data as { classes: Record<string, unknown>[]; lateRequests: unknown[] };
  assertEquals(d.classes.length, 1);
  assertEquals(d.classes[0], { ClassID: full, startsAt: w.find(full)!.startsAt, place: "סטודיו (test)", capacity: 2, status: "active",
    registered: [{}, {}], waitlist: [{}], myStatus: "waitlist", myWaitPosition: 1 });
  assertEquals(d.lateRequests, []);
});

Deno.test("rule 8: cancelHours or spotOfferHours missing in SETTINGS is VALUE_NOT_SET", async () => {
  assertEquals(await coachAsk(world({ settings: { spotOfferHours: "2" } }), "list_upcoming_classes"), fail("VALUE_NOT_SET"));
  assertEquals(await coachAsk(world({ settings: { cancelHours: "24" } }), "list_upcoming_classes"), fail("VALUE_NOT_SET"));
});

Deno.test("UC11 step 8: the coach opens one class of their own; another coach's class is NOT_ALLOWED", async () => {
  const w = world();
  const mine = w.seed(inHours(48), 8, [[NOA, "registered"]]);
  const theirs = w.seed(inHours(48), 8, [], OTHER_COACH);
  assertEquals(((await coachAsk(w, "list_registrations", { classID: mine })).data as { registered: unknown[] }).registered.length, 1);
  assertEquals(await coachAsk(w, "list_registrations", { classID: theirs }), fail("NOT_ALLOWED"));
  assertEquals(await w.ask(otherCoach, "S11", "list_registrations", { classID: mine }), fail("NOT_ALLOWED"));
});

// ---- register (UC11 steps 4-5, b, e) ----

Deno.test("UC11 section 13: the trainee registers, and the registration shows to the coach", async () => {
  const w = world();
  const k = w.seed(inHours(48), 8);
  assertEquals(await traineeAsk(w, NOA, "register", { classID: k }), ok({ status: "registered", position: null }));
  const one = (await coachAsk(w, "list_registrations", { classID: k })).data as { registered: { TraineeID: string }[] };
  assertEquals(one.registered.map((r) => r.TraineeID), [NOA]);
});

Deno.test("UC11 section 13: a full class puts the trainee on the waitlist, with their place", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[ITAI, "registered"], [MAYA, "waitlist"]]);
  assertEquals(await traineeAsk(w, NOA, "register", { classID: k }), ok({ status: "waitlist", position: 2 }));
});

Deno.test("UC11 b: registering again while registered or waiting is ALREADY_REGISTERED", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[ITAI, "registered"], [NOA, "waitlist"]]);
  assertEquals(await traineeAsk(w, ITAI, "register", { classID: k }), fail("ALREADY_REGISTERED"));
  assertEquals(await traineeAsk(w, NOA, "register", { classID: k }), fail("ALREADY_REGISTERED"));
});

Deno.test("execution decision 1: a cancelled class, one that started, or another coach's class cannot be registered to", async () => {
  const w = world();
  const cancelled = w.seed(inHours(48), 8);
  w.find(cancelled)!.status = "cancelled";
  const started = w.seed(inHours(-1), 8);
  const theirs = w.seed(inHours(48), 8, [], OTHER_COACH);
  for (const classID of [cancelled, started, theirs]) assertEquals(await traineeAsk(w, NOA, "register", { classID }), fail("NOT_ALLOWED"));
  assertEquals(await traineeAsk(w, STRANGER, "register", { classID: w.seed(inHours(48), 8) }), fail("NOT_ALLOWED"));
});

Deno.test("UC11 b: a trainee who cancelled in time can register again", async () => {
  const w = world();
  const k = w.seed(inHours(48), 8, [[NOA, "cancelled"]]);
  assertEquals(await traineeAsk(w, NOA, "register", { classID: k }), ok({ status: "registered", position: null }));
  assertEquals(w.find(k)!.registrations.length, 1);
});

// ---- cancel_registration and the spot offer (UC11 steps 6-7, a) ----

Deno.test("UC11 section 13: cancelling two days before takes the name off, and the first waiting gets the spot and a message", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[ITAI, "registered"], [NOA, "waitlist"], [MAYA, "waitlist"]]);
  assertEquals(await traineeAsk(w, ITAI, "cancel_registration", { classID: k }), ok(null));
  assertEquals([w.reg(k, ITAI)!.status, w.reg(k, NOA)!.status, w.reg(k, MAYA)!.status], ["cancelled", "offered", "waitlist"]);
  assert(Date.parse(w.reg(k, NOA)!.offerExpiresAt!) - Date.now() <= 2 * HOUR);
  assertEquals(w.told(NOA).length, 1);
  assert(w.told(NOA)[0].startsWith("התפנה מקום בשיעור ב-"));
  assertEquals(w.told(MAYA), []);
});

Deno.test("UC11 a: cancelling an hour before is CANCEL_TOO_LATE, and the registration stays", async () => {
  const w = world();
  const k = w.seed(inHours(1), 8, [[NOA, "registered"]]);
  assertEquals(await traineeAsk(w, NOA, "cancel_registration", { classID: k }), fail("CANCEL_TOO_LATE"));
  assertEquals(w.reg(k, NOA)!.status, "registered");
});

Deno.test("rule 8 and structural test 4: the window is cancelHours from SETTINGS", async () => {
  const w = world({ settings: { ...SETTINGS, cancelHours: "1" } });
  const k = w.seed(inHours(3), 8, [[NOA, "registered"]]);
  assertEquals(await traineeAsk(w, NOA, "cancel_registration", { classID: k }), ok(null));
});

Deno.test("execution decision 6: a waiting trainee may leave inside the window, and no spot is offered", async () => {
  const w = world();
  const k = w.seed(inHours(1), 1, [[ITAI, "registered"], [NOA, "waitlist"], [MAYA, "waitlist"]]);
  assertEquals(await traineeAsk(w, NOA, "cancel_registration", { classID: k }), ok(null));
  assertEquals([w.reg(k, NOA)!.status, w.reg(k, MAYA)!.status], ["cancelled", "waitlist"]);
  assertEquals(w.notes, []);
});

Deno.test("rule 5: cancelling a class the trainee is not in is NOT_ALLOWED", async () => {
  const w = world();
  const k = w.seed(inHours(48), 8, [[ITAI, "registered"]]);
  assertEquals(await traineeAsk(w, NOA, "cancel_registration", { classID: k }), fail("NOT_ALLOWED"));
});

Deno.test("UC11 step 7: the trainee takes the offered spot", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[NOA, "offered"], [MAYA, "waitlist"]]);
  assertEquals(await traineeAsk(w, NOA, "respond_to_spot_offer", { classID: k, accept: true }), ok(null));
  assertEquals([w.reg(k, NOA)!.status, w.reg(k, NOA)!.offerExpiresAt], ["registered", null]);
});

Deno.test("UC11 step 7: the trainee passes, and the spot goes to the next in line with a message", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[NOA, "offered"], [MAYA, "waitlist"]]);
  assertEquals(await traineeAsk(w, NOA, "respond_to_spot_offer", { classID: k, accept: false }), ok(null));
  assertEquals([w.reg(k, NOA)!.status, w.reg(k, MAYA)!.status], ["cancelled", "offered"]);
  assertEquals(w.told(MAYA).length, 1);
});

Deno.test("decision 6: an offer that ran out passes on at the next read, and answering it is SPOT_OFFER_EXPIRED", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[NOA, "offered"], [MAYA, "waitlist"]]);
  w.reg(k, NOA)!.offerExpiresAt = inHours(-0.1);
  await traineeAsk(w, ITAI, "list_upcoming_classes");
  assertEquals([w.reg(k, NOA)!.status, w.reg(k, MAYA)!.status], ["cancelled", "offered"]);
  assertEquals(w.told(MAYA).length, 1);
  assertEquals(await traineeAsk(w, NOA, "respond_to_spot_offer", { classID: k, accept: true }), fail("SPOT_OFFER_EXPIRED"));
});

// ---- request_late_cancel and decide_late_cancel (UC11 a) ----

Deno.test("UC11 a: inside the window a request goes to the coach, once; outside it, or not registered, NOT_ALLOWED", async () => {
  const w = world();
  const soon = w.seed(inHours(1), 8, [[NOA, "registered"], [MAYA, "waitlist"]]);
  const later = w.seed(inHours(48), 8, [[NOA, "registered"]]);
  assertEquals(await traineeAsk(w, NOA, "request_late_cancel", { classID: soon }), ok(null));
  assertEquals(await traineeAsk(w, NOA, "request_late_cancel", { classID: soon }), ok(null));
  assertEquals(w.late.length, 1);
  assertEquals(await traineeAsk(w, NOA, "request_late_cancel", { classID: later }), fail("NOT_ALLOWED"));
  assertEquals(await traineeAsk(w, MAYA, "request_late_cancel", { classID: soon }), fail("NOT_ALLOWED"));
  const d = (await coachAsk(w, "list_upcoming_classes")).data as { lateRequests: unknown[] };
  assertEquals(d.lateRequests, [{ LateCancelRequestID: w.late[0].LateCancelRequestID, fullName: "נועה (test)", startsAt: w.find(soon)!.startsAt }]);
});

Deno.test("UC11 a: the coach approves; the registration is cancelled, the spot offered, and both trainees get a message", async () => {
  const w = world();
  const k = w.seed(inHours(1), 1, [[NOA, "registered"], [MAYA, "waitlist"]]);
  await traineeAsk(w, NOA, "request_late_cancel", { classID: k });
  assertEquals(await coachAsk(w, "decide_late_cancel", { requestID: w.late[0].LateCancelRequestID, approve: true }), ok(null));
  assertEquals([w.reg(k, NOA)!.status, w.reg(k, MAYA)!.status, w.late[0].status], ["cancelled", "offered", "approved"]);
  assertEquals(w.told(NOA), ["בקשת הביטול שלך אושרה"]);
  assertEquals(w.told(MAYA).length, 1);
});

Deno.test("UC11 a: the coach rejects; the registration stays, and the trainee gets a message. Deciding again changes nothing", async () => {
  const w = world();
  const k = w.seed(inHours(1), 8, [[NOA, "registered"]]);
  await traineeAsk(w, NOA, "request_late_cancel", { classID: k });
  const requestID = w.late[0].LateCancelRequestID;
  assertEquals(await coachAsk(w, "decide_late_cancel", { requestID, approve: false }), ok(null));
  assertEquals(await coachAsk(w, "decide_late_cancel", { requestID, approve: true }), ok(null));
  assertEquals([w.reg(k, NOA)!.status, w.late[0].status], ["registered", "rejected"]);
  assertEquals(w.told(NOA), ["בקשת הביטול שלך נדחתה"]);
});

Deno.test("rule 5: another coach cannot decide a request", async () => {
  const w = world();
  const k = w.seed(inHours(1), 8, [[NOA, "registered"]]);
  await traineeAsk(w, NOA, "request_late_cancel", { classID: k });
  assertEquals(await w.ask(otherCoach, "S11", "decide_late_cancel", { requestID: w.late[0].LateCancelRequestID, approve: true }), fail("NOT_ALLOWED"));
});

// ---- cancel_class (UC11 c) ----

Deno.test("UC11 c: the coach cancels a class; everyone registered, waiting or offered gets a message", async () => {
  const w = world();
  const k = w.seed(inHours(48), 1, [[ITAI, "registered"], [NOA, "offered"], [MAYA, "waitlist"]]);
  w.find(k)!.registrations.push({ ClassRegistrationID: U(seq++), TraineeID: STRANGER, fullName: "זר", status: "cancelled", waitlistPosition: null, offerExpiresAt: null, attended: null });
  assertEquals(await coachAsk(w, "cancel_class", { classID: k }), ok(null));
  assertEquals(w.find(k)!.status, "cancelled");
  for (const t of [ITAI, NOA, MAYA]) assertEquals(w.told(t).length, 1);
  assert(w.told(ITAI)[0].endsWith("בוטל בידי המאמן"));
  assertEquals(w.told(STRANGER), []);
});

Deno.test("execution decision 1: a class that started or was cancelled cannot be cancelled", async () => {
  const w = world();
  const started = w.seed(inHours(-1), 8);
  const k = w.seed(inHours(48), 8);
  await coachAsk(w, "cancel_class", { classID: k });
  assertEquals(await coachAsk(w, "cancel_class", { classID: started }), fail("NOT_ALLOWED"));
  assertEquals(await coachAsk(w, "cancel_class", { classID: k }), fail("NOT_ALLOWED"));
});

// ---- mark_attendance (UC11 steps 9-10) ----

Deno.test("UC11 section 13: only those marked present get coins, once; marking again credits nothing new", async () => {
  const w = world();
  const k = w.seed(inHours(-2), 8, [[NOA, "registered"], [ITAI, "registered"], [MAYA, "cancelled"]]);
  assertEquals(await coachAsk(w, "mark_attendance", { classID: k, present: [NOA, MAYA] }), ok({ awarded: 1 }));
  assertEquals([w.reg(k, NOA)!.attended, w.reg(k, ITAI)!.attended, w.reg(k, MAYA)!.attended], [true, false, null]);
  assertEquals(w.awarded, [{ traineeID: NOA, eventRef: w.reg(k, NOA)!.ClassRegistrationID }]);
  assertEquals(await coachAsk(w, "mark_attendance", { classID: k, present: [NOA, ITAI] }), ok({ awarded: 1 }));
  assertEquals(w.awarded.map((a) => a.traineeID), [NOA, ITAI]);
});

Deno.test("execution decision 1: attendance before the class starts, or on a cancelled class, is NOT_ALLOWED", async () => {
  const w = world();
  const future = w.seed(inHours(2), 8, [[NOA, "registered"]]);
  const cancelled = w.seed(inHours(-2), 8, [[NOA, "registered"]]);
  w.find(cancelled)!.status = "cancelled";
  assertEquals(await coachAsk(w, "mark_attendance", { classID: future, present: [NOA] }), fail("NOT_ALLOWED"));
  assertEquals(await coachAsk(w, "mark_attendance", { classID: cancelled, present: [NOA] }), fail("NOT_ALLOWED"));
  assertEquals(w.awarded, []);
});

// ---- failure ----

Deno.test("UC11 d: a database that fails gives STORAGE_UNAVAILABLE, without throwing", async () => {
  const w = world({ storageDown: true });
  assertEquals(await traineeAsk(w, NOA, "register", { classID: U(1) }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await coachAsk(w, "list_upcoming_classes"), fail("STORAGE_UNAVAILABLE"));
});
