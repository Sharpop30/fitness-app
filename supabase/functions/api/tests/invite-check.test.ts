// Unit tests for checking an invite before signing up (map v13; usecase-04 v4 step 4 and a; usecase-12 v3 step 6 and a).
// A visitor has no identity user; the reply never tells an expired token from one that never existed.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { trainees } from "../modules/trainees.ts";
import { business } from "../modules/business.ts";
import type { Actor } from "../repository.ts";
import { fakeRepo } from "./fake-repo.ts";

const visitor: Actor = { role: "trainee", roles: ["trainee"], businessID: null, coachID: "", traineeID: null };
const OPEN = "a".repeat(48), COACH_OPEN = "b".repeat(48), GONE = "c".repeat(48);

function world() {
  const asked: string[] = [];
  const w = fakeRepo({
    inviteByToken: async (t) => (asked.push(t), t === OPEN ? "רון (test)" : null),
    coachInviteByToken: async (t) => (asked.push(t), t === COACH_OPEN ? "שירה (test)" : null),
  });
  return { ...w, asked };
}
const checkTrainee = (w: ReturnType<typeof world>, token: unknown) =>
  handle({ caller: "S22", module: "trainees", action: "check_invite", payload: { token } }, visitor, w.repo, { trainees, business });
const checkCoach = (w: ReturnType<typeof world>, token: unknown) =>
  handle({ caller: "S22", module: "business", action: "check_coach_invite", payload: { token } }, visitor, w.repo, { trainees, business });

Deno.test("UC4 v4 step 4: an open invite gives the name in it, with no identity user", async () => {
  assertEquals(await checkTrainee(world(), OPEN), ok({ fullName: "רון (test)" }));
});

Deno.test("UC12 v3 step 6: an open coach invite gives the name in it", async () => {
  assertEquals(await checkCoach(world(), COACH_OPEN), ok({ fullName: "שירה (test)" }));
});

Deno.test("UC4 a and UC12 a: expired, used and unknown are one code; the other kind's token is unknown too", async () => {
  const w = world();
  assertEquals(await checkTrainee(w, GONE), fail("INVITE_EXPIRED"));
  assertEquals(await checkTrainee(w, COACH_OPEN), fail("INVITE_EXPIRED"));
  assertEquals(await checkCoach(w, OPEN), fail("INVITE_EXPIRED"));
});

Deno.test("map v13: what is not a token never reaches the database", async () => {
  const w = world();
  for (const bad of ["", "abc", "A".repeat(48), "a".repeat(47), `${"a".repeat(47)}'`, 5, null]) {
    assertEquals(await checkTrainee(w, bad), fail("INVITE_EXPIRED"));
    assertEquals(await checkCoach(w, bad), fail("INVITE_EXPIRED"));
  }
  assertEquals(w.asked, []);
});

Deno.test("every check leaves a request and a reply in the Audit, with one requestID", async () => {
  const w = world();
  await checkTrainee(w, GONE);
  assertEquals(w.audits.length, 2);
  assertEquals(w.audits[0].requestID, w.audits[1].requestID);
});
