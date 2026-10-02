// Integration, stage 7b (stage 7 plan, task 10) against the LOCAL stack: CORS (security review 1, finding 6).
// The rule itself is unit-tested in supabase/functions/api/tests/cors.test.ts. Locally the Kong gateway of the stack adds
// "Access-Control-Allow-Origin: *" to every function reply, over the function's own headers, so here only what the
// gateway leaves visible is checked: the function never echoes another site's origin, and it varies by Origin.
// The cloud has no such gateway header; it is checked there after deploying (stage 7b report).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENDPOINT } from "../system/demo-users.mjs";

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
