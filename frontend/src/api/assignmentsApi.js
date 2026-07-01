import axiosInstance from './axiosInstance';
import { getKRALibrary } from './kraLibraryApi';

// ─────────────────────────────────────────────────────────────────────────────
// KRA ASSIGNMENT PAGE — API FILE
//
// STAGES IN PROJECT (only 5):
//   1. KRA Assignment By Lead
//   2. Self Assessment
//   3. Lead Assessment
//   4. HR Validation
//   5. Completed
//
// PAGE MOUNT — 3 parallel calls via loadKRAAssignmentPageData():
//   1. getCategories()    → category list for grouping KRA library
//   2. getKRACycles()     → cycles for dropdown (active + closed)
//   3. getKRALibrary()    → from kraLibraryApi.js → calls /kra/library_kra
//
// ON CYCLE SELECTED — 1 call:
//   4. getEmployees(cycleId)
//
// ON USER ACTIONS:
//   5. bulkAssignKRAs()          → assign KRAs to one or many employees
//   6. updateAssignment()        → edit existing assignment (Stage 1 only)
//   7. removeEmployeeFromCycle() → single delete (Stage 1 only)
//   8. bulkRemoveEmployees()     → parallel deletes
//   9. cloneAssignmentToMany()   → clone from one employee to many targets
//
// is_standard mapping (CRITICAL — do NOT reverse):
//   is_standard: true  → ORG KRA    (defined by HR/Admin)
//   is_standard: false → PROJECT KRA (added by Lead/RM)
// ─────────────────────────────────────────────────────────────────────────────


// ── 1. CATEGORIES ────────────────────────────────────────────────────────────

/**
 * GET /kra/categories
 * Returns all KRA categories.
 * Response: { categories: [{ id, name, is_standard }] }
 *
 * Used to build the category group headers in the KRA Library panel.
 * Call ONCE on page mount — store in state, do NOT re-call.
 */
export const getCategories = (params = {}) =>
  axiosInstance.get('kra/categories/', { params });


// ── 2. KRA CYCLES ────────────────────────────────────────────────────────────

/**
 * GET /kra/cycles
 * Returns all cycles the caller has access to.
 *
 * HR/VL → all cycles (ACTIVE, CLOSED, DRAFT, ON_HOLD)
 * RM/Employee → only cycles they are enrolled in
 *
 * Response: { cycles: [{ id, name, description, start_date, end_date, status, current_stage: { id, name } }] }
 *
 * Dropdown shows:
 *   ACTIVE    → write access (default selected)
 *   DRAFT /
 *   ON_HOLD   → write access; shown under separate "Draft / On Hold" group
 *   CLOSED    → read-only / view only
 */
export const getKRACycles = () =>
  axiosInstance.get('kra/cycles/');


// NOTE: getKRALibrary is intentionally NOT defined here.
// It is imported from kraLibraryApi.js which calls /kra/library_kra.
// This is the single source of truth for the KRA library.
// Do NOT add a separate getKRALibrary here — that caused the duplicate call bug.


// ── 3. EMPLOYEES ─────────────────────────────────────────────────────────────

/**
 * GET /employees?cycle_id=
 * Fetch employees for the selected cycle.
 *
 * HR/VL  → all active employees
 * RM/Lead → only their direct reports (manager_id = caller.id)
 *
 * Response: {
 *   employees: [{
 *     employee_id,
 *     full_name,
 *     email,
 *     title,              ← display as "Role" in UI
 *     department,
 *     vertical,           ← separate from department, shown as its own column
 *     level,              ← display string e.g. "L3"
 *     level_id,           ← numeric, needed for assignment payload
 *     manager_id,
 *     roles,              ← array of role strings
 *     assigned_to_cycle,      ← bool → drives Assigned / Unassigned tabs
 *     employee_kra_cycle_id,  ← null if not assigned; required for update/delete/clone
 *   }]
 * }
 *
 * Refresh after: any assign / update / delete / clone action
 */
export const getEmployees = (cycleId) =>
  axiosInstance.get('employees/', {
    params: { cycle_id: cycleId },
  });


// ── 4. BULK ASSIGN ───────────────────────────────────────────────────────────

