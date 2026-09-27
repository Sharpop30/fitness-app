// The only file in the app that talks to the server (CLAUDE.md section 5, structural test 2).
// Every screen calls call("Sxx", module, action, payload): the caller is the screen itself.
// Stage 2: the adapter is the demo adapter (no network). Stage 3 swaps in the real Endpoint here, and no screen changes.
import { demoAdapter } from "../demo/adapter";

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
}

export function setAdapter(a: Adapter) {
  adapter = a;
}

export function call<T = any>(caller: string, module: string, action: string, payload: Record<string, unknown> = {}): Promise<Reply<T>> {
  if (!session && !(module === "trainees" && action === "accept_invite")) {
    return Promise.resolve({ ok: false, data: null, error: { code: "NOT_ALLOWED", message: "אין לך גישה לזה" } });
  }
  return adapter({ caller, module, action, payload, lang: "he" }, session ?? { role: "trainee", traineeID: null }).then((r) =>
    r.error && !r.error.message ? { ...r, error: { ...r.error, message: errorTexts[r.error.code] ?? "משהו השתבש. נסה שוב" } } : r);
}
