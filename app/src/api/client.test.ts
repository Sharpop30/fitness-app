// Routing by caller (stage 3 plan, task 9; stage 4a plan, task 8; stage 4b plan, task 12; CLAUDE.md section 9, test 2):
// the screens in LIVE_SCREENS go to the one Endpoint once signed in with the identity service; every other screen stays
// on the demo adapter.
// Synthetic values, no network.
import { accessToken } from "../identity/auth";
import { call, LIVE_SCREENS, now, setAdapter, setErrorTexts, setSession, uploadFile, type Envelope } from "./client";

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

test("stage 4e puts all 27 screens on the Endpoint, the owner's S24 to S27 too", () => {
  expect([...LIVE_SCREENS].sort()).toEqual(Array.from({ length: 27 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`));
});

test("stage 4d: S01, S03, S08, S12 and S19, signed in, go to the Endpoint and declare themselves", async () => {
  const coach = await Promise.all([
    call("S01", "home", "get_coach_home"), call("S03", "trainees", "get_trainee_card", { traineeID: "x" }),
    call("S08", "payments", "list_payments"), call("S12", "settings", "update_settings", { values: {} }),
  ]);
  setSession({ role: "trainee", traineeID: null });
  const s19 = await call("S19", "payments", "pay_demo", { paymentRequestID: "x" });
  expect([...coach, s19].map((r) => r.data.envelope.caller)).toEqual(["S01", "S03", "S08", "S12", "S19"]);
  expect(s19.data.envelope).toEqual({ caller: "S19", module: "payments", action: "pay_demo", payload: { paymentRequestID: "x" }, lang: "he" });
  expect(demoSeen).toEqual([]);
});

test("stage 4c: S11, S13 and S17, signed in, go to the Endpoint and declare themselves", async () => {
  const s11 = await call("S11", "classes", "publish_class");
  setSession({ role: "trainee", traineeID: null });
  const s13 = await call("S13", "notifications", "list_notifications");
  const s17 = await call("S17", "classes", "register", { classID: "x" });
  expect([s11, s13, s17].map((r) => r.data.envelope.caller)).toEqual(["S11", "S13", "S17"]);
  expect(s17.data.envelope).toEqual({ caller: "S17", module: "classes", action: "register", payload: { classID: "x" }, lang: "he" });
  expect(demoSeen).toEqual([]);
});

test("decision 10: a live screen's clock is the real one; on demo data it is the demo's own day", () => {
  expect(Math.abs(now("S11").getTime() - Date.now())).toBeLessThan(1000);
  vi.mocked(accessToken).mockReturnValue(null);
  expect(now("S11").toLocaleDateString("en-CA")).toBe("2026-09-28");
});

test("stage 4b: the coach's and the trainee's screens, signed in, go to the Endpoint and declare themselves", async () => {
  const asked: [string, string, string][] = [
    ["S06", "feedback", "add_coach_note"], ["S07", "coins", "set_personal_goal"], ["S09", "challenges", "create_challenge"],
    ["S10", "coins", "manage_rewards"], ["S21", "progress", "get_progress_chart"],
  ];
  setSession({ role: "trainee", traineeID: null });
  asked.push(["S14", "results", "log_workout"], ["S16", "results", "correct_result"], ["S18", "coins", "redeem_reward"], ["S20", "challenges", "get_current_challenge"]);
  for (const [caller, module, action] of asked) {
    const r = await call(caller, module, action);
    expect(r.data.from).toBe("endpoint");
    expect(r.data.envelope).toEqual({ caller, module, action, payload: {}, lang: "he" });
  }
  expect(demoSeen).toEqual([]);
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

test("stage 5: S22 and S23, signed in, go to the Endpoint and declare themselves; S22 may ask before a session", async () => {
  const me = await call("S23", "trainees", "get_me");
  setSession(null);
  vi.mocked(accessToken).mockReturnValue("newcomer-token"); // signed up, not joined yet
  const join = await call("S22", "trainees", "accept_invite", { token: "t" });
  const texts = await call("S22", "settings", "get_error_texts");
  expect([me, join, texts].map((r) => r.data.envelope.caller)).toEqual(["S23", "S22", "S22"]);
  // With no session, every other screen is refused before the network.
  expect((await call("S04", "programs", "get_active_program")).error?.code).toBe("NOT_ALLOWED");
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(demoSeen).toEqual([]);
});

test("without the identity service, S22 and S23 stay on the demo adapter", async () => {
  vi.mocked(accessToken).mockReturnValue(null);
  setSession({ role: "coach", traineeID: null }); // a demo sign-in: no token when the session opens
  for (const caller of ["S22", "S23"]) expect((await call(caller, "settings", "get_error_texts")).data.from).toBe("demo");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("I04: a file goes straight to the upload address; a refusal or no network is UPLOAD_FAILED with its text", async () => {
  setErrorTexts({ UPLOAD_FAILED: "הסרטון לא עלה. נסה שוב" });
  const file = new Blob([new Uint8Array(4)], { type: "video/mp4" });
  fetchMock.mockResolvedValueOnce({ ok: true } as never);
  expect(await uploadFile("http://store.test/upload?token=t", file)).toEqual({ ok: true, data: null, error: null });
  expect(fetchMock.mock.calls[0][0]).toBe("http://store.test/upload?token=t");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
  fetchMock.mockResolvedValueOnce({ ok: false } as never);
  expect((await uploadFile("http://store.test/upload", file)).error).toEqual({ code: "UPLOAD_FAILED", message: "הסרטון לא עלה. נסה שוב" });
  fetchMock.mockRejectedValueOnce(new TypeError("network down"));
  expect((await uploadFile("http://store.test/upload", file)).error?.code).toBe("UPLOAD_FAILED");
});

test("S04 stays on the demo adapter with a demo sign-in, or with no Endpoint configured", async () => {
  vi.mocked(accessToken).mockReturnValue(null);
  setSession({ role: "coach", traineeID: null }); // a demo sign-in: no token when the session opens
  expect((await call("S04", "programs", "get_active_program")).data.from).toBe("demo");
  vi.mocked(accessToken).mockReturnValue("test-token");
  vi.stubEnv("VITE_API_URL", "");
  expect((await call("S04", "programs", "get_active_program")).data.from).toBe("demo");
  expect(fetchMock).not.toHaveBeenCalled();
});

// Found closing stage 4e, in the cloud: a sign-in lost after the session opened showed the demo data as the business's.
test("a session opened with the identity service whose sign-in is lost is NOT_ALLOWED, never the demo", async () => {
  setErrorTexts({ NOT_ALLOWED: "אין לך גישה לזה" });
  vi.mocked(accessToken).mockReturnValue(null); // the session of beforeEach opened with a token
  const r = await call("S24", "home", "get_owner_home");
  expect(r).toEqual({ ok: false, data: null, error: { code: "NOT_ALLOWED", message: "אין לך גישה לזה" } });
  expect(demoSeen).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await uploadFile("http://store.test/upload", new Blob([]))).error?.code).toBe("UPLOAD_FAILED");
});

test("an unreachable Endpoint is STORAGE_UNAVAILABLE, with the human text from ERROR_CODES", async () => {
  setErrorTexts({ STORAGE_UNAVAILABLE: "השינוי לא נשמר כרגע. נסה שוב" });
  fetchMock.mockRejectedValueOnce(new TypeError("network down"));
  const r = await call("S04", "programs", "save_program", {});
  expect(r).toEqual({ ok: false, data: null, error: { code: "STORAGE_UNAVAILABLE", message: "השינוי לא נשמר כרגע. נסה שוב" } });
});

test("a gateway answer that is not the Endpoint's reply (503 while the function is down) is STORAGE_UNAVAILABLE too", async () => {
  fetchMock.mockResolvedValueOnce({ json: async () => ({ message: "name resolution failed" }) } as any);
  const r = await call("S02", "trainees", "list_trainees");
  expect(r.ok).toBe(false);
  expect(r.error?.code).toBe("STORAGE_UNAVAILABLE");
});
