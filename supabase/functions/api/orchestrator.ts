// C01 Orchestrator: the only gate to the modules. It checks the caller, the Registry,
// logs, routes to exactly one module, and holds no Business Logic (CLAUDE.md rules 1-4, 6).
import { audit } from "./audit.ts";
import { type Envelope, fail, type Reply } from "./errors.ts";
import { isAllowed, isKnownCaller, isModuleCaller } from "./registry.ts";
import type { Actor, Repository } from "./repository.ts";

export interface ModuleContext {
  actor: Actor;
  repo: Repository;
  requestID: string;
  // Module-to-module requests go back through the Orchestrator; modules never import each other.
  call: (envelope: Envelope) => Promise<Reply>;
}

export type Handler = (ctx: ModuleContext, payload: Record<string, unknown>) => Promise<Reply>;

export interface ModuleDef {
  id: string; // M01..M14, used as the caller when this module calls another
  actions: Record<string, Handler>;
}

export type Modules = Record<string, ModuleDef>;

export async function handle(
  envelope: Envelope,
  actor: Actor,
  repo: Repository,
  modules: Modules,
  requestID: string = crypto.randomUUID(),
): Promise<Reply> {
  const caller = envelope.caller ?? "-";
  const moduleName = envelope.module ?? "-";
  const actionName = envelope.action ?? "-";
  const record = (isOk: boolean, errorCode: string | null) =>
    audit(repo, { requestID, caller, moduleName, actionName, isOk, errorCode });

  // A request that could not be logged is not routed.
  if (!(await record(true, null))) return fail("AUDIT_FAILED");

  const reply = await route();
  await record(reply.ok, reply.error?.code ?? null);
  return reply;

  async function route(): Promise<Reply> {
    try {
      if (!envelope.caller) return fail("CALLER_MISSING");
      if (!isKnownCaller(envelope.caller)) return fail("CALLER_INVALID");
      const role = isModuleCaller(envelope.caller) ? "module" : actor.role;
      if (!(await isAllowed(repo, envelope.caller, moduleName, actionName, role))) return fail("ACTION_NOT_ALLOWED");

      const handler = modules[moduleName]?.actions[actionName];
      if (!handler) return fail("ACTION_NOT_ALLOWED"); // registered, but not built yet

      const ctx: ModuleContext = {
        actor,
        repo,
        requestID,
        call: (inner) => handle({ ...inner, caller: modules[moduleName].id }, actor, repo, modules, requestID),
      };
      return await handler(ctx, envelope.payload ?? {});
    } catch {
      // A failing module returns an envelope; it never throws past the Orchestrator.
      // Every unexpected failure maps to STORAGE_UNAVAILABLE until the map defines a general code (stage 1 gap 1).
      return fail("STORAGE_UNAVAILABLE");
    }
  }
}
