// System Test, usecase-04 steps 3-6 end to end (doc-module-map v9 section 6; stage 5 plan, task 10): joining by invite,
// norm, edge, failure, against the LOCAL stack. A fresh coach "(test)" invites; newcomers sign up with the identity service
// (I01) and join on S22; the email invite goes through I03 to the local mailbox (Mailpit).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshEmail, freshPassword, freshWorld, lastMailTo, psql, signIn, signUp, tokenOf } from "./demo-users.mjs";

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(0); });

const invite = async (name, channel = "link", email = "") => {
  const r = await call(w.coachToken, "S02", "trainees", "invite_trainee", { name, email, channel });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  return tokenOf(r.data.link);
};
const join = (token, inviteToken, fullName = "") => call(token, "S22", "trainees", "accept_invite", { token: inviteToken, fullName });
const listed = async (name) => (await call(w.coachToken, "S02", "trainees", "list_trainees")).data.find((x) => x.fullName === name);
const traineesOf = () => psql(`select count(*) from trainees where "CoachID"='${w.coachID}'`);

// ---- norm ----
test("norm, by link: the newcomer signs up, joins with a name, shows in the coach's list, and signs in again as a trainee", async () => {
  const name = `דנה (test ${Date.now()})`;
  const inviteToken = await invite("דנה מההזמנה (test)");
  const email = freshEmail("dana"), password = freshPassword();
  const token = await signUp(email, password);
  assert.ok(token);
  const r = await join(token, inviteToken, name);
  assert.equal(r.ok, true, JSON.stringify(r.error));
  const row = await listed(name);
  assert.deepEqual([row.TraineeID, row.joined], [r.data.TraineeID, true]);
  assert.equal(psql(`select "status" || ':' || "TraineeID" from invites where "token"='${inviteToken}'`), `accepted:${r.data.TraineeID}`);
  assert.equal(psql(`select "email" from trainees where "TraineeID"='${r.data.TraineeID}'`), email); // from the identity service
  const again = await signIn(email, password);
  assert.deepEqual((await call(again, "S23", "trainees", "get_me")).data, { roles: ["trainee"], role: "trainee", traineeID: r.data.TraineeID, fullName: name });
  assert.equal((await call(again, "S13", "home", "get_trainee_home")).ok, true);
});

test("norm, by email: the invite reaches the mailbox, its button signs the newcomer in and returns to the link, and they join", async () => {
  const email = freshEmail("yael"), name = `יעל (test ${Date.now()})`;
  const inviteToken = await invite(name, "email", email);
  const html = await lastMailTo(email);
  assert.ok(html, "no email arrived");
  const button = html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  // The identity service confirms, and returns to SITE_URL?join=token with the sign-in after the # (stage 5 plan, decision 2).
  const back = await fetch(button, { redirect: "manual" });
  const location = new URL(back.headers.get("location"));
  assert.equal(`${location.origin}${location.pathname}`, "http://localhost:5174/fitness-app/");
  assert.equal(location.searchParams.get("join"), inviteToken);
  const session = new URLSearchParams(location.hash.slice(1));
  assert.equal(session.get("type"), "invite");
  const r = await join(session.get("access_token"), inviteToken); // no name: the invite's (execution decision 1)
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.equal((await listed(name)).joined, true);
});

// ---- edge ----
test("edge a: an invite past its date is INVITE_EXPIRED, and nobody joins", async () => {
  const inviteToken = await invite("פג תוקף (test)");
  psql(`update invites set "expiresAt" = now() - interval '1 minute' where "token"='${inviteToken}'`);
  const before = traineesOf();
  assert.equal((await join(await signUp(freshEmail("late"), freshPassword()), inviteToken)).error?.code, "INVITE_EXPIRED");
  assert.equal(traineesOf(), before);
});

test("edge: a used invite is INVITE_EXPIRED; two newcomers on one invite at once make one trainee", async () => {
  const inviteToken = await invite("פעם אחת (test)");
  const [x, y] = await Promise.all([signUp(freshEmail("x"), freshPassword()), signUp(freshEmail("y"), freshPassword())]);
  const before = Number(traineesOf());
  const replies = await Promise.all([join(x, inviteToken), join(y, inviteToken)]);
  assert.deepEqual(replies.map((r) => r.ok ? "joined" : r.error.code).sort(), ["INVITE_EXPIRED", "joined"]);
  assert.equal(Number(traineesOf()), before + 1);
  assert.equal((await join(await signUp(freshEmail("z"), freshPassword()), inviteToken)).error?.code, "INVITE_EXPIRED");
});

// ---- failure ----
test("failure d: someone already a trainee, or a coach, cannot join, and the invite stays open", async () => {
  const inviteToken = await invite("כבר רשום (test)");
  assert.equal((await join(t.noa, inviteToken)).error?.code, "NOT_ALLOWED");
  assert.equal((await join(t.coach, inviteToken)).error?.code, "ACTION_NOT_ALLOWED"); // the S22 row is for a trainee only
  assert.equal(psql(`select "status" from invites where "token"='${inviteToken}'`), "open");
});

test("failure: a newcomer who has not joined reaches nothing but joining", async () => {
  const token = await signUp(freshEmail("nobody"), freshPassword());
  for (const [caller, module, action] of [["S23", "trainees", "get_me"], ["S13", "home", "get_trainee_home"], ["S22", "trainees", "list_trainees"]]) {
    assert.equal((await call(token, caller, module, action)).error?.code, "NOT_ALLOWED", `${caller} ${module}.${action}`);
  }
});
