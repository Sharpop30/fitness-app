// M11 classes: group classes, registration, the waitlist, cancelling and attendance.
// Requirement 30 (story-30, usecase-11); the attendance coins of requirements 6 and 24 (usecase-07). Rules 5, 6, 8.
// Acceptance (UC11 section 13): a registration shows to the coach; a full class puts the trainee on the waitlist with
// their place; cancelling two days before takes the name off; an hour before is refused, and a late-cancel request can
// go to the coach; a freed spot is offered to the first waiting, who decides; a cancelled class tells everyone
// registered; only those marked present get coins.
// Registering and freeing a spot are atomic in the database (migration 0010). An offer that ran out passes to the next
// in line on the next action on the class, with no scheduled job (stage 4c plan, decision 6).
import { type ErrorCode, fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";
import type { GroupClass, SpotResult } from "../repository.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isID = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Israel time (stage 4b plan, decision 8; stage 4c plan, decision 7).
const ZONE = "Asia/Jerusalem";
const ISRAEL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE });
const ISRAEL_DATE = new Intl.DateTimeFormat("he-IL", { timeZone: ZONE });
const WALL = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
});
// How far Israel's clock is ahead of UTC at a moment, in ms.
const offsetAt = (ms: number) => {
  const p = Object.fromEntries(WALL.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};
// A date and time without a zone ("2026-10-02T18:30:00", as S11 sends it) is Israel time; one with a zone is kept.
function parseStart(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) { const t = Date.parse(v); return /[zZ]|[+-]\d{2}:?\d{2}$/.test(v) && Number.isFinite(t) ? t : null; }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  if (new Date(wall).getUTCMonth() !== +m[2] - 1 || new Date(wall).getUTCDate() !== +m[3]) return null;
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}
// The start of the Israel day, n days back (module map v7: the coach sees classes from three days back).
function israelDayStart(daysBack: number): string {
  const day = ISRAEL_DAY.format(new Date(Date.now() - daysBack * DAY_MS));
  const t = parseStart(`${day}T00:00:00`)!;
  return new Date(t).toISOString();
}
const COACH_DAYS_BACK = 3;
const dateOf = (at: string) => ISRAEL_DATE.format(new Date(at));
const started = (k: GroupClass) => Date.parse(k.startsAt) <= Date.now();

// A whole number of hours from SETTINGS, through the Orchestrator. Missing or not positive is VALUE_NOT_SET (rule 8).
async function hoursFor(ctx: ModuleContext, key: string): Promise<number | ErrorCode> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key } });
  if (!r.ok) return r.error!.code;
  const n = Number((r.data as Record<string, string>)[key]);
  return Number.isFinite(n) && n > 0 ? n : "VALUE_NOT_SET";
}

// A message inside the app. A failure is left in the Audit and never undoes what was saved (decision 8).
async function tell(ctx: ModuleContext, traineeIDs: string[], messageText: string) {
  for (const traineeID of traineeIDs) {
    await ctx.call({ module: "notifications", action: "notify_in_app", payload: { traineeID, messageText } });
  }
}
const tellOffered = (ctx: ModuleContext, k: GroupClass, r: SpotResult) =>
  tell(ctx, r.offered ?? [], `התפנה מקום בשיעור ב-${dateOf(k.startsAt)}`);

// Rule 5: only a class of the actor's own coach.
async function ownClass(ctx: ModuleContext, classID: unknown): Promise<GroupClass | null> {
  if (!isID(classID)) return null;
  const k = await ctx.repo.getClass(classID);
  return k && k.CoachID === ctx.actor.coachID ? k : null;
}

// Moves on the offers that ran out, then reads the class again (decision 6).
async function fresh(ctx: ModuleContext, k: GroupClass, offerHours: number): Promise<GroupClass> {
  const now = Date.now();
  if (!k.registrations.some((r) => r.status === "offered" && r.offerExpiresAt && Date.parse(r.offerExpiresAt) <= now)) return k;
  const r = await ctx.repo.releaseSpot(k.ClassID, null, "expire", offerHours);
  await tellOffered(ctx, k, r);
  return (await ctx.repo.getClass(k.ClassID)) ?? k;
}