/**
 * POST /kra/cycles/:cycleId/assignments/bulk
 *
 * Assign KRAs to one or many employees in ONE API call.
 * Weightage is per CATEGORY (not per individual KRA).
 * All category weightages for an employee MUST sum to exactly 100.
 *
 * ── MODE A: Same KRAs to all selected employees ───────────────
 * All employees in the batch get identical KRAs + weightage.
 * Use when: user selected employees + KRAs and hits "Assign to Selection".
 * Detect by presence of `shared` key.
 *
 * payload = {
 *   assignments: [
 *     { employee_id: 1001, employee_level_id: 2 },
 *     { employee_id: 1002, employee_level_id: 1 },
 *   ],
 *   shared: {
 *     categories: [
 *       { category_id: 1, weightage: "40" },
 *       { category_id: 2, weightage: "60" },  // MUST total 100
 *     ],
 *     kra_level_ids: [10, 11, 7],  // kra_level_id from library levels[]
 *     is_date_based: false,
 *   }
 * }
 *
 * ── MODE B: Different KRAs per employee ──────────────────────
 * Each employee in the batch gets their own KRA set + weightage.
 * Use when: HR manually assigns different KRAs to different people.
 * Detect by absence of `shared` key.
 *
 * payload = {
 *   assignments: [
 *     {
 *       employee_id: 1001,
 *       employee_level_id: 2,
 *       is_date_based: false,
 *       categories: [{ category_id: 1, weightage: "100" }],
 *       kra_level_ids: [10, 11],
 *     },
 *     {
 *       employee_id: 1002,
 *       employee_level_id: 1,
 *       is_date_based: false,
 *       categories: [{ category_id: 2, weightage: "100" }],
 *       kra_level_ids: [7],
 *     },
 *   ]
 * }
 *
 * RESPONSE:
 * {
 *   cycle_id,
 *   enrolled: [{ employee_id, employee_kra_cycle_id, kras_assigned }],
 *   skipped:  [{ employee_id, reason }],  // already assigned — not an error
 *   failed:   [{ employee_id, reason }],  // validation error
 *   summary:  { total_submitted, enrolled_count, skipped_count, failed_count }
 * }
 *
 * HTTP STATUS:
 *   201 → all enrolled
 *   207 → mixed result
 *   400 → all failed
 *
 * DUPLICATE HANDLING (skipped):
 *   skipped means the employee already has KRAs assigned in this cycle.
 *   Show user-friendly toast: "X employee(s) already have KRAs assigned and were skipped."
 *   Do NOT show as error. Do NOT block the success flow.
 *
 * FRONTEND AFTER CALL:
 *   enrolled > 0  → success toast, refresh getEmployees(), clear selections
 *   skipped  > 0  → info toast with names
 *   failed   > 0  → error toast with reasons (non-technical language)
 *   Store categories + kra_level_ids in assignmentStateManager cache for modal display
 */
export const bulkAssignKRAs = (cycleId, payload) =>
  axiosInstance.post(`kra/cycles/${cycleId}/assignments/bulk/`, payload);


// ── 5. UPDATE ASSIGNMENT ─────────────────────────────────────────────────────

/**
 * PUT /kra/assignments/:employeeKraCycleId
 *
 * Update an existing employee assignment.
 * ONLY available when cycle is in Stage 1: KRA Assignment By Lead.
 * Fully replaces categories and kra_level_ids (not a merge/patch).
 *
 * employeeKraCycleId → employee_kra_cycle_id from getEmployees() response
 *
 * payload = {
 *   employee_level_id: 2,
 *   is_date_based: false,
 *   categories: [{ category_id: 1, weightage: "50" }, { category_id: 2, weightage: "50" }],
 *   kra_level_ids: [10, 11],
 * }
 *
 * Response: { employee_kra_cycle_id, kras_assigned, message }
 */
export const updateAssignment = (employeeKraCycleId, payload) =>
  axiosInstance.put(`kra/assignments/${employeeKraCycleId}/`, payload);


// ── 6. DELETE / REMOVE ASSIGNMENT ────────────────────────────────────────────

/**
 * DELETE /kra/assignments/:employeeKraCycleId
 *
 * Remove ONE employee from the cycle.
 * ONLY available in Stage 1: KRA Assignment By Lead.
 * Deletes all KRA level rows and category rows for that employee in this cycle.
 *
 * employeeKraCycleId → employee_kra_cycle_id from getEmployees() response
 *
 * Response: { message: 'Employee removed from cycle successfully' }
 */
