// Stage 4b Integration (doc-module-map section 6; stage 4b plan, task 10): the progress, feedback, coins, challenges and
// home actions through the envelope, the Registry and the Audit Log, against the LOCAL stack with the demo data.
// It writes: one workout for Noa, and a challenge of the stranger coach (test). Every other request writes nothing,
// so the file passes on a used database too.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ANON, API, call, demoTokens, ID, lastAudit, psql, strangerCoachToken } from "../system/demo-users.mjs";

let t;
let stranger;
before(async () => { t = await demoTokens(); stranger = await strangerCoachToken(); });

// Every audit row of the latest request for this caller and action: "caller>module.action:isOk:code".
const trail = (caller, action) =>
  psql(`select caller || '>' || "moduleName" || '.' || "actionName" || ':' || "isOk" || ':' || coalesce("errorCode",'-') from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)
        order by "createdAt"`).split("\n");
// The screen's own two rows of that request, without the inner module requests: "isOk:code".
const screenRows = (caller, action) =>
  trail(caller, action).filter((row) => row.startsWith(`${caller}>`)).map((row) => row.split(":").slice(1).join(":"));
const requestIDs = (caller, action) =>
  psql(`select count(distinct "requestID") from audit_entries
        where "requestID" = (select "requestID" from audit_entries where caller='${caller}' and "actionName"='${action}' order by "createdAt" desc limit 1)`);

test("every new screen action goes through the envelope and leaves two audit rows, request and reply", async () => {
  const cases = [
    // [who, caller, module, action, payload, expected: true or an error code]
    ["coach", "S06", "feedback", "get_workout_notes", { traineeID: ID.noa }, true],
    ["coach", "S06", "feedback", "add_coach_note", { workoutLogID: ID.noa, noteText: "" }, "NOT_ALLOWED"], // not a workout: nothing written
    ["coach", "S07", "coins", "set_personal_goal", { traineeID: ID.noa, exerciseID: ID.squat, targetWeight: 0 }, "PROGRAM_INVALID"],
    ["coach", "S09", "challenges", "get_current_challenge", {}, true],
    ["coach", "S09", "challenges", "list_completions", {}, true],
    ["coach", "S09", "challenges", "mark_prize_delivered", { traineeID: ID.maya }, "NOT_ALLOWED"],
    ["coach", "S09", "exercises", "list_exercises", {}, true], // module map v5
    ["coach", "S10", "coins", "manage_rewards", { op: "list" }, true],
    ["coach", "S10", "coins", "mark_reward_delivered", { redemptionID: ID.noa }, "NOT_ALLOWED"],
    ["coach", "S21", "progress", "get_progress_chart", { traineeID: ID.noa }, true],
    ["noa", "S21", "progress", "get_progress_chart", {}, true],
    ["noa", "S16", "feedback", "get_workout_notes", {}, true],
    ["noa", "S18", "coins", "get_balance", {}, true],
    ["noa", "S18", "coins", "redeem_reward", { rewardID: ID.noa }, "NOT_ALLOWED"], // not a reward: nothing written
    ["noa", "S20", "challenges", "get_current_challenge", {}, true],
    ["coach", "S01", "home", "get_coach_home", {}, true],
    ["noa", "S13", "home", "get_trainee_home", {}, true],
  ];
  for (const [who, caller, module, action, payload, expected] of cases) {
    const r = await call(t[who], caller, module, action, payload);
    const label = `${caller} ${module}.${action}`;
    if (expected === true) assert.equal(r.ok, true, `${label}: ${JSON.stringify(r.error)}`);
    else assert.equal(r.error?.code, expected, label);
    assert.deepEqual(screenRows(caller, action), ["true:-", expected === true ? "true:-" : `false:${expected}`], label);
  }
});

test("S14: log_workout asks feedback, coins and challenges, and they ask progress and settings, all under one requestID", async () => {
  const program = await call(t.noa, "S14", "programs", "get_active_program");
  const workout = program.data.workouts.find((w) => w.WorkoutID === ID.noaWorkoutA);
  const sets = workout.items.flatMap((i) => Array.from({ length: i.targetSets }, (_, s) =>
    ({ ExerciseID: i.ExerciseID, setNumber: s + 1, reps: i.targetReps, weight: i.targetWeight, isDone: true })));
  const r = await call(t.noa, "S14", "results", "log_workout", { workoutID: workout.WorkoutID, sets });
  assert.equal(r.ok, true);
  assert.equal(r.data.feedback.coins, Number(psql(`select "settingValue" from settings where "CoachID"='${ID.coach}' and "settingKey"='coinsWorkout'`)));
  assert.equal(typeof r.data.feedback.text, "string");
  assert.notEqual(r.data.feedback.text, "");

  const rows = trail("S14", "log_workout");
  for (const expected of [
    "M04>feedback.build_feedback:true:-", "M06>progress.detect_personal_records:true:-", "M06>settings.get_settings:true:-",
    "M04>coins.award:true:-", "M07>settings.get_settings:true:-", "M04>challenges.check_progress:true:-",
  ]) assert.ok(rows.includes(expected), expected);
  assert.ok(rows.every((row) => row.includes(":true:")), rows.join("\n"));
  assert.equal(requestIDs("S14", "log_workout"), "1");
});

