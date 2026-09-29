// I01 Identity Connector, browser side, against its contract (stage 5 plan, task 6, decision 6; UC4 step 4, section 7).
// Synthetic values, no network: the identity service is a stand-in.
import { accessToken, renew, restoreSession, setPassword, signInWithPassword, signOutIdentity, signUp, takeSessionFromAddress } from "./auth";

const KEY = "fitness-app.identity";
const tokens = (n: number) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 3600 });
const answer = (status: number, body: unknown) => ({ status, json: async () => body });
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://identity.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "browser-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  signOutIdentity();
  fetchMock.mockReset();
  localStorage.clear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

test("signing in keeps the access token in memory and the refresh token in the browser", async () => {
  fetchMock.mockResolvedValueOnce(answer(200, tokens(1)));
  expect(await signInWithPassword("coach@example.com", "pw")).toBe("ok");
  expect(accessToken()).toBe("access-1");
  expect(localStorage.getItem(KEY)).toBe("refresh-1");
  expect(fetchMock.mock.calls[0][0]).toBe("http://identity.test/auth/v1/token?grant_type=password");
});

test("a wrong password is 'wrong'; no answer, or the service failing, is 'unavailable' (UC4 section 7); nothing is kept", async () => {
  fetchMock.mockResolvedValueOnce(answer(400, { error: "invalid_grant" }));
  expect(await signInWithPassword("x@example.com", "bad")).toBe("wrong");
  fetchMock.mockRejectedValueOnce(new TypeError("network down"));
  expect(await signInWithPassword("x@example.com", "pw")).toBe("unavailable");
  fetchMock.mockResolvedValueOnce(answer(503, null));
  expect(await signUp("x@example.com", "pw")).toBe("unavailable");
  expect([accessToken(), localStorage.getItem(KEY)]).toEqual([null, null]);
});

test("decision 6: a visit after reload is signed in again from the kept refresh token, and the token is renewed before it runs out", async () => {
  localStorage.setItem(KEY, "refresh-1");
  fetchMock.mockResolvedValueOnce(answer(200, { ...tokens(2), expires_in: 120 }));
  vi.useFakeTimers();
  expect(await restoreSession()).toBe("ok");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh_token: "refresh-1" });
  expect(accessToken()).toBe("access-2");
  fetchMock.mockResolvedValueOnce(answer(200, tokens(3)));
  await vi.advanceTimersByTimeAsync(60_000); // a minute before the two minutes run out
  expect(accessToken()).toBe("access-3");
  expect(localStorage.getItem(KEY)).toBe("refresh-3");
});

test("a refresh token the service no longer takes is forgotten; with none kept there is nothing to restore", async () => {
  expect(await restoreSession()).toBe("wrong");
  expect(fetchMock).not.toHaveBeenCalled();
  localStorage.setItem(KEY, "refresh-old");
  fetchMock.mockResolvedValue(answer(400, { error: "invalid_grant" }));
  expect(await renew()).toBe("wrong");
  expect(localStorage.getItem(KEY)).toBe(null);
});

test("signing out forgets both tokens and tells the service", async () => {
  fetchMock.mockResolvedValue(answer(200, tokens(1)));
  await signInWithPassword("coach@example.com", "pw");
  signOutIdentity();
  expect([accessToken(), localStorage.getItem(KEY)]).toEqual([null, null]);
  expect(fetchMock.mock.calls.at(-1)![0]).toBe("http://identity.test/auth/v1/logout");
});

test("UC4 step 4: the invite email returns signed in; the tokens are taken and cleared from the address, then a password is set", async () => {
  history.replaceState(null, "", "/fitness-app/?join=abc#access_token=access-9&refresh_token=refresh-9&expires_in=3600&type=invite");
  expect(takeSessionFromAddress()).toBe(true);
  expect(accessToken()).toBe("access-9");
  expect(window.location.hash).toBe("");
  expect(window.location.search).toBe("?join=abc");
  fetchMock.mockResolvedValueOnce(answer(200, { id: "u" }));
  expect(await setPassword("new-pw")).toBe("ok");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT" });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer access-9");
  expect(takeSessionFromAddress()).toBe(false);
});

test("signing up a new address signs in at once (email confirmation off, stage 5 plan, decision 10)", async () => {
  fetchMock.mockResolvedValueOnce(answer(200, tokens(4)));
  expect(await signUp("new@example.com", "pw")).toBe("ok");
  expect(fetchMock.mock.calls[0][0]).toBe("http://identity.test/auth/v1/signup");
  // With confirmation on there is no session in the answer: not signed in.
  signOutIdentity();
  fetchMock.mockResolvedValueOnce(answer(200, { id: "u", email: "new@example.com" }));
  expect(await signUp("new2@example.com", "pw")).toBe("wrong");
  expect(accessToken()).toBe(null);
});
