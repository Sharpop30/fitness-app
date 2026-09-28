// Routing by caller (stage 3 plan, task 9; stage 4a plan, task 8; CLAUDE.md section 9, test 2): S02, S04 and S05 go to
// the one Endpoint once signed in with the identity service; every other screen stays on the demo adapter.
// Synthetic values, no network.
import { accessToken } from "../identity/auth";
import { call, LIVE_SCREENS, setAdapter, setErrorTexts, setSession, type Envelope } from "./client";

vi.mock("../identity/auth", () => ({ accessToken: vi.fn(() => "test-token"), signOutIdentity: vi.fn() }));

const demoSeen: Envelope[] = [];
const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
  json: async () => ({ ok: true, data: { from: "endpoint", envelope: JSON.parse(String(init.body)) }, error: null }),
}));

beforeEach(() => {
  demoSeen.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_API_URL", "http://endpoint.test/api");
  vi.mocked(accessToken).mockReturnValue("test-token");
  setAdapter(async (e) => { demoSeen.push(e); return { ok: true, data: { from: "demo" }, error: null }; });
  setSession({ role: "coach", traineeID: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("stage 4a puts exactly S02, S04 and S05 on the Endpoint", () => {
  expect([...LIVE_SCREENS].sort()).toEqual(["S02", "S04", "S05"]);
});

test("S02 and S05, signed in, go to the Endpoint and declare themselves as the caller", async () => {
  const s02 = await call("S02", "trainees", "list_trainees");
  const s05 = await call("S05", "exercises", "attach_video", { exerciseID: "x", kind: "link", url: "u" });
  expect([s02.data.from, s05.data.from]).toEqual(["endpoint", "endpoint"]);
  expect(s02.data.envelope).toEqual({ caller: "S02", module: "trainees", action: "list_trainees", payload: {}, lang: "he" });
  expect(s05.data.envelope.caller).toBe("S05");
  expect(demoSeen).toEqual([]);
});

test("S04, signed in, goes to the Endpoint with the full envelope and the identity token", async () => {
  const r = await call("S04", "programs", "get_active_program", { traineeID: "x" });
  expect(r.data.from).toBe("endpoint");
  expect(r.data.envelope).toEqual({ caller: "S04", module: "programs", action: "get_active_program", payload: { traineeID: "x" }, lang: "he" });
  expect(fetchMock.mock.calls[0][0]).toBe("http://endpoint.test/api");
  expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  expect(demoSeen).toEqual([]);
});

test("every other screen stays on the demo adapter", async () => {
  for (const caller of ["S01", "S03", "S06", "S14", "S16", "S22", "S23"]) {
    expect((await call(caller, "programs", "get_active_program")).data.from).toBe("demo");
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test("S04 stays on the demo adapter with a demo sign-in, or with no Endpoint configured", async () => {
  vi.mocked(accessToken).mockReturnValue(null);
  expect((await call("S04", "programs", "get_active_program")).data.from).toBe("demo");
  vi.mocked(accessToken).mockReturnValue("test-token");
  vi.stubEnv("VITE_API_URL", "");
  expect((await call("S04", "programs", "get_active_program")).data.from).toBe("demo");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("an unreachable Endpoint is STORAGE_UNAVAILABLE, with the human text from ERROR_CODES", async () => {
  setErrorTexts({ STORAGE_UNAVAILABLE: "השינוי לא נשמר כרגע. נסה שוב" });
  fetchMock.mockRejectedValueOnce(new TypeError("network down"));
  const r = await call("S04", "programs", "save_program", {});
  expect(r).toEqual({ ok: false, data: null, error: { code: "STORAGE_UNAVAILABLE", message: "השינוי לא נשמר כרגע. נסה שוב" } });
});
