// I01 Identity Connector, browser side (CLAUDE.md section 5). It talks to the identity service alone, never to the
// database, and no screen talks to the identity service but through it. Stage 3 built signing in by email and password;
// stage 5 builds signing up, the sign-in the invite email brings, setting a password, keeping the sign-in across visits
// and renewing it (stage 5 plan, task 6, decision 6). Replacing the identity service replaces this file only.
// The access token lives in memory; the refresh token in this browser's storage, so a visit after reload stays signed in.
// Signing out forgets both.

// ok: signed in. wrong: the service said no (a wrong password, an address already in use). unavailable: no answer (UC4 s.7).
// "weak": a password the identity service refuses by its policy, 8 characters with letters and digits (stage 7 plan, task 12).
export type Outcome = "ok" | "wrong" | "weak" | "unavailable";

// The policy, as the identity service holds it (config.toml locally; the dashboard in the cloud), so the screen can say it first.
// "letters_digits" counts English letters only: a password of Hebrew letters and digits is refused (checked, 02.10.2026).
export const PASSWORD_RULE = "לפחות 8 תווים, עם אותיות באנגלית וספרות.";
export const passwordOK = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

interface Tokens { access_token: string; refresh_token: string; expires_in: number }

const KEY = "fitness-app.identity";
const EARLY_MS = 60_000; // renew a minute before the access token runs out

let token: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const env = () => ({ url: import.meta.env.VITE_SUPABASE_URL as string | undefined, key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined });

export const identityConfigured = () => !!(env().url && env().key);

// Browser storage can be missing or refuse (a private window); the sign-in then lasts for this visit only.
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* this visit only */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* nothing kept */ } },
};

function keep(t: Tokens) {
  token = t.access_token;
  store.set(t.refresh_token);
  clearTimeout(timer);
  timer = setTimeout(() => { void renew(); }, Math.max(t.expires_in * 1000 - EARLY_MS, 5_000));
}

async function ask(path: string, init: { method: string; body?: unknown; bearer?: string }): Promise<{ status: number; body: any } | null> {
  const { url, key } = env();
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/${path}`, {
      method: init.method,
      headers: { apikey: key, "Content-Type": "application/json", ...(init.bearer ? { Authorization: `Bearer ${init.bearer}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return null;
  }
}

const session = (r: { status: number; body: any } | null): Outcome => {
  if (!r) return "unavailable";
  if (r.status >= 500) return "unavailable";
  if (r.status < 300 && typeof r.body?.access_token === "string") { keep(r.body); return "ok"; }
  return r.body?.error_code === "weak_password" ? "weak" : "wrong";
};

export async function signInWithPassword(email: string, password: string): Promise<Outcome> {
  return session(await ask("token?grant_type=password", { method: "POST", body: { email, password } }));
}

// S22, joining by a shared link (UC4 step 4). A sign-up that needs an email confirmation first has no session: "wrong".
export async function signUp(email: string, password: string): Promise<Outcome> {
  return session(await ask("signup", { method: "POST", body: { email, password } }));
}

// S22, joining from the invite email: the password of the user the email signed in.
export async function setPassword(password: string): Promise<Outcome> {
  if (!token) return "wrong";
  const r = await ask("user", { method: "PUT", body: { password }, bearer: token });
  return !r || r.status >= 500 ? "unavailable" : r.status < 300 ? "ok" : r.body?.error_code === "weak_password" ? "weak" : "wrong";
}

// Password reset from S23 (design review, finding 24; map v13, I01; stage 7 plan, task 14). The service mails a link
// that returns here signed in, with "type=recovery" after the #. Any answer but an outage is "ok", and the screen says
// "if the email is registered": the reply never tells whether an address has a user.
export async function requestPasswordReset(email: string): Promise<Outcome> {
  const back = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const r = await ask(`recover?redirect_to=${encodeURIComponent(back)}`, { method: "POST", body: { email } });
  return !r || r.status >= 500 || r.status === 429 ? "unavailable" : "ok";
}

// The reset link brought the person back: S23 asks for the new password before anything else.
export const isRecoveryReturn = () => new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

// The invite email returns to the site signed in, with the tokens after the # (stage 5 plan, decision 2). Takes them, and
// clears them from the address bar. True when there was a sign-in there.
export function takeSessionFromAddress(): boolean {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const access = hash.get("access_token"), refresh = hash.get("refresh_token");
  if (!access || !refresh) return false;
  keep({ access_token: access, refresh_token: refresh, expires_in: Number(hash.get("expires_in")) || 3600 });
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

// A new access token from the kept refresh token. "wrong" forgets a refresh token the service no longer accepts.
export async function renew(): Promise<Outcome> {
  const refresh = store.get();
  if (!refresh) return "wrong";
  const outcome = session(await ask("token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refresh } }));
  if (outcome === "wrong") signOutIdentity();
  return outcome;
}

// On opening the site: signed in already, from the last visit? (decision 6)
export const restoreSession = (): Promise<Outcome> => (store.get() ? renew() : Promise.resolve("wrong"));

export const accessToken = () => token;

export function signOutIdentity() {
  const was = token;
  token = null;
  clearTimeout(timer);
  store.clear();
  if (was) void ask("logout", { method: "POST", bearer: was }); // the service forgets it too; best effort
}
