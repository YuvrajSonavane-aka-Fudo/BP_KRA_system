import axiosInstance from './axiosInstance';

/**
 * GET /kra/library
 * Returns categorised KRA list sorted by category, then level.
 * Optional params: { category_id, level_id, search }
 */
export const getKRALibrary = (params = {}) =>
  axiosInstance.get('/kra/library', { params });

/**
 * GET /kra/categories
 */
export const getKRACategories = () =>
  axiosInstance.get('/kra/categories');
