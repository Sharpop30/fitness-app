// M02 exercises: the exercise list and the demo videos.
// Requirements 1 and 10 (story-01, story-10; usecase-01 step 4; usecase-10 steps 1 to 6, alternatives a, b, c, e).
// An upload is two steps through the Endpoint (module map v9): prepare_upload checks and gives an upload address;
// the browser sends the file there; attach_video keeps it once the file is in the bucket.
// Acceptance (UC10 section 13): a video belongs to the exercise, so it appears in every program that has it;
// a new video replaces the old one.
import { type ErrorCode, fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";
import type { Exercise } from "../repository.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// EXERCISES holds two video types only, so a link must be YouTube (stage 4a plan, decision 8).
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

function isYouTubeLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Rule 5: only an active exercise from the ready-made list or the coach's own. Null means NOT_ALLOWED.
async function exerciseInReach(ctx: ModuleContext, payload: Record<string, unknown>): Promise<Exercise | null> {
  const id = payload.exerciseID;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return await ctx.repo.getExerciseInReach(id, ctx.actor.coachID);
}

// The longest and the largest upload come from SETTINGS, through the Orchestrator (CLAUDE.md rule 8). A value missing
// or not a number is VALUE_NOT_SET; a failure of the inner request keeps its own code.
async function videoLimit(ctx: ModuleContext, key: "videoMaxSeconds" | "videoMaxMegabytes"): Promise<number | ErrorCode> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key } });
  if (!r.ok) return r.error!.code;
  const value = Number((r.data as Record<string, string>)[key]);
  return Number.isFinite(value) && value > 0 ? value : "VALUE_NOT_SET";
}

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
// Where an exercise's uploads live: the coach, then the exercise, so a path names whose file it is.
const folderOf = (ctx: ModuleContext, exerciseID: string) => `${ctx.actor.coachID}/${exerciseID}/`;

export const exercises: ModuleDef = {
  id: "M02",
  actions: {
    // The ready-made list and the coach's own exercises, active only.
    async list_exercises(ctx) {
      return ok(await ctx.repo.listExercisesForCoach(ctx.actor.coachID));
    },

    // The coach, and the coach's trainees from the workout screen (S14).
    async get_exercise(ctx, payload) {
      const exercise = await exerciseInReach(ctx, payload);
      return exercise ? ok(exercise) : fail("NOT_ALLOWED");
    },

    async create_exercise(ctx, payload) {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name) return fail("PROGRAM_INVALID"); // no dedicated code in the closed list (stage 4a plan, gap 7)
      return ok(await ctx.repo.createExercise(ctx.actor.coachID, name, payload.isBodyweight === true));
    },

    // UC10 steps 3, 4, alternatives a, b (map v9). The screen checked the file already; this checks again.
    async prepare_upload(ctx, payload) {
      const exercise = await exerciseInReach(ctx, payload);
      if (!exercise) return fail("NOT_ALLOWED");
      const type = typeof payload.contentType === "string" ? payload.contentType.toLowerCase() : "";
      if (!/^video\/[a-z0-9.+-]+$/.test(type) || !positive(payload.seconds) || !positive(payload.megabytes)) return fail("VIDEO_INVALID");

      for (const [key, value] of [["videoMaxSeconds", payload.seconds], ["videoMaxMegabytes", payload.megabytes]] as const) {
        const max = await videoLimit(ctx, key);
        if (typeof max === "string") return fail(max);
        if (value > max) return fail("VIDEO_TOO_LONG"); // UC10 a; the size as well (UC10 section 7, v2)
      }

      const ext = type.slice("video/".length).replace("quicktime", "mov").replace(/[^a-z0-9]/g, "");
      const path = `${folderOf(ctx, exercise.ExerciseID)}${crypto.randomUUID()}.${ext}`;
      const uploadUrl = await ctx.repo.createVideoUploadAddress(path);
      return uploadUrl ? ok({ uploadUrl, path }) : fail("UPLOAD_FAILED"); // UC10 c
    },

    async attach_video(ctx, payload) {
      const exercise = await exerciseInReach(ctx, payload);
      if (!exercise) return fail("NOT_ALLOWED");

      if (payload.kind === "link") {
        if (!isYouTubeLink(payload.url)) return fail("VIDEO_INVALID"); // UC10 step 2
        return ok(await ctx.repo.attachVideo(exercise.ExerciseID, "youtube", payload.url.trim())); // UC10 alternative e
      }

      if (payload.kind === "upload") {
        // Only a file of this coach and this exercise, from prepare_upload.
        const path = payload.path;
        if (typeof path !== "string" || !path.startsWith(folderOf(ctx, exercise.ExerciseID)) || path.includes("..")) return fail("NOT_ALLOWED");
        const address = await ctx.repo.uploadedVideoAddress(path);
        if (!address) return fail("UPLOAD_FAILED"); // UC10 c: the upload did not finish, and the exercise is unchanged
        return ok(await ctx.repo.attachVideo(exercise.ExerciseID, "upload", address)); // UC10 step 5, alternative e
      }

      return fail("VIDEO_INVALID");
    },
  },
};
