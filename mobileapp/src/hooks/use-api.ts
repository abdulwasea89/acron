import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { onRealtimeEvent } from "@/lib/realtime";

interface UseGetResult<T> {
  data: T | null;
  loading: boolean;
  /** True when the request failed for a capability/authorization reason (403). */
  forbidden: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Minimal GET wrapper for the tenant-scoped API client.
 *
 * A `403` is surfaced separately as `forbidden`: some endpoints are
 * capability-gated (e.g. staff tasks), and dashboards render "optional"
 * sections by simply hiding them when the caller lacks the capability,
 * rather than failing the whole screen.
 *
 * `refreshOn` lists realtime event types that should trigger a refetch. When
 * one of those events lands on the WebSocket, the hook refetches the endpoint
 * so the screen stays live without pull-to-refresh.
 */
export function useGet<T>(
  path: string | null,
  refreshOn?: string[],
): UseGetResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    if (!path) return;

    let active = true;
    // Background refresh: only show the skeleton the first time there's no
    // data yet. Later refetches (from mutations or realtime events) keep the
    // previous data on screen and swap it in when the response lands.
    if (!hasData.current) setLoading(true);

    import("@/lib/api")
      .then(({ api }) => api.get<T>(path))
      .then((result) => {
        if (!active) return;
        setData(result);
        hasData.current = true;
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else {
          const message =
            err instanceof Error ? err.message : "Something went wrong loading this page.";
          setError(message);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [path, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const refreshKey = refreshOn ? refreshOn.join(",") : "";

  useEffect(() => {
    if (!path || !refreshKey) return;
    const wanted = refreshKey.split(",");
    return onRealtimeEvent((event) => {
      if (wanted.includes(event.type)) refetch();
    });
  }, [path, refreshKey, refetch]);

  return { data, loading, forbidden, error, refetch };
}