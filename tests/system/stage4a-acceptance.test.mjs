// Stage 4a acceptance (CLAUDE.md sections 6 and 9; stage 4a plan, task 9), against the LOCAL stack.
// With the full regression (Unit, Integration, System) green on a clean database, this file adds:
// the structural tests this stage touches (9.1, 9.6, 9.7), values read from SETTINGS at run time (9.4, rule 8),
// and the browser scenario of the plan through the one Endpoint. Direct updates to SETTINGS are test-only and restored.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { call, demoTokens, ID, psql } from "./demo-users.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const API = join(ROOT, "supabase", "functions", "api");
const read = (...p) => readFileSync(join(...p), "utf8");
const filesUnder = (dir) => readdirSync(dir, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => join(dir, f));

let t;
before(async () => { t = await demoTokens(); });

const setting = (key, value) => psql(`update settings set "settingValue" = '${value}' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${ID.coach}\') and "settingKey" = '${key}'`);

// ---- structural (CLAUDE.md section 9) ----
test("9.1: a database client is created in repository.ts only, in the server and in the app", () => {
  const files = [...filesUnder(join(ROOT, "supabase", "functions")), ...filesUnder(join(ROOT, "app", "src"))];
  const creating = files.filter((f) => /createClient\s*\(/.test(read(f))).map((f) => f.slice(ROOT.length + 1));
  assert.deepEqual(creating, ["supabase/functions/api/repository.ts"]);
});

test("9.7: no module imports another module; each imports only the core", () => {
  for (const f of readdirSync(join(API, "modules"))) {
    const imports = [...read(API, "modules", f).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(imports.filter((i) => !["../errors.ts", "../orchestrator.ts", "../repository.ts"].includes(i)), [], f);
  }
});

test("9.6: the error codes in the code, in ERROR_CODES and in the map are the same, and every code a module returns is listed", () => {
  const code = [...read(API, "errors.ts").matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]).sort();
  const db = psql(`select string_agg("errorCode", ',') from error_codes`).split(",").sort();
  const map = read(ROOT, "project-docs", "doc-module-map.md");
  const table = map.slice(map.indexOf("### קודי השגיאה"), map.indexOf("## 5."));
  const inMap = [...table.matchAll(/^\| ([A-Z_]+) \|/gm)].map((m) => m[1]).sort();
  assert.deepEqual(code, db);
  assert.deepEqual(code, inMap);
  const used = new Set(filesUnder(API).flatMap((f) => [...read(f).matchAll(/fail\("([A-Z_]+)"\)/g)].map((m) => m[1])));
  for (const c of used) assert.ok(code.includes(c), `${c} is not in the closed list`);
});

// ---- SETTINGS at run time (CLAUDE.md rule 8, section 9.4) ----
test("9.4: the invite validity and the longest video follow SETTINGS, with no code change", async () => {
  try {
    setting("inviteValidDays", "3");
    const r = await call(t.coach, "S02", "trainees", "invite_trainee", { name: `שלושה ימים (test ${Date.now()})`, channel: "link" });
    const token = new URL(r.data.link).searchParams.get("join");
    assert.equal(psql(`select round(extract(epoch from "expiresAt" - "createdAt") / 86400) from invites where token='${token}'`), "3");

    // From stage 5 the check is in prepare_upload, which answers with an upload address within the limit.
    const upload = (seconds) => call(t.coach, "S05", "exercises", "prepare_upload", { exerciseID: ID.press, contentType: "video/mp4", seconds, megabytes: 10 });
    assert.equal((await upload(120)).error.code, "VIDEO_TOO_LONG");
    setting("videoMaxSeconds", "150");
    assert.equal((await upload(120)).ok, true); // within the new limit
  } finally {
    setting("inviteValidDays", "7");
    setting("videoMaxSeconds", "60");
  }
});

// ---- the browser scenario of the plan, through the Endpoint ----
test("the coach invites a trainee, who shows in the list as invited", async () => {
  const name = `רותם (test ${Date.now()})`;
  assert.equal((await call(t.coach, "S02", "trainees", "invite_trainee", { name, email: "", channel: "link" })).ok, true);
  const row = (await call(t.coach, "S02", "trainees", "list_trainees")).data.find((x) => x.fullName === name);
  assert.deepEqual([row.joined, row.hasProgram], [false, false]);
});

test("the coach adds an exercise, attaches a link, puts it in a program, and S04 marks it with a video", async () => {
  const made = await call(t.coach, "S05", "exercises", "create_exercise", { name: `פרפר (test ${Date.now()})`, isBodyweight: false });
  assert.equal((await call(t.coach, "S05", "exercises", "attach_video", { exerciseID: made.data.ExerciseID, kind: "link", url: "https://youtu.be/accept" })).ok, true);

  const program = (await call(t.coach, "S04", "programs", "get_active_program", { traineeID: ID.noa })).data;
  const active = new Set((await call(t.coach, "S04", "exercises", "list_exercises")).data.map((e) => e.ExerciseID));
  assert.ok(active.has(made.data.ExerciseID), "the new exercise is in the S04 list");
  const workouts = program.workouts.map((w, i) => ({
    WorkoutID: w.WorkoutID, workoutName: w.workoutName,
    items: [...w.items.filter((it) => active.has(it.ExerciseID)),
      ...(i === 0 ? [{ WorkoutItemID: "new-accept", ExerciseID: made.data.ExerciseID, targetSets: 3, targetReps: 12, targetWeight: 8 }] : [])],
  }));
  assert.equal((await call(t.coach, "S04", "programs", "save_program", { traineeID: ID.noa, workouts })).ok, true);

  const item = (await call(t.coach, "S04", "programs", "get_active_program", { traineeID: ID.noa })).data.workouts[0].items
    .find((i) => i.ExerciseID === made.data.ExerciseID);
  assert.deepEqual([item.exerciseName, item.hasVideo], [made.data.exerciseName, true]);
});
