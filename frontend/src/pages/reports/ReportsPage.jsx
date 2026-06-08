import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, Checkbox,
  ListItemText, TextField, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, InputAdornment,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import axiosInstance from '../../api/axiosInstance';
import { getCycles } from '../../api/cyclesApi';
import { getEmployees } from '../../api/employeesApi';
import * as XLSX from 'xlsx';
import Popover from '@mui/material/Popover';

const NAVY = '#0f1b4c';
const BLUE = '#1E3A8A';
const ACCENT = '#3b82f6';

// ── Available columns ─────────────────────────────────────────────────────────
const REPORT_PER_CYCLE_COLUMNS = [
  { key: 'self_rating', label: 'Self Rating' },
  { key: 'self_comment', label: 'Self Comment' },
  { key: 'lead_rating', label: 'Lead Rating' },
  { key: 'lead_comment', label: 'Lead Comment' },
  { key: 'progress_notes', label: 'Progress Notes' },
  { key: 'lead_progress_notes', label: 'Lead Progress Notes' },
  { key: 'description_by_lead', label: 'Description by Lead' },
];

// Base (non-per-cycle) columns the user can toggle on/off
const REPORT_BASE_OPTIONAL_COLS = [
  { key: 'department',       label: 'Department' },
  { key: 'level',            label: 'Level' },
  { key: 'manager',          label: 'Current Manager' },
  { key: 'previous_manager', label: 'Previous Manager' },
  { key: 'category',         label: 'Category' },
];

const DEFAULT_PER_CYCLE_COLS = ['self_rating', 'lead_rating', 'self_comment', 'lead_comment'];
const DEFAULT_BASE_OPTIONAL_COLS = ['manager', 'previous_manager', 'category'];

// ── Sticky left column config ──────────────────────────────────────────────────
const R2_BASE_COLS = [
  { key: 'employee_id',   label: 'Emp ID', width: 80  },
  { key: 'employee_name', label: 'Name',   width: 150 },
  { key: 'kra_name',      label: 'KRA Name',    width: 160 },
];
// Non-sticky optional base columns shown after the sticky block
const R2_MANAGER_COLS = [
  { key: 'department',       label: 'Department' },
  { key: 'level',            label: 'Level' },
  { key: 'manager',          label: 'Current Manager' },
  { key: 'previous_manager', label: 'Previous Manager' },
  { key: 'category',         label: 'Category' },
];
const R2_BASE_LEFTS = R2_BASE_COLS.reduce((acc, col, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + R2_BASE_COLS[i - 1].width);
  return acc;
}, []);
const R2_BASE_TOTAL_WIDTH = R2_BASE_COLS.reduce((s, c) => s + c.width, 0);

// ── Helpers ───────────────────────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <UnfoldMoreIcon sx={{ fontSize: 14, color: '#cbd5e1' }} />;
  return sortDir === 'asc'
    ? <ArrowUpwardIcon sx={{ fontSize: 14, color: ACCENT }} />
    : <ArrowDownwardIcon sx={{ fontSize: 14, color: ACCENT }} />;
}

function HeaderCell({ label, colKey, sortCol, sortDir, onSort, top = 0, left = undefined, width = undefined }) {
  const isSticky = left !== undefined;
  return (
    <TableCell
      onClick={() => onSort(colKey)}
      sx={{
        fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.07em', py: 1.2, whiteSpace: 'nowrap', cursor: 'pointer',
        position: 'sticky', top,
        ...(isSticky && { left, minWidth: width, maxWidth: width }),
        bgcolor: '#f8fafc',
        zIndex: isSticky ? 4 : 2,
        borderBottom: '1.5px solid #e2e8f0', userSelect: 'none',
        ...(isSticky && { boxShadow: 'inset -2px 0 0 #e2e8f0' }),
        '&:hover': { color: BLUE },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.3}>
        <span>{label}</span>
        <SortIcon col={colKey} sortCol={sortCol} sortDir={sortDir} />
      </Stack>
    </TableCell>
  );
}

function CellValue({ value, maxWidth }) {
  if (value == null || value === '') return <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>—</span>;
  return (
    <Box
      title={String(value)}
      sx={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        ...(maxWidth ? { maxWidth } : {}),
      }}
    >
      {value}
    </Box>
  );
}

