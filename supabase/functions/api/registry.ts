// C02 Registry: who may ask what of whom. The rows live in the registry_entries table,
// so adding a screen or a capability is a row, not a code change.
import type { Repository } from "./repository.ts";

// The closed list of callers (doc-module-map section 4): screens, modules, system.
const SCREENS = Array.from({ length: 23 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
const MODULES = Array.from({ length: 14 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
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
