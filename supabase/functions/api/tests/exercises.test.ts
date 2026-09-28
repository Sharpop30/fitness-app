// Unit tests for M02 exercises (create_exercise, get_exercise, attach_video), against an in-memory Repository.
// list_exercises is tested in programs.test.ts. Sources: usecase-10 steps 1, 2, 5, alternatives a, b, e;
// usecase-01; doc-module-map sections 2, 4; stage 4a plan, decisions 7, 8 and gap 7; CLAUDE.md rule 8.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail } from "../errors.ts";
import { exercises } from "../modules/exercises.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type Exercise, StorageUnavailable } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2);
const SQUAT = U(21), FOREIGN = U(24);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const trainee: Actor = { role: "trainee", coachID: COACH, traineeID: U(11) };

function world(opts: { settings?: Record<string, string>; storageDown?: boolean } = {}) {
  const list: (Exercise & { coach: string | null })[] = [
    { ExerciseID: SQUAT, exerciseName: "סקוואט", isBodyweight: false, videoType: null, videoUrl: null, coach: null },
    { ExerciseID: FOREIGN, exerciseName: "של מאמן אחר", isBodyweight: false, videoType: null, videoUrl: null, coach: OTHER_COACH },
  ];
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const strip = ({ coach: _, ...e }: Exercise & { coach: string | null }): Exercise => e;
  const { repo } = fakeRepo({
    getCoachSettings: async () => (down(), opts.settings ?? { videoMaxSeconds: "60" }),
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
  return { repo, list };
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

Deno.test("UC10 a: an upload longer than videoMaxSeconds is VIDEO_TOO_LONG", async () => {
  const w = world();
  assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "upload", seconds: 120 }), fail("VIDEO_TOO_LONG"));
  assertEquals(await ask(world({ settings: { videoMaxSeconds: "150" } }), "attach_video", { exerciseID: SQUAT, kind: "upload", seconds: 120 }), fail("UPLOAD_FAILED"));
});

Deno.test("decision 7: an upload of a valid length is UPLOAD_FAILED until stage 5, and the exercise is unchanged", async () => {
  const w = world();
  assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "upload", seconds: 45 }), fail("UPLOAD_FAILED"));
  assertEquals(w.list[0].videoType, null);
});

Deno.test("UC10 b: an upload with no length is VIDEO_INVALID", async () => {
  const w = world();
  for (const seconds of [undefined, "x", 0, -3]) {
    assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "upload", seconds }), fail("VIDEO_INVALID"));
  }
});

Deno.test("rule 8: with no videoMaxSeconds in SETTINGS, an upload is VALUE_NOT_SET", async () => {
  assertEquals(await ask(world({ settings: {} }), "attach_video", { exerciseID: SQUAT, kind: "upload", seconds: 45 }), fail("VALUE_NOT_SET"));
});

Deno.test("a database that fails gives STORAGE_UNAVAILABLE, without throwing", async () => {
  const w = world({ storageDown: true });
  assertEquals(await ask(w, "create_exercise", { name: "פרפר" }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await ask(w, "get_exercise", { exerciseID: SQUAT }), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await ask(w, "attach_video", { exerciseID: SQUAT, kind: "link", url: "https://youtu.be/x" }), fail("STORAGE_UNAVAILABLE"));
});
