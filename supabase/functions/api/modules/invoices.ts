// M10 invoices: numbered demo invoices, one per paid request.
// Requirement 2 (story-02, usecase-02 steps 8-10; alternative e). Business Logic rule 5; CLAUDE.md rule 12.
// Acceptance (UC2 section 13): a payment that went through has a demo invoice with no further action; the coach and the
// trainee see it. A real tax invoice comes from an invoice provider later, behind this same contract.
import { fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isID = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// Rule 5: a coach reads all their trainees, or one of them; a trainee only themselves, whatever the input says
// (stage 4d plan, execution decision 2). Undefined means NOT_ALLOWED.
async function whose(ctx: ModuleContext, payload: Record<string, unknown>): Promise<string | null | undefined> {
  const { actor } = ctx;
  if (actor.role === "trainee") return actor.traineeID ?? undefined;
  if (payload.traineeID === undefined || payload.traineeID === null || payload.traineeID === "") return null;
  return isID(payload.traineeID) && (await ctx.repo.isActiveTraineeOfCoach(payload.traineeID, actor.coachID))
    ? payload.traineeID : undefined;
}

export const invoices: ModuleDef = {
  id: "M10",
  actions: {
    // From payments only (Registry, and checked here too). One invoice per request: a second call returns the same
    // number (module map v8, the demo payment with no in-between state).
    async create_invoice(ctx, payload) {
      if (ctx.caller !== "M09") return fail("NOT_ALLOWED");
      const amount = Number(payload.amount);
      if (!isID(payload.paymentRequestID) || !(amount > 0)) return fail("NOT_ALLOWED");
      return ok({ invoiceNumber: await ctx.repo.createInvoice(payload.paymentRequestID, amount) });
    },

    // UC2 step 10 and e. Newest first; marked as demo, as the screens show.
    async list_invoices(ctx, payload) {
      const traineeID = await whose(ctx, payload);
      if (traineeID === undefined) return fail("NOT_ALLOWED");
      const list = await ctx.repo.listInvoices(ctx.actor.coachID, traineeID);
      return ok(list.map((i) => ({
        invoiceNumber: i.invoiceNumber, fullName: i.fullName, paymentType: i.paymentType, amount: i.amount, issuedAt: i.issuedAt, isDemo: i.isDemo,
      })));
    },
  },
};
