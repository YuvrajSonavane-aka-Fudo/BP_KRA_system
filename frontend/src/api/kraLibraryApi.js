import axiosInstance from './axiosInstance';

// ─── KRAs  →  /kra/library-kras ─────────────────────────────────────────────

/**
 * GET /kra/library-kras/
 * Returns all KRAs with their level variants.
 * Optional params: { category_id, level_id, search }
 */
export const getKRALibrary = (params = {}) =>
  axiosInstance.get('/kra/library-kras/', { params });

/**
 * POST /kra/library-kras/
 * Create a new KRA in the library.
 * Body: { name, description, category_id, level_ids: [] }
 */
export const createKRA = (payload) =>
  axiosInstance.post('/kra/library-kras/', payload);

/**
 * PATCH /kra/library-kras/:kra_id/
 * Update an existing KRA.
 * Body: { name?, description?, category_id?, level_ids?: [] }
 */
export const updateKRA = (kra_id, payload) =>
  axiosInstance.patch(`/kra/library-kras/${kra_id}/`, payload);

/**
 * DELETE /kra/library-kras/:kra_id/
 * Soft-delete a KRA from the library.
 */
export const deleteKRA = (kra_id) =>
  axiosInstance.delete(`/kra/library-kras/${kra_id}/`);

/**
 * POST /kra/library-kras/:kra_id/clone/
 * Clone an existing KRA as a new library entry.
 * Body: { name?, description?, category_id?, level_ids?: [] }
 */
export const cloneKRA = (kra_id, payload) =>
  axiosInstance.post(`/kra/library-kras/${kra_id}/clone/`, payload);


// ─── Categories  →  /kra/categories ─────────────────────────────────────────

/**
 * GET /kra/categories
 * List all categories.
 */
export const getCategories = (params = {}) =>
  axiosInstance.get('/kra/categories/', { params });

/**
 * POST /kra/categories
 * Create a new KRA category.
 * Body: { name, is_standard: bool }
 */
export const createCategory = (payload) =>
  axiosInstance.post('/kra/categories/', payload);

/**
 * PATCH /kra/categories/:category_id
 * Update an existing category.
 * Body: { name?, is_standard?: bool }
 */
export const updateCategory = (category_id, payload) =>
  axiosInstance.patch(`/kra/categories/${category_id}/`, payload);

/**
 * DELETE /kra/categories/:category_id
 * Soft-delete a category.
 */
export const deleteCategory = (category_id) =>
  axiosInstance.delete(`/kra/categories/${category_id}/`);

/**
 * POST /kra/categories/:category_id/clone
 * Clone a category.
 */
export const cloneCategory = (category_id, payload) =>
  axiosInstance.post(`/kra/categories/${category_id}/clone/`, payload);


// ─── Levels  →  /kra/levels ──────────────────────────────────────────────────

/**
 * GET /kra/levels/
 * List all levels.
 */
export const getLevels = (params = {}) =>
  axiosInstance.get('/kra/levels/', { params });

/**
 * POST /kra/levels/
 * Create a new level.
 * Body: { name, min_experience, max_experience }
 */
export const createLevel = (payload) =>
  axiosInstance.post('/kra/levels/', payload);

/**
 * PATCH /kra/levels/:level_id/
 * Update an existing level.
 * Body: { name?, min_experience?, max_experience? }
 */
export const updateLevel = (level_id, payload) =>
  axiosInstance.patch(`/kra/levels/${level_id}/`, payload);

/**
 * DELETE /kra/levels/:level_id/
 * Soft-delete a level.
 */
export const deleteLevel = (level_id) =>
  axiosInstance.delete(`/kra/levels/${level_id}/`);

/**
 * POST /kra/levels/:level_id/clone/
 * Clone a level.
 */
export const cloneLevel = (level_id, payload) =>
  axiosInstance.post(`/kra/levels/${level_id}/clone/`, payload);


// ─── KRA Levels  →  /kra/library-kras/:kra_id/levels ───────────────────────
// These manage the many-to-many link between a KRA and its applicable levels.

/**
 * GET /kra/library-kras/:kra_id/levels/
 * List all levels linked to a specific KRA.
 */
export const getKRALevels = (kra_id) =>
  axiosInstance.get(`/kra/library-kras/${kra_id}/levels/`);

/**
 * POST /kra/library-kras/:kra_id/levels/
 * Link a level to a KRA.
 * Body: { level_id, ... }
 */
export const createKRALevel = (kra_id, payload) =>
  axiosInstance.post(`/kra/library-kras/${kra_id}/levels/`, payload);

/**
 * PATCH /kra/library-kras/:kra_id/levels/:kra_level_id/
 * Update a KRA-level link.
 */
export const updateKRALevel = (kra_id, kra_level_id, payload) =>
  axiosInstance.patch(`/kra/library-kras/${kra_id}/levels/${kra_level_id}/`, payload);

/**
 * DELETE /kra/library-kras/:kra_id/levels/:kra_level_id/
 * Remove a level from a KRA.
 */
export const deleteKRALevel = (kra_id, kra_level_id) =>
  axiosInstance.delete(`/kra/library-kras/${kra_id}/levels/${kra_level_id}/`);

/**
 * POST /kra/library-kras/:kra_id/levels/:kra_level_id/clone/
 * Clone a KRA-level link.
 */
export const cloneKRALevel = (kra_id, kra_level_id, payload) =>
  axiosInstance.post(`/kra/library-kras/${kra_id}/levels/${kra_level_id}/clone/`, payload);