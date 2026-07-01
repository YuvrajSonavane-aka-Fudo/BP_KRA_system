import axiosInstance from './axiosInstance';

// ── Self-Assessment ───────────────────────────────────────────────────────────

/**
 * GET /kra/cycles/:cycleId/self-assessment
 * Returns the logged-in employee's KRA rows with descriptions and any existing ratings.
 */
export const getSelfAssessment = (cycleId) =>
  axiosInstance.get(`/kra/cycles/${cycleId}/self-assessment/`);

/**
 * PATCH /kra/assessments/:employeeKraLevelId/self
 * Save self rating, comment, progress notes, help_and_assistance_required.
 * Body: { self_rating_id?, self_comment?, progress_notes?, help_and_assistance_required? }
 */
export const saveSelfAssessmentRow = (employeeKraLevelId, payload) =>
  axiosInstance.patch(`/kra/assessments/${employeeKraLevelId}/self/`, payload);

// ── Lead / HR Assessment ──────────────────────────────────────────────────────

/**
 * GET /kra/cycles/:cycleId/progress?employee_id=:empId
 * Lead/HR: returns all enrolled employees (or one if employee_id given) with KRA rows,
 * self-assessment data, and any existing lead ratings.
 */
// export const getAssessmentProgress = (cycleId, employeeId = null) =>
//   axiosInstance.get(`/kra/cycles/${cycleId}/progress`, {
//     params: employeeId ? { employee_id: employeeId } : {},
//   });

/**
 * PATCH /kra/assessments/:employeeKraLevelId/lead-review
 * Lead/HR: submit lead_rating_id, lead_comment, lead_progress_notes.
 * Only allowed in Stage 3 (Assessment) or Stage 4 (HR Validation).
 */
export const submitLeadReview = (employeeKraLevelId, payload) =>
  axiosInstance.patch(`/kra/assessments/${employeeKraLevelId}/lead-review/`, payload);

/**
 * PATCH /kra/assessments/:employeeKraLevelId/description
 * Lead: write description_by_lead for a KRA row. Stage 1 & 2 only.
 */
export const saveLeadDescription = (employeeKraLevelId, payload) =>
  axiosInstance.patch(`/kra/assessments/${employeeKraLevelId}/description/`, payload);

export const getAssessmentProgress = (cycleId, employeeId = null, page = 1, perPage = 20) =>
  axiosInstance.get(`/kra/cycles/${cycleId}/progress/`, {
    params: {
      ...(employeeId ? { employee_id: employeeId } : {}),
      page,
      per_page: perPage,
    },
  });


export const saveEmployeeStageDates = (ekcId, stages) =>
  axiosInstance.post(`/kra/employee-cycles/${ekcId}/stage-dates/`, { stages });