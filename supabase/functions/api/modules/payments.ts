// M09 payments: payment requests and the demo payment.
// Requirement 2 (story-02, usecase-02; alternatives a to e; section 7). Business Logic rule 5; CLAUDE.md rules 8, 12.
// Acceptance (UC2 section 13): the coach creates a request and the trainee pays; the payment shows as paid to the coach,
// with a demo invoice made with no further action. No card detail is taken, sent or kept anywhere.
import { type ErrorCode, fail, ok } from "../errors.ts";
import type { ModuleContext, ModuleDef } from "../orchestrator.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isID = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// The price of each payment type is in SETTINGS (UC2 step 1). A type with no price is VALUE_NOT_SET (stage 4d plan, decision 8).
const PRICE_KEY: Record<string, string> = { monthly: "priceMonthly", pack10: "pricePack10" };

async function priceOf(ctx: ModuleContext, paymentType: unknown): Promise<number | ErrorCode> {
  const key = typeof paymentType === "string" ? PRICE_KEY[paymentType] : undefined;
  if (!key) return "VALUE_NOT_SET";
  const r = await ctx.call({ module: "settings", action: "get_settings", payload: { key } });
  if (!r.ok) return r.error!.code;
  const n = Number((r.data as Record<string, string>)[key]);
  return Number.isFinite(n) && n > 0 ? n : "VALUE_NOT_SET"; // UC2 d
}

// Rule 5: a coach reads all their trainees, or one of them; a trainee only themselves, whatever the input says
// (stage 4d plan, execution decision 2). Undefined means NOT_ALLOWED.
async function whose(ctx: ModuleContext, payload: Record<string, unknown>): Promise<string | null | undefined> {
  const { actor } = ctx;
  if (actor.role === "trainee") return actor.traineeID ?? undefined;
  if (payload.traineeID === undefined || payload.traineeID === null || payload.traineeID === "") return null;
  return isID(payload.traineeID) && (await ctx.repo.isActiveTraineeOfCoach(payload.traineeID, actor.coachID))
    ? payload.traineeID : undefined;
}

export const payments: ModuleDef = {
  id: "M09",
  actions: {
    // UC2 steps 1-3. Only a trainee who joined and is active, of this coach (execution decision 1). The amount is
    // fixed when the request is made (execution decision 3).
    async create_payment_request(ctx, payload) {
      if (ctx.actor.role !== "coach") return fail("NOT_ALLOWED");
      if (!isID(payload.traineeID) || !(await ctx.repo.isActiveTraineeOfCoach(payload.traineeID, ctx.actor.coachID))) {
        return fail("NOT_ALLOWED");
      }
      const amount = await priceOf(ctx, payload.paymentType);
      if (typeof amount === "string") return fail(amount);
      await ctx.repo.createPaymentRequest(ctx.actor.coachID, payload.traineeID, payload.paymentType as string, amount);
      return ok(null);
    },

    // UC2 steps 4, 10 and alternatives a, e. Newest first, with the invoice number of a paid request.
    async list_payments(ctx, payload) {
      // The owner, through M13 and M15 (map v11): every coach of the business, or the coach asked, with the coach and the
      // day it was paid, for the sums of the business.
      if (ctx.actor.role === "owner") {
        const coaches = await ctx.repo.coachesInReach(ctx.actor.businessID, payload.coachID);
        if (!coaches) return fail("NOT_ALLOWED");
        const rows = [];
        for (const coachID of coaches) rows.push(...await ctx.repo.listPaymentRequests(coachID, null));
        return ok(rows.map((p) => ({
          PaymentRequestID: p.PaymentRequestID, CoachID: p.CoachID, fullName: p.fullName, paymentType: p.paymentType, amount: p.amount,
          status: p.status, createdAt: p.createdAt, paidAt: p.paidAt, invoiceNumber: p.status === "paid" ? p.invoiceNumber : null,
        })));
      }
      const traineeID = await whose(ctx, payload);
      if (traineeID === undefined) return fail("NOT_ALLOWED");
      const list = await ctx.repo.listPaymentRequests(ctx.actor.coachID, traineeID);
      return ok(list.map((p) => ({
        PaymentRequestID: p.PaymentRequestID, fullName: p.fullName, paymentType: p.paymentType, amount: p.amount,
        status: p.status, createdAt: p.createdAt, invoiceNumber: p.status === "paid" ? p.invoiceNumber : null,
      })));
    },

    // UC2 steps 5-9, alternatives b and c, and section 7: charge, then the invoice, then "paid" while still open
    // (module map v8). A paid request always has its invoice, and a retry never makes a second one.
    async pay_demo(ctx, payload) {
      const traineeID = ctx.actor.traineeID;
      if (!traineeID || !isID(payload.paymentRequestID)) return fail("NOT_ALLOWED");
      const request = await ctx.repo.getPaymentRequest(payload.paymentRequestID);
      if (!request || request.TraineeID !== traineeID) return fail("NOT_ALLOWED"); // UC2 e
      if (request.status === "paid") return fail("PAYMENT_ALREADY_PAID"); // UC2 b

      const ids = { paymentRequestID: request.PaymentRequestID, amount: request.amount };
      // UC2 c: a gateway that fails, or is not built yet, leaves the request open with no invoice (execution decision 6).
      const charged = await ctx.call({ module: "payment_gateway", action: "charge", payload: ids });
      if (!charged.ok) return fail("PAYMENT_GATEWAY_UNAVAILABLE");

      const invoice = await ctx.call({ module: "invoices", action: "create_invoice", payload: ids });
      if (!invoice.ok) return fail(invoice.error!.code);

      // Two payments at once: the one that finds the request already paid answers as a second payment.
      if (!(await ctx.repo.markPaymentPaid(request.PaymentRequestID))) return fail("PAYMENT_ALREADY_PAID");
      return ok({ invoiceNumber: (invoice.data as { invoiceNumber: number }).invoiceNumber });
    },
  },
};
