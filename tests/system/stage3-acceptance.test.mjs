// Stage 3 acceptance (CLAUDE.md section 6): a change to the program in the database is seen by S04;
// a change to AUDIT_ENTRIES or SETTINGS does not change what S04 gets. LOCAL stack; direct updates are test-only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, psql } from "./demo-users.mjs";

// A fresh world "(test)" (stage 7b, task 15), so the test runs on a database used before; the claims are stage 3's.
let w, t;
before(async () => { await demoTokens(); w = await freshWorld(1); [t] = w.trainees; });
const s04 = () => call(w.coachToken, "S04", "programs", "get_active_program", { traineeID: t.traineeID });
const squat = (r) => r.data.workouts[0].items.find((i) => i.ExerciseID === ID.squat);

test("a change to the program in the database is seen on S04", async () => {
  const item = squat(await s04());
  psql(`update workout_items set "targetWeight" = ${item.targetWeight + 7.5} where "WorkoutItemID" = '${item.WorkoutItemID}'`);
  assert.equal(squat(await s04()).targetWeight, item.targetWeight + 7.5);
  psql(`update workouts set "workoutName" = 'אימון (עודכן במסד, test)' where "WorkoutID" = '${t.workoutID}'`);
  assert.equal((await s04()).data.workouts[0].workoutName, "אימון (עודכן במסד, test)");
});

test("a change to AUDIT_ENTRIES or SETTINGS does not change S04", async () => {
  const before = JSON.stringify((await s04()).data);
  psql(`insert into audit_entries ("requestID","caller","moduleName","actionName","isOk","errorCode")
        select gen_random_uuid(), 'S04', 'programs', 'get_active_program', false, 'NOT_ALLOWED' from generate_series(1, 20)`);
  psql(`update settings set "settingValue" = '99' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey" = 'coinsWorkout'`);
  // A change only, and back: no row is added or deleted (rule 9; stage 4d report, gap 8, closed in stage 7b).
  const reminderKey = `"BusinessID" = (select "BusinessID" from coaches where "CoachID" = '${w.coachID}') and "settingKey" = 'reminderText'`;
  const reminder = psql(`select "settingValue" from settings where ${reminderKey}`);
  psql(`update settings set "settingValue" = 'בדיקה (test)' where ${reminderKey}`);
  assert.equal(JSON.stringify((await s04()).data), before);
  psql(`update settings set "settingValue" = '10' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${w.coachID}\') and "settingKey" = 'coinsWorkout'`);
  psql(`update settings set "settingValue" = $r$${reminder}$r$ where ${reminderKey}`);
});
