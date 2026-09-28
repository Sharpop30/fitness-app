// System test, usecase-09 daily reminder and streak on the trainee's home (requirement 25), end to end through the one
// Endpoint against the LOCAL stack. Clusters (doc-module-map section 6): normal, edge (a, b), failure (c).
// S13 stays on the demo adapter until stage 4c; the action is tested here. Data: fresh "(test)" people (decision 9).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, freshWorld, ID, psql, workoutDaysAgo } from "./demo-users.mjs";

let w;
const home = (t) => call(t.token, "S13", "home", "get_trainee_home");
const set = [[ID.squat, 5, 60]];

before(async () => { await demoTokens(); w = await freshWorld(4); });

test("normal: the home has the reminder, the streak, the coins, the next workout and the challenge", async () => {
  const [t] = w.trainees;
  await call(w.coachToken, "S09", "challenges", "create_challenge", { challengeName: "אתגר (test)", challengeType: "count", targetValue: 5 });
  workoutDaysAgo(t.traineeID, t.workoutID, 0, set);
  const h = (await home(t)).data;
  assert.equal(h.reminder, psql(`select "settingValue" from settings where "CoachID"='${w.coachID}' and "settingKey"='reminderText'`));
  assert.deepEqual([h.streak, h.streakGapDays], [1, 3]);
  assert.equal(h.coins, 0); // saved straight into the database, not through log_workout
  assert.deepEqual(h.nextWorkout, { WorkoutID: t.workoutID, workoutName: "אימון (test)" });
  assert.equal(h.challenge.challengeName, "אתגר (test)");
  assert.equal(h.challenge.target, 5);
});

test("UC9 section 13: three workouts with a rest day between them show a streak of 3", async () => {
  const t = w.trainees[1];
  for (const n of [4, 2, 0]) workoutDaysAgo(t.traineeID, t.workoutID, n, set);
  assert.equal((await home(t)).data.streak, 3);
});

test("edge b: rest days up to streakGapDays keep the streak; more reset it (UC9 section 13, four days without a workout)", async () => {
  const t = w.trainees[2];
  workoutDaysAgo(t.traineeID, t.workoutID, 12, set);
  workoutDaysAgo(t.traineeID, t.workoutID, 8, set); // 3 rest days between: kept
  assert.equal((await home(t)).data.streak, 0); // 7 days since the last one: reset
  workoutDaysAgo(t.traineeID, t.workoutID, 4, set); // 3 rest days again, and 3 full days since
  assert.equal((await home(t)).data.streak, 3);
});

test("edge a: a new trainee with no workouts gets a home with a streak of 0 and the first workout next", async () => {
  const t = w.trainees[3];
  const h = (await home(t)).data;
  assert.deepEqual([h.streak, h.coins, h.nextWorkout.WorkoutID], [0, 0, t.workoutID]);
});

test("failure c: an item that cannot load is left out, and the rest of the home still comes", async () => {
  // classes is registered but built in stage 4c: its items come back empty, and nothing else is lost.
  const r = await home(w.trainees[0]);
  assert.equal(r.ok, true);
  assert.deepEqual([r.data.nextClass, r.data.offers], [null, []]);
  assert.equal(typeof r.data.streak, "number");
});
