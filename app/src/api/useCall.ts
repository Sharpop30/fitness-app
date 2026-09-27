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