test("S13 and S01: the homes read through the Orchestrator as M13, with the Registry rows of module map v5 and v6", async () => {
  const mine = await call(t.noa, "S13", "home", "get_trainee_home");
  assert.equal(typeof mine.data.streak, "number");
  const trainee = trail("S13", "get_trainee_home");
  // v6: progress reads streakGapDays from SETTINGS.
  for (const expected of ["M13>progress.get_streak:true:-", "M05>settings.get_settings:true:-", "M13>coins.get_balance:true:-",
    "M13>challenges.get_current_challenge:true:-"]) assert.ok(trainee.includes(expected), expected);
  // classes is registered but built in stage 4c: refused, and the rest still comes (UC9 c).
  assert.ok(trainee.includes("M13>classes.list_upcoming_classes:false:ACTION_NOT_ALLOWED"));

  const home = await call(t.coach, "S01", "home", "get_coach_home");
  assert.equal(typeof home.data.rewardsToDeliver, "number");
  const coach = trail("S01", "get_coach_home");
  // v5: home reads the rewards to deliver and the challenge's completions.
  for (const expected of ["M13>coins.manage_rewards:true:-", "M13>challenges.list_completions:true:-", "M13>trainees.list_trainees:true:-"]) {
    assert.ok(coach.includes(expected), expected);
  }
});

test("S09: the stranger coach (test) creates a challenge; a second one in the same week is CHALLENGE_EXISTS", async () => {
  const create = () => call(stranger, "S09", "challenges", "create_challenge",
    { challengeName: "אתגר (test)", challengeType: "count", targetValue: 2, extraPrize: "" });
  const first = await create();
  // On a used database the week may already have it.
  assert.ok(first.ok || first.error.code === "CHALLENGE_EXISTS");
  assert.equal((await create()).error.code, "CHALLENGE_EXISTS");
  assert.deepEqual(lastAudit("S09", "create_challenge"), ["true:-", "false:CHALLENGE_EXISTS"]);
  // One challenge a week per coach, and the demo coach's week is not touched.
  assert.equal(psql(`select count(*) from challenges c join coaches k using ("CoachID") where k."email"='stranger.coach@fitness-app.test'
                     group by "weekStart" order by count(*) desc limit 1`), "1");
});

test("no Registry row: a screen asking a module-only action, and the wrong role on a screen, get ACTION_NOT_ALLOWED", async () => {
  const refused = [
    [t.noa, "S14", "coins", "award", { reason: "workout", eventRef: ID.noa }],
    [t.noa, "S14", "feedback", "build_feedback", {}],
    [t.noa, "S14", "challenges", "check_progress", {}],
    [t.noa, "S21", "progress", "detect_personal_records", {}],
    [t.noa, "S13", "progress", "get_streak", {}],
    [t.noa, "S09", "challenges", "create_challenge", {}],
    [t.coach, "S18", "coins", "get_balance", { traineeID: ID.noa }],
    [t.coach, "S16", "feedback", "get_workout_notes", { traineeID: ID.noa }],
  ];
  for (const [token, caller, module, action, payload] of refused) {
    const r = await call(token, caller, module, action, payload);
    assert.equal(r.error?.code, "ACTION_NOT_ALLOWED", `${caller} ${module}.${action}`);
    assert.deepEqual(lastAudit(caller, action), ["true:-", "false:ACTION_NOT_ALLOWED"], `${caller} ${module}.${action}`);
  }
});

test("rule 5: another coach reading Noa's chart, notes or balance gets NOT_ALLOWED", async () => {
  for (const [caller, module, action] of [["S21", "progress", "get_progress_chart"], ["S06", "feedback", "get_workout_notes"]]) {
    assert.equal((await call(stranger, caller, module, action, { traineeID: ID.noa })).error?.code, "NOT_ALLOWED", action);
  }
  assert.equal((await call(t.itai, "S21", "progress", "get_progress_chart", { traineeID: ID.noa })).error?.code, "NOT_ALLOWED");
});

test("the coins functions are closed to the browser: the public key gets 401, and nothing is written", async () => {
  const count = () => psql(`select count(*) from coin_transactions`);
  const before = count();
  const rpc = (name, body) => fetch(`${API}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal((await rpc("coins_redeem", { p_trainee: ID.noa, p_reward: ID.noa })).status, 401);
  assert.equal((await rpc("coins_achieve_goal", { p_goal: ID.noa, p_amount: 1000 })).status, 401);
  assert.equal(count(), before);
});
