import axiosInstance from './axiosInstance';

// ── Cycles ────────────────────────────────────────────────────────────────────

/**
 * GET /kra/cycles
 * Optional query params: { status: 'DRAFT' | 'ACTIVE' | 'CLOSED' }
 * Response: { cycles: [...] }
 */
export const getCycles = (params = {}) =>
  axiosInstance.get('/kra/cycles', { params });

/**
 * GET /kra/cycles/:id
 */
export const getCycleById = (id) =>
  axiosInstance.get(`/kra/cycles/${id}`);

/**
 * POST /kra/cycles
 * Body: { name, description?, start_date, end_date, stages: [{ stage_id, start_date, end_date }] }
 * Response: { id, name, status, stage, stages_count }
 */
export const createCycle = (payload) =>
  axiosInstance.post('/kra/cycles', payload);

/**
 * PATCH /kra/cycles/:id
 * Body: { status?: 'ACTIVE' | 'CLOSED', is_deleted?: true }
 */
export const updateCycle = (id, payload) =>
  axiosInstance.patch(`/kra/cycles/${id}`, payload);

/**
 * POST /kra/cycles/:id/clone
 * Body: { name, start_date, end_date, description? }
 */
export const cloneCycle = (id, payload) =>
  axiosInstance.post(`/kra/cycles/${id}/clone`, payload);

/**
 * POST /kra/cycles/:id/advance-stage
 * Body (optional):
 *   {}                                         → advance cycle by 1 stage
 *   { target_stage_id: N }                     → set ALL employees to stage N
 *   { target_stage_id: N, employee_ids: [...] } → set specific employees to stage N
 */
export const advanceCycleStage = (id, payload = {}) =>
  axiosInstance.post(`/kra/cycles/${id}/advance-stage`, payload);


