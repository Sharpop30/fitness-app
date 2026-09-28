// The only file in the app that talks to the server (CLAUDE.md section 5, structural test 2).
// Every screen calls call("Sxx", module, action, payload): the caller is the screen itself.
// Screens in LIVE_SCREENS go to the one Endpoint once the person signed in with the identity service; every other
// screen stays on the demo adapter until its stage. Adding a screen is a line here, and the screen does not change.
import { demoAdapter } from "../demo/adapter";
import { TODAY } from "../demo/data";
import { accessToken, signOutIdentity } from "../identity/auth";

// Stage 3: the first slice, S04 against programs (doc-module-map section 7).
// Stage 4a: S02 and S05, whose actions are all built (stage 4a plan, decision 2).
// Stage 4b: every screen whose actions are now all built (stage 4b plan, decision 2). The trainee's screens go live once
// a trainee signs in with the identity service, in stage 5 (decision 1). S01, S03, S13 and the rest wait for actions of
// later stages, so they stay on the demo adapter rather than show half the truth.
// Stage 4c: S11, S13 and S17, with classes and notifications built (stage 4c plan). S13 and S17 are the trainee's, and
// work in the browser with a trainee sign-in in stage 5 (decision 1). S01 waits for payments, in 4d.
export const LIVE_SCREENS = new Set([
  "S02", "S04", "S05", "S06", "S07", "S09", "S10", "S11", "S13", "S14", "S15", "S16", "S17", "S18", "S20", "S21",
]);

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

// "Now" for a screen: the real clock on the Endpoint, and the demo's own day on demo data (stage 4c plan, decision 10).
export const now = (caller: string): Date => (isLive(caller) ? new Date() : new Date(TODAY));

export function call<T = any>(caller: string, module: string, action: string, payload: Record<string, unknown> = {}): Promise<Reply<T>> {
  if (!session && !(module === "trainees" && action === "accept_invite")) {
    return Promise.resolve({ ok: false, data: null, error: { code: "NOT_ALLOWED", message: "אין לך גישה לזה" } });
  }
  return (isLive(caller) ? endpointAdapter : adapter)({ caller, module, action, payload, lang: "he" }, session ?? { role: "trainee", traineeID: null }).then((r) =>
    r.error && !r.error.message ? { ...r, error: { ...r.error, message: errorTexts[r.error.code] ?? "משהו השתבש. נסה שוב" } } : r);
}
