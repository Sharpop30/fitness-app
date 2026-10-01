// System test, usecase-11 group classes: publishing, registering, the waitlist, cancelling and attendance (requirement 30),
// end to end through the one Endpoint against the LOCAL stack. Clusters (doc-module-map section 6): normal, edge (a, c,
// and the freed spot of step 7), failure (b, e). Failure d, a database that does not answer, is in the unit tests.
// Data: a fresh coach and trainees "(test)", and classes in hours from now (stage 4c plan, decision 11).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, classInHours, demoTokens, freshWorld, psql, regStatus } from "./demo-users.mjs";

let w;
before(async () => { await demoTokens(); w = await freshWorld(4); });

const coach = (action, payload = {}) => call(w.coachToken, "S11", "classes", action, payload);
const as = (i, action, payload = {}, caller = "S17") => call(w.trainees[i].token, caller, "classes", action, payload);
const messages = async (i) => (await call(w.trainees[i].token, "S13", "notifications", "list_notifications")).data.map((m) => m.messageText);
// The screen's own two audit rows of its latest request (the inner requests to settings share the requestID).
const lastAudit = (caller, action) =>
  psql(`select "isOk" || ':' || coalesce("errorCode",'-') from audit_entries where caller='${caller}' and "actionName"='${action}'
        and "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");
const balance = (i) => psql(`select coalesce(sum("amount"),0) from coin_transactions where "TraineeID"='${w.trainees[i].traineeID}'`);

test("normal: the coach publishes, the trainee registers, and the registration shows to the coach", async () => {
  const at = new Date(Date.now() + 5 * 24 * 3600e3);
  const day = at.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  assert.equal((await coach("publish_class", { startsAt: `${day}T18:30:00`, place: "פארק (test)", capacity: 8 })).ok, true);
  const k = (await as(0, "list_upcoming_classes")).data.classes.find((x) => x.place === "פארק (test)");
  // Decision 7: 18:30 without a zone is 18:30 in Israel.
  assert.equal(new Date(k.startsAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }), "18:30");
  assert.deepEqual(await as(0, "register", { classID: k.ClassID }), { ok: true, data: { status: "registered", position: null }, error: null });
  const one = (await coach("list_registrations", { classID: k.ClassID })).data;
  assert.deepEqual(one.registered.map((r) => r.TraineeID), [w.trainees[0].traineeID]);
});

test("normal: a full class puts the trainee on the waitlist with their place; the trainee sees counts, not names", async () => {
  const k = classInHours(w.coachID, 48, 1, [[w.trainees[0].traineeID, "registered"], [w.trainees[1].traineeID, "waitlist"]]);
  assert.deepEqual((await as(2, "register", { classID: k })).data, { status: "waitlist", position: 2 });
  const seen = (await as(2, "list_upcoming_classes")).data.classes.find((x) => x.ClassID === k);
  assert.deepEqual([seen.registered, seen.waitlist, seen.myStatus, seen.myWaitPosition], [[{}], [{}, {}], "waitlist", 2]);
});

test("normal: cancelling two days before takes the name off, and the first waiting is offered the spot, with a message", async () => {
  const k = classInHours(w.coachID, 48, 1, [[w.trainees[0].traineeID, "registered"], [w.trainees[1].traineeID, "waitlist"], [w.trainees[2].traineeID, "waitlist"]]);
  assert.equal((await as(0, "cancel_registration", { classID: k })).ok, true);
  assert.deepEqual([0, 1, 2].map((i) => regStatus(k, w.trainees[i].traineeID)), ["cancelled", "offered", "waitlist"]);
  assert.ok((await messages(1)).some((m) => m.startsWith("התפנה מקום בשיעור ב-")));
  assert.equal((await coach("list_registrations", { classID: k })).data.registered.length, 0);
});

test("edge (step 7): the offered trainee takes the spot, or passes it to the next in line", async () => {
  const k = classInHours(w.coachID, 48, 1, [[w.trainees[1].traineeID, "offered"], [w.trainees[2].traineeID, "waitlist"], [w.trainees[3].traineeID, "waitlist"]]);
  assert.equal((await as(1, "respond_to_spot_offer", { classID: k, accept: false }, "S13")).ok, true);
  assert.deepEqual([regStatus(k, w.trainees[1].traineeID), regStatus(k, w.trainees[2].traineeID)], ["cancelled", "offered"]);
  assert.equal((await as(2, "respond_to_spot_offer", { classID: k, accept: true }, "S13")).ok, true);
  assert.equal(regStatus(k, w.trainees[2].traineeID), "registered");
});

test("edge (decision 6): an offer that ran out passes on at the next action, and answering it is SPOT_OFFER_EXPIRED", async () => {
  const k = classInHours(w.coachID, 48, 1, [[w.trainees[1].traineeID, "offered"], [w.trainees[3].traineeID, "waitlist"]]);
  psql(`update class_registrations set "offerExpiresAt" = now() - interval '1 minute' where "ClassID"='${k}' and "status"='offered'`);
  await coach("list_registrations", { classID: k });
  assert.equal(regStatus(k, w.trainees[3].traineeID), "offered");
  assert.equal((await as(1, "respond_to_spot_offer", { classID: k, accept: true }, "S13")).error.code, "SPOT_OFFER_EXPIRED");
  assert.deepEqual(lastAudit("S13", "respond_to_spot_offer"), ["true:-", "false:SPOT_OFFER_EXPIRED"]);
});

test("edge a: cancelling an hour before is refused; a late-cancel request goes to the coach, who approves or rejects", async () => {
  const k = classInHours(w.coachID, 1, 8, [[w.trainees[0].traineeID, "registered"], [w.trainees[1].traineeID, "registered"]]);
  assert.equal((await as(0, "cancel_registration", { classID: k })).error.code, "CANCEL_TOO_LATE");
  assert.deepEqual(lastAudit("S17", "cancel_registration"), ["true:-", "false:CANCEL_TOO_LATE"]);
  assert.equal(regStatus(k, w.trainees[0].traineeID), "registered");
  for (const i of [0, 1]) assert.equal((await as(i, "request_late_cancel", { classID: k })).ok, true);
  const requests = (await coach("list_upcoming_classes")).data.lateRequests;
  const reqOf = (i) => psql(`select q."LateCancelRequestID" from late_cancel_requests q join class_registrations r using ("ClassRegistrationID")
                             where r."ClassID"='${k}' and r."TraineeID"='${w.trainees[i].traineeID}'`);
  assert.ok(requests.some((r) => r.LateCancelRequestID === reqOf(0)));
  assert.equal((await coach("decide_late_cancel", { requestID: reqOf(0), approve: true })).ok, true);
  assert.equal((await coach("decide_late_cancel", { requestID: reqOf(1), approve: false })).ok, true);
  assert.deepEqual([regStatus(k, w.trainees[0].traineeID), regStatus(k, w.trainees[1].traineeID)], ["cancelled", "registered"]);
  assert.ok((await messages(0)).includes("בקשת הביטול שלך אושרה"));
  assert.ok((await messages(1)).includes("בקשת הביטול שלך נדחתה"));
});

test("edge c: the coach cancels a class, and everyone registered or waiting gets a message", async () => {
  const k = classInHours(w.coachID, 30, 1, [[w.trainees[2].traineeID, "registered"], [w.trainees[3].traineeID, "waitlist"]]);
  const before = await Promise.all([2, 3].map(messages));
  assert.equal((await coach("cancel_class", { classID: k })).ok, true);
  const after = await Promise.all([2, 3].map(messages));
  for (const i of [0, 1]) {
    assert.equal(after[i].length, before[i].length + 1);
    assert.ok(after[i][0].endsWith("בוטל בידי המאמן"));
  }
  const seen = (await as(2, "list_upcoming_classes")).data.classes.find((x) => x.ClassID === k);
  assert.equal(seen.status, "cancelled");
});

test("normal: the coach marks attendance, and only those marked get coinsAttendance, once", async () => {
  const k = classInHours(w.coachID, -1, 8, [[w.trainees[0].traineeID, "registered"], [w.trainees[1].traineeID, "registered"]]);
  const coins = Number(psql(`select "settingValue" from settings where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey"='coinsAttendance'`));
  const [a0, a1] = [balance(0), balance(1)].map(Number);
  assert.deepEqual((await coach("mark_attendance", { classID: k, present: [w.trainees[0].traineeID] })).data, { awarded: 1 });
  assert.deepEqual((await coach("mark_attendance", { classID: k, present: [w.trainees[0].traineeID] })).data, { awarded: 0 });
  assert.deepEqual([Number(balance(0)) - a0, Number(balance(1)) - a1], [coins, 0]);
  const one = (await coach("list_registrations", { classID: k })).data;
  assert.deepEqual(one.registered.map((r) => r.attended).sort(), [false, true]);
});

