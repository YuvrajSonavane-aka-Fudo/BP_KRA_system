import axiosInstance from './axiosInstance';

/**
 * GET /reference/stages
 * Returns the master list of KRA cycle stages (static DB data).
 * Response: [{ id, name, description }]
 */
export const getReferenceData = () =>
  axiosInstance.get('/kra/reference-data/');

/**
 * GET /reference/ratings
 * Returns the rating scale (A, B+, B, B-).
 * Response: [{ id, label, description }]
 */
export const getRatings = () =>
  axiosInstance.get('/kra/reference-data/');

/**
 * GET /reference/levels
 * Returns employee levels (Dev1, Dev2, QA1, etc.)
 */
export const getLevels = () =>
  axiosInstance.get('/kra/reference-data/');
