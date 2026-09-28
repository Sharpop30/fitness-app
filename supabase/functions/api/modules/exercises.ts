// M02 exercises: the exercise list and the demo videos.
// Requirements 1 and 10 (story-01, story-10; usecase-01 step 4; usecase-10 steps 1, 2, 5, 6, alternatives a, e).
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

// The longest upload comes from SETTINGS, through the Orchestrator (CLAUDE.md rule 8). A value missing or not a
// number is VALUE_NOT_SET; a failure of the inner request keeps its own code.
async function videoMaxSeconds(ctx: ModuleContext): Promise<number | ErrorCode> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key: "videoMaxSeconds" } });
  if (!r.ok) return r.error!.code;
  const seconds = Number((r.data as Record<string, string>).videoMaxSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : "VALUE_NOT_SET";
}

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

    async attach_video(ctx, payload) {
      const exercise = await exerciseInReach(ctx, payload);
      if (!exercise) return fail("NOT_ALLOWED");

      if (payload.kind === "link") {
        if (!isYouTubeLink(payload.url)) return fail("VIDEO_INVALID"); // UC10 step 2
        return ok(await ctx.repo.attachVideo(exercise.ExerciseID, "youtube", payload.url.trim())); // UC10 alternative e
      }

      if (payload.kind === "upload") {
        const seconds = Number(payload.seconds);
        if (!Number.isFinite(seconds) || seconds <= 0) return fail("VIDEO_INVALID"); // UC10 alternative b
        const max = await videoMaxSeconds(ctx);
        if (typeof max === "string") return fail(max);
        if (seconds > max) return fail("VIDEO_TOO_LONG"); // UC10 alternative a
        // File storage (I04) comes in stage 5; until then the upload itself does not go through (stage 4a plan, decision 7).
        return fail("UPLOAD_FAILED");
      }

      return fail("VIDEO_INVALID");
    },
  },
};
