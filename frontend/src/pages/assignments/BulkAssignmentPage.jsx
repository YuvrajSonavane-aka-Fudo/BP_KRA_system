import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip, CircularProgress,
  Alert, IconButton, TextField, Tooltip, InputAdornment,
  Checkbox, Avatar, Select, MenuItem,
  FormControl, LinearProgress, Collapse, Badge, Fade,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';

import {
  loadKRAAssignmentPageData,
  getEmployees,
  bulkAssignKRAs,
  updateAssignment,
  removeEmployeeFromCycle,
  bulkRemoveEmployees,
  cloneAssignmentToMany,
} from '../../api/assignmentsApi';
import {
  saveAssignmentToCache,
  getAssignmentFromCache,
  removeAssignmentFromCache,
  bulkRemoveFromCache,
} from '../../utils/assignmentStateManager';

import ManageWeightageModal from './ManageWeightageModal';
import EmployeeKRAView from './EmployeeKRAView';

const G = 'linear-gradient(135deg, #1E3A8A 0%, #1e40af 60%, #1d4ed8 100%)';
const ORG_COLOR  = { bg: '#f0fdf4', border: '#86efac', text: '#15803d', chip: '#dcfce7', icon: '#16a34a' };
const PROJ_COLOR = { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', chip: '#dbeafe', icon: '#2563eb' };
const WRITE_STAGES = ['ACTIVE'];
const EDIT_STAGES  = [1];

const typeColor = (isStd) => (isStd ? ORG_COLOR : PROJ_COLOR);
const typeLabel = (isStd) => (isStd ? 'Org' : 'Project');

function initials(name = '') {
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, severity = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, severity }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);
  return { toasts, push };
}

// ─── Cycle Banner ─────────────────────────────────────────────────────────────
function CycleBanner({ cycle, allCycles, onCycleChange, isReadOnly }) {
  const STAGE_LABELS = {
    1: 'KRA Assignment', 2: 'Self Assessment',
    3: 'Lead Assessment', 4: 'HR Validation', 5: 'Completed',
  };
  return (
    <Paper elevation={0} sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid rgba(30,58,138,0.15)', flexShrink: 0 }}>
      <Box sx={{ background: G, color: '#fff', px: 2.5, py: 1.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Stack direction="row" alignItems="center" gap={1.5} minWidth={0}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AssignmentIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box minWidth={0}>
              <Stack direction="row" alignItems="center" gap={0.75} mb={0.25} flexWrap="wrap">
                <Chip label={isReadOnly ? 'VIEW ONLY' : 'LIVE'} size="small"
                  sx={{ height: 17, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                    bgcolor: isReadOnly ? 'rgba(253,230,138,0.25)' : 'rgba(134,239,172,0.25)',
                    color: isReadOnly ? '#fde68a' : '#86efac' }} />
                {cycle?.current_stage && (
                  <Chip label={`Stage ${cycle.current_stage.id}: ${STAGE_LABELS[cycle.current_stage.id] ?? cycle.current_stage.name}`}
                    size="small" sx={{ height: 17, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(96,165,250,0.2)', color: '#bfdbfe' }} />
                )}
              </Stack>
              <Typography fontWeight={800} fontSize="1rem" noWrap lineHeight={1.2}>{cycle?.name ?? 'No Active Cycle'}</Typography>
              <Typography fontSize={10.5} sx={{ opacity: 0.65, mt: 0.15 }}>{fmtDate(cycle?.start_date)} — {fmtDate(cycle?.end_date)}</Typography>
            </Box>
          </Stack>
          <FormControl size="small" sx={{ minWidth: 190, flexShrink: 0 }}>
            <Select value={cycle?.id ?? ''} onChange={e => onCycleChange(e.target.value)}
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 1.5,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.45)' },
                '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' } }}>
              {allCycles.active?.length > 0 && (
                <MenuItem disabled sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</MenuItem>
              )}
              {allCycles.active?.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12, fontWeight: 600 }}>{c.name}</MenuItem>)}
              {allCycles.closed?.length > 0 && (
                <MenuItem disabled sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 0.5 }}>Closed (Read Only)</MenuItem>
              )}
              {allCycles.closed?.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12, color: '#94a3b8' }}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Box>
    </Paper>
  );
}