// ── Multi-select with search (Autocomplete) ───────────────────────────────────
function MultiSelect({
  label,
  options,
  value,
  onChange,
  getLabel = o => o.name,
  getValue = o => o.id,
  sortFn,
  minWidth = 220,
  renderOptionContent,
  disabled = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState('');

  const open = Boolean(anchorEl);

  const sorted = useMemo(() => {
    return sortFn
      ? [...options].sort(sortFn)
      : [...options].sort((a, b) =>
          String(getLabel(a)).localeCompare(
            String(getLabel(b))
          )
        );
  }, [options, sortFn]);

  const filtered = useMemo(() => {
    return sorted.filter(o =>
      String(getLabel(o))
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [sorted, search]);

  const allSelected =
    sorted.length > 0 &&
    sorted.every(o =>
      value.includes(getValue(o))
    );

  const summary =
    value.length === 0
      ? label
      : value.length === 1
      ? getLabel(
          sorted.find(
            o => getValue(o) === value[0]
          )
        )
      : `${value.length} selected`;

  return (
    <>
      <TextField
        size="small"
        value={summary}
        disabled={disabled}
        onClick={e => !disabled && setAnchorEl(e.currentTarget)}
        InputProps={{ readOnly: true }}
        sx={{
          minWidth,
          '& .MuiOutlinedInput-root': {
            fontSize: 13,
            borderRadius: 2,
            bgcolor: disabled ? '#f1f5f9' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
          '& input': {
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          setSearch('');
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ width: minWidth + 40, p: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            <Box
              onClick={() => {
                onChange(allSelected ? [] : sorted.map(getValue));
              }}
              sx={{
                display: 'flex', alignItems: 'center', px: 1, py: 0.75,
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                '&:hover': { bgcolor: '#f8fafc' },
              }}
            >
              <Checkbox checked={allSelected} indeterminate={!allSelected && value.length > 0} size="small" />
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Select All</Typography>
            </Box>
            {filtered.map(option => {
              const val = getValue(option);
              const checked = value.includes(val);
              return (
                <Box
                  key={val}
                  onClick={() => {
                    if (checked) onChange(value.filter(v => v !== val));
                    else onChange([...value, val]);
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', px: 1, py: 0.75,
                    cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  <Checkbox checked={checked} size="small" />
                  {renderOptionContent ? (
                    renderOptionContent(option)
                  ) : (
                    <Typography sx={{ fontSize: 13 }}>{getLabel(option)}</Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Popover>
    </>
  );
}

// ── Single cycle select with search (Autocomplete) ────────────────────────────
function CycleSelect({ cycles, value, onChange }) {
  const sorted = useMemo(() => [...cycles].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
    return a.name.localeCompare(b.name);
  }), [cycles]);

  const selected = sorted.find(c => c.id === value) ?? null;

  return (
    <Autocomplete
      size="small"
      options={sorted}
      value={selected}
      onChange={(_, newVal) => onChange(newVal?.id ?? '')}
      getOptionLabel={o => o.name}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Stack direction="row" alignItems="center" gap={1}>
            <span style={{ fontSize: 13 }}>{option.name}</span>
            {option.status === 'ACTIVE' && (
              <Box component="span" sx={{ px: 0.75, py: 0.15, borderRadius: 1, bgcolor: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>Active</Box>
            )}
          </Stack>
        </li>
      )}
      renderInput={params => (
        <TextField {...params} label="Cycle *" size="small"
          sx={{ minWidth: 240, '& .MuiOutlinedInput-root': { fontSize: 13, borderRadius: 2, bgcolor: '#fff' } }} />
      )}
      slotProps={{ paper: { sx: { maxHeight: 320 } } }}
    />
  );
}

// ── Export to Excel ───────────────────────────────────────────────────────────
function exportReport(rows, cycles, perCycleCols, visibleBaseCols) {
  const alwaysBase = ['Employee ID', 'Name', 'KRA'];
  const optionalHeaders = R2_MANAGER_COLS
    .filter(c => visibleBaseCols.includes(c.key))
    .map(c => c.label);
  const cycleHeaders = cycles.flatMap(c =>
    REPORT_PER_CYCLE_COLUMNS.filter(col => perCycleCols.includes(col.key))
      .map(col => `${c.name} — ${col.label}`)
  );
  const headers = [...alwaysBase, ...optionalHeaders, ...cycleHeaders];

  const data = rows.map(row => {
    const base = [row.employee_id, row.employee_name, row.kra_name ?? ''];
    const optionals = R2_MANAGER_COLS
      .filter(c => visibleBaseCols.includes(c.key))
      .map(c => row[c.key] ?? '');
    const cycleCells = cycles.flatMap(c =>
      REPORT_PER_CYCLE_COLUMNS.filter(col => perCycleCols.includes(col.key))
        .map(col => row.cycles?.[String(c.id)]?.[col.key] ?? '')
    );
    return [...base, ...optionals, ...cycleCells];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const suffix = cycles.length === 1 ? cycles[0].name.replace(/\s+/g, '_') : 'Multi_Cycle';
  XLSX.writeFile(wb, `KRA_Report_${suffix}.xlsx`);
}

// ── Report (unified) ──────────────────────────────────────────────────────────
function Report({ cycles, employees }) {
  const [cycleIds, setCycleIds] = useState([]);
  const [perCycleCols, setPerCycleCols] = useState(DEFAULT_PER_CYCLE_COLS);
  const [baseOptionalCols, setBaseOptionalCols] = useState(DEFAULT_BASE_OPTIONAL_COLS);
  const [empFilter, setEmpFilter] = useState([]);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState(null);
  const [hasRun, setHasRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('employee_name');
  const [sortDir, setSortDir] = useState('asc');

  // Employees belonging to ANY of the selected cycles, derived directly from the
  // cycle_ids array on each employee object (present in the /employees API response).
  // Employees with an empty cycle_ids array have no cycle assignments and are excluded.
  const filteredEmployees = useMemo(() => {
    if (!cycleIds.length) return employees;
    return employees.filter(e =>
      (e.cycle_ids ?? []).some(cid => cycleIds.includes(cid))
    );
  }, [cycleIds, employees]);

  // Keep empFilter in sync: drop any selected employee no longer in the filtered list
  useEffect(() => {
    if (!empFilter.length) return;
    const validIds = new Set(filteredEmployees.map(e => e.employee_id ?? e.id));
    setEmpFilter(prev => prev.filter(id => validIds.has(id)));
  }, [filteredEmployees]);

  async function fetchReport() {
    if (!cycleIds.length) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      params.set('cycle_ids', cycleIds.join(','));
      params.set('columns', perCycleCols.join(','));
      if (empFilter.length) params.set('employee_ids', empFilter.join(','));
      if (search) params.set('search', search);
      const res = await axiosInstance.get(`/reports/multi-cycle?${params}`);
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
      setHasRun(true);
    }
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const rows = result?.rows ?? [];
  const resultCycles = result?.cycles ?? [];
  const visPerCycle = REPORT_PER_CYCLE_COLUMNS.filter(c => perCycleCols.includes(c.key));
  // Only show the optional base columns the user has selected
  const visibleManagerCols = R2_MANAGER_COLS.filter(c => baseOptionalCols.includes(c.key));

  const displayed = useMemo(() => {
    const filtered = search
      ? rows.filter(r =>
        (r.employee_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.kra_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
      : rows;
    return [...filtered].sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol.startsWith('cycle_')) {
        const [, cid, ...rest] = sortCol.split('_');
        const field = rest.join('_');
        va = a.cycles?.[cid]?.[field] ?? '';
        vb = b.cycles?.[cid]?.[field] ?? '';
      }
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [rows, search, sortCol, sortDir]);

  return (
    <Box>
      {/* Filters */}
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, p: 1.5, mb: 1.5 }}>
        <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="flex-end">
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cycles <Box component="span" sx={{ color: '#ef4444' }}>*</Box></Typography>
            <MultiSelect
              label="Select cycles…"
              options={cycles}
              value={cycleIds}
              onChange={setCycleIds}
              getLabel={c => c.name}
              getValue={c => c.id}
              sortFn={(a, b) => {
                if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
                return a.name.localeCompare(b.name);
              }}
              renderOptionContent={c => (
                <Stack direction="row" alignItems="center" gap={1}>
                  <span style={{ fontSize: 13 }}>{c.name}</span>
                  {c.status === 'ACTIVE' && (
                    <Box component="span" sx={{ px: 0.75, py: 0.15, borderRadius: 1, bgcolor: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>Active</Box>
                  )}
                </Stack>
              )}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employees <Box component="span" sx={{ color: '#ef4444' }}>*</Box></Typography>
            <MultiSelect label="All employees" options={filteredEmployees} value={empFilter}
              onChange={setEmpFilter}
              getLabel={e => e.full_name ?? e.employee_name ?? String(e.employee_id ?? e.id)}
              getValue={e => e.employee_id ?? e.id}
              sortFn={(a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')}
              minWidth={220}
              disabled={!cycleIds.length}
              renderOptionContent={e => (
                <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 44, flexShrink: 0 }}>
                    #{e.employee_id ?? e.id}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {e.full_name ?? e.employee_name ?? String(e.employee_id ?? e.id)}
                  </Typography>
                </Stack>
              )}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Columns <Box component="span" sx={{ color: '#ef4444' }}>*</Box></Typography>
            <MultiSelect label="Select columns…" options={REPORT_BASE_OPTIONAL_COLS}
              value={baseOptionalCols} onChange={setBaseOptionalCols}
              getLabel={c => c.label} getValue={c => c.key} minWidth={170} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columns per Cycle <Box component="span" sx={{ color: '#ef4444' }}>*</Box></Typography>
            <MultiSelect label="Select columns…" options={REPORT_PER_CYCLE_COLUMNS}
              value={perCycleCols} onChange={setPerCycleCols}
              getLabel={c => c.label} getValue={c => c.key} minWidth={190} />
          </Box>
          <Box onClick={fetchReport} sx={{
            px: 2, py: 0.7, borderRadius: 2, cursor: cycleIds.length ? 'pointer' : 'not-allowed',
            bgcolor: cycleIds.length ? BLUE : '#e2e8f0', color: cycleIds.length ? '#fff' : '#94a3b8',
            fontSize: 12, fontWeight: 700, '&:hover': cycleIds.length ? { bgcolor: ACCENT } : {},
          }}>
            {loading ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Run Report'}
          </Box>
          {rows.length > 0 && (
            <Box onClick={() => exportReport(displayed, resultCycles, perCycleCols, baseOptionalCols)} sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 2, py: 0.7, borderRadius: 2, cursor: 'pointer',
              bgcolor: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 700,
              border: '1.5px solid #16a34a40', '&:hover': { bgcolor: '#dcfce7' },
            }}>
              <DownloadIcon sx={{ fontSize: 14 }} /> Export
            </Box>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {rows.length > 0 && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>
            <b style={{ color: BLUE }}>{displayed.length}</b> rows
            {displayed.length !== rows.length && ` (filtered from ${rows.length})`}
          </Typography>
          <TextField size="small" placeholder="Search name or KRA…"
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} /></InputAdornment> }}
            sx={{ width: 240, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13, bgcolor: '#fff' } }}
          />
        </Stack>
      )}

      {rows.length > 0 && (
        <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <Table size="small" sx={{ minWidth: 800 }}>
              <TableHead>
                {/* ── Row 1: Cycle group headers ── */}
                <TableRow sx={{ bgcolor: NAVY }}>
                  {/* Sticky placeholder spanning base cols */}
                  <TableCell
                    colSpan={R2_BASE_COLS.length}
                    sx={{
                      borderBottom: 'none', py: 0.8,
                      position: 'sticky', top: 0, left: 0,
                      bgcolor: NAVY, zIndex: 5,
                      minWidth: R2_BASE_TOTAL_WIDTH,
                    }}
                  />
                  {/* Non-sticky optional base col placeholders */}
                  {visibleManagerCols.map(c => (
                    <TableCell key={c.key} sx={{ borderBottom: 'none', py: 0.8, bgcolor: NAVY, position: 'sticky', top: 0, zIndex: 3 }} />
                  ))}
                  {resultCycles.map(c => (
                    <TableCell key={c.id} colSpan={visPerCycle.length}
                      sx={{
                        color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', py: 0.8, borderBottom: 'none',
                        borderLeft: '2px solid rgba(255,255,255,0.15)', textAlign: 'center',
                        position: 'sticky', top: 0, bgcolor: NAVY, zIndex: 3,
                      }}>
                      {c.name}
                    </TableCell>
                  ))}
                </TableRow>

                {/* ── Row 2: Column headers ── */}
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {R2_BASE_COLS.map((col, i) => (
                    <HeaderCell
                      key={col.key}
                      label={col.label}
                      colKey={col.key}
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                      top={34}
                      left={R2_BASE_LEFTS[i]}
                      width={col.width}
                    />
                  ))}
                  {visibleManagerCols.map(col => (
                    <HeaderCell key={col.key} label={col.label} colKey={col.key}
                      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} top={34} />
                  ))}
                  {resultCycles.map(c => visPerCycle.map(col => (
                    <HeaderCell key={`${c.id}_${col.key}`} label={col.label}
                      colKey={`cycle_${c.id}_${col.key}`}
                      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} top={34} />
                  )))}
                </TableRow>
              </TableHead>

              <TableBody>
                {displayed.map((row, idx) => {
                  const rowBg = idx % 2 === 0 ? '#fff' : '#fafbff';
                  const hoverBg = '#eff6ff';
                  const stickyCell = (key, i, content, extraSx = {}) => (
                    <TableCell
                      key={key}
                      sx={{
                        fontSize: 12, py: 1.2, borderBottom: '1px solid #f1f5f9',
                        position: 'sticky', left: R2_BASE_LEFTS[i],
                        minWidth: R2_BASE_COLS[i].width, maxWidth: R2_BASE_COLS[i].width,
                        bgcolor: rowBg, zIndex: 1,
                        boxShadow: i === R2_BASE_COLS.length - 1 ? 'inset -2px 0 0 #e2e8f0' : 'none',
                        ...extraSx,
                      }}
                    >
                      {content}
                    </TableCell>
                  );

                  return (
                    <TableRow
                      key={idx}
                      sx={{ bgcolor: rowBg, '&:hover': { bgcolor: hoverBg, '& td': { bgcolor: hoverBg } } }}
                    >
                      {stickyCell('emp_id',   0, <CellValue value={row.employee_id} maxWidth={R2_BASE_COLS[0].width} />)}
                      {stickyCell('emp_name', 1, <CellValue value={row.employee_name} maxWidth={R2_BASE_COLS[1].width} />, { fontWeight: 600 })}
                      {stickyCell('kra',      2, <CellValue value={row.kra_name} maxWidth={R2_BASE_COLS[2].width} />)}

                      {visibleManagerCols.map(col => (
                        <TableCell key={col.key} sx={{ fontSize: 12, py: 1.2, borderBottom: '1px solid #f1f5f9' }}>
                          <CellValue value={row[col.key]} maxWidth={140} />
                        </TableCell>
                      ))}

                      {resultCycles.map(c => visPerCycle.map(col => (
                        <TableCell key={`${c.id}_${col.key}`}
                          sx={{
                            fontSize: 12, py: 1.2, borderBottom: '1px solid #f1f5f9',
                            borderLeft: col === visPerCycle[0] ? '2px solid #e2e8f0' : 'none',
                          }}>
                          <CellValue value={row.cycles?.[String(c.id)]?.[col.key]} maxWidth={180} />
                        </TableCell>
                      )))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {!loading && !error && !hasRun && (
        <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 6, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', mb: 0.5 }}>No report generated yet</Typography>
          <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>Select at least one cycle and click <b>Run Report</b> to see results.</Typography>
        </Paper>
      )}

      {!loading && !error && hasRun && rows.length === 0 && (
        <Paper elevation={0} sx={{ border: '1.5px solid #fde68a', borderRadius: 3, p: 6, textAlign: 'center', bgcolor: '#fffbeb' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#92400e', mb: 0.5 }}>No data available</Typography>
          <Typography sx={{ fontSize: 13, color: '#b45309' }}>The selected cycle(s) and filters returned no results. Try adjusting your filters.</Typography>
        </Paper>
      )}
    </Box>
  );
}
export default function ReportsPage() {
  const [cycles, setCycles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cycleRes, empRes] = await Promise.all([
          getCycles(),
          axiosInstance.get('/employees'),
        ]);
        const cycleList = cycleRes.data?.cycles ?? [];
        setCycles(cycleList);

        let emps = empRes.data?.employees ?? [];
        if (!emps.length && cycleList.length) {
          const fallback = await axiosInstance.get(`/employees?cycle_id=${cycleList[0].id}`);
          emps = fallback.data?.employees ?? [];
        }

        setEmployees(emps.map(e => ({
          ...e,
          full_name: e.full_name ?? `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
        })));
      } catch (e) {
        console.error('Failed to load report data', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress sx={{ color: BLUE }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>
      {/* Header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: 0, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>Reports</Typography>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Generate, filter, sort and export KRA assessment reports.</Typography>
          </Box>
        </Stack>
        <Divider />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        <Report cycles={cycles} employees={employees} />
      </Box>
    </Box>
  );
}