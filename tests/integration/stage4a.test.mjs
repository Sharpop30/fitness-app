// Stage 4a Integration (doc-module-map section 6; stage 4a plan, task 6): the trainees, exercises and results actions
// through the envelope, the Registry and the Audit Log, against the LOCAL stack with the demo data.
// It writes: two invites, one exercise (set inactive at the end, so the demo list stays at eight), and one workout for Noa.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, demoTokens, ID, lastAudit, psql, strangerCoachToken } from "../system/demo-users.mjs";

let t;
let stranger;
const created = [];
before(async () => { t = await demoTokens(); stranger = await strangerCoachToken(); });
after(() => {
  // No physical delete (CLAUDE.md rule 9): the test exercise leaves use as inactive.
  for (const id of created) psql(`update exercises set "isActive" = false where "ExerciseID" = '${id}'`);
});

// Every audit row of the latest request for this caller and action, in order: "caller>module.action:isOk:code".
const trail = (caller, action) =>
  psql(`select caller || '>' || "moduleName" || '.' || "actionName" || ':' || "isOk" || ':' || coalesce("errorCode",'-') from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");

test("S02: list_trainees gives joined trainees and the open invite, with hasProgram, and two audit rows", async () => {
  const r = await call(t.coach, "S02", "trainees", "list_trainees");
  assert.equal(r.ok, true);
  // hasProgram as the database has it (uc01 gives Maya a program, so this does not assume the demo state).
  for (const x of r.data.filter((y) => y.joined)) {
    const active = psql(`select count(*) from programs where "TraineeID"='${x.TraineeID}' and "isActive"`) === "1";
    assert.equal(x.hasProgram, active, x.fullName);
  }
  assert.equal(r.data.find((x) => x.TraineeID === ID.noa).hasProgram, true);
  const byName = Object.fromEntries(r.data.map((x) => [x.fullName, x]));
  assert.deepEqual(byName["רון (דוגמה)"], { TraineeID: null, InviteID: "d0000000-0000-4000-8000-00000000b001", fullName: "רון (דוגמה)", isActive: true, joined: false, hasProgram: false });
  assert.deepEqual(lastAudit("S02", "list_trainees"), ["true:-", "true:-"]);
});

test("S02: invite_trainee by link saves an open invite for the SETTINGS days, and it shows in the list", async () => {
  const name = `בדיקה ${Date.now()}`;
  const r = await call(t.coach, "S02", "trainees", "invite_trainee", { name, email: "", channel: "link" });
  assert.equal(r.ok, true);
  const token = r.data.link.replace("#join-", "");
  assert.equal(psql(`select status || ':' || round(extract(epoch from "expiresAt" - "createdAt") / 86400) from invites where token='${token}'`), "open:7");
  assert.deepEqual(trail("S02", "invite_trainee"), [
    "S02>trainees.invite_trainee:true:-", "M01>settings.get_settings:true:-", "M01>settings.get_settings:true:-",
    "S02>trainees.invite_trainee:true:-",
  ]);
  const list = await call(t.coach, "S02", "trainees", "list_trainees");
  assert.equal(list.data.find((x) => x.fullName === name).joined, false);
});

test("S02: by email the channel is not built yet, so INVITE_DELIVERY_FAILED, and the invite stays open", async () => {
  const name = `במייל ${Date.now()}`;
  const r = await call(t.coach, "S02", "trainees", "invite_trainee", { name, email: "dana@example.com", channel: "email" });
  assert.equal(r.error.code, "INVITE_DELIVERY_FAILED");
  assert.equal(psql(`select status from invites where "inviteeName"='${name}'`), "open");
  assert.deepEqual(trail("S02", "invite_trainee"), [
    "S02>trainees.invite_trainee:true:-",
    "M01>settings.get_settings:true:-", "M01>settings.get_settings:true:-",
    "M01>invite_channel.send_invite:true:-", "M01>invite_channel.send_invite:false:ACTION_NOT_ALLOWED",
    "S02>trainees.invite_trainee:false:INVITE_DELIVERY_FAILED",
  ]);
});

test("S05: create_exercise, attach_video and get_exercise pass the envelope; the trainee sees the video from S14", async () => {
  const made = await call(t.coach, "S05", "exercises", "create_exercise", { name: "תרגיל בדיקה (test)", isBodyweight: false });
  assert.equal(made.ok, true);
  created.push(made.data.ExerciseID);
  assert.deepEqual(lastAudit("S05", "create_exercise"), ["true:-", "true:-"]);

  const video = await call(t.coach, "S05", "exercises", "attach_video", { exerciseID: made.data.ExerciseID, kind: "link", url: "https://youtu.be/test" });
  assert.deepEqual([video.data.videoType, video.data.videoUrl], ["youtube", "https://youtu.be/test"]);
  assert.deepEqual(lastAudit("S05", "attach_video"), ["true:-", "true:-"]);

  const got = await call(t.coach, "S05", "exercises", "get_exercise", { exerciseID: made.data.ExerciseID });
  assert.equal(got.data.videoUrl, "https://youtu.be/test");
  assert.deepEqual(lastAudit("S05", "get_exercise"), ["true:-", "true:-"]);
  assert.equal((await call(t.noa, "S14", "exercises", "get_exercise", { exerciseID: made.data.ExerciseID })).ok, true);
});

test("S05: a link that is not YouTube is VIDEO_INVALID, and a long upload is VIDEO_TOO_LONG, against the SETTINGS value", async () => {
  const bad = await call(t.coach, "S05", "exercises", "attach_video", { exerciseID: ID.squat, kind: "link", url: "https://vimeo.com/1" });
  assert.equal(bad.error.code, "VIDEO_INVALID");
  const long = await call(t.coach, "S05", "exercises", "attach_video", { exerciseID: ID.squat, kind: "upload", seconds: 120 });
  assert.equal(long.error.code, "VIDEO_TOO_LONG");
  assert.deepEqual(trail("S05", "attach_video"), [
    "S05>exercises.attach_video:true:-", "M02>settings.get_settings:true:-", "M02>settings.get_settings:true:-",
    "S05>exercises.attach_video:false:VIDEO_TOO_LONG",
  ]);
});

test("S14: log_workout saves atomically and leaves M04 rows toward programs, feedback, coins and challenges, one requestID", async () => {
  const program = await call(t.noa, "S14", "programs", "get_active_program");
  const workout = program.data.workouts.find((w) => w.WorkoutID === ID.noaWorkoutA);
  const sets = workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, s) =>
    ({ ExerciseID: i.ExerciseID, setNumber: s + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true, isCorrected: false })));
  const r = await call(t.noa, "S14", "results", "log_workout", { workoutID: workout.WorkoutID, sets });
  assert.equal(r.ok, true);
  assert.deepEqual([r.data.feedback.done, r.data.feedback.total], [sets.length, sets.length]);
  assert.equal(psql(`select count(*) from set_results where "WorkoutLogID"='${r.data.WorkoutLogID}'`), String(sets.length));
  assert.deepEqual(trail("S14", "log_workout"), [
    "S14>results.log_workout:true:-",
    "M04>programs.get_active_program:true:-", "M04>programs.get_active_program:true:-",
    // Not built until stage 4b: the save stands (stage 4a plan, decision 6).
    "M04>feedback.build_feedback:true:-", "M04>feedback.build_feedback:false:ACTION_NOT_ALLOWED",
    "M04>coins.award:true:-", "M04>coins.award:false:ACTION_NOT_ALLOWED",
    "M04>challenges.check_progress:true:-", "M04>challenges.check_progress:false:ACTION_NOT_ALLOWED",
    "S14>results.log_workout:true:-",
  ]);

  // S16: the trainee sees it first, and corrects one set; S06: the coach sees the correction marked.
  const mine = await call(t.noa, "S16", "results", "list_results");
  assert.equal(mine.data[0].WorkoutLogID, r.data.WorkoutLogID);
  const fixed = structuredClone(mine.data[0].sets);
  fixed[0].weight += 2.5;
  assert.deepEqual(await call(t.noa, "S16", "results", "correct_result", { workoutLogID: r.data.WorkoutLogID, sets: fixed }), { ok: true, data: null, error: null });
  assert.deepEqual(lastAudit("S16", "correct_result"), ["true:-", "true:-"]);
  const seen = await call(t.coach, "S06", "results", "list_results", { traineeID: ID.noa });
  const log = seen.data.find((l) => l.WorkoutLogID === r.data.WorkoutLogID);
  assert.deepEqual(log.sets.map((s) => s.isCorrected), log.sets.map((_, i) => i === 0));
  assert.deepEqual(lastAudit("S06", "list_results"), ["true:-", "true:-"]);
});

test("no Registry row: S16 asking log_workout, a trainee on S05, and a coach on S14 get ACTION_NOT_ALLOWED", async () => {
  const s16 = await call(t.noa, "S16", "results", "log_workout", { workoutID: ID.noaWorkoutA, sets: [] });
  assert.equal(s16.error.code, "ACTION_NOT_ALLOWED");
  assert.deepEqual(lastAudit("S16", "log_workout"), ["true:-", "false:ACTION_NOT_ALLOWED"]);
  const s05 = await call(t.noa, "S05", "exercises", "create_exercise", { name: "x" });
  assert.equal(s05.error.code, "ACTION_NOT_ALLOWED");
  const s14 = await call(t.coach, "S14", "results", "log_workout", { workoutID: ID.noaWorkoutA, sets: [] });
  assert.equal(s14.error.code, "ACTION_NOT_ALLOWED");
});

test("rule 5: another coach reading Noa's results, and Itai reading Noa's, get NOT_ALLOWED", async () => {
  assert.equal((await call(stranger, "S06", "results", "list_results", { traineeID: ID.noa })).error.code, "NOT_ALLOWED");
  assert.equal((await call(t.itai, "S16", "results", "list_results", { traineeID: ID.noa })).error.code, "NOT_ALLOWED");
});

test("the results functions are closed to the browser: the public key gets 401, and nothing is written", async () => {
  const before = psql(`select count(*) from workout_logs`);
  const rpc = (name, body) => fetch(`${API}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal((await rpc("results_log_workout", { p_trainee: ID.noa, p_workout: ID.noaWorkoutA, p_sets: [] })).status, 401);
  assert.equal((await rpc("results_correct", { p_log: ID.noa, p_sets: [] })).status, 401);
  assert.equal(psql(`select count(*) from workout_logs`), before);
});
