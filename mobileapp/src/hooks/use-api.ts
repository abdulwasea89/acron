import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";

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
 */
export function useGet<T>(path: string | null): UseGetResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      setForbidden(false);
      setError(null);
      return;
    }

    let active = true;
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    import("@/lib/api")
      .then(({ api }) => api.get<T>(path))
      .then((result) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!active || cancelledRef.current) return;
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
      cancelledRef.current = true;
    };
  }, [path, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, forbidden, error, refetch };
}