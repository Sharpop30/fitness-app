// M12 notifications: messages inside the app, for the trainee.
// Requirements 21, 25 and 30 (usecase-06 step 9, usecase-09 step 2, usecase-11 step 7 and c). Business Logic rule 5.
// Acceptance (UC11 section 13): a freed spot and a cancelled class reach the trainee as a message; (UC9 v3 step 2) a new
// coach note reaches the trainee's home as a message. A push to the phone is the next stage (UC9, UC11 section 14).
import { fail, ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isID = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export const notifications: ModuleDef = {
  id: "M12",
  actions: {
    // Asked by classes and feedback only (Registry). The asking module writes the text (module map v7, section 4);
    // the trainee must be one of the coach of the request (rule 5).
    async notify_in_app(ctx, payload) {
      const text = typeof payload.messageText === "string" ? payload.messageText.trim() : "";
      if (!isID(payload.traineeID) || !text) return fail("NOT_ALLOWED");
      if (!(await ctx.repo.isActiveTraineeOfCoach(payload.traineeID, ctx.actor.coachID))) return fail("NOT_ALLOWED");
      await ctx.repo.addNotification(payload.traineeID, text);
      return ok(null);
    },

    // The trainee's own unread messages, newest first (stage 4c plan, execution decision 8).
    async list_notifications(ctx) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID) return fail("NOT_ALLOWED");
      return ok(await ctx.repo.listUnreadNotifications(traineeID));
    },

    // Only a message of the trainee's own; reading one twice is not an error.
    async mark_read(ctx, payload) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID || !isID(payload.notificationID)) return fail("NOT_ALLOWED");
      return (await ctx.repo.markNotificationRead(payload.notificationID, traineeID)) ? ok(null) : fail("NOT_ALLOWED");
    },
  },
};
