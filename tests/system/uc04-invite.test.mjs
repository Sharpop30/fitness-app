// System Test, usecase-04 steps 1-3 and 6 end to end (doc-module-map section 6; stage 4a plan, task 7): norm, edge,
// failure, against the LOCAL stack. The coach invites on S02 and reads the list there. Joining (steps 4-5) is stage 5.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, psql, strangerCoachToken } from "./demo-users.mjs";

let t, stranger;
before(async () => {
  t = await demoTokens();
  stranger = await strangerCoachToken();
});
const invite = (payload) => call(t.coach, "S02", "trainees", "invite_trainee", payload);
const listed = async (name) => (await call(t.coach, "S02", "trainees", "list_trainees")).data.find((x) => x.fullName === name);
const invitesNamed = (name) => psql(`select count(*) from invites where "inviteeName"='${name}'`);

// ---- norm ----
test("norm: an invite by link appears in the list as invited, not joined, with no program", async () => {
  const name = `דנה (test ${Date.now()})`;
  const r = await invite({ name, email: "", channel: "link" });
  assert.equal(r.ok, true);
  assert.match(r.data.link, /^#join-[0-9a-f]{48}$/);
  const row = await listed(name);
  assert.deepEqual([row.TraineeID, row.joined, row.hasProgram], [null, false, false]);
  assert.equal(psql(`select "InviteID" from invites where "inviteeName"='${name}'`), row.InviteID);
});

// ---- edge ----
test("edge e: a coach with no trainees gets an empty list, for the screen to explain how to invite the first", async () => {
  const r = await call(stranger, "S02", "trainees", "list_trainees");
  assert.deepEqual(r, { ok: true, data: [], error: null });
});

// ---- failure ----
test("failure b: a bad contact detail creates no invite (INVITE_INVALID)", async () => {
  const name = `בלי מייל (test ${Date.now()})`;
  assert.equal((await invite({ name, email: "not-an-email", channel: "email" })).error.code, "INVITE_INVALID");
  assert.equal((await invite({ name: "", email: "", channel: "link" })).error.code, "INVITE_INVALID");
  assert.equal(invitesNamed(name), "0");
  assert.equal(await listed(name), undefined);
});

test("failure c: when the channel does not send, INVITE_DELIVERY_FAILED, and the invite stays open in the list", async () => {
  // The email channel (I03) is built in stage 5, so today every email invite reaches this case.
  const name = `במייל (test ${Date.now()})`;
  assert.equal((await invite({ name, email: "dana@example.com", channel: "email" })).error.code, "INVITE_DELIVERY_FAILED");
  assert.equal(psql(`select status || ':' || "inviteeEmail" from invites where "inviteeName"='${name}'`), "open:dana@example.com");
  assert.equal((await listed(name)).joined, false);
});
