// Unit tests for M14 settings, against an in-memory Repository (synthetic data), behind the Orchestrator.
// Sources: doc-module-map v8 section 4 (settings.update_settings, its contract); stage 4d plan, decision 4 and execution
// decision 5; usecase-02 step 1 and d; CLAUDE.md rule 8. Map v11 (stage 4e): SETTINGS of the business, changed by its
// owner only (rule 9; usecase-12 step 10 and alternative f). The business here is a coach's business of one.
import { assertEquals } from "jsr:@std/assert@1";
import { handle } from "../orchestrator.ts";
import { fail, ok } from "../errors.ts";
import { settings } from "../modules/settings.ts";
import { type Actor, StorageUnavailable } from "../repository.ts";
import { fakeRepo, U } from "./fake-repo.ts";

const COACH = U(1), OTHER_COACH = U(2);
const coach: Actor = { role: "coach", businessID: COACH, coachID: COACH, traineeID: null };
const trainee: Actor = { role: "trainee", businessID: COACH, coachID: COACH, traineeID: U(11) };
const owner: Actor = { role: "owner", roles: ["owner", "coach"], businessID: COACH, coachID: COACH, traineeID: null };
// The coach's update_settings row is out of use (0014); the owner has both rows.
// Map v12: S12 is the owner's only; the coach's rows are out of use (0014, 0015).
// Map v13: S05, S07, S08 and S11 read the keys they show.
const ROWS = new Set(["S12/get_settings/owner", "S12/update_settings/owner", "S06/get_settings/coach",
  "S22/get_error_texts/trainee", "S05/get_settings/coach", "S07/get_settings/coach", "S08/get_settings/coach",
  "S11/get_settings/coach"]);

function world(opts: { storageDown?: boolean } = {}) {
  const store: Record<string, Record<string, string>> = {
    [COACH]: { priceMonthly: "350", coinsWorkout: "10", cancelHours: "24", feedbackFull: "כל הכבוד (test)", noteMaxLength: "280" },
    [OTHER_COACH]: { priceMonthly: "999" },
  };
  const down = () => { if (opts.storageDown) throw new StorageUnavailable("db down"); };
  let writes = 0;
  const w = fakeRepo({
    isRegistered: async (caller, _m, action, role) => ROWS.has(`${caller}/${action}/${role}`),
    getBusinessSettings: async (c) => (down(), { ...store[c] }),
    updateBusinessSettings: async (c, values) => { down(); writes++; Object.assign(store[c], values); },
  });
  const update = (values: unknown, actor: Actor = owner) =>
    handle({ caller: "S12", module: "settings", action: "update_settings", payload: { values } }, actor, w.repo, { settings });
  return { ...w, store, update, writes: () => writes };
}

Deno.test("update_settings: the owner changes values and reads them back with canEdit; a coach does not open S12", async () => {
  const w = world();
  assertEquals(await w.update({ priceMonthly: " 400 ", coinsWorkout: 0, feedbackFull: "יפה מאוד (test)" }), ok(null));
  const values = { priceMonthly: "400", coinsWorkout: "0", cancelHours: "24", feedbackFull: "יפה מאוד (test)", noteMaxLength: "280" };
  const read = (actor: Actor) => handle({ caller: "S12", module: "settings", action: "get_settings" }, actor, w.repo, { settings });
  assertEquals(await read({ ...coach, roles: ["coach"] }), fail("ACTION_NOT_ALLOWED"));
  assertEquals(await read(owner), ok({ ...values, canEdit: true }));
  assertEquals(w.store[OTHER_COACH], { priceMonthly: "999" });
});

Deno.test("UC12 f: a coach cannot change settings (no Registry row), and nothing is written", async () => {
  const w = world();
  assertEquals(await w.update({ priceMonthly: "1" }, coach), fail("ACTION_NOT_ALLOWED"));
  assertEquals(w.writes(), 0);
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

Deno.test("map v13, rule 9: a coach's screen gets only the keys it shows, and only those", async () => {
  const w = world();
  const read = (caller: string, payload: Record<string, unknown>) =>
    handle({ caller, module: "settings", action: "get_settings", payload }, coach, w.repo, { settings });
  assertEquals(await read("S08", { keys: ["priceMonthly"] }), ok({ priceMonthly: "350" }));
  assertEquals(await read("S06", { keys: ["noteMaxLength"] }), ok({ noteMaxLength: "280" }));
  // Another screen's key, a key no screen shows, or no key at all: the coach does not see the table.
  assertEquals(await read("S05", { keys: ["priceMonthly"] }), fail("NOT_ALLOWED"));
  assertEquals(await read("S08", { keys: ["priceMonthly", "cancelHours"] }), fail("NOT_ALLOWED"));
  assertEquals(await read("S08", {}), fail("NOT_ALLOWED"));
  assertEquals(await read("S06", {}), fail("NOT_ALLOWED"));
  // A key of the screen that is not set yet is "not yet", never an invented value (rule 8).
  assertEquals(await read("S11", { keys: ["coinsAttendance"] }), fail("VALUE_NOT_SET"));
  assertEquals(await read("S08", { keys: ["priceMonthly", "pricePack10"] }), fail("VALUE_NOT_SET"));
});

Deno.test("map v13: the owner, and the modules on a coach's behalf, still read the whole table", async () => {
  const w = world();
  const r = await handle({ caller: "S12", module: "settings", action: "get_settings" }, owner, w.repo, { settings });
  assertEquals((r.data as Record<string, unknown>).cancelHours, "24");
  const m = await settings.actions.get_settings({ actor: coach, repo: w.repo, requestID: "r", caller: "M07", call: async () => ok(null) }, {});
  assertEquals((m.data as Record<string, unknown>).cancelHours, "24");
});

Deno.test("a database that falls returns STORAGE_UNAVAILABLE, and never throws", async () => {
  assertEquals(await world({ storageDown: true }).update({ priceMonthly: "400" }), fail("STORAGE_UNAVAILABLE"));
});

// ---- get_error_texts (module map v3 and v10; stage 5) ----

Deno.test("get_error_texts: every code with its text for people, as ERROR_CODES holds it", async () => {
  const { repo } = fakeRepo({ listErrorTexts: async () => ({ INVITE_EXPIRED: "ההזמנה כבר לא בתוקף. בקש חדשה" }) });
  const newcomer: Actor = { role: "trainee", coachID: "", traineeID: null, authUserID: U(90), email: "x@example.com" };
  const r = await handle({ caller: "S22", module: "settings", action: "get_error_texts" }, newcomer, repo, { settings });
  assertEquals(r, ok({ INVITE_EXPIRED: "ההזמנה כבר לא בתוקף. בקש חדשה" }));
});

Deno.test("stage 5: videoMaxMegabytes is a positive whole number", async () => {
  const w = world();
  w.store[COACH].videoMaxMegabytes = "50";
  for (const bad of ["0", "ten", "1.5"]) assertEquals((await w.update({ videoMaxMegabytes: bad })).error?.code, "VALUE_NOT_SET");
  assertEquals(await w.update({ videoMaxMegabytes: "80" }), ok(null));
  assertEquals(w.store[COACH].videoMaxMegabytes, "80");
});
