// Stage 5 acceptance (CLAUDE.md sections 6 and 9; stage 5 plan, task 11), against the LOCAL stack.
// With the full regression (Unit, Integration, System) green on a clean database, this file adds: the structural tests
// the interfaces touch (9.1, 9.2, 9.7, 9.8); every request of the interfaces leaves audit rows with one requestID (9.3);
// the upload limits follow SETTINGS (9.4); and the scenario of the plan through the one Endpoint, each interface against
// its contract. 9.6 runs in stage4a-acceptance.test.mjs over every file under the api folder, the interfaces included.
// The gateway's failure runs in decline mode (uc02-payments.test.mjs). Writes go to a fresh coach "(test)" only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ANON, API as STACK, call, demoTokens, freshEmail, freshPassword, freshWorld, ID, lastMailTo, paymentRequest, psql, signIn, signUp, tokenOf } from "./demo-users.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const API = join(ROOT, "supabase", "functions", "api");
const read = (...p) => readFileSync(join(...p), "utf8");
const filesUnder = (dir) => readdirSync(dir, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => join(dir, f));

let t, w;
before(async () => { t = await demoTokens(); w = await freshWorld(1); });

// ---- structural (CLAUDE.md section 9) ----
test("9.1: a database or storage client is created in repository.ts only, the interfaces included", () => {
  const files = [...filesUnder(join(ROOT, "supabase", "functions")), ...filesUnder(join(ROOT, "app", "src"))];
  const creating = files.filter((f) => /createClient\s*\(|\.storage\.from\(/.test(read(f))).map((f) => f.slice(ROOT.length + 1));
  assert.deepEqual(creating, ["supabase/functions/api/repository.ts"]);
});

test("9.2: in the app, only client.ts talks to the server, and only auth.ts to the identity service", () => {
  const talking = filesUnder(join(ROOT, "app", "src")).filter((f) => !f.includes(".test.") && /\bfetch\s*\(/.test(read(f)))
    .map((f) => f.slice(ROOT.length + 1)).sort();
  assert.deepEqual(talking, ["app/src/api/client.ts", "app/src/identity/auth.ts"]);
  assert.ok(!/VITE_API_URL/.test(read(ROOT, "app", "src", "identity", "auth.ts")));
});

test("9.7: no module imports another module or an interface; the interfaces import only the core", () => {
  const core = ["../errors.ts", "../orchestrator.ts", "../repository.ts"];
  for (const dir of ["modules", "interfaces"]) {
    for (const f of readdirSync(join(API, dir))) {
      const imports = [...read(API, dir, f).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(imports.filter((i) => !core.includes(i)), [], `${dir}/${f}`);
    }
  }
});

test("9.8: no key in the repository: no token-shaped value, and no secret-key prefix, in any file Git holds", () => {
  const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n")
    .filter((f) => f && /\.(ts|tsx|mjs|js|sql|toml|json|md|html|yml|yaml|csv)$/.test(f));
  const found = files.filter((f) => /eyJ[\w-]{20,}\.eyJ[\w-]{20,}|sb_secret_\w+|sbp_\w{20,}/.test(read(ROOT, f)));
  assert.deepEqual(found, []);
});

// ---- 9.3: every request leaves audit rows with a shared requestID ----
test("9.3: each request through an interface leaves its audit rows under one requestID, inner requests included", async () => {
  const [a] = w.trainees;
  const link = (await call(w.coachToken, "S02", "trainees", "invite_trainee", { name: "9.3 (test)", channel: "link" })).data.link;
  const newcomer = await signUp(freshEmail("n93"), freshPassword());
  const asked = [
    [w.coachToken, "S02", "trainees", "invite_trainee", { name: "9.3 במייל (test)", email: freshEmail("m93"), channel: "email" }],
    [newcomer, "S22", "settings", "get_error_texts", {}],
    [newcomer, "S22", "trainees", "accept_invite", { token: tokenOf(link) }],
    [w.coachToken, "S23", "trainees", "get_me", {}],
    [t.coach, "S05", "exercises", "prepare_upload", { exerciseID: ID.press, contentType: "video/mp4", seconds: 20, megabytes: 3 }],
    [a.token, "S19", "payments", "pay_demo", { paymentRequestID: paymentRequest(w.coachID, a.traineeID) }],
  ];
  for (const [token, caller, module, action, payload] of asked) {
    const before = Number(psql(`select count(*) from audit_entries`));
    const r = await call(token, caller, module, action, payload);
    assert.equal(r.ok, true, `${caller} ${module}.${action}: ${JSON.stringify(r.error)}`);
    const ids = psql(`select count(distinct "requestID") from (select "requestID" from audit_entries order by "createdAt" desc limit ${Number(psql(`select count(*) from audit_entries`)) - before}) x`);
    assert.equal(ids, "1", `${caller} ${module}.${action}`);
  }
});

// ---- 9.4: SETTINGS at run time (CLAUDE.md rule 8) ----
test("9.4: the largest upload follows videoMaxMegabytes on S12, with no code change", async () => {
  const exercise = (await call(w.coachToken, "S05", "exercises", "create_exercise", { name: "9.4 (test)" })).data.ExerciseID;
  const prepare = () => call(w.coachToken, "S05", "exercises", "prepare_upload", { exerciseID: exercise, contentType: "video/mp4", seconds: 20, megabytes: 70 });
  assert.equal((await prepare()).error?.code, "VIDEO_TOO_LONG");
  assert.equal((await call(w.coachToken, "S12", "settings", "update_settings", { values: { videoMaxMegabytes: "80" } })).ok, true);
  assert.equal((await prepare()).ok, true);
  psql(`update exercises set "isActive"=false where "ExerciseID"='${exercise}'`); // out of use (rule 9)
});

// ---- the scenario of the plan (task 11), each interface against its contract ----
test("I03 and I01: the coach invites by email; the newcomer opens the email, sets a password, joins, and signs in again", async () => {
  const email = freshEmail("scenario"), password = freshPassword(), name = `תרחיש (test ${Date.now()})`;
  const inviteToken = tokenOf((await call(w.coachToken, "S02", "trainees", "invite_trainee", { name, email, channel: "email" })).data.link);
  const button = (await lastMailTo(email)).match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  const session = new URLSearchParams(new URL((await fetch(button, { redirect: "manual" })).headers.get("location")).hash.slice(1));
  const token = session.get("access_token");
  const set = await fetch(`${STACK}/auth/v1/user`, { // what S22 does through auth.ts
    method: "PUT", headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert.equal(set.ok, true);
  const joined = await call(token, "S22", "trainees", "accept_invite", { token: inviteToken });
  assert.equal(joined.ok, true, JSON.stringify(joined.error));
  assert.equal((await call(w.coachToken, "S02", "trainees", "list_trainees")).data.find((x) => x.fullName === name).joined, true);
  const again = await signIn(email, password);
  assert.deepEqual((await call(again, "S23", "trainees", "get_me")).data.role, "trainee");
});

test("I02: the trainee pays a request on S19; paid, with its demo invoice; no card field anywhere in the database", async () => {
  const [a] = w.trainees;
  const id = paymentRequest(w.coachID, a.traineeID, { paymentType: "pack10", amount: 600 });
  const r = await call(a.token, "S19", "payments", "pay_demo", { paymentRequestID: id });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.equal(psql(`select p."status" || ':' || i."invoiceNumber" || ':' || i."isDemo" from payment_requests p join invoices i using ("PaymentRequestID") where p."PaymentRequestID"='${id}'`),
    `paid:${r.data.invoiceNumber}:true`);
  assert.equal(psql(`select count(*) from information_schema.columns where table_schema='public' and column_name ~* 'card|cvv|pan'`), "0");
});

test("I04: the coach uploads a file for an exercise in a program; the trainee opens it from the workout", async () => {
  const [a] = w.trainees;
  const prepared = await call(t.coach, "S05", "exercises", "prepare_upload", { exerciseID: ID.squat, contentType: "video/mp4", seconds: 10, megabytes: 1 });
  assert.equal((await fetch(prepared.data.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: new Uint8Array(1024).fill(3) })).ok, true);
  const before = psql(`select "videoType" || '|' || "videoUrl" from exercises where "ExerciseID"='${ID.squat}'`).split("|");
  try {
    const attached = await call(t.coach, "S05", "exercises", "attach_video", { exerciseID: ID.squat, kind: "upload", path: prepared.data.path });
    assert.equal(attached.ok, true, JSON.stringify(attached.error));
    const seen = await call(a.token, "S14", "exercises", "get_exercise", { exerciseID: ID.squat }); // squat is in the fresh trainee's program
    assert.equal(seen.data.videoType, "upload");
    assert.equal((await fetch(seen.data.videoUrl)).status, 200);
  } finally {
    psql(`update exercises set "videoType"='${before[0]}', "videoUrl"='${before[1]}' where "ExerciseID"='${ID.squat}'`); // the demo link back
  }
});
