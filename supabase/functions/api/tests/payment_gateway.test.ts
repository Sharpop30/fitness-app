// Unit tests for I02 payment_gateway, the demo gateway, against its contract (module map v9, section 4).
// Sources: usecase-02 step 6, alternative c; stage 5 plan, decision 4, execution decision 4; CLAUDE.md rule 12.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { demoProvider, paymentGateway, type Provider } from "../interfaces/payment_gateway.ts";
import type { Actor } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const noa: Actor = { role: "trainee", coachID: U(1), traineeID: U(11) };
const charge = (gw = paymentGateway(), payload: Record<string, unknown> = { paymentRequestID: U(900), amount: 350 }) =>
  handle({ caller: "M09", module: "payment_gateway", action: "charge", payload }, noa, fakeRepo().repo, { payment_gateway: gw });

Deno.test("the contract: charge takes the request and the amount, approves, and answers null", async () => {
  const seen: unknown[] = [];
  const provider: Provider = (c) => (seen.push(c), Promise.resolve("approved"));
  assertEquals(await charge(paymentGateway(provider)), ok(null));
  assertEquals(seen, [{ paymentRequestID: U(900), amount: 350 }]);
});

Deno.test("rule 12: whatever else is sent, the provider gets only the request and the amount, and the reply holds nothing", async () => {
  const seen: Record<string, unknown>[] = [];
  const provider: Provider = (c) => (seen.push(c), Promise.resolve("approved"));
  const r = await charge(paymentGateway(provider), { paymentRequestID: U(900), amount: 350, cardNumber: "x", cvv: "y" });
  assertEquals(r, ok(null));
  assertEquals(Object.keys(seen[0]).sort(), ["amount", "paymentRequestID"]);
});

Deno.test("UC2 c: a decline, a provider that fails, or no answer in time, is PAYMENT_GATEWAY_UNAVAILABLE", async () => {
  assertEquals(await charge(paymentGateway(() => Promise.resolve("declined"))), fail("PAYMENT_GATEWAY_UNAVAILABLE"));
  assertEquals(await charge(paymentGateway(() => Promise.reject(new Error("down")))), fail("PAYMENT_GATEWAY_UNAVAILABLE"));
  const never: Provider = () => new Promise(() => {});
  assertEquals(await charge(paymentGateway(never, 20)), fail("PAYMENT_GATEWAY_UNAVAILABLE"));
});

Deno.test("a request with no ID, or an amount that is not positive, charges nothing", async () => {
  const seen: unknown[] = [];
  const gw = paymentGateway((c) => (seen.push(c), Promise.resolve("approved")));
  for (const payload of [{ amount: 350 }, { paymentRequestID: U(900), amount: 0 }, { paymentRequestID: U(900), amount: "350" }]) {
    assertEquals(await charge(gw, payload), fail("NOT_ALLOWED"));
  }
  assertEquals(seen, []);
});

Deno.test("decision 4: the demo approves, and declines only when the local test value says so", async () => {
  const before = Deno.env.get("PAYMENT_GATEWAY_MODE");
  try {
    Deno.env.delete("PAYMENT_GATEWAY_MODE");
    assertEquals(await demoProvider({ paymentRequestID: U(900), amount: 350 }), "approved");
    Deno.env.set("PAYMENT_GATEWAY_MODE", "approve");
    assertEquals(await demoProvider({ paymentRequestID: U(900), amount: 350 }), "approved");
    Deno.env.set("PAYMENT_GATEWAY_MODE", "decline");
    assertEquals(await demoProvider({ paymentRequestID: U(900), amount: 350 }), "declined");
  } finally {
    if (before === undefined) Deno.env.delete("PAYMENT_GATEWAY_MODE"); else Deno.env.set("PAYMENT_GATEWAY_MODE", before);
  }
});

Deno.test("Registry: only payments may charge; a screen is refused before the gateway", async () => {
  const seen: unknown[] = [];
  const gw = paymentGateway((c) => (seen.push(c), Promise.resolve("approved")));
  const rows = fakeRepo({ isRegistered: async (caller, module) => caller === "M09" && module === "payment_gateway" }).repo;
  const ask = (caller: string) => handle({ caller, module: "payment_gateway", action: "charge", payload: { paymentRequestID: U(900), amount: 350 } }, noa, rows, { payment_gateway: gw });
  assertEquals(await ask("S19"), fail("ACTION_NOT_ALLOWED"));
  assertEquals(await ask("M09"), ok(null));
  assertEquals(seen.length, 1);
});
