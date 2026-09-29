// C01 Endpoint: the single entry point. Every screen posts { caller, module, action, payload, lang }
// here and gets { ok, data, error } back, always as JSON.
import { audit } from "./audit.ts";
import { type Envelope, fail, type Reply } from "./errors.ts";
import { handle, type Modules } from "./orchestrator.ts";
import { type Actor, createRepository, StorageUnavailable } from "./repository.ts";
import { invite_channel } from "./interfaces/invite_channel.ts";
import { payment_gateway } from "./interfaces/payment_gateway.ts";
import { challenges } from "./modules/challenges.ts";
import { classes } from "./modules/classes.ts";
import { coins } from "./modules/coins.ts";
import { exercises } from "./modules/exercises.ts";
import { feedback } from "./modules/feedback.ts";
import { home } from "./modules/home.ts";
import { invoices } from "./modules/invoices.ts";
import { notifications } from "./modules/notifications.ts";
import { payments } from "./modules/payments.ts";
import { programs } from "./modules/programs.ts";
import { progress } from "./modules/progress.ts";
import { results } from "./modules/results.ts";
import { settings } from "./modules/settings.ts";
import { trainees } from "./modules/trainees.ts";

const modules: Modules = {
  challenges, classes, coins, exercises, feedback, home, invoices, notifications, payments, programs, progress, results, settings, trainees,
  // The interfaces (module map section 3), reached only by the modules the Registry names.
  payment_gateway, invite_channel,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: Reply) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });

// I01 Identity Connector, server side: ask the identity service who owns the token.
async function authUser(req: Request): Promise<{ id: string; email: string } | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.id === "string" ? { id: user.id, email: typeof user.email === "string" ? user.email : "" } : null;
}

// A newcomer: signed in, not yet a coach or a trainee. Only S22 joining by invite (module map v9; stage 5 plan, decision 3).
const isJoining = (e: Envelope) => e.caller === "S22" && e.module === "trainees" && e.action === "accept_invite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let envelope: Envelope;
  try {
    envelope = await req.json();
  } catch {
    return reply(fail("CALLER_MISSING"));
  }

  const repo = createRepository();
  try {
    const user = await authUser(req);
    const known = user ? await repo.findActorByAuthUser(user.id) : null;
    const actor: Actor | null = known ? { ...known, authUserID: user!.id, email: user!.email }
      : user && isJoining(envelope) ? { role: "trainee", coachID: "", traineeID: null, authUserID: user.id, email: user.email }
      : null;
    if (!actor) {
      // Rejected before the Orchestrator, and still logged: request and reply share one requestID.
      const entry = { requestID: crypto.randomUUID(), caller: envelope.caller ?? "-", moduleName: envelope.module ?? "-", actionName: envelope.action ?? "-" };
      if (!(await audit(repo, { ...entry, isOk: true, errorCode: null }))) return reply(fail("AUDIT_FAILED"));
      await audit(repo, { ...entry, isOk: false, errorCode: "NOT_ALLOWED" });
      return reply(fail("NOT_ALLOWED"));
    }
    return reply(await handle(envelope, actor, repo, modules));
  } catch (e) {
    return reply(fail(e instanceof StorageUnavailable ? "STORAGE_UNAVAILABLE" : "UNEXPECTED_ERROR"));
  }
});
