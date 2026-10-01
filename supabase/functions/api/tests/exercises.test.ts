// Unit tests for M02 exercises (create_exercise, get_exercise, prepare_upload, attach_video), against an in-memory
// Repository. list_exercises is tested in programs.test.ts. Sources: usecase-10 steps 1 to 5, alternatives a, b, c, e,
// section 7 (v2); usecase-01; doc-module-map sections 2, 4 (v9); stage 4a plan, decision 8 and gap 7; stage 5 plan,
// decision 5; CLAUDE.md rule 8.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail } from "../errors.ts";
import { exercises } from "../modules/exercises.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type Exercise, StorageUnavailable } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2);
const SQUAT = U(21), FOREIGN = U(24);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: U(11) };

function world(opts: { settings?: Record<string, string>; storageDown?: boolean; bucketDown?: boolean } = {}) {
  const uploaded = new Set<string>(); // the files in the bucket
  const issued: string[] = [];        // the paths an upload address was given for
  const list: (Exercise & { coach: string | null })[] = [
    { ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null, coach: null },
    { ExerciseID: FOREIGN, exerciseName: "של מאמן אחר", isBodyweight: false, videoType: null, videoUrl: null, coach: OTHER_COACH },
  ];
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const strip = ({ coach: _, ...e }: Exercise & { coach: string | null }): Exercise => e;
  const { repo } = fakeRepo({
    getBusinessSettings: async () => (down(), opts.settings ?? { videoMaxSeconds: "60", videoMaxMegabytes: "50" }),
    createVideoUploadAddress: async (path) => opts.bucketDown ? null : (issued.push(path), `https://store.test/upload/${path}?token=t`),
    uploadedVideoAddress: async (path) => uploaded.has(path) ? `https://store.test/public/${path}` : null,
    getExerciseInReach: async (id, c) => {
      down();
      const e = list.find((x) => x.ExerciseID === id && (x.coach === null || x.coach === c));
      return e ? strip(e) : null;
    },
    createExercise: async (c, exerciseName, isBodyweight) => {
      down();
      const e = { ExerciseID: U(100 + list.length), exerciseName, isBodyweight, videoType: null, videoUrl: null, coach: c };
      list.push(e);
      return strip(e);
    },
    attachVideo: async (id, videoType, videoUrl) => {
      down();
      const e = list.find((x) => x.ExerciseID === id)!;
      Object.assign(e, { videoType, videoUrl });
      return strip(e);
    },
  });
  return { repo, list, uploaded, issued };
}

const ask = (w: ReturnType<typeof world>, action: string, payload: Record<string, unknown>, actor = coach, caller = "S05") =>
  handle({ caller, module: "exercises", action, payload }, actor, w.repo, { exercises, settings });

Deno.test("create_exercise: a new exercise is the coach's own, with the name trimmed", async () => {
  const w = world();
  const r = await ask(w, "create_exercise", { name: " פרפר ", isBodyweight: true });
  assertEquals(r.ok, true);
  assertEquals([(r.data as Exercise).exerciseName, (r.data as Exercise).isBodyweight], ["פרפר", true]);
  assertEquals(w.list.at(-1)!.coach, COACH);
});

Deno.test("gap 7: an exercise with no name is PROGRAM_INVALID, and nothing is saved", async () => {
  const w = world();
  assertEquals(await ask(w, "create_exercise", { name: "   " }), fail("PROGRAM_INVALID"));
  assertEquals(await ask(w, "create_exercise", {}), fail("PROGRAM_INVALID"));
  assertEquals(w.list.length, 2);
});

Deno.test("get_exercise: the coach and the coach's trainee get an exercise in reach; another coach's is NOT_ALLOWED", async () => {
  const w = world();
  assertEquals((await ask(w, "get_exercise", { exerciseID: SQUAT })).data, { ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null });
  assertEquals((await ask(w, "get_exercise", { exerciseID: SQUAT }, trainee, "S14")).ok, true);
  assertEquals(await ask(w, "get_exercise", { exerciseID: FOREIGN }), fail("NOT_ALLOWED"));
  assertEquals(await ask(w, "get_exercise", { exerciseID: "" }), fail("NOT_ALLOWED"));
});

Deno.test("UC10 step 5 / alternative e: a YouTube link is saved to the exercise, and a new one replaces it", async () => {
  const w = world();
  const first = await ask(w, "attach_video", { exerciseID: SQUAT, kind: "link", url: "https://www.youtube.com/watch?v=abc" });
  assertEquals([(first.data as Exercise).videoType, (first.data as Exercise).videoUrl], ["youtube", "https://www.youtube.com/watch?v=abc"]);
  await ask(w, "attach_video", { exerciseID: SQUAT, kind: "link", url: " https://youtu.be/xyz " });
  assertEquals(w.list[0].videoUrl, "https://youtu.be/xyz");
});

