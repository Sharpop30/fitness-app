// C02 Registry: who may ask what of whom. The rows live in the registry_entries table,
// so adding a screen or a capability is a row, not a code change.
import type { Repository, Role } from "./repository.ts";

// The closed list of callers (doc-module-map section 4, v11): screens S01-S27, modules M01-M15, system.
const SCREENS = Array.from({ length: 27 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
const MODULES = Array.from({ length: 15 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
export const CALLERS = new Set<string>([...SCREENS, ...MODULES, "system"]);

export const isModuleCaller = (caller: string) => caller.startsWith("M");

// From outside, only a screen may be the caller. A module is the caller only inside the Orchestrator (ctx.call), so a
// request that declares a module or "system" is refused (security review 1, finding 1).
const SCREEN_SET = new Set(SCREENS);
export const isScreenCaller = (caller: unknown) => typeof caller === "string" && SCREEN_SET.has(caller);

export function isKnownCaller(caller: string): boolean {
  return CALLERS.has(caller);
}

export function isAllowed(repo: Repository, caller: string, moduleName: string, actionName: string, role: string) {
  return repo.isRegistered(caller, moduleName, actionName, role);
}

// The role of a screen's request (map v11, "the role"): the first of the person's roles, owner, coach, trainee, that has
// a row for this caller, module and action. Null: no row for any of them.
export async function roleFor(repo: Repository, caller: string, moduleName: string, actionName: string, roles: Role[]) {
  for (const role of roles) if (await isAllowed(repo, caller, moduleName, actionName, role)) return role;
  return null;
}
