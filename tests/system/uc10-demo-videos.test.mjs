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

// ---- norm, the upload (stage 5, I04; module map v9: prepare_upload, the file to the address, then attach_video) ----
const prepare = (file) =>
  call(t.coach, "S05", "exercises", "prepare_upload", { exerciseID: exercise.ExerciseID, contentType: "video/mp4", seconds: 45, megabytes: 1, ...file });
// What client.ts does with the address: the file itself, straight to the store.
const sendFile = (uploadUrl, bytes = new Uint8Array(2048).fill(7), type = "video/mp4") =>
  fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: bytes });

test("norm, steps 3-6: an uploaded file replaces the link, and both trainees reach it from the workout", async () => {
  const r = await prepare({});
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.match(r.data.uploadUrl, /^http:\/\/127\.0\.0\.1:54321\/storage\/v1\//); // an address the browser reaches (CLAUDE.md v6)
  assert.equal((await sendFile(r.data.uploadUrl)).ok, true);
  const a = await attach({ kind: "upload", path: r.data.path });
  assert.equal(a.ok, true, JSON.stringify(a.error));
  assert.equal(a.data.videoType, "upload");
  const seen = await call(t.itai, "S14", "exercises", "get_exercise", { exerciseID: exercise.ExerciseID });
  assert.equal(seen.data.videoUrl, a.data.videoUrl);
  const view = await fetch(seen.data.videoUrl);
  assert.equal(view.status, 200);
  assert.equal((await view.arrayBuffer()).byteLength, 2048);
  assert.deepEqual([await hasVideo(t.noa), await hasVideo(t.itai)], [true, true]);
});

// ---- failure ----
test("failure a: a video longer than videoMaxSeconds, or larger than videoMaxMegabytes, is blocked (VIDEO_TOO_LONG), and nothing changes", async () => {
  const before = stored();
  assert.equal((await prepare({ seconds: 120 })).error.code, "VIDEO_TOO_LONG");
  assert.equal((await prepare({ megabytes: 80 })).error.code, "VIDEO_TOO_LONG");
  assert.equal(stored(), before);
});

test("failure b: something that is not a video, or not a YouTube link, is blocked (VIDEO_INVALID), and nothing changes", async () => {
  const before = stored();
  assert.equal((await prepare({ contentType: "image/png" })).error.code, "VIDEO_INVALID");
  assert.equal((await attach({ kind: "link", url: "https://example.com/clip.mp4" })).error.code, "VIDEO_INVALID");
  // The store itself refuses a file that is not a video, even at a valid address (the bucket takes video/* only).
  const r = await prepare({});
  assert.equal((await sendFile(r.data.uploadUrl, new Uint8Array(10), "image/png")).ok, false);
  assert.equal(stored(), before);
});

test("failure c: an upload that did not finish is UPLOAD_FAILED, and the exercise is unchanged", async () => {
  const before = stored();
  const r = await prepare({});
  assert.equal((await attach({ kind: "upload", path: r.data.path })).error.code, "UPLOAD_FAILED");
  assert.equal(stored(), before);
});