export const removeEmployeeFromCycle = (employeeKraCycleId) =>
  axiosInstance.delete(`kra/assignments/${employeeKraCycleId}/`);

/**
 * Bulk remove multiple employees from a cycle.
 * Backend has no bulk delete endpoint — fires parallel individual requests.
 *
 * employeeKraCycleIds → array of employee_kra_cycle_id values
 *
 * Wrap in try/catch — Promise.all rejects if ANY request fails.
 */
export const bulkRemoveEmployees = (employeeKraCycleIds) =>
  Promise.all(
    employeeKraCycleIds.map((id) =>
      axiosInstance.delete(`kra/assignments/${id}/`)
    )
  );


// ── 7. CLONE ASSIGNMENT ──────────────────────────────────────────────────────

/**
 * POST /kra/assignments/:targetEmployeeKraCycleId/clone-from
 *
 * Clone KRAs from ONE source employee to ONE target employee.
 * Both must already be enrolled in the cycle.
 * Ratings and comments are NOT copied (nulled on clone).
 * Target's existing KRAs are REPLACED (not merged).
 *
 * targetEmployeeKraCycleId → employee receiving the KRAs
 * sourceEmployeeKraCycleId → employee being copied from
 *
 * Both IDs come from getEmployees() response: employee_kra_cycle_id
 *
 * Response: { employee_kra_cycle_id, cloned_from, kras_copied, message }
 */
export const cloneAssignment = (targetEmployeeKraCycleId, sourceEmployeeKraCycleId) =>
  axiosInstance.post(`kra/assignments/clone-from/`, {
    source_employee_kra_cycle_id: sourceEmployeeKraCycleId,
    target_employee_kra_cycle_ids: [targetEmployeeKraCycleId],
  });

/**
 * Clone KRAs from ONE source to MULTIPLE target employees.
 * All targets must already be enrolled in the cycle.
 * Fires parallel requests — one per target.
 *
 * targetEmployeeKraCycleIds → array of employee_kra_cycle_id (targets)
 * sourceEmployeeKraCycleId  → employee_kra_cycle_id (source)
 *
 * Wrap in try/catch — Promise.all rejects if ANY request fails.
 */
export const cloneAssignmentToMany = (targetEmployeeKraCycleIds, sourceEmployeeKraCycleId, mode = 'append') =>
  axiosInstance.post(`kra/assignments/clone-from/`, {
    source_employee_kra_cycle_id: sourceEmployeeKraCycleId,
    target_employee_kra_cycle_ids: targetEmployeeKraCycleIds,
    mode,
  });


// ── 8. PAGE BOOTSTRAP ────────────────────────────────────────────────────────

/**
 * Load ALL data needed for KRA Assignment page — 3 parallel calls.
 * Call ONCE on page mount.
 *
 * getKRALibrary() → imported from kraLibraryApi.js → hits /kra/library_kra
 * This is the ONLY place getKRALibrary should be called for this page.
 *
 * Returns: {
 *   categories:   [{ id, name, is_standard }]
 *   activeCycle:  { id, name, ..., current_stage } | null
 *   allCycles:    { active: [...], closed: [...] }
 *   kraLibrary:   [{ id, name, description, category_id, category_name, is_standard, levels[] }]
 * }
 *
 * After bootstrap, call getEmployees(activeCycle.id) separately.
 */
export const loadKRAAssignmentPageData = async () => {
  const [categoriesRes, cyclesRes, kraRes] = await Promise.all([
    getCategories(),
    getKRACycles(),
    getKRALibrary(), // ← kraLibraryApi.js → /kra/library_kra
  ]);

  const allCyclesList = cyclesRes.data.cycles ?? [];

  return {
    categories:  categoriesRes.data.categories ?? [],
    activeCycle: allCyclesList.find((c) => c.status === 'ACTIVE') ?? allCyclesList.find((c) => c.status === 'DRAFT') ?? null,
    allCycles: {
      active: allCyclesList.filter((c) => c.status === 'ACTIVE'),
      draft:  allCyclesList.filter((c) => c.status === 'DRAFT' || c.status === 'ON_HOLD'),
      closed: allCyclesList.filter((c) => c.status === 'CLOSED'),
    },
    kraLibrary: kraRes.data.kras ?? [],
  };
};