test("failure b: registering again while registered is ALREADY_REGISTERED, logged, and nothing is added", async () => {
  const k = classInHours(w.coachID, 48, 8, [[w.trainees[0].traineeID, "registered"]]);
  assert.equal((await as(0, "register", { classID: k })).error.code, "ALREADY_REGISTERED");
  assert.deepEqual(lastAudit("S17", "register"), ["true:-", "false:ALREADY_REGISTERED"]);
  assert.equal(psql(`select count(*) from class_registrations where "ClassID"='${k}'`), "1");
});

test("failure e: two trainees on the last spot at the same moment; one registers, one waits, never over capacity", async () => {
  for (let round = 0; round < 5; round++) {
    const k = classInHours(w.coachID, 48, 1);
    const replies = await Promise.all([2, 3].map((i) => as(i, "register", { classID: k })));
    assert.deepEqual(replies.map((r) => r.data.status).sort(), ["registered", "waitlist"], `round ${round}`);
    assert.equal(psql(`select count(*) from class_registrations where "ClassID"='${k}' and "status"='registered'`), "1");
  }
});

test("failure: a class with missing details is CLASS_INVALID, logged, and not saved", async () => {
  const count = () => psql(`select count(*) from classes where "CoachID"='${w.coachID}'`);
  const before = count();
  assert.equal((await coach("publish_class", { startsAt: "2099-01-01T10:00", place: "פארק", capacity: 0 })).error.code, "CLASS_INVALID");
  assert.deepEqual(lastAudit("S11", "publish_class"), ["true:-", "false:CLASS_INVALID"]);
  assert.equal(count(), before);
});
