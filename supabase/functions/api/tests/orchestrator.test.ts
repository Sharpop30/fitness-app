// Unit tests for C01-C03 against an in-memory Repository (synthetic data, no database).
// Sources: CLAUDE.md rules 2, 3, 4, 6; doc-module-map section 4.
import { assertEquals } from "jsr:@std/assert@1";
import { handle, type Modules } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { type Actor, type AuditRecord, type Repository, StorageUnavailable } from "../repository.ts";

const coach: Actor = { role: "coach", coachID: "coach-1", traineeID: null };

// The training operations are not reached by these tests.
const notUsed = () => Promise.reject(new Error("not used in orchestrator tests"));
const trainingNotUsed = {
  isActiveTraineeOfCoach: notUsed, listExercisesForCoach: notUsed, getActiveProgram: notUsed, listInactivePrograms: notUsed,
  saveProgram: notUsed, swapExercise: notUsed, startNewProgram: notUsed,
  listTraineesForCoach: notUsed, createInvite: notUsed, createExercise: notUsed, getExerciseInReach: notUsed, attachVideo: notUsed,
  logWorkout: notUsed, getWorkoutLog: notUsed, correctResults: notUsed, listResults: notUsed,
};

function fakeRepo(opts: { rows?: string[]; auditFails?: boolean } = {}) {
  const audits: AuditRecord[] = [];
  const rows = new Set(opts.rows ?? []);
  const repo: Repository = {
    ...trainingNotUsed,
    findActorByAuthUser: () => Promise.resolve(coach),
    isRegistered: (c, m, a, r) => Promise.resolve(rows.has(`${c}|${m}|${a}|${r}`)),
    writeAudit: (e) => {
      if (opts.auditFails) return Promise.reject(new Error("audit down"));
      audits.push(e);
      return Promise.resolve();
    },
    getCoachSettings: () => Promise.resolve({ cancelHours: "24" }),
  };

  return { repo, audits };
}

const modules: Modules = {
  settings: { id: "M14", actions: { get_settings: () => Promise.resolve(ok({ cancelHours: "24" })) } },
  boom: {
    id: "M99",
    actions: {
      storage: () => Promise.reject(new StorageUnavailable("db down")),
      other: () => Promise.reject(new Error("bug")),
    },
  },
  results: {
    id: "M04",
    actions: { relay: (ctx) => ctx.call({ module: "settings", action: "get_settings" }) },
  },
};

Deno.test("allowed request is routed and leaves two audit rows with one requestID", async () => {
  const { repo, audits } = fakeRepo({ rows: ["S12|settings|get_settings|coach"] });
  const r = await handle({ caller: "S12", module: "settings", action: "get_settings" }, coach, repo, modules);
  assertEquals(r, ok({ cancelHours: "24" }));
  assertEquals(audits.length, 2);
  assertEquals(audits[0].requestID, audits[1].requestID);
  assertEquals(audits[1].isOk, true);
});

Deno.test("check order: missing caller, then invalid caller, then Registry", async () => {
  const { repo } = fakeRepo();
  assertEquals(await handle({ module: "settings", action: "get_settings" }, coach, repo, modules), fail("CALLER_MISSING"));
  assertEquals(await handle({ caller: "X1", module: "settings", action: "get_settings" }, coach, repo, modules), fail("CALLER_INVALID"));
  assertEquals(await handle({ caller: "S12", module: "settings", action: "get_settings" }, coach, repo, modules), fail("ACTION_NOT_ALLOWED"));
});

Deno.test("a request that cannot be logged is not routed: AUDIT_FAILED", async () => {
  let routed = false;
  const spy: Modules = { settings: { id: "M14", actions: { get_settings: () => { routed = true; return Promise.resolve(ok(null)); } } } };
  const { repo } = fakeRepo({ rows: ["S12|settings|get_settings|coach"], auditFails: true });
  const r = await handle({ caller: "S12", module: "settings", action: "get_settings" }, coach, repo, spy);
  assertEquals(r, fail("AUDIT_FAILED"));
  assertEquals(routed, false);
});

Deno.test("a failing module returns an envelope and never throws", async () => {
  const { repo } = fakeRepo({ rows: ["S12|boom|storage|coach", "S12|boom|other|coach"] });
  assertEquals(await handle({ caller: "S12", module: "boom", action: "storage" }, coach, repo, modules), fail("STORAGE_UNAVAILABLE"));
  assertEquals(await handle({ caller: "S12", module: "boom", action: "other" }, coach, repo, modules), fail("UNEXPECTED_ERROR"));
});

Deno.test("module-to-module goes through the Orchestrator, declaring the module as caller", async () => {
  const { repo, audits } = fakeRepo({ rows: ["S14|results|relay|coach", "M04|settings|get_settings|module"] });
  const r = await handle({ caller: "S14", module: "results", action: "relay" }, coach, repo, modules);
  assertEquals(r.ok, true);
  assertEquals(audits.some((a) => a.caller === "M04" && a.moduleName === "settings"), true);
  // and without its own Registry row, the inner call is refused
  const { repo: repo2 } = fakeRepo({ rows: ["S14|results|relay|coach"] });
  assertEquals(await handle({ caller: "S14", module: "results", action: "relay" }, coach, repo2, modules), fail("ACTION_NOT_ALLOWED"));
});

Deno.test("registered but not yet built is refused, not crashed", async () => {
  const { repo } = fakeRepo({ rows: ["S02|trainees|list_trainees|coach"] });
  assertEquals(await handle({ caller: "S02", module: "trainees", action: "list_trainees" }, coach, repo, modules), fail("ACTION_NOT_ALLOWED"));
});
