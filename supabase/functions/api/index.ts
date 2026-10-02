// C01 Endpoint: the single entry point. Every screen posts { caller, module, action, payload, lang }
// here and gets { ok, data, error } back, always as JSON.
import { audit } from "./audit.ts";
import { corsFor } from "./cors.ts";
import { type Envelope, fail, type Reply } from "./errors.ts";
import { handle, type Modules } from "./orchestrator.ts";
import { isScreenCaller } from "./registry.ts";
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
import { business } from "./modules/business.ts";
import { settings } from "./modules/settings.ts";
import { trainees } from "./modules/trainees.ts";

const modules: Modules = {
  business, challenges, classes, coins, exercises, feedback, home, invoices, notifications, payments, programs, progress, results, settings, trainees,
  // The interfaces (module map section 3), reached only by the modules the Registry names.
  payment_gateway, invite_channel,
};

const respond = (body: Reply, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });

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

// A newcomer: signed in, not yet an owner, a coach or a trainee. Only S22: joining by invite as a trainee (module map
// v9; stage 5 plan, decision 3) or as a coach (map v11), and the error texts, so a failed join reads as it should (v10).
const isJoining = (e: Envelope) => e.caller === "S22" &&
  ((e.module === "trainees" && e.action === "accept_invite") || (e.module === "business" && e.action === "accept_coach_invite") ||
    isVisiting(e));

// A visitor: not signed in. Only S22, to check the invite before signing up, and the error texts to say why not
// (map v13, "checking an invite before signing up"; usecase-04 v4, usecase-12 v3). Every other request is NOT_ALLOWED.
const isVisiting = (e: Envelope) => e.caller === "S22" &&
  ((e.module === "trainees" && e.action === "check_invite") || (e.module === "business" && e.action === "check_coach_invite") ||
    (e.module === "settings" && e.action === "get_error_texts"));

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"), Deno.env.get("SITE_URL")); // per request: never shared
  const reply = (body: Reply) => respond(body, cors);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let envelope: Envelope;
  try {
    envelope = await req.json();
  } catch {
    return reply(fail("CALLER_MISSING"));
  }

  const repo = createRepository();
  // Rejected before the Orchestrator, and still logged: request and reply share one requestID.
  // authUserID: the verified identity user, when the refusal comes after it is known (a user with no role here).
  const refuse = async (code: "NOT_ALLOWED" | "CALLER_INVALID", authUserID: string | null = null) => {
    const entry = { requestID: crypto.randomUUID(), caller: envelope.caller ?? "-", moduleName: envelope.module ?? "-", actionName: envelope.action ?? "-",
      authUserID, BusinessID: null };
    if (!(await audit(repo, { ...entry, isOk: true, errorCode: null }))) return reply(fail("AUDIT_FAILED"));
    await audit(repo, { ...entry, isOk: false, errorCode: code });
    return reply(fail(code));
  };
  try {
    // Only a screen calls from outside; a declared module or "system" would reach module-only actions (security
    // review 1, finding 1). A missing caller goes on, and the Orchestrator answers CALLER_MISSING.
    if (envelope.caller !== undefined && envelope.caller !== null && envelope.caller !== "" && !isScreenCaller(envelope.caller)) {
      return await refuse("CALLER_INVALID");
    }
    const user = await authUser(req);
    const known = user ? await repo.findActorByAuthUser(user.id) : null;
    const actor: Actor | null = known ? { ...known, authUserID: user!.id, email: user!.email }
      : user && isJoining(envelope) ? { role: "trainee", roles: ["trainee"], businessID: null, coachID: "", traineeID: null, authUserID: user.id, email: user.email }
      : !user && isVisiting(envelope) ? { role: "trainee", roles: ["trainee"], businessID: null, coachID: "", traineeID: null } // no identity user
      : null;
    if (!actor) return await refuse("NOT_ALLOWED", user?.id ?? null);
    return reply(await handle(envelope, actor, repo, modules));
  } catch (e) {
    return reply(fail(e instanceof StorageUnavailable ? "STORAGE_UNAVAILABLE" : "UNEXPECTED_ERROR"));
  }
});
