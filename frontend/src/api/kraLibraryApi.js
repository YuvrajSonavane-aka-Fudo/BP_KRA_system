import axiosInstance from './axiosInstance';

// ─── KRAs  →  /kra/library_kra ───────────────────────────────────────────────

/**
 * GET /kra/library_kra
 * Returns all KRAs with their level variants.
 * Optional params: { category_id, level_id, search }
 */
export const getKRALibrary = (params = {}) =>
  axiosInstance.get('/kra/library_kra', { params });

/**
 * POST /kra/library_kra
 * Create a new KRA in the library.
 * Body: { name, description, category_id, level_ids: [] }
 */
export const createKRA = (payload) =>
  axiosInstance.post('/kra/library_kra', payload);

/**
 * PATCH /kra/library_kra/:kra_id
 * Update an existing KRA.
 * Body: { name?, description?, category_id?, level_ids?: [] }
 */
export const updateKRA = (kra_id, payload) =>
  axiosInstance.patch(`/kra/library_kra/${kra_id}`, payload);

/**
 * DELETE /kra/library_kra/:kra_id
 * Soft-delete a KRA from the library.
 */
export const deleteKRA = (kra_id) =>
  axiosInstance.delete(`/kra/library_kra/${kra_id}`);

/**
 * POST /kra/library_kra/:kra_id/clone
 * Clone an existing KRA as a new library entry.
 * Body: { name?, description?, category_id?, level_ids?: [] }
 */
export const cloneKRA = (kra_id, payload) =>
  axiosInstance.post(`/kra/library_kra/${kra_id}/clone`, payload);


// ─── Categories  →  /kra/categories ─────────────────────────────────────────

/**
 * GET /kra/categories
 * List all categories.
 */
export const getCategories = (params = {}) =>
  axiosInstance.get('/kra/categories', { params });

/**
 * POST /kra/categories
 * Create a new KRA category.
 * Body: { name, is_standard: bool }
 */
export const createCategory = (payload) =>
  axiosInstance.post('/kra/categories', payload);

/**
 * PATCH /kra/categories/:category_id
 * Update an existing category.
 * Body: { name?, is_standard?: bool }
 */
export const updateCategory = (category_id, payload) =>
  axiosInstance.patch(`/kra/categories/${category_id}`, payload);

/**
 * DELETE /kra/categories/:category_id
 * Soft-delete a category.
 */
export const deleteCategory = (category_id) =>
  axiosInstance.delete(`/kra/categories/${category_id}`);

/**
 * POST /kra/categories/:category_id/clone
 * Clone a category.
 */
export const cloneCategory = (category_id, payload) =>
  axiosInstance.post(`/kra/categories/${category_id}/clone`, payload);


// ─── Levels  →  /levels ──────────────────────────────────────────────────────

/**
 * GET /levels
 * List all levels.
 */
export const getLevels = (params = {}) =>
  axiosInstance.get('/levels', { params });

/**
 * POST /levels
 * Create a new level.
 * Body: { name, min_experience, max_experience }
 */
export const createLevel = (payload) =>
  axiosInstance.post('/levels', payload);

/**
 * PATCH /levels/:level_id
 * Update an existing level.
 * Body: { name?, min_experience?, max_experience? }
 */
export const updateLevel = (level_id, payload) =>
  axiosInstance.patch(`/levels/${level_id}`, payload);

/**
 * DELETE /levels/:level_id
 * Soft-delete a level.
 */
export const deleteLevel = (level_id) =>
  axiosInstance.delete(`/levels/${level_id}`);

/**
 * POST /levels/:level_id/clone
 * Clone a level.
 */
export const cloneLevel = (level_id, payload) =>
  axiosInstance.post(`/levels/${level_id}/clone`, payload);


// ─── KRA Levels  →  /kra/library/:kra_id/levels ──────────────────────────────
// These manage the many-to-many link between a KRA and its applicable levels.

/**
 * GET /kra/library/:kra_id/levels
 * List all levels linked to a specific KRA.
 */
export const getKRALevels = (kra_id) =>
  axiosInstance.get(`/kra/library/${kra_id}/levels`);

/**
 * POST /kra/library/:kra_id/levels
 * Link a level to a KRA.
 * Body: { level_id, ... }
 */
export const createKRALevel = (kra_id, payload) =>
  axiosInstance.post(`/kra/library/${kra_id}/levels`, payload);

/**
 * PATCH /kra/library/:kra_id/levels/:kra_level_id
 * Update a KRA-level link.
 */
export const updateKRALevel = (kra_id, kra_level_id, payload) =>
  axiosInstance.patch(`/kra/library/${kra_id}/levels/${kra_level_id}`, payload);

/**
 * DELETE /kra/library/:kra_id/levels/:kra_level_id
 * Remove a level from a KRA.
 */
export const deleteKRALevel = (kra_id, kra_level_id) =>
  axiosInstance.delete(`/kra/library/${kra_id}/levels/${kra_level_id}`);

/**
 * POST /kra/library/:kra_id/levels/:kra_level_id/clone
 * Clone a KRA-level link.
 */
export const cloneKRALevel = (kra_id, kra_level_id, payload) =>
  axiosInstance.post(`/kra/library/${kra_id}/levels/${kra_level_id}/clone`, payload);