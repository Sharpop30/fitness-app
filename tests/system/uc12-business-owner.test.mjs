// System Test, usecase-12 end to end (doc-module-map v11 section 6; stage 4e plan, task 12): the business owner, norm,
// edge and failure, against the LOCAL stack. A fresh coach "(test)" is a business of one and its owner (rule 9); coaches
// join it by invite on S22. Sections 4, 6 and 13 of the use case.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  call, coachJoins, coachTokenOf, demoTokens, freshEmail, freshPassword, freshWorld, lastAudit, lastMailTo, paymentRequest, psql, signUp, traineeOfCoach,
} from "./demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(1); });

const ISRAEL_MONTH = `to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM')`;

// ---- norm (section 4, and section 13 rows 1, 2, 4, 5, 7) ----

test("norm, steps 3-7: the owner invites a coach, the coach joins, and appears in the list of coaches", async () => {
  const before = (await call(w.coachToken, "S25", "business", "list_coaches")).data;
  assert.deepEqual(before.map((c) => [c.CoachID, c.joined]), [[w.coachID, true]]); // edge e: only the owner, as a coach
  const { coachID } = await coachJoins(w.coachToken, "שירה (test)");
  const after = (await call(w.coachToken, "S25", "business", "list_coaches")).data;
  assert.deepEqual(after.find((c) => c.CoachID === coachID), { CoachID: coachID, CoachInviteID: null, fullName: "שירה (test)", joined: true, trainees: 0 });
});

test("norm, step 5: an email invite reaches the local mailbox with the coach link", async () => {
  const email = freshEmail("coachmail");
  const r = await call(w.coachToken, "S25", "business", "invite_coach", { name: "במייל (test)", email, channel: "email" });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  const html = await lastMailTo(email);
  assert.ok(html, "no mail");
  assert.ok(html.includes(encodeURIComponent(`coach=${coachTokenOf(r.data.link)}`)) || html.includes(`coach=${coachTokenOf(r.data.link)}`), "the coach link is in the mail");
  const open = (await call(w.coachToken, "S25", "business", "list_coaches")).data.find((c) => c.fullName === "במייל (test)");
  assert.equal(open.joined, false);
});

test("norm, step 2: the overview's sums equal the payments of every coach in the business", async () => {
  const k = await coachJoins(w.coachToken);
  const trainee = psql(`select "TraineeID" from trainees where "CoachID"='${w.coachID}' limit 1`);
  paymentRequest(w.coachID, trainee, { amount: 350, paid: true });
  paymentRequest(w.coachID, trainee, { amount: 600 });
  // The second coach's request, for a trainee of their own.
  const { traineeID } = await traineeOfCoach(k.coachID);
  paymentRequest(k.coachID, traineeID, { amount: 400, paid: true });
  const home = (await call(w.coachToken, "S24", "home", "get_owner_home")).data;
  const sum = (where) => Number(psql(`select coalesce(sum(p.amount),0) from payment_requests p join coaches c using ("CoachID")
                                       where c."BusinessID"='${w.businessID}' and ${where}`));
  assert.equal(home.incomeMonth, sum(`p.status='paid' and to_char(p."paidAt" at time zone 'Asia/Jerusalem','YYYY-MM') = ${ISRAEL_MONTH}`));
  assert.equal(home.incomeMonth, 750);
  assert.equal(home.openAmount, sum(`p.status='open'`));
  assert.equal(home.activeTrainees, Number(psql(`select count(*) from trainees t join coaches c using ("CoachID") where c."BusinessID"='${w.businessID}' and t."isActive"`)));
});

test("norm, step 8 and rule 5: the coach card has names, programs, streaks, income and classes, and no results, notes or goals", async () => {
  const r = await call(w.coachToken, "S27", "business", "get_coach_card", { coachID: w.coachID });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.deepEqual(Object.keys(r.data).sort(), ["coach", "income", "trainees", "upcomingClasses"]);
  assert.deepEqual(Object.keys(r.data.trainees[0]).sort(), ["TraineeID", "fullName", "hasProgram", "streak"]);
  assert.equal(/"(reps|weight|sets|noteText|targetWeight|goal)"/.test(JSON.stringify(r.data)), false);
});

