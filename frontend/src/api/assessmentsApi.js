import axiosInstance from './axiosInstance';

// ── Self-Assessment ───────────────────────────────────────────────────────────

/**
 * GET /kra/cycles/:cycleId/self-assessment
 * Employee: returns own KRAs with editable self-rating, self-comments, progress_notes.
 */
export const getSelfAssessment = (cycleId) =>
  axiosInstance.get(`/kra/cycles/${cycleId}/self-assessment`);

/**
 * PATCH /kra/cycles/:cycleId/self-assessment  (Save — keep editable)
 * Body: { kra_level_id, self_rating?, self_comments?, progress_notes? }
 */
export const saveSelfAssessment = (cycleId, payload) =>
  axiosInstance.patch(`/kra/cycles/${cycleId}/self-assessment`, payload);

/**
 * POST /kra/cycles/:cycleId/self-assessment/submit  (Submit — locks fields)
 */
export const submitSelfAssessment = (cycleId) =>
  axiosInstance.post(`/kra/cycles/${cycleId}/self-assessment/submit`);

// ── Lead / HR Assessment ──────────────────────────────────────────────────────

/**
 * GET /kra/cycles/:cycleId/assessments?employee_id=:empId
 * Reviewer (Lead/VL/HR): returns employee KRAs including self-assessment data.
 */
export const getEmployeeAssessment = (cycleId, employeeId) =>
  axiosInstance.get(`/kra/cycles/${cycleId}/assessments`, {
    params: { employee_id: employeeId },
  });

/**
 * PATCH /kra/cycles/:cycleId/assessments
 * Body: { employee_id, kra_level_id, lead_rating?, lead_comments? }
 */
export const submitLeadAssessment = (cycleId, payload) =>
  axiosInstance.patch(`/kra/cycles/${cycleId}/assessments`, payload);