// ─── KRA Panel ────────────────────────────────────────────────────────────────
function KRAPanel({ kras, categories, selectedKraLevelIds, onToggleKRA, isReadOnly, employeeDuplicateMap }) {
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [levelFilter, setLevelFilter] = useState('');
  const [expanded, setExpanded]       = useState({});

  const allLevels = useMemo(() => {
    const set = new Map();
    kras.forEach(k => (k.levels ?? []).forEach(l => {
      if (!set.has(l.level_id)) set.set(l.level_id, l.level_name);
    }));
    return [...set.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [kras]);

  const grouped = useMemo(() => {
    let list = kras;
    if (typeFilter === 'org')     list = list.filter(k => k.is_standard === true);
    if (typeFilter === 'project') list = list.filter(k => k.is_standard === false);
    if (levelFilter) list = list.filter(k => (k.levels ?? []).some(l => String(l.level_id) === levelFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(k => k.name.toLowerCase().includes(q) || k.description?.toLowerCase().includes(q));
    }
    const map = {};
    list.forEach(kra => {
      const cid = kra.category_id ?? '__uncategorized__';
      if (!map[cid]) {
        const catFromProp = categories.find(c => c.id === cid);
        map[cid] = { cid, name: catFromProp?.name ?? kra.category_name ?? `Category ${cid}`, isStd: kra.is_standard, kras: [] };
      }
      map[cid].kras.push(kra);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [kras, typeFilter, levelFilter, search, categories]);

  const allVisibleIds = useMemo(
    () => grouped.flatMap(g => g.kras.flatMap(k => (k.levels ?? []).map(l => `${k.id}_${l.level_id}`))),
    [grouped]
  );

  const allSelected  = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedKraLevelIds.includes(id));
  const someSelected = allVisibleIds.some(id => selectedKraLevelIds.includes(id));
  const orgCount     = kras.filter(k => k.is_standard === true).length;
  const projectCount = kras.filter(k => k.is_standard === false).length;

  const toggleExpand = useCallback((cid) => {
    setExpanded(p => ({ ...p, [cid]: !p[cid] }));
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography fontWeight={800} fontSize={13} color="#0f172a">KRA Library</Typography>
          <Chip label={`${kras.length}`} size="small"
            sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#e0e7ff', color: '#3730a3', borderRadius: 1 }} />
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <Chip icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ORG_COLOR.icon, ml: '6px !important' }} />}
            label="Org" size="small"
            sx={{ height: 20, fontSize: 9.5, fontWeight: 700, bgcolor: ORG_COLOR.chip, color: ORG_COLOR.text, cursor: 'default' }} />
          <Chip icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PROJ_COLOR.icon, ml: '6px !important' }} />}
            label="Project" size="small"
            sx={{ height: 20, fontSize: 9.5, fontWeight: 700, bgcolor: PROJ_COLOR.chip, color: PROJ_COLOR.text, cursor: 'default' }} />
          {selectedKraLevelIds.length > 0 && (
            <Chip label={`${selectedKraLevelIds.length} selected`} size="small"
              deleteIcon={<ClearIcon sx={{ fontSize: '13px !important' }} />}
              onDelete={() => onToggleKRA(selectedKraLevelIds, 'deselect_all')}
              sx={{ height: 20, fontSize: 9.5, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }} />
          )}
        </Stack>
      </Stack>

      {/* Search */}
      <TextField size="small" placeholder="Search KRAs…" value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#94a3b8' }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch('')}><ClearIcon sx={{ fontSize: 13 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 36, bgcolor: '#f8fafc' } }} />

      {/* Type + Level filters */}
      <Stack direction="row" gap={1} mb={1.5} alignItems="center">
        <Stack direction="row" sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden', flexShrink: 0, height: 30 }}>
          {[{ v: 'all', l: 'All' }, { v: 'org', l: `Org (${orgCount})` }, { v: 'project', l: `Proj (${projectCount})` }].map(t => (
            <Box key={t.v} onClick={() => setTypeFilter(t.v)}
              sx={{ px: 1.25, display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 700,
                cursor: 'pointer', userSelect: 'none',
                bgcolor: typeFilter === t.v ? '#1E3A8A' : 'transparent',
                color: typeFilter === t.v ? '#fff' : '#64748b',
                '&:hover': { bgcolor: typeFilter === t.v ? '#1E3A8A' : '#f1f5f9' } }}>
              {t.l}
            </Box>
          ))}
        </Stack>
        <FormControl size="small" sx={{ flex: 1 }}>
          <Select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} displayEmpty
            sx={{ fontSize: 11, height: 30, borderRadius: 1.5, bgcolor: '#f8fafc' }}>
            <MenuItem value="" sx={{ fontSize: 11 }}>All Levels</MenuItem>
            {allLevels.map(l => <MenuItem key={l.id} value={String(l.id)} sx={{ fontSize: 11 }}>{l.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {/* ─── FIX 1: Select All bar checkbox ───────────────────────────────────
          BEFORE: onChange={e => onToggleKRA(allVisibleIds, e.target.checked ? 'select_all' : 'deselect_all')}
          WHY IT BROKE: MUI fires onChange whenever the checked/indeterminate props change due to
          a re-render (e.g. after a child KRA is selected), causing a spurious bulk-select.
          FIX: Move logic to onClick (only fires on real user clicks) and keep onChange empty.
      ─────────────────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, mb: 0.5, borderRadius: 1.5,
        bgcolor: someSelected ? '#f0f9ff' : '#fafafa',
        border: `1px solid ${someSelected ? '#bae6fd' : '#f1f5f9'}` }}>
        <Checkbox size="small" disabled={isReadOnly || allVisibleIds.length === 0}
          indeterminate={someSelected && !allSelected} checked={allSelected}
          onChange={() => { /* intentionally empty — onClick handles this */ }}
          onClick={() => {
            if (isReadOnly || allVisibleIds.length === 0) return;
            onToggleKRA(allVisibleIds, allSelected ? 'deselect_all' : 'select_all');
          }}
          sx={{ p: 0.5 }} />
        <Typography fontSize={10} fontWeight={700} color="#475569" textTransform="uppercase" letterSpacing="0.06em" ml={0.75}>
          Select All Visible ({allVisibleIds.length})
        </Typography>
        {someSelected && (
          <Typography fontSize={10} color="#0284c7" fontWeight={700} ml="auto">
            {selectedKraLevelIds.length} / {kras.flatMap(k => k.levels ?? []).length} total
          </Typography>
        )}
      </Box>

      {/* Grouped list */}
      <Box sx={{ flex: 1, overflow: 'auto', pr: 0.5,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 4 } }}>

        {grouped.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
              <AssignmentIcon sx={{ fontSize: 24, color: '#cbd5e1' }} />
            </Box>
            <Typography fontSize={13} fontWeight={600} color="#94a3b8">No KRAs found</Typography>
            <Typography fontSize={11} color="#cbd5e1" mt={0.25}>Try adjusting your filters</Typography>
          </Box>
        ) : grouped.map(group => {
          const catLevelIds = group.kras.flatMap(k => (k.levels ?? []).map(l => `${k.id}_${l.level_id}`));
          const catAll      = catLevelIds.length > 0 && catLevelIds.every(id => selectedKraLevelIds.includes(id));
          const catSome     = catLevelIds.some(id => selectedKraLevelIds.includes(id));
          const isOpen      = !!expanded[group.cid];
          const tc          = typeColor(group.isStd);
          const selCount    = catLevelIds.filter(id => selectedKraLevelIds.includes(id)).length;

          return (
            <Box key={group.cid} sx={{ mb: 0.75 }}>

              {/* ── Category header ── */}
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.85, borderRadius: 1.5,
                bgcolor: tc.bg, border: `1px solid ${tc.border}`, mb: 0.4 }}>

                {/* ─── FIX 2: Category checkbox ──────────────────────────────────────
                    BEFORE: onChange={e => onToggleKRA(catLevelIds, e.target.checked ? 'select_all' : 'deselect_all')}
                    WHY IT BROKE: When any child KRA row is toggled, selectedKraLevelIds state updates →
                    React re-renders this component → catAll/catSome props recalculate → MUI fires
                    onChange on the category checkbox with the new derived checked value → this triggers
                    onToggleKRA(catLevelIds, 'select_all') unexpectedly, bulk-selecting everything.
                    FIX: Use onClick instead of onChange. onClick only fires on real user interaction,
                    not on prop-driven re-renders. Also stopPropagation to prevent the label Box's
                    onClick (which toggles collapse) from also firing.
                ─────────────────────────────────────────────────────────────────── */}
                <Checkbox size="small" disabled={isReadOnly}
                  indeterminate={catSome && !catAll}
                  checked={catAll && catLevelIds.length > 0}
                  onChange={() => { /* intentionally empty — onClick handles this */ }}
                  onClick={e => {
                    e.stopPropagation();
                    if (isReadOnly) return;
                    onToggleKRA(catLevelIds, catAll ? 'deselect_all' : 'select_all');
                  }}
                  sx={{ p: 0.5, mr: 0.5, flexShrink: 0, color: tc.text, '&.Mui-checked': { color: tc.text } }} />

                {/* Label area — ONLY toggles collapse, does NOT touch selectedKraLevelIds */}
                <Box flex={1} minWidth={0}
                  onClick={() => toggleExpand(group.cid)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', userSelect: 'none' }}>
                  <Typography fontSize={12} fontWeight={800} color={tc.text} noWrap>{group.name}</Typography>
                  <Chip label={typeLabel(group.isStd)} size="small"
                    sx={{ height: 15, fontSize: 8, fontWeight: 800, bgcolor: tc.chip, color: tc.text, borderRadius: 0.75 }} />
                  <Chip label={`${group.kras.length} KRA${group.kras.length !== 1 ? 's' : ''}`} size="small"
                    sx={{ height: 15, fontSize: 8, fontWeight: 600, bgcolor: 'rgba(0,0,0,0.06)', color: '#475569', borderRadius: 0.75 }} />
                  {selCount > 0 && (
                    <Chip label={`${selCount} ✓`} size="small"
                      sx={{ height: 15, fontSize: 8, fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRadius: 0.75 }} />
                  )}
                  <Box flex={1} />
                  <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {isOpen ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}
                  </Box>
                </Box>
              </Box>

              {/* ── KRA rows ── */}
              <Collapse in={isOpen} unmountOnExit>
                <Box sx={{ pl: 1.5 }}>
                  {group.kras
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(kra =>
                      (kra.levels ?? []).map(level => {
                        const kraLevelId   = `${kra.id}_${level.level_id}`;
                        const isSelected   = selectedKraLevelIds.includes(kraLevelId);
                        const ktc          = typeColor(kra.is_standard);
                        const dupCount     = employeeDuplicateMap?.[kraLevelId] ?? 0;
                        const hasDuplicate = dupCount > 0;

                        const toggle = () => {
                          if (!isReadOnly) onToggleKRA([kraLevelId], isSelected ? 'deselect' : 'select');
                        };

                        return (
                          <Box key={kraLevelId}
                            sx={{
                              display: 'flex', alignItems: 'center',
                              px: 1.25, py: 0.85, borderRadius: 1.5, mb: 0.3,
                              cursor: isReadOnly ? 'default' : 'pointer',
                              bgcolor: isSelected ? '#eff6ff' : hasDuplicate ? '#fefce8' : 'transparent',
                              border: `1px solid ${isSelected ? '#93c5fd' : hasDuplicate ? '#fde68a' : 'transparent'}`,
                              '&:hover': {
                                bgcolor: isReadOnly ? 'transparent' : isSelected ? '#dbeafe' : '#f8fafc',
                                border: `1px solid ${isReadOnly ? 'transparent' : isSelected ? '#93c5fd' : '#e2e8f0'}`,
                              },
                              transition: 'all 0.1s',
                            }}>

                            {/* Checkbox: handles its own click, stops propagation */}
                            <Checkbox size="small"
                              checked={isSelected}
                              disabled={isReadOnly}
                              onChange={() => { /* intentionally empty */ }}
                              onClick={e => { e.stopPropagation(); toggle(); }}
                              sx={{ p: 0, mr: 1.25, flexShrink: 0 }} />

                            {/* Text content: sibling of checkbox, its own click handler */}
                            <Box flex={1} minWidth={0} onClick={toggle}>
                              <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                                <Typography fontSize={12} fontWeight={isSelected ? 700 : 500} color="#1e293b" noWrap>
                                  {kra.name}
                                </Typography>
                                {hasDuplicate && (
                                  <Tooltip title={`${dupCount} selected employee${dupCount > 1 ? 's' : ''} already have this KRA`}>
                                    <Chip label={`${dupCount} assigned`} size="small"
                                      icon={<WarningAmberIcon sx={{ fontSize: '10px !important', color: '#b45309 !important' }} />}
                                      sx={{ height: 15, fontSize: 8, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e', cursor: 'help' }} />
                                  </Tooltip>
                                )}
                              </Stack>
                              <Typography fontSize={10} color="#94a3b8" noWrap>
                                {level.level_name}{level.description ? ` · ${level.description}` : ''}
                              </Typography>
                            </Box>

                            <Chip label={typeLabel(kra.is_standard)} size="small"
                              sx={{ height: 15, fontSize: 8, ml: 0.75, flexShrink: 0, fontWeight: 700,
                                bgcolor: ktc.chip, color: ktc.text, borderRadius: 0.75 }} />
                          </Box>
                        );
                      })
                    )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Employee Panel ───────────────────────────────────────────────────────────
function EmployeePanel({ employees, selectedEmployeeIds, onToggleEmployee, isReadOnly, canEdit,
  onView, onEdit, onDelete, onClone }) {
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState(0);
  const [deptFilter, setDept]   = useState('');

  const [levelFilter, setLevel] = useState('');

  const depts  = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
  const levels = useMemo(() => [...new Set(employees.map(e => e.level).filter(Boolean))].sort(), [employees]);

  const filtered = useMemo(() => {
    let list = employees;
    if (tab === 1) list = list.filter(e => e.assigned_to_cycle);
    if (tab === 2) list = list.filter(e => !e.assigned_to_cycle);
    if (deptFilter)  list = list.filter(e => e.department === deptFilter);
    if (levelFilter) list = list.filter(e => e.level      === levelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.full_name.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q));
    }
    return list;
  }, [employees, tab, deptFilter, levelFilter, search]);

  const assigned   = employees.filter(e => e.assigned_to_cycle).length;
  const unassigned = employees.filter(e => !e.assigned_to_cycle).length;
  const allSel     = filtered.length > 0 && filtered.every(e => selectedEmployeeIds.includes(e.employee_id));
  const someSel    = filtered.some(e => selectedEmployeeIds.includes(e.employee_id));
  const hasFilters = deptFilter || levelFilter;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography fontWeight={800} fontSize={13} color="#0f172a">Target Employees</Typography>
          {selectedEmployeeIds.length > 0 && (
            <Chip label={`${selectedEmployeeIds.length} selected`} size="small"
              deleteIcon={<ClearIcon sx={{ fontSize: '13px !important' }} />}
              onDelete={() => onToggleEmployee(selectedEmployeeIds, 'deselect_all')}
              sx={{ height: 18, fontSize: 9.5, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }} />
          )}
        </Stack>
        <Stack direction="row" gap={0.5}>
          {[{ l: 'All', c: employees.length, v: 0 }, { l: 'Assigned', c: assigned, v: 1 }, { l: 'Unassigned', c: unassigned, v: 2 }].map(t => (
            <Chip key={t.v} label={`${t.l} ${t.c}`} size="small" onClick={() => setTab(t.v)}
              sx={{ height: 22, fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 1.5,
                bgcolor: tab === t.v ? '#1E3A8A' : '#f1f5f9', color: tab === t.v ? '#fff' : '#64748b',
                '&:hover': { bgcolor: tab === t.v ? '#1e40af' : '#e2e8f0' } }} />
          ))}
        </Stack>
      </Stack>

      <Stack direction="row" gap={1} mb={1}>
        <TextField size="small" placeholder="Search by name or email…" value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#94a3b8' }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><ClearIcon sx={{ fontSize: 13 }} /></IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 36, bgcolor: '#f8fafc' } }} />
        <Tooltip title="Filters">
          <Badge badgeContent={hasFilters ? (!!deptFilter + !!levelFilter) : 0} color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: 8, height: 14, minWidth: 14 } }}>
            <IconButton size="small"
              sx={{ border: `1px solid ${hasFilters ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 1.5,
                bgcolor: hasFilters ? '#eff6ff' : 'transparent', width: 36, height: 36,
                color: hasFilters ? '#1d4ed8' : '#64748b' }}>
              <FilterListIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Badge>
        </Tooltip>
      </Stack>

      <Stack direction="row" gap={1} mb={1.5}>
        {[
          { val: deptFilter, set: setDept,  items: depts,  placeholder: 'Department' },
          { val: levelFilter, set: setLevel, items: levels, placeholder: 'Level' },
        ].map((f, i) => (
          <FormControl key={i} size="small" sx={{ flex: 1 }}>
            <Select value={f.val} onChange={e => f.set(e.target.value)} displayEmpty
              sx={{ fontSize: 10.5, height: 30, borderRadius: 1.5,
                bgcolor: f.val ? '#eff6ff' : '#f8fafc', color: f.val ? '#1d4ed8' : undefined,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: f.val ? '#93c5fd' : '#e2e8f0' } }}>
              <MenuItem value="" sx={{ fontSize: 10.5 }}>{f.placeholder}</MenuItem>
              {f.items.map(v => <MenuItem key={v} value={v} sx={{ fontSize: 10.5 }}>{v}</MenuItem>)}
            </Select>
          </FormControl>
        ))}
        {hasFilters && (
          <Button size="small" onClick={() => { setDept(''); setLevel(''); }}
            sx={{ fontSize: 10, color: '#64748b', minWidth: 0, px: 1, height: 30, flexShrink: 0 }}>Clear</Button>
        )}
      </Stack>

      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pb: 0.75, mb: 0.5, borderBottom: '1px solid #f1f5f9' }}>
        <Checkbox size="small" disabled={isReadOnly}
          indeterminate={someSel && !allSel} checked={allSel && filtered.length > 0}
          onChange={() => !isReadOnly && onToggleEmployee(filtered.map(e => e.employee_id), allSel ? 'deselect_all' : 'select_all')}
          sx={{ p: 0.5 }} />
        <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.06em" ml={1} flex={1}>Employee</Typography>
        <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.06em" sx={{ width: 130, mr: 1 }}>Role / Level</Typography>
        <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.06em" sx={{ width: 60, textAlign: 'center' }}>Actions</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto',
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 4 } }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
              <PersonIcon sx={{ fontSize: 24, color: '#cbd5e1' }} />
            </Box>
            <Typography fontSize={13} fontWeight={600} color="#94a3b8">No employees found</Typography>
          </Box>
        ) : filtered.map(emp => {
          const isSel      = selectedEmployeeIds.includes(emp.employee_id);
          const isAssigned = emp.assigned_to_cycle;
          return (
            <Box key={emp.employee_id}
              sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.85, borderRadius: 1.5, mb: 0.35,
                bgcolor: isSel ? '#eff6ff' : 'transparent',
                border: `1px solid ${isSel ? '#93c5fd' : 'transparent'}`,
                '&:hover': { bgcolor: isSel ? '#eff6ff' : '#f8fafc' }, transition: 'all 0.1s' }}>
              <Checkbox size="small" checked={isSel} disabled={isReadOnly}
                onChange={() => !isReadOnly && onToggleEmployee([emp.employee_id], isSel ? 'deselect' : 'select')}
                sx={{ p: 0.5, flexShrink: 0 }} />
              <Stack direction="row" alignItems="center" gap={1.25} flex={1} minWidth={0} ml={0.5}
                onClick={() => isAssigned && onView(emp)}
                sx={{ cursor: isAssigned ? 'pointer' : 'default' }}>
                {/* <Avatar sx={{ width: 32, height: 32, fontSize: 11, fontWeight: 800, background: G, flexShrink: 0, borderRadius: 1.5 }}>
                  {initials(emp.full_name)}
                </Avatar> */}
                <Box minWidth={0}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography fontSize={12.5} fontWeight={600}
                      color={isAssigned ? '#1d4ed8' : '#1e293b'} noWrap
                      sx={{ '&:hover': { textDecoration: isAssigned ? 'underline' : 'none' } }}>
                      {emp.full_name}
                    </Typography>
                    {isAssigned && (
                      <Tooltip title="KRAs assigned — click to view">
                        <CheckCircleIcon sx={{ fontSize: 12, color: '#16a34a', flexShrink: 0 }} />
                      </Tooltip>
                    )}
                  </Stack>
                  <Typography fontSize={10} color="#94a3b8" noWrap>{emp.email}</Typography>
                </Box>
              </Stack>
              <Box sx={{ width: 130, mr: 1, flexShrink: 0 }}>
                <Typography fontSize={11} color="#374151" noWrap fontWeight={500}>{emp.title || '—'}</Typography>
                <Typography fontSize={10} color="#94a3b8" noWrap>{[emp.department, emp.level].filter(Boolean).join(' · ')}</Typography>
              </Box>
              <Stack direction="row" gap={0} sx={{ width: 60, justifyContent: 'center', flexShrink: 0 }}>
                {isAssigned && (
                  <>
                    {canEdit && (
                      <Tooltip title="Edit assignment">
                        <IconButton size="small" onClick={() => onEdit(emp)}
                          sx={{ color: '#cbd5e1', '&:hover': { color: '#1E3A8A', bgcolor: '#eff6ff' }, borderRadius: 1 }}>
                          <EditIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Copy KRAs to others">
                      <IconButton size="small" onClick={() => onClone(emp)}
                        sx={{ color: '#cbd5e1', '&:hover': { color: '#7c3aed', bgcolor: '#f5f3ff' }, borderRadius: 1 }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Remove from cycle">
                        <IconButton size="small" onClick={() => onDelete(emp)}
                          sx={{ color: '#cbd5e1', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' }, borderRadius: 1 }}>
                          <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Selection Summary Bar ────────────────────────────────────────────────────
function SelectionBar({ selectedKraIds, selectedEmpIds, employees, assignedEmployees,
  onClearKRAs, onClearEmps, onClearAll, onAssign, assigning, isReadOnly }) {
  if (selectedKraIds.length === 0 && selectedEmpIds.length === 0) return null;

  const avatarEmps = employees.filter(e => selectedEmpIds.includes(e.employee_id)).slice(0, 5);

  const fullyDuplicateEmps = employees.filter(e => {
    if (!selectedEmpIds.includes(e.employee_id) || !e.assigned_to_cycle) return false;
    const cached = assignedEmployees[e.employee_kra_cycle_id];
    if (!cached) return false;
    return selectedKraIds.every(id => cached.includes(id));
  });

  const partialDuplicateEmps = employees.filter(e => {
    if (!selectedEmpIds.includes(e.employee_id) || !e.assigned_to_cycle || fullyDuplicateEmps.includes(e)) return false;
    const cached = assignedEmployees[e.employee_kra_cycle_id];
    if (!cached) return false;
    return selectedKraIds.some(id => cached.includes(id));
  });

  const readyCount = selectedEmpIds.length - fullyDuplicateEmps.length;
  const canAssign  = !assigning && selectedKraIds.length > 0 && selectedEmpIds.length > 0 && !isReadOnly;

  return (
    <Paper elevation={0} sx={{ position: 'sticky', bottom: 0, zIndex: 10, borderRadius: 2.5,
      border: '1px solid #bfdbfe', bgcolor: '#fff',
      boxShadow: '0 -8px 32px -8px rgba(30,58,138,0.15)', overflow: 'hidden' }}>
      {fullyDuplicateEmps.length > 0 && (
        <Box sx={{ px: 2.5, py: 1, bgcolor: '#fefce8', borderBottom: '1px solid #fde68a' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <WarningAmberIcon sx={{ fontSize: 14, color: '#b45309', flexShrink: 0 }} />
            <Typography fontSize={11} color="#92400e" fontWeight={600}>
              {fullyDuplicateEmps.length === selectedEmpIds.length
                ? `All ${fullyDuplicateEmps.length} selected employees already have these KRAs.`
                : `${fullyDuplicateEmps.length} employee${fullyDuplicateEmps.length > 1 ? 's' : ''} already have all selected KRAs: ${fullyDuplicateEmps.slice(0, 2).map(e => e.full_name.split(' ')[0]).join(', ')}${fullyDuplicateEmps.length > 2 ? ` +${fullyDuplicateEmps.length - 2}` : ''}`}
            </Typography>
          </Stack>
        </Box>
      )}
      {partialDuplicateEmps.length > 0 && (
        <Box sx={{ px: 2.5, py: 0.75, bgcolor: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <InfoOutlinedIcon sx={{ fontSize: 13, color: '#0369a1', flexShrink: 0 }} />
            <Typography fontSize={11} color="#0c4a6e" fontWeight={500}>
              {partialDuplicateEmps.length} employee{partialDuplicateEmps.length > 1 ? 's' : ''} already have some of these KRAs.
            </Typography>
          </Stack>
        </Box>
      )}
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
          <Stack direction="row" alignItems="center" gap={2}>
            <Stack direction="row" sx={{ '& > *:not(:first-of-type)': { ml: '-8px' } }}>
              {avatarEmps.map(e => (
                <Tooltip key={e.employee_id} title={e.full_name}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 10, fontWeight: 800, background: G,
                    border: '2px solid #fff', borderRadius: 1.25, flexShrink: 0 }}>
                    {initials(e.full_name)}
                  </Avatar>
                </Tooltip>
              ))}
              {selectedEmpIds.length > 5 && (
                <Avatar sx={{ width: 28, height: 28, fontSize: 9, fontWeight: 700, bgcolor: '#e2e8f0',
                  color: '#64748b', border: '2px solid #fff', borderRadius: 1.25 }}>
                  +{selectedEmpIds.length - 5}
                </Avatar>
              )}
            </Stack>
            <Box>
              <Typography fontSize={12} fontWeight={800} color="#0f172a">Selection Summary</Typography>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Typography fontSize={11} color="#475569">
                  <Box component="span" sx={{ fontWeight: 700, color: selectedKraIds.length > 0 ? '#1d4ed8' : '#94a3b8' }}>
                    {selectedKraIds.length} KRA{selectedKraIds.length !== 1 ? 's' : ''}
                  </Box>
                  {' → '}
                  <Box component="span" sx={{ fontWeight: 700, color: selectedEmpIds.length > 0 ? '#1d4ed8' : '#94a3b8' }}>
                    {selectedEmpIds.length} employee{selectedEmpIds.length !== 1 ? 's' : ''}
                  </Box>
                </Typography>
                {readyCount !== selectedEmpIds.length && readyCount > 0 && (
                  <Chip label={`${readyCount} new`} size="small"
                    sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: '#dcfce7', color: '#166534' }} />
                )}
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            {selectedKraIds.length > 0 && (
              <Button size="small" onClick={onClearKRAs} startIcon={<ClearIcon sx={{ fontSize: 12 }} />}
                sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 1.5, height: 30, px: 1.5 }}>KRAs</Button>
            )}
            {selectedEmpIds.length > 0 && (
              <Button size="small" onClick={onClearEmps} startIcon={<ClearIcon sx={{ fontSize: 12 }} />}
                sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 1.5, height: 30, px: 1.5 }}>Employees</Button>
            )}
            <Button size="small" onClick={onClearAll}
              sx={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', height: 30, px: 1 }}>Clear All</Button>
            <Button variant="contained" size="small" disabled={!canAssign} onClick={onAssign}
              startIcon={assigning ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <AssignmentIcon sx={{ fontSize: 14 }} />}
              sx={{ fontSize: 12, fontWeight: 800, background: G, color: '#fff', borderRadius: 1.5, height: 36, px: 2.5,
                boxShadow: '0 2px 12px rgba(30,58,138,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)' },
                '&:disabled': { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none' } }}>
              {assigning ? 'Assigning…' : `Assign to ${selectedEmpIds.length} Employee${selectedEmpIds.length !== 1 ? 's' : ''}`}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

function ToastStack({ toasts }) {
  return (
    <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
      display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
      {toasts.map(t => (
        <Fade key={t.id} in>
          <Alert severity={t.severity}
            sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12.5, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 300, maxWidth: 480 }}>
            {t.msg}
          </Alert>
        </Fade>
      ))}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkAssignmentPage() {
  const { toasts, push: showToast } = useToasts();

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [refetching, setRefetching] = useState(false);

  const [categories,   setCategories]   = useState([]);
  const [allCycles,    setAllCycles]    = useState({ active: [], closed: [] });
  const [kraLibrary,   setKraLibrary]   = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [activeCycle,  setActiveCycle]  = useState(null);
  const [assignedKRAMap, setAssignedKRAMap] = useState({});

  const [selectedKraLevelIds, setSelectedKraLevelIds] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [assigning,      setAssigning]      = useState(false);
  const [weightageModal, setWeightageModal] = useState({ open: false, mode: 'assign', employee: null, prefill: null, enrolMode: 'skip' });
  const [viewEmployee,   setViewEmployee]   = useState(null);
  const [cloneDefault,   setCloneDefault]   = useState(false);

  const hasMounted = useRef(false);

  const isReadOnly = !WRITE_STAGES.includes(activeCycle?.status);
  const canEdit    = !isReadOnly && EDIT_STAGES.includes(activeCycle?.current_stage?.id);

  const employeeDuplicateMap = useMemo(() => {
    const map = {};
    selectedEmployeeIds.forEach(empId => {
      const emp = employees.find(e => e.employee_id === empId);
      if (!emp?.assigned_to_cycle || !emp.employee_kra_cycle_id) return;
      (assignedKRAMap[emp.employee_kra_cycle_id] ?? []).forEach(kraId => {
        map[kraId] = (map[kraId] ?? 0) + 1;
      });
    });
    return map;
  }, [selectedEmployeeIds, employees, assignedKRAMap]);

  const rebuildAssignedMap = useCallback((empList) => {
    const map = {};
    empList.forEach(e => {
      if (e.employee_kra_cycle_id) {
        const cached = getAssignmentFromCache(e.employee_kra_cycle_id);
        if (cached?.kra_level_ids) map[e.employee_kra_cycle_id] = cached.kra_level_ids;
      }
    });
    setAssignedKRAMap(map);
  }, []);

  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    (async () => {
      try {
        setLoading(true);
        const { categories: cats, activeCycle: ac, allCycles: cycles, kraLibrary: kl } =
          await loadKRAAssignmentPageData();
        setCategories(cats); setKraLibrary(kl); setAllCycles(cycles); setActiveCycle(ac);
        if (ac) {
          const res  = await getEmployees(ac.id);
          const emps = res.data.employees ?? [];
          setEmployees(emps);
          rebuildAssignedMap(emps);
        }
      } catch {
        setError('Unable to load the page. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRefresh = useCallback(async (cycleId) => {
    const id = cycleId ?? activeCycle?.id;
    if (!id) return;
    try {
      setRefetching(true);
      const [empRes, pageData] = await Promise.all([getEmployees(id), loadKRAAssignmentPageData()]);
      const emps = empRes.data.employees ?? [];
      setEmployees(emps);
      rebuildAssignedMap(emps);
      setKraLibrary(pageData.kraLibrary);
      setCategories(pageData.categories);
    } catch {
      showToast('Could not refresh data.', 'error');
    } finally {
      setRefetching(false);
    }
  }, [activeCycle, rebuildAssignedMap]);

  const handleCycleChange = async (cycleId) => {
    const found = [...(allCycles.active ?? []), ...(allCycles.closed ?? [])].find(c => c.id === cycleId);
    if (!found) return;
    setActiveCycle(found);
    setSelectedKraLevelIds([]);
    setSelectedEmployeeIds([]);
    await handleRefresh(cycleId);
  };

  const handleToggleKRA = useCallback((ids, mode) => {
    setSelectedKraLevelIds(prev => {
      if (mode === 'select_all' || mode === 'select')     return [...new Set([...prev, ...ids])];
      if (mode === 'deselect_all' || mode === 'deselect') return prev.filter(id => !ids.includes(id));
      return prev;
    });
  }, []);

  const handleToggleEmployee = useCallback((ids, mode) => {
    setSelectedEmployeeIds(prev => {
      if (mode === 'select_all' || mode === 'select')     return [...new Set([...prev, ...ids])];
      if (mode === 'deselect_all' || mode === 'deselect') return prev.filter(id => !ids.includes(id));
      return prev;
    });
  }, []);

  const handleAssignClick = () => {
    if (selectedKraLevelIds.length === 0) { showToast('Select at least one KRA before assigning.', 'warning'); return; }
    if (selectedEmployeeIds.length === 0) { showToast('Select at least one employee.', 'warning'); return; }

    // Decode composite keys "kraId_levelId" back to plain level_id numbers for API
    const decodedLevelIds = selectedKraLevelIds.map(key => {
      const parts = String(key).split('_');
      return Number(parts[parts.length - 1]);
    });

    const selectedKras = kraLibrary.filter(k => (k.levels ?? []).some(l => decodedLevelIds.includes(l.level_id) && selectedKraLevelIds.includes(`${k.id}_${l.level_id}`)));
    const uniqueCatIds = [...new Set(selectedKras.map(k => k.category_id))];
    const prefillCats  = uniqueCatIds.map(cid => ({
      category_id: cid,
      category_name: categories.find(c => c.id === cid)?.name ?? `Category ${cid}`,
      weightage: '',
    }));

    // If any selected employees are already enrolled, default to 'append' so the
    // user sees the enrol_mode picker pre-set to a sensible value.
    const anyAlreadyEnrolled = employees.some(
      e => selectedEmployeeIds.includes(e.employee_id) && e.assigned_to_cycle,
    );

    setWeightageModal({
      open: true, mode: 'assign', employee: null,
      prefill: { categories: prefillCats, kra_level_ids: decodedLevelIds },
      enrolMode: anyAlreadyEnrolled ? 'append' : 'skip',
    });
  };

  const handleConfirmAssign = async ({ categories: cats, kra_level_ids, is_date_based, enrol_mode }) => {
    setAssigning(true);
    setWeightageModal(m => ({ ...m, open: false }));
    try {
      const selEmps = employees.filter(e => selectedEmployeeIds.includes(e.employee_id));
      const payload = {
        assignments: selEmps.map(e => ({ employee_id: e.employee_id, employee_level_id: e.level_id ?? null })),
        shared: { categories: cats, kra_level_ids, is_date_based: is_date_based ?? false },
        enrol_mode: enrol_mode ?? 'skip',
      };
      const res = await bulkAssignKRAs(activeCycle.id, payload);
      const { enrolled = [], skipped = [], failed = [] } = res.data;
      enrolled.forEach(e => saveAssignmentToCache({ employee_kra_cycle_id: e.employee_kra_cycle_id, cycle_id: activeCycle.id, categories: cats, kra_level_ids }));
      await handleRefresh(activeCycle.id);
      setSelectedKraLevelIds([]); setSelectedEmployeeIds([]);
      if (failed.length === 0) {
        const newCount       = enrolled.filter(e => e.enrol_mode === 'new').length;
        const updatedCount   = enrolled.filter(e => e.enrol_mode !== 'new').length;
        const parts = [];
        if (newCount)     parts.push(`${newCount} assigned`);
        if (updatedCount) parts.push(`${updatedCount} ${enrol_mode === 'overwrite' ? 'overwritten' : 'appended'}`);
        if (skipped.length) parts.push(`${skipped.length} skipped`);
        showToast(parts.join(', ') + '.', 'success');
      } else {
        showToast(enrolled.length > 0 ? `${enrolled.length} assigned, ${failed.length} failed.` : 'Assignment failed.', enrolled.length > 0 ? 'warning' : 'error');
      }
    } catch (e) {
      showToast(e?.response?.data?.message || 'Assignment failed.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleEditEmployee = (emp) => {
    const cached = getAssignmentFromCache(emp.employee_kra_cycle_id);
    setWeightageModal({ open: true, mode: 'edit', employee: emp,
      prefill: cached ? { categories: cached.categories, kra_level_ids: cached.kra_level_ids } : { categories: [], kra_level_ids: [] } });
  };

  // Edit always uses PUT /assignments/{id} — enrol_mode is not relevant here.
  const handleConfirmEdit = async ({ categories: cats, kra_level_ids, is_date_based }) => {
    const { employee } = weightageModal;
    setWeightageModal(m => ({ ...m, open: false }));
    try {
      await updateAssignment(employee.employee_kra_cycle_id, { categories: cats, kra_level_ids, is_date_based });
      saveAssignmentToCache({ employee_kra_cycle_id: employee.employee_kra_cycle_id, cycle_id: activeCycle.id, categories: cats, kra_level_ids });
      await handleRefresh(activeCycle.id);
      showToast(`Assignment updated for ${employee.full_name}.`, 'success');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Update failed.', 'error');
    }
  };

  const handleDeleteEmployee = async (emp) => {
    try {
      await removeEmployeeFromCycle(emp.employee_kra_cycle_id);
      removeAssignmentFromCache(emp.employee_kra_cycle_id);
      await handleRefresh(activeCycle.id);
      showToast(`${emp.full_name} removed.`, 'success');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Remove failed.', 'error');
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = employees.filter(e => selectedEmployeeIds.includes(e.employee_id) && e.assigned_to_cycle && e.employee_kra_cycle_id);
    if (!toDelete.length) { showToast('None of the selected employees have assignments to remove.', 'info'); return; }
    try {
      await bulkRemoveEmployees(toDelete.map(e => e.employee_kra_cycle_id));
      bulkRemoveFromCache(toDelete.map(e => e.employee_kra_cycle_id));
      await handleRefresh(activeCycle.id);
      setSelectedEmployeeIds([]);
      showToast(`${toDelete.length} employee${toDelete.length !== 1 ? 's' : ''} removed.`, 'success');
    } catch {
      showToast('Bulk remove failed.', 'error');
    }
  };

  const handleCloneEmployee = (emp) => { setCloneDefault(true);  setViewEmployee(emp); };
  const handleViewEmployee  = (emp) => { setCloneDefault(false); setViewEmployee(emp); };

  const handleCloneTo = async (targetIds) => {
    try {
      await cloneAssignmentToMany(viewEmployee.employee_kra_cycle_id, targetIds);
      await handleRefresh(activeCycle.id);
      showToast(`KRAs copied to ${targetIds.length} employee${targetIds.length !== 1 ? 's' : ''}.`, 'success');
      setViewEmployee(null); setCloneDefault(false);
    } catch {
      showToast('Copy failed.', 'error');
    }
  };

  const selectedAssigned = employees.filter(e => selectedEmployeeIds.includes(e.employee_id) && e.assigned_to_cycle);

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2, bgcolor: '#f8fafc' }}>
      <Box sx={{ width: 56, height: 56, borderRadius: 2, background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(30,58,138,0.3)' }}>
        <AssignmentIcon sx={{ fontSize: 28, color: '#fff' }} />
      </Box>
      <CircularProgress size={20} sx={{ color: '#1E3A8A' }} />
      <Typography fontSize={13} color="#94a3b8" fontWeight={500}>Loading KRA Assignment…</Typography>
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error" action={<Button size="small" onClick={() => window.location.reload()}>Retry</Button>}>{error}</Alert>
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', overflow: 'hidden' }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography fontWeight={900} color="#0f172a" fontSize="1.1rem" letterSpacing="-0.02em" lineHeight={1.2}>KRA Assignment</Typography>
            <Typography fontSize={12} color="#94a3b8" mt={0.25}>Assign performance targets to employees for the active cycle</Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="center">
            {selectedAssigned.length > 0 && canEdit && (
              <Button size="small" startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />} onClick={handleBulkDelete}
                sx={{ fontSize: 11, fontWeight: 700, color: '#ef4444', border: '1px solid #fecaca', borderRadius: 1.5, height: 32, px: 1.5,
                  '&:hover': { bgcolor: '#fef2f2', border: '1px solid #f87171' } }}>
                Remove {selectedAssigned.length} Selected
              </Button>
            )}
            <Tooltip title="Refresh KRAs and employees">
              <IconButton size="small" onClick={() => handleRefresh()} disabled={refetching}
                sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, width: 32, height: 32, color: '#64748b',
                  '&:hover': { color: '#1E3A8A', border: '1px solid #bfdbfe', bgcolor: '#eff6ff' } }}>
                <RefreshIcon fontSize="small"
                  sx={{ animation: refetching ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <CycleBanner cycle={activeCycle} allCycles={allCycles} onCycleChange={handleCycleChange} isReadOnly={isReadOnly} />

        {isReadOnly && activeCycle && (
          <Alert severity="info" icon={<LockIcon fontSize="small" />} sx={{ borderRadius: 2, fontSize: 12, py: 0.5 }}>
            <strong>View Only.</strong> This cycle is {activeCycle.status?.toLowerCase()}.
          </Alert>
        )}
        {!isReadOnly && !canEdit && (
          <Alert severity="warning" sx={{ borderRadius: 2, fontSize: 12, py: 0.5 }}>
            <strong>Limited access.</strong> Cycle is past Stage 1 — view only.
          </Alert>
        )}
        {refetching && <LinearProgress sx={{ borderRadius: 1, height: 2 }} />}

        {activeCycle ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, flex: 1, minHeight: 0 }}>
            <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', p: 2,
              display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
              <KRAPanel kras={kraLibrary} categories={categories}
                selectedKraLevelIds={selectedKraLevelIds} onToggleKRA={handleToggleKRA}
                isReadOnly={isReadOnly} employeeDuplicateMap={employeeDuplicateMap} />
            </Paper>
            <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', p: 2,
              display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
              <EmployeePanel employees={employees} selectedEmployeeIds={selectedEmployeeIds}
                onToggleEmployee={handleToggleEmployee} isReadOnly={isReadOnly} canEdit={canEdit}
                onView={handleViewEmployee} onEdit={handleEditEmployee}
                onDelete={handleDeleteEmployee} onClone={handleCloneEmployee} />
            </Paper>
          </Box>
        ) : (
          <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', p: 6, textAlign: 'center', bgcolor: '#fff' }}>
            <Box sx={{ width: 64, height: 64, borderRadius: 2.5, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <AssignmentIcon sx={{ fontSize: 32, color: '#cbd5e1' }} />
            </Box>
            <Typography fontSize={15} fontWeight={800} color="#374151">No Active Cycle</Typography>
            <Typography fontSize={13} color="#94a3b8" mt={0.5}>Activate a KRA cycle to start assigning KRAs to employees.</Typography>
          </Paper>
        )}

        {!isReadOnly && (selectedKraLevelIds.length > 0 || selectedEmployeeIds.length > 0) && (
          <SelectionBar selectedKraIds={selectedKraLevelIds} selectedEmpIds={selectedEmployeeIds}
            employees={employees} assignedEmployees={assignedKRAMap}
            onClearKRAs={() => setSelectedKraLevelIds([])} onClearEmps={() => setSelectedEmployeeIds([])}
            onClearAll={() => { setSelectedKraLevelIds([]); setSelectedEmployeeIds([]); }}
            onAssign={handleAssignClick} assigning={assigning} isReadOnly={isReadOnly} />
        )}
      </Box>

      <ManageWeightageModal open={weightageModal.open} mode={weightageModal.mode}
        employee={weightageModal.employee} prefill={weightageModal.prefill}
        enrolMode={weightageModal.enrolMode}
        onEnrolModeChange={val => setWeightageModal(m => ({ ...m, enrolMode: val }))}
        kraLibrary={kraLibrary} categories={categories}
        selectedEmployeeIds={selectedEmployeeIds} employees={employees}
        activeCycleId={activeCycle?.id}
        onConfirm={weightageModal.mode === 'edit' ? handleConfirmEdit : handleConfirmAssign}
        onClose={() => setWeightageModal(m => ({ ...m, open: false }))} />

      {viewEmployee && (
        <EmployeeKRAView open={!!viewEmployee} employee={viewEmployee}
          kraLibrary={kraLibrary} categories={categories}
          cachedData={getAssignmentFromCache(viewEmployee.employee_kra_cycle_id)}
          employees={employees} activeCycleId={activeCycle?.id}
          defaultTab={cloneDefault ? 'clone' : 'kras'}
          onClose={() => { setViewEmployee(null); setCloneDefault(false); }}
          onCloneTo={handleCloneTo} />
      )}

      <ToastStack toasts={toasts} />
    </Box>
  );
}