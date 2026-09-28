// System Test, usecase-10 end to end (doc-module-map section 6; stage 4a plan, task 7): norm, edge, failure, against
// the LOCAL stack. The coach works on S05 and S04; the trainees read on S14; one Endpoint.
// Every demo exercise in a program already has a video, so the test makes its own "(test)" exercise and adds it to
// Noa's and Itai's active programs. The app cannot take an item out of a program, so that item stays in the local
// database; the exercise itself leaves use as inactive at the end (CLAUDE.md rule 9).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { call, demoTokens, ID, psql } from "./demo-users.mjs";

let t, exercise;
before(async () => {
  t = await demoTokens();
  const made = await call(t.coach, "S05", "exercises", "create_exercise", { name: `תרגיל סרטון (test ${Date.now()})`, isBodyweight: false });
  exercise = made.data;
  // A program saves only exercises that are still active, so an item left by an earlier run is not sent (it stays,
  // since a save never takes an item out). Stage 4a report: an inactive exercise blocks saving its program.
  const active = new Set((await call(t.coach, "S04", "exercises", "list_exercises")).data.map((e) => e.ExerciseID));
  // Into the first workout of each program, as the coach does on S04.
  for (const trainee of [ID.noa, ID.itai]) {
    const program = (await call(t.coach, "S04", "programs", "get_active_program", { traineeID: trainee })).data;
    const workouts = program.workouts.map((w, i) => ({
      WorkoutID: w.WorkoutID, workoutName: w.workoutName,
      items: [...w.items.filter((it) => active.has(it.ExerciseID)),
        ...(i === 0 ? [{ WorkoutItemID: "new-video-test", ExerciseID: exercise.ExerciseID, targetSets: 1, targetReps: 10, targetWeight: 20 }] : [])],
    })).filter((w) => w.items.length > 0);
    const saved = await call(t.coach, "S04", "programs", "save_program", { traineeID: trainee, workouts });
    if (!saved.ok) throw new Error(`could not add the test exercise: ${saved.error.code}`);
  }
});
after(() => { if (exercise) psql(`update exercises set "isActive"=false where "ExerciseID"='${exercise.ExerciseID}'`); });

const attach = (payload) => call(t.coach, "S05", "exercises", "attach_video", { exerciseID: exercise.ExerciseID, ...payload });
// What each trainee sees for the test exercise on S14.
const hasVideo = async (token) => (await call(token, "S14", "programs", "get_active_program")).data.workouts
  .flatMap((w) => w.items).find((i) => i.ExerciseID === exercise.ExerciseID).hasVideo;
const stored = () => psql(`select coalesce("videoType",'-') || ':' || coalesce("videoUrl",'-') from exercises where "ExerciseID"='${exercise.ExerciseID}'`);

// ---- norm ----
test("norm: a link on an exercise that is in two programs shows in both, and the trainee opens it from the workout", async () => {
  assert.deepEqual([await hasVideo(t.noa), await hasVideo(t.itai)], [false, false]);
  const r = await attach({ kind: "link", url: "https://www.youtube.com/watch?v=test1" });
  assert.equal(r.ok, true);
  assert.deepEqual([await hasVideo(t.noa), await hasVideo(t.itai)], [true, true]);
  const seen = await call(t.itai, "S14", "exercises", "get_exercise", { exerciseID: exercise.ExerciseID });
  assert.deepEqual([seen.data.videoType, seen.data.videoUrl], ["youtube", "https://www.youtube.com/watch?v=test1"]);
});

// ---- edge ----
test("edge e: a new video replaces the old one, in every program", async () => {
  assert.equal((await attach({ kind: "link", url: "https://youtu.be/test2" })).ok, true);
  assert.equal(stored(), "youtube:https://youtu.be/test2");
  const seen = await call(t.noa, "S14", "exercises", "get_exercise", { exerciseID: exercise.ExerciseID });
  assert.equal(seen.data.videoUrl, "https://youtu.be/test2");
  assert.deepEqual([await hasVideo(t.noa), await hasVideo(t.itai)], [true, true]);
});

// ---- failure ----
test("failure a: a video longer than videoMaxSeconds is blocked (VIDEO_TOO_LONG), and the exercise is unchanged", async () => {
  const before = stored();
  assert.equal((await attach({ kind: "upload", seconds: 120 })).error.code, "VIDEO_TOO_LONG");
  assert.equal(stored(), before);
});

test("failure b: something that is not a video, or not a YouTube link, is blocked (VIDEO_INVALID), and nothing changes", async () => {
  const before = stored();
  assert.equal((await attach({ kind: "upload" })).error.code, "VIDEO_INVALID");
  assert.equal((await attach({ kind: "link", url: "https://example.com/clip.mp4" })).error.code, "VIDEO_INVALID");
  // Decision 7: a valid length does not upload until stage 5.
  assert.equal((await attach({ kind: "upload", seconds: 45 })).error.code, "UPLOAD_FAILED");
  assert.equal(stored(), before);
});
