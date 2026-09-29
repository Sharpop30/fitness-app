// Loads one action's reply for a screen, and reloads it after a change.
import { useCallback, useEffect, useState } from "react";
import { call, type Reply } from "./client";

export function useCall<T = any>(caller: string, module: string, action: string, payload: Record<string, unknown> = {}) {
  const key = JSON.stringify(payload);
  const [reply, setReply] = useState<Reply<T> | null>(null);
  const reload = useCallback(() => {
    call<T>(caller, module, action, JSON.parse(key)).then(setReply);
  }, [caller, module, action, key]);
  useEffect(reload, [reload]);
  return { data: reply?.ok ? reply.data : null, error: reply?.error ?? null, loading: reply === null, reload };
}

type CallState<T> = { data: T | null; error: { code: string; message: string } | null; loading: boolean; reload: () => void };
// Several of a screen's calls as one, for Load: the data once all arrived, the first error, and one retry for all.
export function both<A, B>(a: CallState<A>, b: CallState<B>): CallState<[A, B]> {
  return {
    data: a.data != null && b.data != null ? [a.data, b.data] : null,
    error: a.error ?? b.error,
    loading: a.loading || b.loading,
    reload: () => { if (a.error || a.data == null) a.reload(); if (b.error || b.data == null) b.reload(); },
  };
}
