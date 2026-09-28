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

// Stage 4b plan, decision 9: a fresh coach with fresh trainees, all marked "(test)", LOCAL only, so the tests of streaks,
// weeks and challenges depend neither on the demo data nor on the day they run. Each has the demo coach's SETTINGS and an
// active program of one workout: squat 3x5 at 60, and pushups 2x10 (bodyweight). Call demoTokens() first.
export async function freshWorld(traineeCount = 1) {
  const run = randomBytes(4).toString("hex");
  const password = `local-only-${randomBytes(12).toString("hex")}`;
  const person = async (email) => { await ensureUser(email, password); return psql(`select id from auth.users where email = '${email}'`); };

  const coachEmail = `coach.${run}@fitness-app.test`;
  const coachAuth = await person(coachEmail);
  const coachID = psql(`insert into coaches ("authUserID","fullName","email") values ('${coachAuth}','מאמן ${run} (test)','${coachEmail}')
                        returning "CoachID"`).split("\n")[0];
  psql(`insert into settings ("CoachID","settingKey","settingValue")
        select '${coachID}', "settingKey", "settingValue" from settings where "CoachID" = '${ID.coach}'`);

  const trainees = [];
  for (let i = 1; i <= traineeCount; i++) {
    const email = `trainee${i}.${run}@fitness-app.test`;
    const auth = await person(email);
    const traineeID = psql(`insert into trainees ("CoachID","authUserID","fullName","email") values ('${coachID}','${auth}','מתאמן ${i} ${run} (test)','${email}')
                            returning "TraineeID"`).split("\n")[0];
    const programID = psql(`insert into programs ("TraineeID","programName") values ('${traineeID}','תוכנית (test)') returning "ProgramID"`).split("\n")[0];
    const workoutID = psql(`insert into workouts ("ProgramID","workoutName","sortOrder") values ('${programID}','אימון (test)',0) returning "WorkoutID"`).split("\n")[0];
    psql(`insert into workout_items ("WorkoutID","ExerciseID","sortOrder","targetSets","targetReps","targetWeight") values
          ('${workoutID}','${ID.squat}',0,3,5,60), ('${workoutID}','${ID.pushup}',1,2,10,0)`);
    trainees.push({ traineeID, programID, workoutID, email, token: await signIn(email, password) });
  }
  return { coachID, coachToken: await signIn(coachEmail, password), trainees };
}

// A workout saved n days before today, at noon in Israel (stage 4b plan, decision 8), straight into the database, so a
// test can build a history across days. sets: [[exerciseID, reps, weight, isDone?], ...]. Returns the WorkoutLogID.
export function workoutDaysAgo(traineeID, workoutID, n, sets) {
  const at = `(((now() at time zone 'Asia/Jerusalem')::date - ${n}) + time '12:00') at time zone 'Asia/Jerusalem'`;
  const logID = psql(`insert into workout_logs ("TraineeID","WorkoutID","performedAt") values ('${traineeID}','${workoutID}',${at})
                      returning "WorkoutLogID"`).split("\n")[0];
  const rows = sets.map(([ex, reps, weight, isDone = true], i) => `('${logID}','${ex}',${i + 1},${reps},${weight},${isDone})`).join(",");
  psql(`insert into set_results ("WorkoutLogID","ExerciseID","setNumber","reps","weight","isDone") values ${rows}`);
  return logID;
}

// The two audit rows of the latest request for this caller and action: [request, reply].
export const lastAudit = (caller, action) =>
  psql(`select "isOk" || ':' || coalesce("errorCode",'-') from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");

// Stage 4c plan, decision 11: a class "(test)" of a coach, starting the given hours from now (negative: already started),
// straight into the database, LOCAL only. regs: [[traineeID, status], ...] in waitlist order. Returns the ClassID.
export function classInHours(coachID, hours, capacity = 8, regs = []) {
  const classID = psql(`insert into classes ("CoachID","startsAt","place","capacity")
                        values ('${coachID}', now() + interval '${hours} hours', 'סטודיו (test)', ${capacity}) returning "ClassID"`).split("\n")[0];
  regs.forEach(([traineeID, status], i) => psql(`insert into class_registrations ("ClassID","TraineeID","status","waitlistPosition","offerExpiresAt")
    values ('${classID}','${traineeID}','${status}',${status === "waitlist" ? i + 1 : "null"},${status === "offered" ? "now() + interval '2 hours'" : "null"})`));
  return classID;
}

// The status of a trainee in a class, straight from the database.
export const regStatus = (classID, traineeID) =>
  psql(`select "status" from class_registrations where "ClassID"='${classID}' and "TraineeID"='${traineeID}'`);
