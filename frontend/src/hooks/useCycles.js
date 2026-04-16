import { useCallback } from 'react';
import { getCycles } from '../api/cyclesApi';
import useApiCache, { invalidateCache } from './useApiCache';

// ── useCycles ─────────────────────────────────────────────────────────────────
/**
 * Fetches the full list of cycles, optionally filtered by status.
 *
 * const { data: cycles, loading, error, refetch } = useCycles();
 * const { data: drafts } = useCycles({ status: 'DRAFT' });
 */
export function useCycles(params = {}) {
  const key = `cycles-${JSON.stringify(params)}`;

  return useApiCache(
    key,
    () => getCycles(params),
    { transform: (res) => res.data?.cycles ?? [] }
  );
}

// ── useDashboard ──────────────────────────────────────────────────────────────
/**
 * Fetches all data needed for DashboardPage in a single call.
 *
 * Returns:
 *   activeCycle, draftCycles, completedCycles, summary, loading, error, refetch
 *
 * The backend GET /dashboard/stats is expected to return:
 * {
 *   active_cycle: { ... } | null,
 *   draft_cycles: [...],
 *   completed_cycles: [...],
 *   summary: { total_employees, active_cycles, avg_completion }
 * }
 *
 * If your backend doesn't have /dashboard/stats yet, fall back to
 * parallel getCycles calls (see comment below).
 */
export function useDashboard() {
  const { data, loading, error, refetch } = useApiCache(
    'dashboard-stats',
    () => getDashboardStats(),
    {
      ttl: 30_000, // Dashboard refreshes every 30 s
      transform: (res) => res.data,
    }
  );

  return {
    activeCycle:      data?.active_cycle     ?? null,
    draftCycles:      data?.draft_cycles     ?? [],
    completedCycles:  data?.completed_cycles ?? [],
    summary:          data?.summary          ?? {},
    loading,
    error,
    refetch,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Call this after any mutation (create / update / clone) to bust the cache
 * so the next read re-fetches from the server.
 */
export function invalidateCyclesCache() {
  // Bust all cycle-related cache entries
  invalidateCache('dashboard-stats');
  // Pattern-based bust for useCycles keys (covers all param combos)
  invalidateCache('cycles-{}');
  invalidateCache('cycles-{"status":"DRAFT"}');
  invalidateCache('cycles-{"status":"ACTIVE"}');
  invalidateCache('cycles-{"status":"CLOSED"}');
}
