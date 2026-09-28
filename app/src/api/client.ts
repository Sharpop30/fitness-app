// The only file in the app that talks to the server (CLAUDE.md section 5, structural test 2).
// Every screen calls call("Sxx", module, action, payload): the caller is the screen itself.
// Screens in LIVE_SCREENS go to the one Endpoint once the person signed in with the identity service; every other
// screen stays on the demo adapter until its stage. Adding a screen is a line here, and the screen does not change.
import { demoAdapter } from "../demo/adapter";
import { accessToken, signOutIdentity } from "../identity/auth";

// Stage 3: the first slice, S04 against programs (doc-module-map section 7).
// Stage 4a: S02 and S05, whose actions are all built (stage 4a plan, decision 2). S03, S06, S14, S16 and S22 wait
// for actions of later stages, so they stay on the demo adapter rather than show half the truth.
export const LIVE_SCREENS = new Set(["S02", "S04", "S05"]);

export interface Envelope {
  caller: string;
  module: string;
  action: string;
  payload: Record<string, unknown>;
  lang: "he";
}

export interface ReplyError {
  code: string;
  message: string; // the human text from ERROR_CODES
}

export interface Reply<T = any> {
  ok: boolean;
  data: T | null;
  error: ReplyError | null;
}

export interface Session {
  role: "coach" | "trainee";
  traineeID: string | null;
}

export type Adapter = (envelope: Envelope, session: Session) => Promise<Reply>;

let adapter: Adapter = demoAdapter;
let session: Session | null = null;
// The human text of every error code (ERROR_CODES), loaded once by S23 after sign-in (module map v3).
let errorTexts: Record<string, string> = {};

export function setErrorTexts(texts: Record<string, string>) {
  errorTexts = texts;
}

export function setSession(s: Session | null) {
  session = s;
  if (!s) signOutIdentity();
}

export function setAdapter(a: Adapter) {
  adapter = a;
}

// The Endpoint. Any failure to reach it is STORAGE_UNAVAILABLE: the change stays on the screen for a retry (UC1 c).
export const endpointAdapter: Adapter = async (envelope) => {
  try {
    const res = await fetch(import.meta.env.VITE_API_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken()}` },
      body: JSON.stringify(envelope),
    });
    return await res.json();
  } catch {
    return { ok: false, data: null, error: { code: "STORAGE_UNAVAILABLE", message: "" } };
  }
};

const isLive = (caller: string) => LIVE_SCREENS.has(caller) && !!import.meta.env.VITE_API_URL && accessToken() !== null;

export function call<T = any>(caller: string, module: string, action: string, payload: Record<string, unknown> = {}): Promise<Reply<T>> {
  if (!session && !(module === "trainees" && action === "accept_invite")) {
    return Promise.resolve({ ok: false, data: null, error: { code: "NOT_ALLOWED", message: "אין לך גישה לזה" } });
  }
  return (isLive(caller) ? endpointAdapter : adapter)({ caller, module, action, payload, lang: "he" }, session ?? { role: "trainee", traineeID: null }).then((r) =>
    r.error && !r.error.message ? { ...r, error: { ...r.error, message: errorTexts[r.error.code] ?? "משהו השתבש. נסה שוב" } } : r);
}
