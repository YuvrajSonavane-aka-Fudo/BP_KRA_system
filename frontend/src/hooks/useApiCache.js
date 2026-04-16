import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useApiCache — generic fetch hook with:
 *   - In-memory cache shared across hook instances (keyed by cacheKey)
 *   - Deduplication: concurrent mounts with the same key share one in-flight request
 *   - Configurable TTL (default 60 s) — stale data shown instantly, revalidated in background
 *   - Manual refetch that bypasses cache
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApiCache(
 *     'cycles-all',
 *     () => getCycles(),
 *     { ttl: 30_000, transform: r => r.data.cycles }
 *   );
 */

// Module-level shared cache — survives re-renders, cleared on full page reload
const CACHE = new Map(); // key → { data, ts }
const IN_FLIGHT = new Map(); // key → Promise

const DEFAULT_TTL = 60_000; // 1 minute

export function invalidateCache(key) {
  if (key) {
    CACHE.delete(key);
  } else {
    CACHE.clear();
  }
}

export default function useApiCache(cacheKey, fetcher, options = {}) {
  const { ttl = DEFAULT_TTL, transform = (r) => r.data, enabled = true } = options;

  const [data, setData] = useState(() => {
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < ttl) return cached.data;
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return;

      // Serve from cache if fresh and not forced
      if (!force) {
        const cached = CACHE.get(cacheKey);
        if (cached && Date.now() - cached.ts < ttl) {
          if (mountedRef.current) {
            setData(cached.data);
            setLoading(false);
          }
          return;
        }
      }

      // Deduplicate concurrent requests for the same key
      if (IN_FLIGHT.has(cacheKey)) {
        setLoading(true);
        try {
          const result = await IN_FLIGHT.get(cacheKey);
          if (mountedRef.current) {
            setData(result);
            setError(null);
          }
        } catch (err) {
          if (mountedRef.current) setError(err);
        } finally {
          if (mountedRef.current) setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const promise = fetcher()
        .then((res) => {
          const transformed = transform(res);
          CACHE.set(cacheKey, { data: transformed, ts: Date.now() });
          return transformed;
        })
        .finally(() => {
          IN_FLIGHT.delete(cacheKey);
        });

      IN_FLIGHT.set(cacheKey, promise);

      try {
        const result = await promise;
        if (mountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err?.response?.data?.error ||
            err?.response?.data?.detail ||
            err?.message ||
            'Something went wrong.'
          );
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, ttl, enabled]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  return { data, loading, error, refetch };
}
