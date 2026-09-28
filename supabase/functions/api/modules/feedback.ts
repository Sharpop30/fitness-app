// M06 feedback: the instant feedback after a workout, and the coach's personal notes.
// Requirement 21 (story-21, usecase-06). Business Logic rule 5; CLAUDE.md rule 8.
// Acceptance (UC6 section 13): saving a workout shows feedback at once; a record is highlighted; a coach's note is seen
// by the trainee. The texts are the coach's, from SETTINGS, and never written in code.
import { type ErrorCode, fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rule 5: a coach reads only their own trainees; a trainee only themselves. Null means NOT_ALLOWED.
async function traineeInReach(ctx: ModuleContext, payload: Record<string, unknown>): Promise<string | null> {
  const { actor } = ctx;
  if (actor.role === "trainee") {
    const asked = payload.traineeID ?? actor.traineeID;
    return asked === actor.traineeID ? actor.traineeID : null;
  }
  const id = payload.traineeID;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return (await ctx.repo.isActiveTraineeOfCoach(id, actor.coachID)) ? id : null;
}

// One value from SETTINGS, through the Orchestrator. A missing key comes back VALUE_NOT_SET (rule 8).
async function setting(ctx: ModuleContext, key: string): Promise<{ value: string } | { code: ErrorCode }> {
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key } });
  return r.ok ? { value: (r.data as Record<string, string>)[key] } : { code: r.error!.code };
}

export const feedback: ModuleDef = {
  id: "M06",
  actions: {
    // UC6 steps 1-5, asked by results only (Registry), with the contract of module map v4 and v5:
    // in workoutLogID and traineeID; out records and text. done, total and coins are results' and coins' fields.
    async build_feedback(ctx, payload) {
      const traineeID = await traineeInReach(ctx, payload);
      const id = payload.workoutLogID;
      if (!traineeID || typeof id !== "string" || !UUID.test(id)) return fail("NOT_ALLOWED");
      const log = await ctx.repo.getWorkoutLog(id);
      if (!log || log.TraineeID !== traineeID) return fail("NOT_ALLOWED");

      // UC6 step 3, through the Orchestrator. Feedback is not a core action: without records it still answers.
      const found = await ctx.call({ module: "progress", action: "detect_personal_records", payload: { workoutLogID: id, traineeID } });
      const records = found.ok && Array.isArray((found.data as { records?: unknown })?.records)
        ? (found.data as { records: string[] }).records : [];

      // UC6 step 5 and alternative a: a record, a full workout, or a partial one. A text missing from SETTINGS is
      // VALUE_NOT_SET, logged, and never replaced by a text written here (stage 4b plan, decision 10).
      const allDone = log.sets.every((s) => s.isDone);
      const key = records.length ? "feedbackRecord" : allDone ? "feedbackFull" : "feedbackPartial";
      const text = await setting(ctx, key);
      if ("code" in text) return fail(text.code);
      if (!text.value.trim()) return fail("VALUE_NOT_SET");
      return ok({ records, text: text.value });
    },

    // UC6 steps 7-8 and alternative b. The coach writes on a workout of their own trainee.
    async add_coach_note(ctx, payload) {
      const id = payload.workoutLogID;
      if (typeof id !== "string" || !UUID.test(id)) return fail("NOT_ALLOWED");
      const log = await ctx.repo.getWorkoutLog(id);
      if (!log || !(await ctx.repo.isActiveTraineeOfCoach(log.TraineeID, ctx.actor.coachID))) return fail("NOT_ALLOWED");

      const text = typeof payload.noteText === "string" ? payload.noteText.trim() : "";
      if (!text) return fail("NOTE_INVALID");
      const max = await setting(ctx, "noteMaxLength");
      if ("code" in max) return fail(max.code);
      const maxLength = Number(max.value);
      if (!Number.isInteger(maxLength) || maxLength <= 0) return fail("VALUE_NOT_SET");
      if (text.length > maxLength) return fail("NOTE_INVALID");

      await ctx.repo.addCoachNote(id, ctx.actor.coachID, text);
      return ok(null);
    },

    // UC6 step 9: the notes on a trainee's workouts, for the trainee, the coach, or home.
    async get_workout_notes(ctx, payload) {
      const traineeID = await traineeInReach(ctx, payload);
      if (!traineeID) return fail("NOT_ALLOWED");
      const notes = await ctx.repo.listCoachNotes(traineeID);
      return ok(notes.map(({ WorkoutLogID, noteText }) => ({ WorkoutLogID, noteText })));
    },
  },
};