// The class as the screens show it (module map v7): names for the coach; for a trainee, only how many places are taken
// and waiting, and their own status and place (rule 5). A spot held by an offer is taken.
function view(k: GroupClass, me: string | null) {
  const regs = k.registrations;
  const waiting = regs.filter((r) => r.status === "waitlist");
  const base = { ClassID: k.ClassID, startsAt: k.startsAt, place: k.place, capacity: k.capacity, status: k.status };
  if (me === null) {
    return {
      ...base,
      registered: regs.filter((r) => r.status === "registered").map(({ TraineeID, fullName, attended }) => ({ TraineeID, fullName, attended })),
      waitlist: regs.filter((r) => r.status === "waitlist" || r.status === "offered").map(({ TraineeID, fullName }) => ({ TraineeID, fullName })),
      myStatus: null,
      myWaitPosition: 0,
    };
  }
  const mine = regs.find((r) => r.TraineeID === me);
  return {
    ...base,
    registered: regs.filter((r) => r.status === "registered" || r.status === "offered").map(() => ({})),
    waitlist: waiting.map(() => ({})),
    myStatus: mine && mine.status !== "cancelled" ? mine.status : null,
    myWaitPosition: waiting.findIndex((r) => r.TraineeID === me) + 1, // by order, not stored again (execution decision 4)
  };
}

