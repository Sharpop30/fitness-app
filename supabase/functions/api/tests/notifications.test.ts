// Unit tests for M12 notifications, against an in-memory Repository (synthetic data), behind the Orchestrator.
// Sources: usecase-11 step 7 and c; usecase-06 step 9; usecase-09 v3 step 2; doc-module-map v7 section 4
// (notify_in_app, list_notifications); stage 4c plan, execution decision 8; Business Logic rule 5.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { feedback } from "../modules/feedback.ts";
import { notifications } from "../modules/notifications.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type Notification, StorageUnavailable, type WorkoutLog } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), NOA = U(11), ITAI = U(12);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const noa: Actor = { role: "trainee", coachID: COACH, traineeID: NOA };
const itai: Actor = { role: "trainee", coachID: COACH, traineeID: ITAI };
// The Registry rows of 0002: notify_in_app from M06 and M11 only; list and mark_read from S13.
const ROWS = new Set(["M06/notify_in_app/module", "M11/notify_in_app/module", "S13/list_notifications/trainee", "S13/mark_read/trainee",
  "S06/add_coach_note/coach", "M06/get_settings/module"]);

function world(opts: { storageDown?: boolean } = {}) {
  let seq = 800;
  const rows: (Notification & { TraineeID: string; readAt: string | null })[] = [];
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const log: WorkoutLog = { WorkoutLogID: U(51), TraineeID: NOA, WorkoutID: U(41), workoutName: "אימון A", performedAt: "2026-09-28", sets: [] };
  const w = fakeRepo({
    isRegistered: async (caller, _m, action, role) => ROWS.has(`${caller}/${action}/${role}`),
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [NOA, ITAI].includes(t)),
    addNotification: async (TraineeID, messageText) => {
      down();
      rows.push({ NotificationID: U(seq++), TraineeID, messageText, createdAt: new Date(2026, 8, 28, 0, seq).toISOString(), readAt: null });
    },
    listUnreadNotifications: async (t) => (down(), rows.filter((r) => r.TraineeID === t && !r.readAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ NotificationID, messageText, createdAt }) => ({ NotificationID, messageText, createdAt }))),
    markNotificationRead: async (id, t) => {
      down();
      const r = rows.find((x) => x.NotificationID === id && x.TraineeID === t);
      if (!r) return false;
      r.readAt ??= "2026-09-28";
      return true;
    },
    getWorkoutLog: async (id) => (id === log.WorkoutLogID ? structuredClone(log) : null),
    getCoachSettings: async () => ({ noteMaxLength: "280" }),
    addCoachNote: async () => {},
  });
  const ask = (actor: Actor, caller: string, action: string, payload: Record<string, unknown> = {}, module = "notifications") =>
    handle({ caller, module, action, payload }, actor, w.repo, { notifications, feedback, settings });
  return { ...w, rows, ask, log };
}

Deno.test("UC11 step 7: classes sends a message to a trainee of the coach, and the trainee sees it unread", async () => {
  const w = world();
  assertEquals(await w.ask(coach, "M11", "notify_in_app", { traineeID: NOA, messageText: " התפנה מקום (test) " }), ok(null));
  const r = await w.ask(noa, "S13", "list_notifications");
  assertEquals((r.data as Notification[]).map((n) => n.messageText), ["התפנה מקום (test)"]);
});

Deno.test("module map v7 and rule 5: a trainee of another coach, or an empty text, is NOT_ALLOWED", async () => {
  const w = world();
  assertEquals(await w.ask({ ...coach, coachID: OTHER_COACH }, "M11", "notify_in_app", { traineeID: NOA, messageText: "x" }), fail("NOT_ALLOWED"));
  assertEquals(await w.ask(coach, "M11", "notify_in_app", { traineeID: NOA, messageText: "  " }), fail("NOT_ALLOWED"));
  assertEquals(await w.ask(coach, "M11", "notify_in_app", { traineeID: "not-an-id", messageText: "x" }), fail("NOT_ALLOWED"));
  assertEquals(w.rows, []);
});

Deno.test("Registry: notify_in_app from a screen, or from a module other than classes and feedback, is ACTION_NOT_ALLOWED", async () => {
  const w = world();
  assertEquals(await w.ask(coach, "S11", "notify_in_app", { traineeID: NOA, messageText: "x" }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(await w.ask(coach, "M07", "notify_in_app", { traineeID: NOA, messageText: "x" }), fail("ACTION_NOT_ALLOWED"));
});

Deno.test("execution decision 8: unread only, newest first; reading one takes it off the list, and reading it again is fine", async () => {
  const w = world();
  for (const m of ["ראשונה", "שנייה"]) await w.ask(coach, "M11", "notify_in_app", { traineeID: NOA, messageText: m });
  const first = ((await w.ask(noa, "S13", "list_notifications")).data as Notification[]);
  assertEquals(first.map((n) => n.messageText), ["שנייה", "ראשונה"]);
  assertEquals(await w.ask(noa, "S13", "mark_read", { notificationID: first[0].NotificationID }), ok(null));
  assertEquals(await w.ask(noa, "S13", "mark_read", { notificationID: first[0].NotificationID }), ok(null));
  assertEquals(((await w.ask(noa, "S13", "list_notifications")).data as Notification[]).map((n) => n.messageText), ["ראשונה"]);
});

Deno.test("rule 5: a trainee cannot see or mark another trainee's message", async () => {
  const w = world();
  await w.ask(coach, "M11", "notify_in_app", { traineeID: NOA, messageText: "של נועה" });
  assertEquals((await w.ask(itai, "S13", "list_notifications")).data, []);
  assertEquals(await w.ask(itai, "S13", "mark_read", { notificationID: w.rows[0].NotificationID }), fail("NOT_ALLOWED"));
  assertEquals(w.rows[0].readAt, null);
});

Deno.test("UC6 step 9 and UC9 v3 step 2: a coach note reaches the trainee as a message", async () => {
  const w = world();
  assertEquals(await w.ask(coach, "S06", "add_coach_note", { workoutLogID: w.log.WorkoutLogID, noteText: "יפה מאוד" }, "feedback"), ok(null));
  assertEquals(((await w.ask(noa, "S13", "list_notifications")).data as Notification[]).map((n) => n.messageText), ["המאמן הוסיף הערה לאימון שלך"]);
});

Deno.test("decision 8: a message that fails leaves the note saved, and the failure in the Audit", async () => {
  const w = world();
  w.repo.addNotification = () => Promise.reject(new StorageUnavailable("db down"));
  assertEquals(await w.ask(coach, "S06", "add_coach_note", { workoutLogID: w.log.WorkoutLogID, noteText: "יפה מאוד" }, "feedback"), ok(null));
  const inner = w.audits.filter((a) => a.caller === "M06" && a.actionName === "notify_in_app");
  assertEquals(inner.map((a) => [a.isOk, a.errorCode]), [[true, null], [false, "STORAGE_UNAVAILABLE"]]);
});

Deno.test("a database that fails gives STORAGE_UNAVAILABLE, without throwing", async () => {
  assertEquals(await world({ storageDown: true }).ask(noa, "S13", "list_notifications"), fail("STORAGE_UNAVAILABLE"));
});
