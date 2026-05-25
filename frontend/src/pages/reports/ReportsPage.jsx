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
const REPORT1_COLUMNS = [
  { key: 'employee_id', label: 'Employee ID' },
  { key: 'employee_name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'level', label: 'Level' },
  { key: 'manager', label: 'Current Manager' },
  { key: 'previous_manager', label: 'Previous Manager' },
  { key: 'kra_name', label: 'KRA' },
  { key: 'category', label: 'Category' },
  { key: 'self_rating', label: 'Self Rating' },
  { key: 'self_comment', label: 'Self Comment' },
  { key: 'lead_rating', label: 'Lead Rating' },
  { key: 'lead_comment', label: 'Lead Comment' },
  { key: 'progress_notes', label: 'Progress Notes' },
  { key: 'description_by_lead', label: 'Description by Lead' },
];

const REPORT2_PER_CYCLE_COLUMNS = [
  { key: 'self_rating', label: 'Self Rating' },
  { key: 'self_comment', label: 'Self Comment' },
  { key: 'lead_rating', label: 'Lead Rating' },
  { key: 'lead_comment', label: 'Lead Comment' },
  { key: 'progress_notes', label: 'Progress Notes' },
  { key: 'lead_progress_notes', label: 'Lead Progress Notes' },
  { key: 'description_by_lead', label: 'Description by Lead' },
];

const DEFAULT_R1_COLS = ['employee_id', 'employee_name', 'manager', 'previous_manager', 'kra_name', 'category', 'self_rating', 'self_comment', 'lead_rating', 'lead_comment'];
const DEFAULT_R2_COLS = ['self_rating', 'lead_rating', 'self_comment', 'lead_comment'];

// ── Sticky left column config for Report 2 ────────────────────────────────────
const R2_BASE_COLS = [
  { key: 'employee_id',   label: 'Emp ID', width: 80  },
  { key: 'employee_name', label: 'Name',   width: 150 },
  { key: 'kra_name',      label: 'KRA',    width: 160 },
];
// Non-sticky base columns shown after the sticky block in Report 2
const R2_MANAGER_COLS = [
  { key: 'manager',          label: 'Current Manager' },
  { key: 'previous_manager', label: 'Previous Manager' },
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
        onClick={e =>
          setAnchorEl(e.currentTarget)
        }
        InputProps={{
          readOnly: true,
        }}
        sx={{
          minWidth,
          '& .MuiOutlinedInput-root': {
            fontSize: 13,
            borderRadius: 2,
            bgcolor: '#fff',
            cursor: 'pointer',
          },
          '& input': {
            cursor: 'pointer',
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
function exportReport1(rows, columns, cycleName) {
  const headers = REPORT1_COLUMNS.filter(c => columns.includes(c.key)).map(c => c.label);
  const data = rows.map(row =>
    REPORT1_COLUMNS.filter(c => columns.includes(c.key)).map(c => row[c.key] ?? '')
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `KRA_Report_${cycleName.replace(/\s+/g, '_')}.xlsx`);
}

function exportReport2(rows, cycles, perCycleCols) {
  const baseCols = ['Employee ID', 'Name', 'Department', 'Level', 'Manager', 'KRA', 'Category'];
  const cycleHeaders = cycles.flatMap(c =>
    REPORT2_PER_CYCLE_COLUMNS.filter(col => perCycleCols.includes(col.key))
      .map(col => `${c.name} — ${col.label}`)
  );
  const headers = [...baseCols, ...cycleHeaders];

  const data = rows.map(row => {
    const base = [
      row.employee_id, row.employee_name, row.department ?? '',
      row.level ?? '', row.manager ?? '', row.kra_name ?? '', row.category ?? '',
    ];
    const cycleCells = cycles.flatMap(c =>
      REPORT2_PER_CYCLE_COLUMNS.filter(col => perCycleCols.includes(col.key))
        .map(col => row.cycles?.[String(c.id)]?.[col.key] ?? '')
    );
    return [...base, ...cycleCells];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
  XLSX.writeFile(wb, `KRA_Comparison_Report.xlsx`);
}

// ── Report 1 column widths (px) ───────────────────────────────────────────────
const R1_COL_WIDTHS = {
  employee_id:        80,
  employee_name:     140,
  department:        120,
  level:              80,
  manager:           140,
  previous_manager:  140,
  kra_name:          160,
  category:          110,
  self_rating:        80,
  self_comment:      200,
  lead_rating:        80,
  lead_comment:      200,
  progress_notes:    180,
  description_by_lead: 180,
};

// ── Report 1 ──────────────────────────────────────────────────────────────────
function Report1({ cycles, employees }) {
  const [cycleId, setCycleId] = useState('');
  const [columns, setColumns] = useState(DEFAULT_R1_COLS);
  const [empFilter, setEmpFilter] = useState([]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('employee_name');
  const [sortDir, setSortDir] = useState('asc');

  const cycleName = cycles.find(c => c.id === cycleId)?.name ?? '';

  async function fetchReport() {
    if (!cycleId) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      params.set('columns', columns.join(','));
      if (empFilter.length) params.set('employee_ids', empFilter.join(','));
      const res = await axiosInstance.get(`/reports/cycle/${cycleId}?${params}`);
      setRows(res.data.rows ?? []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const displayed = useMemo(() => {
    const filtered = search
      ? rows.filter(r =>
        (r.employee_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.kra_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
      : rows;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [rows, search, sortCol, sortDir]);

  const visibleCols = REPORT1_COLUMNS.filter(c => columns.includes(c.key));

  return (
    <Box>
      {/* Filters */}
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, p: 1.5, mb: 1.5 }}>
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
          <CycleSelect cycles={cycles} value={cycleId} onChange={setCycleId} />
          <MultiSelect label="Employees (all)" options={employees} value={empFilter}
            onChange={setEmpFilter}
            getLabel={e => e.full_name ?? e.employee_name ?? String(e.employee_id ?? e.id)}
            getValue={e => e.employee_id ?? e.id}
            sortFn={(a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')}
            minWidth={220}
          />
          <MultiSelect label="Columns" options={REPORT1_COLUMNS} value={columns}
            onChange={setColumns} getLabel={c => c.label} getValue={c => c.key} minWidth={180} />
          <Box onClick={fetchReport} sx={{
            px: 2, py: 0.7, borderRadius: 2, cursor: cycleId ? 'pointer' : 'not-allowed',
            bgcolor: cycleId ? BLUE : '#e2e8f0', color: cycleId ? '#fff' : '#94a3b8',
            fontSize: 12, fontWeight: 700, '&:hover': cycleId ? { bgcolor: ACCENT } : {},
          }}>
            {loading ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Run Report'}
          </Box>
          {rows.length > 0 && (
            <Box onClick={() => exportReport1(displayed, columns, cycleName)} sx={{
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
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {visibleCols.map(c => (
                    <HeaderCell key={c.key} label={c.label} colKey={c.key}
                      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayed.map((row, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#fafbff', '&:hover': { bgcolor: '#eff6ff' } }}>
                    {visibleCols.map(c => (
                      <TableCell key={c.key} sx={{ fontSize: 12, py: 1.2, borderBottom: '1px solid #f1f5f9' }}>
                        <CellValue value={row[c.key]} maxWidth={R1_COL_WIDTHS[c.key] ?? 160} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {!loading && rows.length === 0 && cycleId && (
        <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 5, textAlign: 'center' }}>
          <Typography sx={{ color: '#94a3b8' }}>Run the report to see results.</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ── Report 2 ──────────────────────────────────────────────────────────────────
function Report2({ cycles, employees }) {
  const [cycleIds, setCycleIds] = useState([]);
  const [perCycleCols, setPerCycleCols] = useState(DEFAULT_R2_COLS);
  const [empFilter, setEmpFilter] = useState([]);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('employee_name');
  const [sortDir, setSortDir] = useState('asc');

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
    }
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const rows = result?.rows ?? [];
  const resultCycles = result?.cycles ?? [];
  const visPerCycle = REPORT2_PER_CYCLE_COLUMNS.filter(c => perCycleCols.includes(c.key));

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
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
          <MultiSelect
            label="Cycles *"
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
          <MultiSelect label="Employees (all)" options={employees} value={empFilter}
            onChange={setEmpFilter}
            getLabel={e => e.full_name ?? e.employee_name ?? String(e.employee_id ?? e.id)}
            getValue={e => e.employee_id ?? e.id}
            sortFn={(a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')}
            minWidth={220}
          />
          <MultiSelect label="Columns per Cycle" options={REPORT2_PER_CYCLE_COLUMNS}
            value={perCycleCols} onChange={setPerCycleCols}
            getLabel={c => c.label} getValue={c => c.key} minWidth={190} />
          <Box onClick={fetchReport} sx={{
            px: 2, py: 0.7, borderRadius: 2, cursor: cycleIds.length ? 'pointer' : 'not-allowed',
            bgcolor: cycleIds.length ? BLUE : '#e2e8f0', color: cycleIds.length ? '#fff' : '#94a3b8',
            fontSize: 12, fontWeight: 700, '&:hover': cycleIds.length ? { bgcolor: ACCENT } : {},
          }}>
            {loading ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Run Report'}
          </Box>
          {rows.length > 0 && (
            <Box onClick={() => exportReport2(displayed, resultCycles, perCycleCols)} sx={{
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
                  {/* Non-sticky manager col placeholders */}
                  {R2_MANAGER_COLS.map(c => (
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
                  {R2_MANAGER_COLS.map(col => (
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

                      {R2_MANAGER_COLS.map(col => (
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

      {!loading && rows.length === 0 && cycleIds.length > 0 && (
        <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 5, textAlign: 'center' }}>
          <Typography sx={{ color: '#94a3b8' }}>Run the report to see results.</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState('report1');
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
          <Stack direction="row" spacing={1}>
            {[
              { key: 'report1', label: 'Single Cycle Report' },
              { key: 'report2', label: 'Multi Cycle Report' },
            ].map(t => (
              <Box key={t.key} onClick={() => setTab(t.key)} sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.8,
                px: 2.5, py: 0.9, borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                bgcolor: tab === t.key ? BLUE : '#fff',
                color: tab === t.key ? '#fff' : '#64748b',
                border: `1.5px solid ${tab === t.key ? BLUE : '#e2e8f0'}`,
                transition: 'all 0.15s', '&:hover': { borderColor: BLUE, color: tab === t.key ? '#fff' : BLUE },
              }}>
                {t.label}
              </Box>
            ))}
          </Stack>
        </Stack>
        <Divider />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        <Box sx={{ display: tab === 'report1' ? 'block' : 'none' }}>
          <Report1 cycles={cycles} employees={employees} />
        </Box>
        <Box sx={{ display: tab === 'report2' ? 'block' : 'none' }}>
          <Report2 cycles={cycles} employees={employees} />
        </Box>
      </Box>
    </Box>
  );
}