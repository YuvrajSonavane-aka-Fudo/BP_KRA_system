import axiosInstance from './axiosInstance';

/**
 * POST /kra/cycles/:cycleId/assignments
 * Enrol employees into a cycle with KRAs.
 * Body: { employee_ids: [], kra_level_ids: [], category_id, weightage }
 */
export const assignKRAs = (cycleId, payload) =>
  axiosInstance.post(`/kra/cycles/${cycleId}/assignments`, payload);

/**
 * PATCH /kra/cycles/:cycleId/assignments
 * Update an existing assignment (e.g. weightage, add KRAs).
 */
export const updateAssignment = (cycleId, payload) =>
  axiosInstance.patch(`/kra/cycles/${cycleId}/assignments`, payload);

/**
 * POST /kra/cycles/:cycleId/assignments/clone
 * Clone KRA assignments from one employee to one or more employees.
 * Body: { source_employee_id, target_employee_ids: [] }
 */
export const cloneAssignment = (cycleId, payload) =>
  axiosInstance.post(`/kra/cycles/${cycleId}/assignments/clone`, payload);

/**
 * DELETE /kra/cycles/:cycleId/assignments
 * Remove one or more employees from the cycle.
 * Body: { employee_ids: [] }
 */
export const removeEmployees = (cycleId, payload) =>
  axiosInstance.delete(`/kra/cycles/${cycleId}/assignments`, { data: payload });
