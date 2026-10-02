// I01 Identity Connector, browser side, against its contract (stage 5 plan, task 6, decision 6; UC4 step 4, section 7).
// Synthetic values, no network: the identity service is a stand-in.
import { accessToken, ensureFresh, renew, RENEW_RETRY_MS, restoreSession, setPassword, signInWithPassword, signOutIdentity, signUp, takeSessionFromAddress } from "./auth";

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

// Code review in 7c, finding 3: the network drops while the token is renewed.
test("a renewal with no answer keeps the sign-in and is tried again, and the token is renewed once the network is back", async () => {
  localStorage.setItem(KEY, "refresh-1");
  fetchMock.mockResolvedValueOnce(answer(200, { ...tokens(2), expires_in: 120 }));
  vi.useFakeTimers();
  expect(await restoreSession()).toBe("ok");
  fetchMock.mockRejectedValueOnce(new TypeError("network down"));
  await vi.advanceTimersByTimeAsync(60_000); // the timed renewal finds no network
  expect([accessToken(), localStorage.getItem(KEY)]).toEqual(["access-2", "refresh-2"]); // still signed in
  fetchMock.mockResolvedValueOnce(answer(200, tokens(3)));
  await vi.advanceTimersByTimeAsync(RENEW_RETRY_MS); // tried again
  expect(accessToken()).toBe("access-3");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("before a request, and when the network comes back, a token about to run out is renewed once; a fresh one is left alone", async () => {
  localStorage.setItem(KEY, "refresh-1");
  fetchMock.mockResolvedValueOnce(answer(200, tokens(2)));
  expect(await restoreSession()).toBe("ok");
  await ensureFresh(); // an hour left: nothing to do
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // The phone held the timer back: the token is about to run out when the site comes back.
  fetchMock.mockResolvedValueOnce(answer(200, { ...tokens(3), expires_in: 30 }));
  localStorage.setItem(KEY, "refresh-2");
  expect(await renew()).toBe("ok"); // now 30 seconds left, under the minute
  fetchMock.mockResolvedValue(answer(200, tokens(4)));
  window.dispatchEvent(new Event("online"));
  await Promise.all([ensureFresh(), ensureFresh()]); // and a request at the same moment: one renewal, not three
  expect(accessToken()).toBe("access-4");
  expect(fetchMock).toHaveBeenCalledTimes(3);
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

// Stage 7 plan, task 12 (security review 1, finding 5): the screen says the policy before sending, as the service holds it.
test("the password policy: 8 characters or more, with a letter and a digit", async () => {
  const { passwordOK } = await import("./auth");
  for (const ok of ["abcd1234", "A1b2C3d4", "סיסמה12a"]) expect(passwordOK(ok)).toBe(true);
  // Hebrew letters are not letters to the identity service ("letters_digits" is English letters).
  for (const weak of ["abc123", "abcdefgh", "12345678", "סיסמה12345", ""]) expect(passwordOK(weak)).toBe(false);
});