Deno.test("decision 8: a link that is not YouTube is VIDEO_INVALID, and the exercise is unchanged", async () => {
  const w = world();
  for (const url of ["https://vimeo.com/1", "https://youtube.com.evil.io/x", "ftp://youtube.com/x", "youtube", "", 7]) {
    assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "link", url }), fail("VIDEO_INVALID"));
  }
  assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "gif" }), fail("VIDEO_INVALID"));
  assertEquals([w.list[0].videoType, w.list[0].videoUrl], [null, null]);
});

Deno.test("rule 5: a video for another coach's exercise is NOT_ALLOWED", async () => {
  const w = world();
  assertEquals(await ask(w, "attach_video", { exerciseID: FOREIGN, kind: "link", url: "https://youtu.be/x" }), fail("NOT_ALLOWED"));
  assertEquals(w.list[1].videoUrl, null);
});

const file = { exerciseID: SQUAT, contentType: "video/mp4", seconds: 45, megabytes: 12 };

Deno.test("UC10 steps 3-5: prepare_upload gives an address for a path of this coach and exercise, and attach_video keeps the file", async () => {
  const w = world();
  const r = await ask(w, "prepare_upload", file);
  assertEquals(r.ok, true);
  const { uploadUrl, path } = r.data as { uploadUrl: string; path: string };
  assert(path.startsWith(`${COACH}/${SQUAT}/`) && path.endsWith(".mp4"), path);
  assertEquals(uploadUrl, `https://store.test/upload/${path}?token=t`);
  w.uploaded.add(path); // the browser sent the file
  const a = await ask(w, "attach_video", { exerciseID: SQUAT, kind: "upload", path });
  assertEquals(a.ok, true);
  assertEquals([w.list[0].videoType, w.list[0].videoUrl], ["upload", `https://store.test/public/${path}`]);
});

Deno.test("UC10 a and section 7: longer than videoMaxSeconds, or larger than videoMaxMegabytes, is VIDEO_TOO_LONG, with no address", async () => {
  const w = world();
  assertEquals(await ask(w, "prepare_upload", { ...file, seconds: 120 }), fail("VIDEO_TOO_LONG"));
  assertEquals(await ask(w, "prepare_upload", { ...file, megabytes: 80 }), fail("VIDEO_TOO_LONG"));
  assertEquals(w.issued, []);
  assertEquals((await ask(world({ settings: { videoMaxSeconds: "150", videoMaxMegabytes: "100" } }), "prepare_upload", { ...file, seconds: 120, megabytes: 80 })).ok, true);
});

Deno.test("UC10 b: not a video, or no length or size, is VIDEO_INVALID", async () => {
  const w = world();
  for (const bad of [{ contentType: "image/png" }, { contentType: undefined }, { seconds: undefined }, { seconds: "45" }, { seconds: 0 }, { megabytes: -1 }]) {
    assertEquals(await ask(w, "prepare_upload", { ...file, ...bad }), fail("VIDEO_INVALID"));
  }
  assertEquals(w.issued, []);
});

Deno.test("rule 8: with no videoMaxSeconds or videoMaxMegabytes in SETTINGS, an upload is VALUE_NOT_SET", async () => {
  assertEquals(await ask(world({ settings: { videoMaxMegabytes: "50" } }), "prepare_upload", file), fail("VALUE_NOT_SET"));
  assertEquals(await ask(world({ settings: { videoMaxSeconds: "60" } }), "prepare_upload", file), fail("VALUE_NOT_SET"));
});

Deno.test("UC10 c: a store that refuses, or a file that never arrived, is UPLOAD_FAILED, and the exercise is unchanged", async () => {
  assertEquals(await ask(world({ bucketDown: true }), "prepare_upload", file), fail("UPLOAD_FAILED"));
  const w = world();
  const { path } = (await ask(w, "prepare_upload", file)).data as { path: string };
  assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "upload", path }), fail("UPLOAD_FAILED"));
  assertEquals([w.list[0].videoType, w.list[0].videoUrl], [null, null]);
});

Deno.test("rule 5: an upload only to the coach's own path of this exercise, and not for another coach's exercise", async () => {
  const w = world();
  for (const path of [undefined, `${OTHER_COACH}/${SQUAT}/a.mp4`, `${COACH}/${FOREIGN}/a.mp4`, `${COACH}/${SQUAT}/../x.mp4`]) {
    if (path) w.uploaded.add(path);
    assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "upload", path }), fail("NOT_ALLOWED"));
  }
  assertEquals(await ask(w, "prepare_upload", { ...file, exerciseID: FOREIGN }), fail("NOT_ALLOWED"));
  assertEquals(w.list[0].videoUrl, null);
});

Deno.test("a database that fails gives STORAGE_UNAVAILABLE, without throwing", async () => {
  const w = world({ storageDown: true });
  assertEquals(await ask(w, "create_exercise", { name: "פרפר" }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await ask(w, "get_exercise", { exerciseID: SQUAT }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "link", url: "https://youtu.be/x" }), fail("STORAGE_UNAVAILABLE"));
});
