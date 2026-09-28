// Unit tests for M09 payments and M10 invoices, against an in-memory Repository (synthetic data), behind the Orchestrator,
// with the real settings module and a stand-in for the payment gateway (I02 is built in stage 5; stage 4d plan, decision 1).
// Sources: usecase-02 sections 4, 6, 7, 13; doc-module-map v8 section 4 (the demo payment with no in-between state,
// the reading along the request-invoice link, the contracts); stage 4d plan, execution decisions 1-3, 6; CLAUDE.md rule 12.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { handle, type ModuleDef, type Modules } from "../orchestrator.ts";
import { fail, ok, type Reply } from "../errors.ts";
import { invoices } from "../modules/invoices.ts";
import { payments } from "../modules/payments.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, type Invoice, type PaymentRequest, StorageUnavailable } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2), NOA = U(11), ITAI = U(12), GONE = U(13);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const noa: Actor = { role: "trainee", coachID: COACH, traineeID: NOA };
const itai: Actor = { role: "trainee", coachID: COACH, traineeID: ITAI };
const NAMES: Record<string, string> = { [NOA]: "נועה (test)", [ITAI]: "איתי (test)", [GONE]: "לא פעיל (test)" };

// The Registry rows of 0002 for payments and invoices.
const ROWS = new Set([
  "S08/payments/create_payment_request/coach", "S08/payments/list_payments/coach", "S08/invoices/list_invoices/coach",
  "S19/payments/list_payments/trainee", "S19/payments/pay_demo/trainee", "S19/invoices/list_invoices/trainee",
  "M09/payment_gateway/charge/module", "M09/invoices/create_invoice/module", "M09/settings/get_settings/module",
  "M13/payments/list_payments/module", "M01/payments/list_payments/module",
]);

// The gateway stand-in: it approves, fails, or is missing (not built), and counts its charges.
const gateway = (reply: Reply, seen: unknown[]): ModuleDef =>
  ({ id: "I02", actions: { charge: async (_ctx, payload) => (seen.push(payload), reply) } });

function world(opts: { values?: Record<string, string>; storageDown?: boolean; gateway?: Reply | "missing"; invoiceDown?: boolean } = {}) {
  const values = opts.values ?? { priceMonthly: "350", pricePack10: "600" };
  const requests: Omit<PaymentRequest, "fullName" | "invoiceNumber">[] = [];
  const invs: { invoiceNumber: number; PaymentRequestID: string; amount: number; issuedAt: string }[] = [];
  const charges: unknown[] = [];
  let seq = 900, number = 1001, clock = 0;
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  const at = () => new Date(Date.UTC(2026, 8, 28, 8, clock++)).toISOString();
  const view = (r: typeof requests[number]): PaymentRequest =>
    ({ ...r, fullName: NAMES[r.TraineeID], invoiceNumber: invs.find((i) => i.PaymentRequestID === r.PaymentRequestID)?.invoiceNumber ?? null });

  const w = fakeRepo({
    isRegistered: async (caller, module, action, role) => ROWS.has(`${caller}/${module}/${action}/${role}`),
    getCoachSettings: async () => (down(), values),
    isActiveTraineeOfCoach: async (t, c) => (down(), c === COACH && [NOA, ITAI].includes(t)),
    createPaymentRequest: async (CoachID, TraineeID, paymentType, amount) => {
      down();
      const id = U(seq++);
      requests.push({ PaymentRequestID: id, CoachID, TraineeID, paymentType, amount, status: "open", createdAt: at(), paidAt: null });
      return id;
    },
    getPaymentRequest: async (id) => { down(); const r = requests.find((x) => x.PaymentRequestID === id); return r ? view(r) : null; },
    listPaymentRequests: async (c, t) => (down(), requests.filter((r) => r.CoachID === c && (!t || r.TraineeID === t))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view)),
    markPaymentPaid: async (id) => {
      down();
      const r = requests.find((x) => x.PaymentRequestID === id && x.status === "open");
      if (!r) return false;
      r.status = "paid"; r.paidAt = at();
      return true;
    },
    createInvoice: async (id, amount) => {
      down();
      if (opts.invoiceDown) throw new StorageUnavailable("db down");
      const found = invs.find((i) => i.PaymentRequestID === id);
      if (found) return found.invoiceNumber;
      invs.push({ invoiceNumber: number, PaymentRequestID: id, amount, issuedAt: at() });
      return number++;
    },
    listInvoices: async (c, t) => {
      down();
      return invs.map((i): Invoice => {
        const r = requests.find((x) => x.PaymentRequestID === i.PaymentRequestID)!;
        return { ...i, TraineeID: r.TraineeID, fullName: NAMES[r.TraineeID], paymentType: r.paymentType, isDemo: true, CoachID: r.CoachID } as Invoice & { CoachID: string };
      }).filter((i) => (i as Invoice & { CoachID: string }).CoachID === c && (!t || i.TraineeID === t)).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    },
  });

  const modules: Modules = { payments, invoices, settings };
  if (opts.gateway !== "missing") modules.payment_gateway = gateway(opts.gateway ?? ok(null), charges);
  const ask = (actor: Actor, caller: string, module: string, action: string, payload: Record<string, unknown> = {}) =>
    handle({ caller, module, action, payload }, actor, w.repo, modules);
  const request = (traineeID = NOA, paymentType = "monthly") =>
    ask(coach, "S08", "payments", "create_payment_request", { traineeID, paymentType });
  const pay = (actor: Actor, paymentRequestID: string) => ask(actor, "S19", "payments", "pay_demo", { paymentRequestID });
  return { ...w, requests, invs, charges, values, ask, request, pay };
}

