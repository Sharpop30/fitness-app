// LOCAL stack only (supabase start + functions serve): makes sure the four demo identity users exist, loads the
// demo data (supabase/migrations/20260928000005_demo_data.sql), and signs each one in.
// The password is random per run and never written anywhere. In the cloud the team creates these users.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export const API = process.env.API_URL ?? "http://127.0.0.1:54321";
export const ENDPOINT = `${API}/functions/v1/api`;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) throw new Error("demo-users.mjs runs against the local stack only");

// Local-only demo keys printed by `supabase status`; never a cloud key.
const status = JSON.parse(execSync("supabase status -o json", { encoding: "utf8" }));
export const SERVICE = status.SERVICE_ROLE_KEY;
export const ANON = status.ANON_KEY;

export const psql = (sql) => {
  const c = execSync("docker ps --format '{{.Names}}' | grep supabase_db_fitness-app", { encoding: "utf8" }).trim();
  return execSync(`docker exec -i ${c} psql -U postgres -tA`, { input: sql, encoding: "utf8" }).trim();
};

const P = "d0000000-0000-4000-8000-00000000";
export const ID = {
  coach: `${P}0001`, noa: `${P}1001`, itai: `${P}1002`, maya: `${P}1003`,
  squat: `${P}2001`, bench: `${P}2002`, row: `${P}2003`, lunge: `${P}2004`, pushup: `${P}2005`, rdl: `${P}2006`, press: `${P}2007`, pullup: `${P}2008`,
  noaProgram: `${P}3002`, noaOldProgram: `${P}3001`, itaiProgram: `${P}3003`,
  noaWorkoutA: `${P}4001`, noaWorkoutB: `${P}4002`,
  noaBenchItem: `${P}5002`, noaSquatItem: `${P}5001`,
};
export const EMAIL = {
  coach: "coach.demo@fitness-app.test", noa: "noa.demo@fitness-app.test",
  itai: "itai.demo@fitness-app.test", maya: "maya.demo@fitness-app.test",
};

const admin = (path, method, body) =>
  fetch(`${API}/auth/v1/admin${path}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  }).then((r) => r.json());

async function ensureUser(email, password) {
  const id = psql(`select id from auth.users where email = '${email}'`);
  if (id) await admin(`/users/${id}`, "PUT", { password });
  else await admin("/users", "POST", { email, password, email_confirm: true });
}

export async function signIn(email, password) {
  const res = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await res.json()).access_token;
}

// Returns a token per demo person: { coach, noa, itai, maya }.
export async function demoTokens() {
  const password = `local-only-${randomBytes(12).toString("hex")}`;
  for (const email of Object.values(EMAIL)) await ensureUser(email, password);
  if (psql("select demo.load()") !== "t") throw new Error("demo.load() did not load the demo data");
  const tokens = {};
  for (const [who, email] of Object.entries(EMAIL)) tokens[who] = await signIn(email, password);
  return tokens;
}

export const call = async (token, caller, module, action, payload = {}) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ caller, module, action, payload, lang: "he" }),
  });
  return res.json();
};

// A second coach, outside the demo data, for the "not your trainee" cases (UC1 alternative d).
export async function strangerCoachToken() {
  const password = `local-only-${randomBytes(12).toString("hex")}`;
  const email = "stranger.coach@fitness-app.test";
  await ensureUser(email, password);
  const id = psql(`select id from auth.users where email = '${email}'`);
  psql(`insert into coaches ("authUserID","fullName","email") values ('${id}','מאמן זר (test)','${email}') on conflict ("authUserID") do nothing`);
  return signIn(email, password);
}

// The two audit rows of the latest request for this caller and action: [request, reply].
export const lastAudit = (caller, action) =>
  psql(`select "isOk" || ':' || coalesce("errorCode",'-') from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");
