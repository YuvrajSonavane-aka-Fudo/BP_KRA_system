import axiosInstance from './axiosInstance';

/**
 * GET /employees
 * Role-filtered: HR sees all; Lead sees only direct reports.
 * Optional params: { level_id, department_id, manager_id, search, is_active }
 */
export const getEmployees = (params = {}) =>
  axiosInstance.get('/employees/', { params });

/**
 * GET /employees/:id
 */
export const getEmployeeById = (id) =>
  axiosInstance.get(`/employees/${id}`);
