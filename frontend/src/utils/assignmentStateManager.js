// ─────────────────────────────────────────────────────────────────────────────
// assignmentStateManager.js
//
// Local cache for KRA assignment data (categories + kra_level_ids per employee).
// Required because backend has no GET /assignments/:id endpoint.
//
// STORAGE: localStorage with 7-day TTL.
// SAFE: all ops wrapped in try/catch — private mode / full storage won't crash app.
//
// Cache key: employee_kra_cycle_id (number)
// Cache entry: { employee_kra_cycle_id, cycle_id, categories, kra_level_ids, cached_at }
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'kra_assignment_cache';
const TTL_MS      = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode) — fail silently
  }
}

function pruneStale(cache) {
  const now = Date.now();
  let pruned = false;
  const fresh = {};
  Object.entries(cache).forEach(([key, val]) => {
    const age = val?.cached_at ? now - new Date(val.cached_at).getTime() : Infinity;
    if (age < TTL_MS) {
      fresh[key] = val;
    } else {
      pruned = true;
    }
  });
  if (pruned) writeCache(fresh);
  return fresh;
}

/**
 * Save assignment after bulkAssignKRAs() or updateAssignment() succeeds.
 * data: { employee_kra_cycle_id, cycle_id, categories, kra_level_ids, is_date_based? }
 */
export const saveAssignmentToCache = (data) => {
  if (!data?.employee_kra_cycle_id) return;
  const cache = pruneStale(readCache());
  cache[data.employee_kra_cycle_id] = { ...data, cached_at: new Date().toISOString() };
  writeCache(cache);
};

/**
 * Get single employee assignment. Returns null if not found or expired.
 */
export const getAssignmentFromCache = (employeeKraCycleId) => {
  if (!employeeKraCycleId) return null;
  const cache = pruneStale(readCache());
  return cache[employeeKraCycleId] ?? null;
};

/**
 * Get all cached assignments (after pruning stale entries).
 */
export const getAssignmentCache = () => pruneStale(readCache());

/**
 * Remove a single assignment from cache after delete.
 */
export const removeAssignmentFromCache = (employeeKraCycleId) => {
  if (!employeeKraCycleId) return;
  const cache = pruneStale(readCache());
  delete cache[employeeKraCycleId];
  writeCache(cache);
};

/**
 * Remove multiple assignments in one shot.
 * Use after bulkRemoveEmployees() succeeds.
 */
export const bulkRemoveFromCache = (employeeKraCycleIds = []) => {
  if (!employeeKraCycleIds.length) return;
  const cache = pruneStale(readCache());
  employeeKraCycleIds.forEach((id) => { delete cache[id]; });
  writeCache(cache);
};

/**
 * Clear ALL cached assignments.
 * Call on logout or when switching KRA cycle to avoid stale weightage.
 */
export const clearAssignmentCache = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
};