type Row = { PaymentRequestID: string; fullName: string; paymentType: string; amount: number; status: string; invoiceNumber: number | null };

// ---- create_payment_request and list_payments (UC2 steps 1-4, alternatives a, d, e) ----

Deno.test("UC2 steps 1-4 and a: the coach creates a request, open, at the price in SETTINGS, and both see it open", async () => {
  const w = world();
  assertEquals(await w.request(NOA, "monthly"), ok(null));
  assertEquals(await w.request(NOA, "pack10"), ok(null));
  const mine = (await w.ask(noa, "S19", "payments", "list_payments")).data as Row[];
  assertEquals(mine.map((p) => [p.paymentType, p.amount, p.status, p.invoiceNumber]), [["pack10", 600, "open", null], ["monthly", 350, "open", null]]);
  const all = (await w.ask(coach, "S08", "payments", "list_payments")).data as Row[];
  assertEquals(all.map((p) => p.fullName), ["נועה (test)", "נועה (test)"]);
});

Deno.test("UC2 d and decision 8: a price missing, zero or not a number, or a type with no price, is VALUE_NOT_SET and creates nothing", async () => {
  for (const values of [{ pricePack10: "600" }, { priceMonthly: "0", pricePack10: "600" }, { priceMonthly: "abc", pricePack10: "600" }] as Record<string, string>[]) {
    const w = world({ values });
    assertEquals(await w.request(NOA, "monthly"), fail("VALUE_NOT_SET"));
    assertEquals(w.requests.length, 0);
  }
  const w = world();
  assertEquals(await w.request(NOA, "yearly"), fail("VALUE_NOT_SET"));
  assertEquals(w.requests.length, 0);
});

Deno.test("execution decision 3: the amount is fixed when the request is made; a new price changes only the next request", async () => {
  const w = world();
  await w.request(NOA);
  w.values.priceMonthly = "400";
  await w.request(NOA);
  assertEquals(w.requests.map((r) => r.amount), [350, 400]);
});

