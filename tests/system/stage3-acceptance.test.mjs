// Stage 3 acceptance (CLAUDE.md section 6): a change to the program in the database is seen by S04;
// a change to AUDIT_ENTRIES or SETTINGS does not change what S04 gets. LOCAL stack; direct updates are test-only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, ID, psql } from "./demo-users.mjs";

let t;
before(async () => { t = await demoTokens(); });
const s04 = () => call(t.coach, "S04", "programs", "get_active_program", { traineeID: ID.noa });
const squat = (r) => r.data.workouts[0].items.find((i) => i.WorkoutItemID === ID.noaSquatItem);

test("a change to the program in the database is seen on S04", async () => {
  const was = squat(await s04()).targetWeight;
  psql(`update workout_items set "targetWeight" = ${was + 7.5} where "WorkoutItemID" = '${ID.noaSquatItem}'`);
  assert.equal(squat(await s04()).targetWeight, was + 7.5);
  psql(`update workouts set "workoutName" = 'אימון A (עודכן במסד)' where "WorkoutID" = '${ID.noaWorkoutA}'`);
  assert.equal((await s04()).data.workouts[0].workoutName, "אימון A (עודכן במסד)");
  psql(`update workout_items set "targetWeight" = ${was} where "WorkoutItemID" = '${ID.noaSquatItem}'`);
  psql(`update workouts set "workoutName" = 'אימון A' where "WorkoutID" = '${ID.noaWorkoutA}'`);
});

test("a change to AUDIT_ENTRIES or SETTINGS does not change S04", async () => {
  const before = JSON.stringify((await s04()).data);
  psql(`insert into audit_entries ("requestID","caller","moduleName","actionName","isOk","errorCode")
        select gen_random_uuid(), 'S04', 'programs', 'get_active_program', false, 'NOT_ALLOWED' from generate_series(1, 20)`);
  psql(`update settings set "settingValue" = '99' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${ID.coach}\') and "settingKey" = 'coinsWorkout'`);
  psql(`insert into settings ("BusinessID","settingKey","settingValue") select "BusinessID",'acceptanceProbe','1' from coaches where "CoachID" = '${ID.coach}'`);
  assert.equal(JSON.stringify((await s04()).data), before);
  psql(`update settings set "settingValue" = '10' where "BusinessID" = (select "BusinessID" from coaches where "CoachID" = \'${ID.coach}\') and "settingKey" = 'coinsWorkout'`);
  psql(`delete from settings where "settingKey" = 'acceptanceProbe'`); // local test row only
});
