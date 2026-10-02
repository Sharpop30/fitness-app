// Integration, stage 7b against the LOCAL stack: CORS (task 10; security review 1, finding 6), and the password policy
// (task 12; finding 5).
// The rule itself is unit-tested in supabase/functions/api/tests/cors.test.ts. Locally the Kong gateway of the stack adds
// "Access-Control-Allow-Origin: *" to every function reply, over the function's own headers, so here only what the
// gateway leaves visible is checked: the function never echoes another site's origin, and it varies by Origin.
// The cloud has no such gateway header; it is checked there after deploying (stage 7b report).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, ENDPOINT, freshEmail, psql } from "../system/demo-users.mjs";

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