test("norm, step 9: the measures, for the whole business", async () => {
  const r = (await call(w.coachToken, "S26", "business", "get_kpis")).data;
  assert.deepEqual(Object.keys(r).sort(), ["activeTrainees", "allPayments", "challengeCompletions", "invoicedPayments", "loggedThisWeek", "withProgram"]);
  assert.equal(r.allPayments, Number(psql(`select count(*) from payment_requests p join coaches c using ("CoachID") where c."BusinessID"='${w.businessID}'`)));
});

test("norm, step 10: the owner changes the price, and a new request of every coach in the business carries it", async () => {
  const k = await coachJoins(w.coachToken);
  const { traineeID } = await traineeOfCoach(k.coachID);
  assert.equal((await call(w.coachToken, "S12", "settings", "update_settings", { values: { priceMonthly: "420" } })).ok, true);
  assert.equal((await call(k.token, "S08", "payments", "create_payment_request", { traineeID, paymentType: "monthly" })).ok, true);
  assert.equal(Number(psql(`select amount from payment_requests where "TraineeID"='${traineeID}' order by "createdAt" desc limit 1`)), 420);
});

test("norm, step 1 and rule 10: an owner who is also a coach has both roles, and moves between them with one sign-in", async () => {
  const me = (await call(t.coach, "S23", "trainees", "get_me")).data;
  assert.deepEqual(me.roles, ["owner", "coach"]);
  assert.equal((await call(t.coach, "S24", "home", "get_owner_home")).ok, true);
  assert.equal((await call(t.coach, "S01", "home", "get_coach_home")).ok, true);
});

// ---- edge and failure (section 6) ----

test("a: an invite past its date, or used, is INVITE_EXPIRED", async () => {
  const link = (await call(w.coachToken, "S25", "business", "invite_coach", { name: "פג (test)", channel: "link" })).data.link;
  psql(`update coach_invites set "expiresAt" = now() - interval '1 minute' where token = '${coachTokenOf(link)}'`);
  const token = await signUp(freshEmail("late"), freshPassword());
  assert.equal((await call(token, "S22", "business", "accept_coach_invite", { token: coachTokenOf(link) })).error?.code, "INVITE_EXPIRED");
  assert.equal((await call(token, "S22", "business", "accept_coach_invite", { token: "no-such-token" })).error?.code, "INVITE_EXPIRED");
});

test("b: a bad contact detail creates no invite (INVITE_INVALID)", async () => {
  const count = () => psql(`select count(*) from coach_invites where "BusinessID"='${w.businessID}'`);
  const before = count();
  assert.equal((await call(w.coachToken, "S25", "business", "invite_coach", { name: "x", email: "not-an-email", channel: "email" })).error?.code, "INVITE_INVALID");
  assert.equal((await call(w.coachToken, "S25", "business", "invite_coach", { name: "", channel: "link" })).error?.code, "INVITE_INVALID");
  assert.equal(count(), before);
});

test("d: someone already a trainee, a coach or an owner cannot join as a coach (NOT_ALLOWED), and no coach is made", async () => {
  const link = (await call(w.coachToken, "S25", "business", "invite_coach", { name: "תפוס (test)", channel: "link" })).data.link;
  // A trainee reaches the module, which refuses (NOT_ALLOWED); an owner and coach has no S22 row at all (ACTION_NOT_ALLOWED).
  for (const [token, code] of [[w.trainees[0].token, "NOT_ALLOWED"], [t.coach, "ACTION_NOT_ALLOWED"]]) {
    assert.equal((await call(token, "S22", "business", "accept_coach_invite", { token: coachTokenOf(link) })).error?.code, code);
  }
  assert.equal(psql(`select status from coach_invites where token='${coachTokenOf(link)}'`), "open");
});

test("f: a coach who tries to change settings gets ACTION_NOT_ALLOWED, logged, and the value stays", async () => {
  const k = await coachJoins(w.coachToken);
  const before = psql(`select "settingValue" from settings where "BusinessID"='${w.businessID}' and "settingKey"='pricePack10'`);
  assert.equal((await call(k.token, "S12", "settings", "update_settings", { values: { pricePack10: "1" } })).error?.code, "ACTION_NOT_ALLOWED");
  assert.deepEqual(lastAudit("S12", "update_settings"), ["true:-", "false:ACTION_NOT_ALLOWED"]);
  assert.equal(psql(`select "settingValue" from settings where "BusinessID"='${w.businessID}' and "settingKey"='pricePack10'`), before);
});
