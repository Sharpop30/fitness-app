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
// Stage 4d: S01, S03, S08, S12 and S19, with payments, invoices, settings and the trainee card built (stage 4d plan).
// S19 is the trainee's, and works in the browser with a trainee sign-in in stage 5.
// Stage 5: S22 and S23, with the identity service (stage 5 plan, task 7). Every screen is on the Endpoint once signed in.
// Stage 4e: S24 to S27, the owner's screens, with business and home.get_owner_home built (stage 4e plan, task 9).
export const LIVE_SCREENS = new Set([
  "S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S12", "S13", "S14", "S15", "S16", "S17", "S18",
  "S19", "S20", "S21", "S22", "S23", "S24", "S25", "S26", "S27",
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

// The role on show. The Endpoint does not take it from here: it finds the person's roles itself, and answers each screen
// by its Registry row (map v11), so this is the view only.
export interface Session {
  role: "owner" | "coach" | "trainee";
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

// True for a session opened with the identity service (a token was there), and false for the demo sign-in.
let liveSession = false;

export function setSession(s: Session | null) {
  session = s;
  liveSession = !!s && accessToken() !== null;
  if (!s) signOutIdentity();
}

export function setAdapter(a: Adapter) {
  adapter = a;
}

// The Endpoint. Any failure to reach it is STORAGE_UNAVAILABLE: the change stays on the screen for a retry (UC1 c).
// That includes an answer that is not the Endpoint's reply, like the gateway's 503 when the function is down (design
// stage, acceptance review): the screen shows the error with a retry instead of loading forever.
const isReply = (r: any): r is Reply => r !== null && typeof r === "object" && typeof r.ok === "boolean";
export const endpointAdapter: Adapter = async (envelope) => {
  const unavailable: Reply<null> = { ok: false, data: null, error: { code: "STORAGE_UNAVAILABLE", message: "" } };
  try {
    const res = await fetch(import.meta.env.VITE_API_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken()}` },
      body: JSON.stringify(envelope),
    });
    const body = await res.json();
    return isReply(body) ? body : unavailable;
  } catch {
    return unavailable;
  }
};

export const isLive = (caller: string) => LIVE_SCREENS.has(caller) && !!import.meta.env.VITE_API_URL && accessToken() !== null;

// "Now" for a screen: the real clock on the Endpoint, and the demo's own day on demo data (stage 4c plan, decision 10).
export const now = (caller: string): Date => (isLive(caller) ? new Date() : new Date(TODAY));

export function call<T = any>(caller: string, module: string, action: string, payload: Record<string, unknown> = {}): Promise<Reply<T>> {
  // S22 is the one screen before a session: its actions are joining and the error texts (module map v10). S23 asks who
  // signed in before the session is set.
  if (!session && caller !== "S22" && !(caller === "S23" && isLive(caller))) {
    return Promise.resolve({ ok: false, data: null, error: { code: "NOT_ALLOWED", message: "אין לך גישה לזה" } });
  }
  // A session opened with the identity service never falls back to the demo data: once its sign-in is lost, a screen of
  // the Endpoint is NOT_ALLOWED, and the demo is never shown as if it were the business's (found closing stage 4e).
  if (liveSession && LIVE_SCREENS.has(caller) && accessToken() === null) {
    return Promise.resolve({ ok: false, data: null, error: { code: "NOT_ALLOWED", message: errorTexts.NOT_ALLOWED ?? "אין לך גישה לזה" } });
  }
  return (isLive(caller) ? endpointAdapter : adapter)({ caller, module, action, payload, lang: "he" }, session ?? { role: "trainee", traineeID: null }).then((r) =>
    r.error && !r.error.message ? { ...r, error: { ...r.error, message: errorTexts[r.error.code] ?? "משהו השתבש. אפשר לנסות שוב" } } : r);
}

// I04, from the browser (module map v9): the file goes straight to the upload address the Endpoint gave (prepare_upload).
// Any refusal or failure is UPLOAD_FAILED (UC10 c). On demo data there is no store, and the demo upload always goes through.
export async function uploadFile(uploadUrl: string, file: Blob): Promise<Reply<null>> {
  const failed: Reply<null> = { ok: false, data: null, error: { code: "UPLOAD_FAILED", message: errorTexts.UPLOAD_FAILED ?? "משהו השתבש. אפשר לנסות שוב" } };
  if (liveSession && accessToken() === null) return failed; // the sign-in was lost: nothing pretends the upload went
  if (!isLive("S05")) return { ok: true, data: null, error: null };
  try {
    const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    return res.ok ? { ok: true, data: null, error: null } : failed;
  } catch {
    return failed;
  }
}
