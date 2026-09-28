// C01 Endpoint: the single entry point. Every screen posts { caller, module, action, payload, lang }
// here and gets { ok, data, error } back, always as JSON.
import { audit } from "./audit.ts";
import { type Envelope, fail, type Reply } from "./errors.ts";
import { handle, type Modules } from "./orchestrator.ts";
import { createRepository, StorageUnavailable } from "./repository.ts";
import { challenges } from "./modules/challenges.ts";
import { classes } from "./modules/classes.ts";
import { coins } from "./modules/coins.ts";
import { exercises } from "./modules/exercises.ts";
import { feedback } from "./modules/feedback.ts";
import { home } from "./modules/home.ts";
import { notifications } from "./modules/notifications.ts";
import { programs } from "./modules/programs.ts";
import { progress } from "./modules/progress.ts";
import { results } from "./modules/results.ts";
import { settings } from "./modules/settings.ts";
import { trainees } from "./modules/trainees.ts";

const modules: Modules = {
  challenges, classes, coins, exercises, feedback, home, notifications, programs, progress, results, settings, trainees,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: Reply) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });

// I01 Identity Connector, server side: ask the identity service who owns the token.
async function authUserID(req: Request): Promise<string | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.id === "string" ? user.id : null;
}

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
    const userID = await authUserID(req);
    const actor = userID ? await repo.findActorByAuthUser(userID) : null;
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
