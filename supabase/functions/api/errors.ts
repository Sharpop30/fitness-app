// C05 Error Codes. The closed list from doc-module-map section 4.
// The human text lives in the error_codes table (read at runtime), never here.
export const ERROR_CODES = [
  "CALLER_MISSING", "CALLER_INVALID", "ACTION_NOT_ALLOWED", "AUDIT_FAILED",
  "NOT_ALLOWED", "STORAGE_UNAVAILABLE", "VALUE_NOT_SET",
  "PROGRAM_INVALID", "NO_ACTIVE_PROGRAM", "RESULT_INVALID", "NOTE_INVALID",
  "INVITE_INVALID", "INVITE_EXPIRED", "INVITE_DELIVERY_FAILED",
  "VIDEO_INVALID", "VIDEO_TOO_LONG", "UPLOAD_FAILED",
  "PAYMENT_ALREADY_PAID", "PAYMENT_GATEWAY_UNAVAILABLE",
  "COINS_INSUFFICIENT", "COINS_ALREADY_AWARDED",
  "CHALLENGE_EXISTS", "CHALLENGE_INVALID",
  "CLASS_INVALID", "ALREADY_REGISTERED", "CANCEL_TOO_LATE", "SPOT_OFFER_EXPIRED",
] as const;

export type ErrorCode = typeof ERROR_CODES[number];

export interface Envelope {
  caller?: string;
  module?: string;
  action?: string;
  payload?: Record<string, unknown>;
  lang?: string;
}

export interface Reply<T = unknown> {
  ok: boolean;
  data: T | null;
  error: { code: ErrorCode } | null;
}

export const ok = <T>(data: T): Reply<T> => ({ ok: true, data, error: null });
export const fail = (code: ErrorCode): Reply<never> => ({ ok: false, data: null, error: { code } });
