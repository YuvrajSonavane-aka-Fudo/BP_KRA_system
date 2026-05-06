const STORAGE_KEY = 'kra_assignment_cache';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── In-memory cache layer ─────────────────────────────────────────────────────
// Reads localStorage ONCE, keeps a live copy in memory.
// All ops hit memory first; localStorage is only written on mutations.
let _memCache = null; // null = not loaded yet

function getMemCache() {
  if (_memCache !== null) return _memCache; // already loaded
  _memCache = loadFromStorage();
  return _memCache;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function persistToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_memCache));
  } catch {
    // Storage full or private mode — fail silently
  }
}

function pruneStale() {
  const now = Date.now();
  const cache = getMemCache();
  let pruned = false;
  Object.keys(cache).forEach((key) => {
    const age = cache[key]?.cached_at
      ? now - new Date(cache[key].cached_at).getTime()
      : Infinity;
    if (age >= TTL_MS) {
      delete cache[key];
      pruned = true;
    }
  });
  if (pruned) persistToStorage(); // only write if something was actually removed
}

// Prune once on module load — not on every read
pruneStale();

// ── Public API ────────────────────────────────────────────────────────────────

export const saveAssignmentToCache = (data) => {
  if (!data?.employee_kra_cycle_id) return;
  const cache = getMemCache();
  cache[data.employee_kra_cycle_id] = { ...data, cached_at: new Date().toISOString() };
  persistToStorage();
};

export const getAssignmentFromCache = (employeeKraCycleId) => {
  if (!employeeKraCycleId) return null;
  return getMemCache()[employeeKraCycleId] ?? null;
};

export const getAssignmentCache = () => getMemCache();

export const removeAssignmentFromCache = (employeeKraCycleId) => {
  if (!employeeKraCycleId) return;
  const cache = getMemCache();
  delete cache[employeeKraCycleId];
  persistToStorage();
};

export const bulkRemoveFromCache = (employeeKraCycleIds = []) => {
  if (!employeeKraCycleIds.length) return;
  const cache = getMemCache();
  employeeKraCycleIds.forEach((id) => { delete cache[id]; });
  persistToStorage();
};

export const clearAssignmentCache = () => {
  _memCache = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
};