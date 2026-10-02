// C01 Orchestrator: the only gate to the modules. It checks the caller, the Registry,
// logs, routes to exactly one module, and holds no Business Logic (CLAUDE.md rules 1-4, 6).
import { audit } from "./audit.ts";
import { type Envelope, fail, type Reply } from "./errors.ts";
import { isAllowed, isKnownCaller, isModuleCaller, roleFor } from "./registry.ts";
import { type Actor, type Repository, StorageUnavailable } from "./repository.ts";

export interface ModuleContext {
  actor: Actor;
  repo: Repository;
  requestID: string;
  caller: string; // the screen or module that asked, already checked against the Registry
  // Module-to-module requests go back through the Orchestrator; modules never import each other.
  call: (envelope: Envelope) => Promise<Reply>;
}

export type Handler = (ctx: ModuleContext, payload: Record<string, unknown>) => Promise<Reply>;

export interface ModuleDef {
  id: string; // M01..M15, used as the caller when this module calls another
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
    audit(repo, { requestID, caller, moduleName, actionName, isOk, errorCode, authUserID: actor.authUserID ?? null, BusinessID: actor.businessID ?? null });

  // A request that could not be logged is not routed.
  if (!(await record(true, null))) return fail("AUDIT_FAILED");

  const reply = await route();
  await record(reply.ok, reply.error?.code ?? null);
  return reply;

  async function route(): Promise<Reply> {
    try {
      if (!envelope.caller) return fail("CALLER_MISSING");
      if (!isKnownCaller(envelope.caller)) return fail("CALLER_INVALID");
      // A module asks on behalf of the person, in the role of the original request. A screen's request takes the role
      // of its Registry row (map v11): as the owner, the module sees the business and no coach or trainee of its own,
      // so no path written for a coach reads a coach's data for the owner (rule 5).
      let acting = actor;
      if (isModuleCaller(envelope.caller)) {
        if (!(await isAllowed(repo, envelope.caller, moduleName, actionName, "module"))) return fail("ACTION_NOT_ALLOWED");
      } else {
        const role = await roleFor(repo, envelope.caller, moduleName, actionName, actor.roles?.length ? actor.roles : [actor.role]);
        if (!role) return fail("ACTION_NOT_ALLOWED");
        acting = role === "owner" ? { ...actor, role, coachID: "", traineeID: null } : { ...actor, role };
      }

      const handler = modules[moduleName]?.actions[actionName];
      if (!handler) return fail("ACTION_NOT_ALLOWED"); // registered, but not built yet

      const ctx: ModuleContext = {
        actor: acting,
        repo,
        requestID,
        caller: envelope.caller,
        call: (inner) => handle({ ...inner, caller: modules[moduleName].id }, acting, repo, modules, requestID),
      };
      return await handler(ctx, envelope.payload ?? {});
    } catch (e) {
      // A failing module returns an envelope; it never throws past the Orchestrator.
      return fail(e instanceof StorageUnavailable ? "STORAGE_UNAVAILABLE" : "UNEXPECTED_ERROR");
    }
  }
}
