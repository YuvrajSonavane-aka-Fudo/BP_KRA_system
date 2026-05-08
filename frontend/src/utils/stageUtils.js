/**
 * stageUtils.js
 *
 * Single source of truth for KRA cycle stage definitions and all
 * stage-dependent UI state. Import from here; never hardcode stage
 * lists or comparisons in page components.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Stage IDs can be rolled back via the DB (e.g. HR demotes a cycle from
 * stage 3 back to stage 2). If we use positional math like `id < currentId`
 * to decide what's "done", rolled-back stages still appear green. Instead:
 *   • "done"    = backend explicitly said so via `completed_stage_ids`
 *   • "current" = backend's `current_stage_id`
 *   • "locked"  = everything else
 *
 * The backend's GET /self-assessment and GET /progress responses must include:
 *   current_stage_id:     number   — the stage the cycle is currently IN
 *   completed_stage_ids:  number[] — stages that have been fully completed
 *                                    (survives rollbacks because backend tracks history)
 *
 * If your backend does NOT yet return `completed_stage_ids`, set
 * FALLBACK_TO_POSITIONAL = true below. That re-enables the old `id < current`
 * logic so nothing breaks while you add the field.
 */

// ── Stage registry ────────────────────────────────────────────────────────────
// Must match backend Stage table exactly (id, name).
// DashboardPage's STAGES and any page-local CYCLE_STAGES arrays should be
// deleted and replaced with this import.
export const CYCLE_STAGES = [
  { id: 1, name: 'KRA Assignment' },
  { id: 2, name: 'Self Assessment' },
  { id: 3, name: 'Lead Assessment' },
  { id: 4, name: 'HR Validation'  },
  { id: 5, name: 'Completed'      },
];

// ── Stage ID constants (avoids magic numbers in components) ──────────────────
export const STAGE = {
  KRA_ASSIGNMENT:  1,
  SELF_ASSESSMENT: 2,
  LEAD_ASSESSMENT: 3,
  HR_VALIDATION:   4,
  COMPLETED:       5,
};

// ── Fallback flag ─────────────────────────────────────────────────────────────
// Set to false once backend returns `completed_stage_ids`.
// When true, falls back to positional logic (id < currentStageId = done).
const FALLBACK_TO_POSITIONAL = true;

// ── Core helper ───────────────────────────────────────────────────────────────
/**
 * Returns display state for every stage given the API response.
 *
 * @param {number}   currentStageId      — data.current_stage_id from API
 * @param {number[]} completedStageIds   — data.completed_stage_ids from API ([] if not yet returned)
 * @returns {{ id, name, isDone, isCurrent, isFuture }[]}
 */
export function getStageStates(currentStageId, completedStageIds = []) {
  return CYCLE_STAGES.map(stage => {
    const isCurrent = stage.id === currentStageId;

    let isDone;
    if (FALLBACK_TO_POSITIONAL || !completedStageIds.length) {
      // Safe fallback: treat anything before current as done.
      // This breaks on rollbacks, but that's better than crashing.
      isDone = stage.id < currentStageId;
    } else {
      // Correct path: only mark done if backend explicitly confirmed it.
      isDone = completedStageIds.includes(stage.id);
    }

    return {
      ...stage,
      isDone,
      isCurrent,
      isFuture: !isDone && !isCurrent,
    };
  });
}

// ── Action-gate helpers ───────────────────────────────────────────────────────
/**
 * Can the employee save their self-assessment right now?
 * Backend allows stage 2 (Self Assessment) and stage 3 (Lead Assessment).
 * We also allow it at stage 1 so leads can pre-fill descriptions — adjust if needed.
 */
export function canSelfAssess(currentStageId) {
  return currentStageId === STAGE.SELF_ASSESSMENT || currentStageId === STAGE.LEAD_ASSESSMENT;
}

/**
 * Can a lead/HR save a lead review right now?
 */
export function canLeadReview(currentStageId) {
  return currentStageId === STAGE.LEAD_ASSESSMENT || currentStageId === STAGE.HR_VALIDATION;
}

/**
 * Human-readable banner message shown to the user when they are outside
 * the actionable window — avoids silent "Save failed" toasts.
 */
export function getStageLockReason(currentStageId, role = 'employee') {
  if (!currentStageId) return 'Cycle stage is not yet available.';

  const stage = CYCLE_STAGES.find(s => s.id === currentStageId);
  const stageName = stage?.name ?? `Stage ${currentStageId}`;

  if (role === 'employee') {
    if (currentStageId < STAGE.SELF_ASSESSMENT)
      return `Self-assessment opens in the Self Assessment stage. Currently in: ${stageName}.`;
    if (currentStageId > STAGE.LEAD_ASSESSMENT)
      return `Self-assessment has closed. Currently in: ${stageName}.`;
  }

  if (role === 'lead') {
    if (currentStageId < STAGE.LEAD_ASSESSMENT)
      return `Lead review opens in the Lead Assessment stage. Currently in: ${stageName}.`;
    if (currentStageId > STAGE.HR_VALIDATION)
      return `Lead review has closed. Currently in: ${stageName}.`;
  }

  return null; // no lock
}