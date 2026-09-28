// Stage 4c Integration (doc-module-map section 6; stage 4c plan, task 8): the classes and notifications actions through the
// envelope, the Registry and the Audit Log, against the LOCAL stack. Writes go only to a fresh coach and trainees "(test)"
// (stage 4c plan, decision 11), and to one coach note on a workout of the fresh trainee, so the file passes on a used
// database too.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, classInHours, demoTokens, freshWorld, ID, lastAudit, psql, workoutDaysAgo } from "../system/demo-users.mjs";

let t;
let w;
before(async () => { t = await demoTokens(); w = await freshWorld(2); });

const trail = (caller, action) =>
  psql(`select caller || '>' || "moduleName" || '.' || "actionName" || ':' || "isOk" || ':' || coalesce("errorCode",'-') from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");
const requestIDs = (caller, action) =>
  psql(`select count(distinct "requestID") from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)`);
const screenRows = (caller, action) =>
  trail(caller, action).filter((row) => row.startsWith(`${caller}>`)).map((row) => row.split(":").slice(1).join(":"));

test("every classes and notifications screen action goes through the envelope and leaves two audit rows", async () => {
  const [a, b] = w.trainees;
  const open = classInHours(w.coachID, 48, 1);
  const done = classInHours(w.coachID, -2, 8, [[a.traineeID, "registered"]]);
  const cases = [
    // [token, caller, module, action, payload, expected: true or an error code]
    [w.coachToken, "S11", "classes", "publish_class", { startsAt: new Date(Date.now() + 72 * 3600e3).toISOString(), place: "פארק (test)", capacity: 5 }, true],
    [w.coachToken, "S11", "classes", "publish_class", { startsAt: "2099-01-01T10:00", place: " ", capacity: 5 }, "CLASS_INVALID"],
    [w.coachToken, "S11", "classes", "list_upcoming_classes", {}, true],
    [w.coachToken, "S11", "classes", "list_registrations", { classID: open }, true],
    [a.token, "S17", "classes", "list_upcoming_classes", {}, true],
    [a.token, "S17", "classes", "register", { classID: open }, true],
    [a.token, "S17", "classes", "register", { classID: open }, "ALREADY_REGISTERED"],
    [b.token, "S17", "classes", "register", { classID: open }, true], // the waitlist
    [a.token, "S17", "classes", "cancel_registration", { classID: open }, true], // the spot goes to b
    [b.token, "S13", "classes", "respond_to_spot_offer", { classID: open, accept: true }, true],
    [a.token, "S13", "classes", "respond_to_spot_offer", { classID: open, accept: true }, "SPOT_OFFER_EXPIRED"],
    [a.token, "S17", "classes", "request_late_cancel", { classID: open }, "NOT_ALLOWED"], // not registered any more
    [w.coachToken, "S11", "classes", "decide_late_cancel", { requestID: w.coachID, approve: true }, "NOT_ALLOWED"], // not a request
    [w.coachToken, "S11", "classes", "mark_attendance", { classID: done, present: [a.traineeID] }, true],
    [w.coachToken, "S11", "classes", "cancel_class", { classID: open }, true],
    [b.token, "S13", "notifications", "list_notifications", {}, true],
    [b.token, "S13", "notifications", "mark_read", { notificationID: w.coachID }, "NOT_ALLOWED"], // not a message
  ];
  for (const [token, caller, module, action, payload, expected] of cases) {
    const r = await call(token, caller, module, action, payload);
    const label = `${caller} ${module}.${action} ${JSON.stringify(payload)}`;
    if (expected === true) assert.equal(r.ok, true, `${label}: ${JSON.stringify(r.error)}`);
    else assert.equal(r.error?.code, expected, label);
    assert.deepEqual(screenRows(caller, action), ["true:-", expected === true ? "true:-" : `false:${expected}`], label);
  }
});

test("S11: mark_attendance asks coins.award as M11, and coins asks settings, all under one requestID", async () => {
  const [a] = w.trainees;
  const k = classInHours(w.coachID, -1, 8, [[a.traineeID, "registered"]]);
  const r = await call(w.coachToken, "S11", "classes", "mark_attendance", { classID: k, present: [a.traineeID] });
  assert.deepEqual(r.data, { awarded: 1 });
  const rows = trail("S11", "mark_attendance");
  for (const expected of ["M11>coins.award:true:-", "M07>settings.get_settings:true:-"]) assert.ok(rows.includes(expected), rows.join("\n"));
  assert.equal(requestIDs("S11", "mark_attendance"), "1");
  const regID = psql(`select "ClassRegistrationID" from class_registrations where "ClassID"='${k}' and "TraineeID"='${a.traineeID}'`);
  assert.equal(psql(`select count(*) from coin_transactions where "eventType"='attendance' and "eventRef"='${regID}'`), "1");
});

test("S06: add_coach_note asks notifications.notify_in_app as M06, under one requestID, and the trainee sees the message", async () => {
  const [a] = w.trainees;
  const logID = workoutDaysAgo(a.traineeID, a.workoutID, 1, [[ID.squat, 5, 60]]);
  const r = await call(w.coachToken, "S06", "feedback", "add_coach_note", { workoutLogID: logID, noteText: "יפה (test)" });
  assert.equal(r.ok, true);
  assert.ok(trail("S06", "add_coach_note").includes("M06>notifications.notify_in_app:true:-"));
  assert.equal(requestIDs("S06", "add_coach_note"), "1");
  const mine = await call(a.token, "S13", "notifications", "list_notifications");
  assert.equal(mine.data[0].messageText, "המאמן הוסיף הערה לאימון שלך");
});

test("S13: the trainee's home reads classes as M13, with no refused rows for classes (stage 4b report, gap 7)", async () => {
  const [a] = w.trainees;
  classInHours(w.coachID, 30, 8, [[a.traineeID, "registered"]]);
  const r = await call(a.token, "S13", "home", "get_trainee_home");
  assert.equal(r.ok, true);
  assert.notEqual(r.data.nextClass, null);
  const rows = trail("S13", "get_trainee_home");
  assert.ok(rows.includes("M13>classes.list_upcoming_classes:true:-"));
  assert.ok(rows.includes("M11>settings.get_settings:true:-"));
});

test("no Registry row: a screen asking notify_in_app, and the wrong role on a screen, get ACTION_NOT_ALLOWED", async () => {
  const [a] = w.trainees;
  const refused = [
    [w.coachToken, "S11", "notifications", "notify_in_app", { traineeID: a.traineeID, messageText: "x" }],
    [a.token, "S13", "notifications", "notify_in_app", { traineeID: a.traineeID, messageText: "x" }],
    [a.token, "S11", "classes", "list_upcoming_classes", {}],
    [a.token, "S11", "classes", "publish_class", {}],
    [w.coachToken, "S17", "classes", "register", {}],
    [w.coachToken, "S13", "notifications", "list_notifications", {}],
  ];
  for (const [token, caller, module, action, payload] of refused) {
    const r = await call(token, caller, module, action, payload);
    assert.equal(r.error?.code, "ACTION_NOT_ALLOWED", `${caller} ${module}.${action}`);
    assert.deepEqual(lastAudit(caller, action), ["true:-", "false:ACTION_NOT_ALLOWED"], `${caller} ${module}.${action}`);
  }
});

test("rule 5: the demo coach and a demo trainee cannot reach the fresh coach's class", async () => {
  const k = classInHours(w.coachID, 48, 8);
  assert.equal((await call(t.coach, "S11", "classes", "list_registrations", { classID: k })).error?.code, "NOT_ALLOWED");
  assert.equal((await call(t.noa, "S17", "classes", "register", { classID: k })).error?.code, "NOT_ALLOWED");
});

test("the classes functions are closed to the browser: the public key gets 401, and nothing is written", async () => {
  const count = () => psql(`select count(*) from class_registrations`);
  const before = count();
  const rpc = (name, body) => fetch(`${API}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const k = classInHours(w.coachID, 48, 8);
  assert.equal((await rpc("classes_register", { p_class: k, p_trainee: ID.noa, p_hours: 2 })).status, 401);
  assert.equal((await rpc("classes_release_spot", { p_class: k, p_trainee: ID.noa, p_op: "cancel", p_hours: 2 })).status, 401);
  assert.equal((await rpc("classes_offer_spots", { p_class: k, p_hours: 2 })).status, 401);
  assert.equal(count(), before);
});
