// I02 Payment Gateway: the one door to a payment provider (module map sections 3, 9). Version one is a demo that
// approves; a real provider replaces only this file. Requirement 2 (usecase-02 step 6, alternative c; stage 5 plan).
// Rule 12: the charge knows a payment request and an amount, and nothing about a card.
// Acceptance (UC2 section 13): an approved charge lets payments issue the invoice; a decline, or no answer in time,
// is PAYMENT_GATEWAY_UNAVAILABLE, and payments leaves the request open with no invoice.
import { fail, ok } from "../errors.ts";
import type { ModuleDef } from "../orchestrator.ts";

// What a provider answers for one charge. The demo approves, unless the local test value asks it to decline
// (PAYMENT_GATEWAY_MODE, CLAUDE.md v6 section 3; never set in the cloud).
export type Provider = (charge: { paymentRequestID: string; amount: number }) => Promise<"approved" | "declined">;

export const demoProvider: Provider = () =>
  Promise.resolve(Deno.env.get("PAYMENT_GATEWAY_MODE") === "decline" ? "declined" : "approved");

// How long to wait for the provider: a property of the provider, not of the business (stage 5 plan, execution decision 4).
const ANSWER_MS = 10_000;

export function paymentGateway(provider: Provider = demoProvider, answerMs = ANSWER_MS): ModuleDef {
  return {
    id: "I02",
    actions: {
      async charge(_ctx, payload) {
        const { paymentRequestID, amount } = payload;
        if (typeof paymentRequestID !== "string" || typeof amount !== "number" || !(amount > 0)) return fail("NOT_ALLOWED");
        let timer: ReturnType<typeof setTimeout> | undefined;
        const late = new Promise<"late">((resolve) => { timer = setTimeout(() => resolve("late"), answerMs); });
        try {
          const answer = await Promise.race([provider({ paymentRequestID, amount }), late]);
          return answer === "approved" ? ok(null) : fail("PAYMENT_GATEWAY_UNAVAILABLE");
        } catch {
          return fail("PAYMENT_GATEWAY_UNAVAILABLE"); // the provider failed: no charge was made
        } finally {
          clearTimeout(timer);
        }
      },
    },
  };
}

export const payment_gateway = paymentGateway();
