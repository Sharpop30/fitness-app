// Stage 4c acceptance (CLAUDE.md sections 6 and 9; stage 4c plan, task 11), against the LOCAL stack.
// With the full regression (Unit, Integration, System) green on a clean database, this file adds: every request of the
// stage's screens leaves audit rows with one requestID (9.3); values read from SETTINGS at run time (9.4, rule 8); and
// the coach scenario of the plan through the one Endpoint. 9.1, 9.6 and 9.7 run in stage4a-acceptance.test.mjs, which
// reads every module file, classes.ts and notifications.ts included. Direct changes to SETTINGS are to a fresh coach only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, classInHours, demoTokens, freshWorld, psql, regStatus } from "./demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(2); });

const setting = (key, value) => psql(`update settings set "settingValue" = '${value}' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey" = '${key}'`);

// ---- 9.3: every request leaves audit rows with a shared requestID ----
test("9.3: each request of S11, S13 and S17 leaves its audit rows under one requestID, inner requests included", async () => {
  const [a] = w.trainees;
  const k = classInHours(w.coachID, 48, 1, [[w.trainees[1].traineeID, "registered"]]);
  const asked = [
    [t.coach, "S11", "classes", "list_upcoming_classes", {}], [w.coachToken, "S11", "classes", "list_registrations", { classID: k }],
    [a.token, "S17", "classes", "list_upcoming_classes", {}], [a.token, "S17", "classes", "register", { classID: k }],
    [w.trainees[1].token, "S17", "classes", "cancel_registration", { classID: k }], // offers the spot and tells a: three modules
    [a.token, "S13", "home", "get_trainee_home", {}], [a.token, "S13", "notifications", "list_notifications", {}],
  ];
  for (const [token, caller, module, action, payload] of asked) {
    const before = Number(psql(`select count(*) from audit_entries`));
    await call(token, caller, module, action, payload);
    const ids = psql(`select count(distinct "requestID") from (select "requestID" from audit_entries order by "createdAt" desc limit ${Number(psql(`select count(*) from audit_entries`)) - before}) x`);
    assert.equal(ids, "1", `${caller} ${module}.${action}`);
  }
  assert.equal(regStatus(k, a.traineeID), "offered");
});

// ---- 9.4: SETTINGS at run time (CLAUDE.md rule 8) ----
test("9.4: the cancel window, the offer time and the attendance coins follow SETTINGS, with no code change", async () => {
  const [a, b] = w.trainees;
  const cancel = (k) => call(a.token, "S17", "classes", "cancel_registration", { classID: k });
  setting("cancelHours", "24");
  assert.equal((await cancel(classInHours(w.coachID, 5, 8, [[a.traineeID, "registered"]]))).error.code, "CANCEL_TOO_LATE");
  setting("cancelHours", "4");
  assert.equal((await cancel(classInHours(w.coachID, 5, 8, [[a.traineeID, "registered"]]))).ok, true);

  const offerHours = async (hours) => {
    setting("spotOfferHours", String(hours));
    const k = classInHours(w.coachID, 48, 1, [[b.traineeID, "registered"], [a.traineeID, "waitlist"]]);
    await call(b.token, "S17", "classes", "cancel_registration", { classID: k });
    return Number(psql(`select round(extract(epoch from "offerExpiresAt" - now()) / 3600) from class_registrations
                        where "ClassID"='${k}' and "TraineeID"='${a.traineeID}'`));
  };
  assert.equal(await offerHours(2), 2);
  assert.equal(await offerHours(6), 6);

  const coinsFor = async (amount) => {
    setting("coinsAttendance", String(amount));
    const k = classInHours(w.coachID, -1, 8, [[a.traineeID, "registered"]]);
    await call(w.coachToken, "S11", "classes", "mark_attendance", { classID: k, present: [a.traineeID] });
    return psql(`select c."amount" from coin_transactions c join class_registrations r on c."eventRef" = r."ClassRegistrationID"::text
                 where c."eventType"='attendance' and r."ClassID"='${k}'`);
  };
  assert.equal(await coinsFor(5), "5");
  assert.equal(await coinsFor(8), "8");
  setting("cancelHours", "24");
  setting("spotOfferHours", "2");
  setting("coinsAttendance", "5");
});

// ---- the coach scenario of the plan (task 11), through the Endpoint ----
test("the coach publishes a class, sees who registered and waits, decides a late request, marks attendance, and cancels a class", async () => {
  const [a, b] = w.trainees;
  const coach = (action, payload = {}) => call(w.coachToken, "S11", "classes", action, payload);
  const day = new Date(Date.now() + 3 * 24 * 3600e3).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  assert.equal((await coach("publish_class", { startsAt: `${day}T07:00:00`, place: "חוף (test)", capacity: 1 })).ok, true);
  const k = (await coach("list_upcoming_classes")).data.classes.find((x) => x.place === "חוף (test)");
  assert.equal((await call(a.token, "S17", "classes", "register", { classID: k.ClassID })).data.status, "registered");
  assert.equal((await call(b.token, "S17", "classes", "register", { classID: k.ClassID })).data.status, "waitlist");
  const one = (await coach("list_registrations", { classID: k.ClassID })).data;
  assert.deepEqual([one.registered.map((r) => r.TraineeID), one.waitlist.map((r) => r.TraineeID)], [[a.traineeID], [b.traineeID]]);

  const soon = classInHours(w.coachID, 2, 8, [[a.traineeID, "registered"]]);
  await call(a.token, "S17", "classes", "request_late_cancel", { classID: soon });
  const req = (await coach("list_upcoming_classes")).data.lateRequests[0];
  assert.equal((await coach("decide_late_cancel", { requestID: req.LateCancelRequestID, approve: true })).ok, true);
  assert.equal(regStatus(soon, a.traineeID), "cancelled");

  const done = classInHours(w.coachID, -1, 8, [[a.traineeID, "registered"], [b.traineeID, "registered"]]);
  assert.deepEqual((await coach("mark_attendance", { classID: done, present: [b.traineeID] })).data, { awarded: 1 });

  assert.equal((await coach("cancel_class", { classID: k.ClassID })).ok, true);
  const told = (await call(b.token, "S13", "notifications", "list_notifications")).data.map((m) => m.messageText);
  assert.ok(told.some((m) => m.endsWith("בוטל בידי המאמן")));
});
