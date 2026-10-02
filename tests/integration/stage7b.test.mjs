// Integration, stage 7b against the LOCAL stack: CORS (task 10; security review 1, finding 6), and the password policy
// (task 12; finding 5), and the password reset (task 14; design review, finding 24).
// The rule itself is unit-tested in supabase/functions/api/tests/cors.test.ts. Locally the Kong gateway of the stack adds
// "Access-Control-Allow-Origin: *" to every function reply, over the function's own headers, so here only what the
// gateway leaves visible is checked: the function never echoes another site's origin, and it varies by Origin.
// The cloud has no such gateway header; it is checked there after deploying (stage 7b report).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, ENDPOINT, freshEmail, freshPassword, lastMailTo, psql, signIn } from "../system/demo-users.mjs";

const ask = (origin, method = "POST") => fetch(ENDPOINT, {
  method,
  headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
  body: method === "POST" ? JSON.stringify({ caller: "S22", module: "settings", action: "get_error_texts", payload: {}, lang: "he" }) : undefined,
});

test("CORS: the function never echoes another site's origin, on the preflight or the POST, and varies by Origin", async () => {
  for (const origin of ["https://evil.example", "https://sharpop30.github.io.evil.example"]) {
    for (const method of ["OPTIONS", "POST"]) {
      const r = await ask(origin, method);
      assert.notEqual(r.headers.get("access-control-allow-origin"), origin, `${method} ${origin}`);
      assert.match(r.headers.get("vary") ?? "", /Origin/);
      await r.body?.cancel();
    }
  }
});

test("CORS: a request with no Origin is not a browser's, and goes on as before", async () => {
  assert.equal((await (await ask(null)).json()).ok, true);
});

// ---- Task 12: the password policy of the identity service (security review 1, finding 5): 8 characters, letters and digits ----

const signUpRaw = async (email, password) => {
  const res = await fetch(`${API}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  return { status: res.status, body: await res.json() };
};

test("password policy: shorter than 8, or no digit, or no letter, is weak_password, and no identity user is made", async () => {
  for (const password of ["abc12", "abcdefghij", "1234567890", "סיסמהעברית123"]) { // Hebrew letters are not letters to the service
    const email = freshEmail("weak");
    const r = await signUpRaw(email, password);
    assert.equal(r.body.error_code, "weak_password", password);
    assert.equal(psql(`select count(*) from auth.users where email='${email}'`), "0");
  }
});

test("password policy: 8 characters with letters and digits signs up", async () => {
  const r = await signUpRaw(freshEmail("strong"), "abcd1234");
  assert.equal(typeof r.body.access_token, "string");
});

// ---- Task 14: the password reset through the identity service (design review, finding 24; map v13, I01) ----

const recover = (email) => fetch(`${API}/auth/v1/recover?redirect_to=${encodeURIComponent("http://localhost:5174/fitness-app/")}`,
  { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });

test("reset: the email arrives, its link returns to the site signed in for recovery, and the new password signs in", async () => {
  const email = freshEmail("reset"), old = freshPassword();
  assert.equal(typeof (await signUpRaw(email, old)).body.access_token, "string");
  assert.equal((await recover(email)).status, 200);
  const html = await lastMailTo(email);
  assert.ok(html, "the reset email reached the local mailbox");
  const link = html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const back = new URL((await fetch(link, { redirect: "manual" })).headers.get("location"));
  assert.equal(`${back.origin}${back.pathname}`, "http://localhost:5174/fitness-app/");
  const session = new URLSearchParams(back.hash.slice(1));
  assert.equal(session.get("type"), "recovery"); // S23 opens on "a new password" (isRecoveryReturn)
  const put = await fetch(`${API}/auth/v1/user`, { method: "PUT", headers: { apikey: ANON, Authorization: `Bearer ${session.get("access_token")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "newpass123" }) });
  assert.equal(put.status, 200);
  assert.equal(typeof (await signIn(email, "newpass123")), "string");
  assert.equal(await signIn(email, old), undefined);
});

test("reset: an address with no user gets the same answer, and no email", async () => {
  const email = freshEmail("nobody");
  assert.equal((await recover(email)).status, 200);
  assert.equal(await lastMailTo(email, 4), null);
});