Deno.test("rule 5 and execution decision 1: a request for a trainee of another coach, inactive, or by a trainee, is NOT_ALLOWED", async () => {
  const w = world();
  assertEquals(await w.request(GONE), fail("NOT_ALLOWED"));
  assertEquals(await w.ask({ ...coach, coachID: OTHER_COACH }, "S08", "payments", "create_payment_request", { traineeID: NOA, paymentType: "monthly" }), fail("NOT_ALLOWED"));
  assertEquals(await w.ask(noa, "S08", "payments", "create_payment_request", { traineeID: NOA, paymentType: "monthly" }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(w.requests.length, 0);
});

Deno.test("UC2 e and decision 2: the coach filters to one trainee of theirs; a trainee sees only their own, whatever they ask", async () => {
  const w = world();
  await w.request(NOA); await w.request(ITAI);
  const one = (await w.ask(coach, "S08", "payments", "list_payments", { traineeID: ITAI })).data as Row[];
  assertEquals(one.map((p) => p.fullName), ["איתי (test)"]);
  assertEquals(await w.ask(coach, "S08", "payments", "list_payments", { traineeID: GONE }), fail("NOT_ALLOWED"));
  const asked = (await w.ask(noa, "S19", "payments", "list_payments", { traineeID: ITAI })).data as Row[];
  assertEquals(asked.map((p) => p.fullName), ["נועה (test)"]);
  const invs = await w.ask(noa, "S19", "invoices", "list_invoices", { traineeID: ITAI });
  assertEquals(invs, ok([]));
});

// ---- pay_demo (UC2 steps 5-10, alternatives b, c, e; section 7) ----

Deno.test("UC2 steps 5-10: a demo payment charges once, makes one demo invoice, and the request shows as paid to the coach", async () => {
  const w = world();
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  assertEquals(await w.pay(noa, id), ok({ invoiceNumber: 1001 }));
  assertEquals(w.charges, [{ paymentRequestID: id, amount: 350 }]);
  const row = ((await w.ask(coach, "S08", "payments", "list_payments")).data as Row[])[0];
  assertEquals([row.status, row.invoiceNumber], ["paid", 1001]);
  const inv = (await w.ask(coach, "S08", "invoices", "list_invoices")).data as Record<string, unknown>[];
  assertEquals(inv, [{ invoiceNumber: 1001, fullName: "נועה (test)", paymentType: "monthly", amount: 350, issuedAt: w.invs[0].issuedAt, isDemo: true }]);
  // One Audit trail: the screen's request, the gateway and the invoice share one requestID.
  const pays = w.audits.filter((a) => a.actionName === "pay_demo");
  const trail = w.audits.filter((a) => a.requestID === pays[0].requestID).map((a) => `${a.caller}>${a.moduleName}.${a.actionName}`);
  assertEquals(new Set(trail), new Set(["S19>payments.pay_demo", "M09>payment_gateway.charge", "M09>invoices.create_invoice"]));
});

Deno.test("UC2 b: paying a paid request is PAYMENT_ALREADY_PAID, with no charge and no second invoice", async () => {
  const w = world();
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  await w.pay(noa, id);
  assertEquals(await w.pay(noa, id), fail("PAYMENT_ALREADY_PAID"));
  assertEquals([w.charges.length, w.invs.length], [1, 1]);
});

Deno.test("module map v8: two payments at once make one invoice; the second answers PAYMENT_ALREADY_PAID", async () => {
  const w = world();
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  const both = await Promise.all([w.pay(noa, id), w.pay(noa, id)]);
  assertEquals(both.filter((r) => r.ok).length, 1);
  assertEquals(both.filter((r) => !r.ok).map((r) => r.error!.code), ["PAYMENT_ALREADY_PAID"]);
  assertEquals(w.invs.length, 1);
});

Deno.test("UC2 c and decision 6: a gateway that fails, or is not built yet, is PAYMENT_GATEWAY_UNAVAILABLE; open, no invoice", async () => {
  for (const g of [fail("UNEXPECTED_ERROR"), "missing"] as const) {
    const w = world({ gateway: g });
    await w.request(NOA);
    assertEquals(await w.pay(noa, w.requests[0].PaymentRequestID), fail("PAYMENT_GATEWAY_UNAVAILABLE"));
    assertEquals([w.requests[0].status, w.invs.length], ["open", 0]);
    // The inner code stays in the Audit of the inner request.
    const inner = w.audits.filter((a) => a.moduleName === "payment_gateway" && !a.isOk);
    assertEquals(inner.map((a) => a.errorCode), [g === "missing" ? "ACTION_NOT_ALLOWED" : "UNEXPECTED_ERROR"]);
  }
});

Deno.test("UC2 section 7: an invoice that could not be made leaves the request open; the next try pays with one invoice", async () => {
  const w = world({ invoiceDown: true });
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  assertEquals(await w.pay(noa, id), fail("STORAGE_UNAVAILABLE"));
  assertEquals([w.requests[0].status, w.invs.length], ["open", 0]);
});

Deno.test("module map v8: create_invoice returns the same number for the same request", async () => {
  const w = world();
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  const a = await w.ask(coach, "M09", "invoices", "create_invoice", { paymentRequestID: id, amount: 350 });
  const b = await w.ask(coach, "M09", "invoices", "create_invoice", { paymentRequestID: id, amount: 350 });
  assertEquals([a, b], [ok({ invoiceNumber: 1001 }), ok({ invoiceNumber: 1001 })]);
  assertEquals(w.invs.length, 1);
});

Deno.test("UC2 e and rule 5: paying a request of another trainee, or a coach paying, is refused with nothing charged", async () => {
  const w = world();
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  assertEquals(await w.pay(itai, id), fail("NOT_ALLOWED"));
  assertEquals(await w.pay(noa, U(999)), fail("NOT_ALLOWED"));
  assertEquals(await w.ask(coach, "S19", "payments", "pay_demo", { paymentRequestID: id }), fail("ACTION_NOT_ALLOWED"));
  assertEquals([w.charges.length, w.invs.length, w.requests[0].status], [0, 0, "open"]);
});

Deno.test("Registry: create_invoice and charge from a screen, or create_invoice from a module other than payments, are refused", async () => {
  const w = world();
  await w.request(NOA);
  const id = w.requests[0].PaymentRequestID;
  assertEquals(await w.ask(noa, "S19", "invoices", "create_invoice", { paymentRequestID: id, amount: 1 }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(await w.ask(noa, "S19", "payment_gateway", "charge", { paymentRequestID: id, amount: 1 }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(await w.ask(coach, "M13", "invoices", "create_invoice", { paymentRequestID: id, amount: 1 }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(w.invs.length, 0);
});

Deno.test("CLAUDE.md rule 12: no card field in any input or output of payments and invoices", async () => {
  const w = world();
  await w.request(NOA);
  await w.pay(noa, w.requests[0].PaymentRequestID);
  const seen = JSON.stringify([w.requests, w.invs, w.charges,
    (await w.ask(coach, "S08", "payments", "list_payments")).data, (await w.ask(noa, "S19", "invoices", "list_invoices")).data]);
  assert(!/card|cvv|expiry|כרטיס/i.test(seen), seen);
});

Deno.test("a database that falls returns STORAGE_UNAVAILABLE, and never throws", async () => {
  const w = world({ storageDown: true });
  assertEquals(await w.request(NOA), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await w.ask(coach, "S08", "payments", "list_payments"), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await w.ask(noa, "S19", "invoices", "list_invoices"), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await w.pay(noa, U(900)), fail("STORAGE_UNAVAILABLE"));
});
