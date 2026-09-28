// Unit tests for M14 settings, against an in-memory Repository (synthetic data), behind the Orchestrator.
// Sources: doc-module-map v8 section 4 (settings.update_settings, its contract); stage 4d plan, decision 4 and execution
// decision 5; usecase-02 step 1 and d; CLAUDE.md rule 8.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, StorageUnavailable } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2);
const coach: Actor = { role: "coach", coachID: COACH, traineeID: null };
const trainee: Actor = { role: "trainee", coachID: COACH, traineeID: U(11) };
const ROWS = new Set(["S12/get_settings/coach", "S12/update_settings/coach", "S06/get_settings/coach"]);

function world(opts: { storageDown?: boolean } = {}) {
  const store: Record<string, Record<string, string>> = {
    [COACH]: { priceMonthly: "350", coinsWorkout: "10", cancelHours: "24", feedbackFull: "כל הכבוד (test)", noteMaxLength: "280" },
    [OTHER_COACH]: { priceMonthly: "999" },
  };
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  let writes = 0;
  const w = fakeRepo({
    isRegistered: async (caller, _m, action, role) => ROWS.has(`${caller}/${action}/${role}`),
    getCoachSettings: async (c) => (down(), { ...store[c] }),
    updateCoachSettings: async (c, values) => { down(); writes++; Object.assign(store[c], values); },
  });
  const update = (values: unknown, actor: Actor = coach) =>
    handle({ caller: "S12", module: "settings", action: "update_settings", payload: { values } }, actor, w.repo, { settings });
  return { ...w, store, update, writes: () => writes };
}

Deno.test("update_settings: the coach changes values, get_settings reads them back, and a key not sent stays", async () => {
  const w = world();
  assertEquals(await w.update({ priceMonthly: " 400 ", coinsWorkout: 0, feedbackFull: "יפה מאוד (test)" }), ok(null));
  const r = await handle({ caller: "S12", module: "settings", action: "get_settings" }, coach, w.repo, { settings });
  assertEquals(r, ok({ priceMonthly: "400", coinsWorkout: "0", cancelHours: "24", feedbackFull: "יפה מאוד (test)", noteMaxLength: "280" }));
  assertEquals(w.store[OTHER_COACH], { priceMonthly: "999" });
});

Deno.test("decision 4: an empty value, or a number that is not valid for its key, is VALUE_NOT_SET and saves nothing", async () => {
  for (const values of [
    { priceMonthly: "0" }, { priceMonthly: "-5" }, { priceMonthly: "3.5" }, { cancelHours: "abc" }, { coinsWorkout: "-1" },
    { feedbackFull: "  " }, { priceMonthly: "400", noteMaxLength: "" }, { priceMonthly: null },
  ]) {
    const w = world();
    assertEquals(await w.update(values), fail("VALUE_NOT_SET"), JSON.stringify(values));
    assertEquals([w.writes(), w.store[COACH].priceMonthly], [0, "350"]);
  }
});

Deno.test("decision 4: a key the coach does not have is NOT_ALLOWED and saves nothing; values that are not a map are VALUE_NOT_SET", async () => {
  const w = world();
  assertEquals(await w.update({ priceMonthly: "400", priceYearly: "4000" }), fail("NOT_ALLOWED"));
  assertEquals(await w.update(["priceMonthly"]), fail("VALUE_NOT_SET"));
  assertEquals(await w.update("400"), fail("VALUE_NOT_SET"));
  assertEquals(w.writes(), 0);
});

Deno.test("rule 5 and the Registry: a trainee cannot change settings", async () => {
  const w = world();
  assertEquals(await w.update({ priceMonthly: "1" }, trainee), fail("ACTION_NOT_ALLOWED"));
  assertEquals(w.writes(), 0);
});

Deno.test("module map v8: S06 reads noteMaxLength from SETTINGS", async () => {
  const w = world();
  const r = await handle({ caller: "S06", module: "settings", action: "get_settings", payload: { key: "noteMaxLength" } }, coach, w.repo, { settings });
  assertEquals(r, ok({ noteMaxLength: "280" }));
});

Deno.test("a database that falls returns STORAGE_UNAVAILABLE, and never throws", async () => {
  assertEquals(await world({ storageDown: true }).update({ priceMonthly: "400" }), fail("STORAGE_UNAVAILABLE"));
});