export const classes: ModuleDef = {
  id: "M11",
  actions: {
    // UC11 step 1-2. A class in the past is CLASS_INVALID (execution decision 1).
    async publish_class(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const at = parseStart(payload.startsAt);
      const place = typeof payload.place === "string" ? payload.place.trim() : "";
      const capacity = Number(payload.capacity);
      if (at === null || at <= Date.now() || !place || !Number.isInteger(capacity) || capacity <= 0) return fail("CLASS_INVALID");
      await ctx.repo.publishClass(ctx.actor.coachID, new Date(at).toISOString(), place, capacity);
      return ok(null);
    },

    // UC11 c: everyone registered, waiting or offered a spot gets a message. A class that started or was cancelled
    // cannot be cancelled (execution decision 1).
    async cancel_class(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      if (!k || k.status !== "active" || started(k)) return fail("NOT_ALLOWED");
      if (!(await ctx.repo.cancelClass(k.ClassID))) return fail("NOT_ALLOWED");
      const told = k.registrations.filter((r) => ["registered", "waitlist", "offered"].includes(r.status)).map((r) => r.TraineeID);
      await tell(ctx, told, `השיעור ב-${dateOf(k.startsAt)} בוטל בידי המאמן`);
      return ok(null);
    },

    // UC11 steps 3 and 8. The coach: from the start of the day three days back, to mark attendance after a class, with
    // the late-cancel requests. The trainee: classes that have not started (module map v7).
    async list_upcoming_classes(ctx) {
      const [cancelHours, offerHours] = await Promise.all([hoursFor(ctx, "cancelHours"), hoursFor(ctx, "spotOfferHours")]);
      if (typeof cancelHours === "string") return fail(cancelHours);
      if (typeof offerHours === "string") return fail(offerHours);
      const coach = ctx.actor.role === "coach";
      const from = coach ? israelDayStart(COACH_DAYS_BACK) : new Date().toISOString();
      const list = await ctx.repo.listClasses(ctx.actor.coachID, from);
      const shown = [];
      for (const k of list) shown.push(view(await fresh(ctx, k, offerHours), coach ? null : ctx.actor.traineeID));
      const lateRequests = coach
        ? (await ctx.repo.listLateCancelRequests(ctx.actor.coachID))
          .map(({ LateCancelRequestID, fullName, startsAt }) => ({ LateCancelRequestID, fullName, startsAt }))
        : [];
      return ok({ classes: shown, cancelHours, lateRequests });
    },

    // UC11 step 8: one class, in the same shape.
    async list_registrations(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      if (!k) return fail("NOT_ALLOWED");
      const offerHours = await hoursFor(ctx, "spotOfferHours");
      if (typeof offerHours === "string") return fail(offerHours);
      return ok(view(await fresh(ctx, k, offerHours), null));
    },

    // UC11 steps 4-5, b and e. A spot or the waitlist, in one database action.
    async register(ctx, payload) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID) return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      if (!k) return fail("NOT_ALLOWED");
      const offerHours = await hoursFor(ctx, "spotOfferHours");
      if (typeof offerHours === "string") return fail(offerHours);
      const r = await ctx.repo.registerForClass(k.ClassID, traineeID, offerHours);
      await tellOffered(ctx, k, r);
      if (r.status === "closed") return fail("NOT_ALLOWED");
      if (r.status === "already") return fail("ALREADY_REGISTERED");
      return ok({ status: r.status, position: r.position ?? null });
    },

    // UC11 step 6 and a. Up to cancelHours before the class; a waiting trainee may always leave (execution decision 6).
    async cancel_registration(ctx, payload) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID) return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      const mine = k?.registrations.find((r) => r.TraineeID === traineeID);
      if (!k || !mine || !["registered", "waitlist"].includes(mine.status)) return fail("NOT_ALLOWED");
      const [cancelHours, offerHours] = await Promise.all([hoursFor(ctx, "cancelHours"), hoursFor(ctx, "spotOfferHours")]);
      if (typeof cancelHours === "string") return fail(cancelHours);
      if (typeof offerHours === "string") return fail(offerHours);
      if (mine.status === "registered" && Date.parse(k.startsAt) - Date.now() < cancelHours * HOUR_MS) return fail("CANCEL_TOO_LATE");
      const r = await ctx.repo.releaseSpot(k.ClassID, traineeID, "cancel", offerHours);
      await tellOffered(ctx, k, r);
      return r.status === "ok" ? ok(null) : fail("NOT_ALLOWED");
    },

    // UC11 a: a request to the coach, only for a registration inside the window. A second one while one waits adds
    // nothing (execution decision 5).
    async request_late_cancel(ctx, payload) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID) return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      const mine = k?.registrations.find((r) => r.TraineeID === traineeID);
      if (!k || k.status !== "active" || started(k) || mine?.status !== "registered") return fail("NOT_ALLOWED");
      const cancelHours = await hoursFor(ctx, "cancelHours");
      if (typeof cancelHours === "string") return fail(cancelHours);
      if (Date.parse(k.startsAt) - Date.now() >= cancelHours * HOUR_MS) return fail("NOT_ALLOWED");
      await ctx.repo.addLateCancelRequest(mine.ClassRegistrationID);
      return ok(null);
    },

    // UC11 a (team decision): approved, the registration is cancelled and the spot offered; rejected, it stays. The
    // trainee gets a message either way. A request already decided is not changed (execution decision 5).
    async decide_late_cancel(ctx, payload) {
      if (ctx.actor.role !== "coach" || !isID(payload.requestID)) return fail("NOT_ALLOWED");
      const q = await ctx.repo.getLateCancelRequest(payload.requestID);
      if (!q || q.CoachID !== ctx.actor.coachID) return fail("NOT_ALLOWED");
      if (q.status !== "pending") return ok(null);
      const approve = payload.approve === true;
      if (approve) {
        const offerHours = await hoursFor(ctx, "spotOfferHours");
        if (typeof offerHours === "string") return fail(offerHours);
        const r = await ctx.repo.releaseSpot(q.ClassID, q.TraineeID, "cancel", offerHours);
        const k = await ctx.repo.getClass(q.ClassID);
        if (k) await tellOffered(ctx, k, r);
      }
      if (await ctx.repo.decideLateCancelRequest(q.LateCancelRequestID, approve)) {
        await tell(ctx, [q.TraineeID], approve ? "בקשת הביטול שלך אושרה" : "בקשת הביטול שלך נדחתה");
      }
      return ok(null);
    },

    // UC11 step 7: the trainee who got the offer takes the spot or passes it on. After it ran out, SPOT_OFFER_EXPIRED.
    async respond_to_spot_offer(ctx, payload) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID) return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      if (!k) return fail("NOT_ALLOWED");
      const offerHours = await hoursFor(ctx, "spotOfferHours");
      if (typeof offerHours === "string") return fail(offerHours);
      const r = await ctx.repo.releaseSpot(k.ClassID, traineeID, payload.accept === true ? "accept" : "decline", offerHours);
      await tellOffered(ctx, k, r);
      return r.status === "ok" ? ok(null) : fail("SPOT_OFFER_EXPIRED");
    },

    // UC11 steps 9-10: after the class started. Everyone marked present gets coins once, through coins.award with the
    // registration as the event (execution decision 2); marking again credits nothing new, and unmarking takes nothing
    // back. A failed award leaves attendance saved (execution decision 3).
    async mark_attendance(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      const k = await ownClass(ctx, payload.classID);
      if (!k || k.status !== "active" || !started(k)) return fail("NOT_ALLOWED");
      const present = Array.isArray(payload.present) ? payload.present.filter(isID) : [];
      const marked = await ctx.repo.setAttendance(k.ClassID, present);
      let awarded = 0;
      for (const m of marked) {
        const r = await ctx.call({ module: "coins", action: "award", payload: { traineeID: m.TraineeID, reason: "attendance", eventRef: m.ClassRegistrationID } });
        if (r.ok) awarded++;
      }
      return ok({ awarded });
    },
  },
};
