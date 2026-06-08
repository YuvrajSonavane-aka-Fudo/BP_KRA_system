import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip, CircularProgress,
  Alert, IconButton, TextField, Tooltip, InputAdornment,
  Checkbox, Select, MenuItem,
  FormControl, LinearProgress, Collapse, Fade,
  Dialog, DialogContent, DialogActions,
  TableSortLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';

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

import EmployeeKRAView from './EmployeeKRAView';
import useRoleAccess from '../../hooks/useRoleAccess';
import { useSearchParams } from 'react-router-dom';

const G = 'linear-gradient(135deg, #1E3A8A 0%, #1e40af 60%, #1d4ed8 100%)';
const ORG_COLOR = { bg: '#f0fdf4', border: '#86efac', text: '#15803d', chip: '#dcfce7', icon: '#16a34a' };
const PROJ_COLOR = { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', chip: '#dbeafe', icon: '#2563eb' };

const WRITE_STAGES = ['ACTIVE', 'DRAFT'];

const typeColor = (isStd) => (isStd ? ORG_COLOR : PROJ_COLOR);
const typeLabel = (isStd) => (isStd ? 'Org' : 'Project');

const getLevelId = (level) => level.kra_level_id ?? level.id;
const makeKey = (kraId, level) => `${kraId}_${getLevelId(level)}`;

function initials(name = '') {
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Hoisted static sx objects ─────────────────────────────────────────────────
const SX = {
  scrollbar: {
    '&::-webkit-scrollbar': { width: 3 },
    '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 4 },
  },
  kraItemBase: {
    display: 'flex', alignItems: 'center', px: 1.25, py: 0.85,
    borderRadius: 1.5, mb: 0.3, transition: 'all 0.1s',
  },
  empItemBase: {
    display: 'flex', alignItems: 'center', px: 1, py: 0.85,
    borderRadius: 1.5, mb: 0.35, transition: 'all 0.1s',
  },
};

// ── FIX: debounce hook — prevents useMemo from firing on every keystroke ──────
function useDebounce(value, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
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
                  sx={{ height: 17, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', bgcolor: isReadOnly ? 'rgba(253,230,138,0.25)' : 'rgba(134,239,172,0.25)', color: isReadOnly ? '#fde68a' : '#86efac' }} />
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
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 1.5, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.45)' }, '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' } }}>
              {allCycles.active?.length > 0 && <MenuItem disabled sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</MenuItem>}
              {allCycles.active?.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{c.name}</MenuItem>)}
              {allCycles.draft?.length > 0 && <MenuItem disabled sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 0.5 }}>Draft / On Hold</MenuItem>}
              {allCycles.draft?.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12, fontWeight: 600 }}>{c.name}</MenuItem>)}
              {allCycles.closed?.length > 0 && <MenuItem disabled sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 0.5 }}>Closed (Read Only)</MenuItem>}
              {allCycles.closed?.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12, color: '#94a3b8' }}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Box>
    </Paper>
  );
}

// ─── KRA Panel ────────────────────────────────────────────────────────────────
const KRAPanel = memo(function KRAPanel({ kras, categories, selectedKraSet, onToggleKRA, isReadOnly, isManager, employeeDuplicateMap }) {
  const [searchRaw, setSearchRaw] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('');
  const [expanded, setExpanded] = useState({});

  // debounce search so useMemo doesn't re-run on every keystroke
  const search = useDebounce(searchRaw, 180);

  const allLevels = useMemo(() => {
    const seen = new Set(); const list = [];
    kras.forEach(k => (k.levels ?? []).forEach(l => {
      const name = l.level_name;
      if (name && !seen.has(name)) { seen.add(name); list.push({ name }); }
    }));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [kras]);

  // grouped does NOT depend on selectedKraSet — pure filter/group only
  const grouped = useMemo(() => {
    let list = kras;
    if (typeFilter === 'org') list = list.filter(k => k.is_standard === true);
    if (typeFilter === 'project') list = list.filter(k => k.is_standard === false);
    if (levelFilter) list = list.filter(k => (k.levels ?? []).some(l => l.level_name === levelFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(k =>
        k.name.toLowerCase().includes(q) ||
        k.description?.toLowerCase().includes(q) ||
        k.category_name?.toLowerCase().includes(q) ||
        (k.levels ?? []).some(l => l.level_name?.toLowerCase().includes(q))
      );
    }

    // Seed map from categories so empty ones still appear
    const map = {};
    categories.forEach(cat => {
      const matchesTypeFilter =
        typeFilter === 'all' ||
        (typeFilter === 'org' && cat.is_standard === true) ||
        (typeFilter === 'project' && cat.is_standard === false);
      if (!matchesTypeFilter) return;
      map[cat.id] = {
        cid: cat.id,
        name: cat.name,
        isStd: cat.is_standard,
        kras: [],
      };
    });

    // Fill in KRAs
    list.forEach(kra => {
      const cid = kra.category_id ?? '__uncategorized__';
      if (!map[cid]) {
        // fallback for KRAs whose category isn't in categories list
        const catFromProp = categories.find(c => String(c.id) === String(cid));
        map[cid] = {
          cid,
          name: catFromProp?.name ?? kra.category_name ?? `Category ${cid}`,
          isStd: catFromProp?.is_standard ?? kra.is_standard,
          kras: [],
        };
      }
      map[cid].kras.push(kra);
    });

    return Object.values(map)
  .filter(g => !search.trim() || g.kras.length > 0)  // ← hide empty cats when searching
  .sort((a, b) => a.name.localeCompare(b.name));
  }, [kras, typeFilter, levelFilter, search, categories]);

  // This means checking a KRA checkbox no longer re-sorts the entire list.
  const groupedWithRows = useMemo(() => {
    return grouped.map(group => ({
      ...group,
      rows: group.kras.flatMap(kra =>
        (kra.levels ?? []).map(level => ({
          kra, level, kraLevelId: makeKey(kra.id, level),
        }))
      ).sort((a, b) => {
        const aSelected = selectedKraSet.has(a.kraLevelId);
        const bSelected = selectedKraSet.has(b.kraLevelId);

        // selected on top
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;

        // original order
        if (a.kra.name === b.kra.name) {
          return (a.level.level_name || '').localeCompare(
            b.level.level_name || ''
          );
        }

        return a.kra.name.localeCompare(b.kra.name);
      }),
    }));
  }, [grouped, selectedKraSet]); // ← selectedKraSet intentionally removed

  const allVisibleIds = useMemo(
    () => groupedWithRows.flatMap(g => g.rows.map(r => r.kraLevelId)),
    [groupedWithRows]
  );
  // useMemo: .every()/.some() over all visible ids — don't recompute every render
  const allSelected = useMemo(
    () => allVisibleIds.length > 0 && allVisibleIds.every(id => selectedKraSet.has(id)),
    [allVisibleIds, selectedKraSet]
  );
  const someSelected = useMemo(
    () => allVisibleIds.some(id => selectedKraSet.has(id)),
    [allVisibleIds, selectedKraSet]
  );

  const [orgCount, projectCount, totalKraLevelCount] = useMemo(() => [
    categories.filter(c => c.is_standard === true).length,
    categories.filter(c => c.is_standard === false).length,
    kras.reduce((sum, k) => sum + (k.levels?.length ?? 0), 0),
  ], [kras, categories]);
  const toggleExpand = useCallback((cid) => { setExpanded(p => ({ ...p, [cid]: !p[cid] })); }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography fontWeight={800} fontSize={13} color="#0f172a">KRA Library</Typography>
          <Box component="span" color="#3730a3" fontSize={13} fontWeight={700}>
            ({categories.length})
          </Box>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <Chip icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ORG_COLOR.icon, ml: '6px !important' }} />} label="Org" size="small" sx={{ height: 20, fontSize: 9.5, fontWeight: 700, bgcolor: ORG_COLOR.chip, color: ORG_COLOR.text, cursor: 'default' }} />
          <Chip icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PROJ_COLOR.icon, ml: '6px !important' }} />} label="Project" size="small" sx={{ height: 20, fontSize: 9.5, fontWeight: 700, bgcolor: PROJ_COLOR.chip, color: PROJ_COLOR.text, cursor: 'default' }} />
          {selectedKraSet.size > 0 && (
            <Chip label={`${selectedKraSet.size} selected`} size="small" deleteIcon={<ClearIcon sx={{ fontSize: '13px !important' }} />} onDelete={() => onToggleKRA([...selectedKraSet], 'deselect_all')} sx={{ height: 20, fontSize: 9.5, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }} />
          )}
        </Stack>
      </Stack>

      {/*  value={searchRaw} — raw state updates instantly for responsive feel */}
      <TextField size="small" placeholder="Search KRAs…" value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#94a3b8' }} /></InputAdornment>, endAdornment: searchRaw ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearchRaw('')}><ClearIcon sx={{ fontSize: 13 }} /></IconButton></InputAdornment> : null }}
        sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 36, bgcolor: '#f8fafc' } }} />

      <Stack direction="row" gap={1} mb={1.5} alignItems="center">
        <Stack direction="row" sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden', flexShrink: 0, height: 30 }}>
          {[{ v: 'all', l: 'All' }, { v: 'org', l: `Org (${orgCount})` }, { v: 'project', l: `Proj (${projectCount})` }].map(t => (
            <Box key={t.v} onClick={() => setTypeFilter(t.v)} sx={{ px: 2, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, cursor: 'pointer', userSelect: 'none', bgcolor: typeFilter === t.v ? '#1E3A8A' : 'transparent', color: typeFilter === t.v ? '#fff' : '#64748b', '&:hover': { bgcolor: typeFilter === t.v ? '#1E3A8A' : '#f1f5f9' } }}>{t.l}</Box>
          ))}
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, mb: 0.5, borderRadius: 1.5, bgcolor: someSelected ? '#f0f9ff' : '#fafafa', border: `1px solid ${someSelected ? '#bae6fd' : '#f1f5f9'}` }}>
        <Checkbox size="small" disabled={isReadOnly || allVisibleIds.length === 0} indeterminate={someSelected && !allSelected} checked={allSelected} onChange={() => { }} onClick={() => { if (isReadOnly || allVisibleIds.length === 0) return; onToggleKRA(allVisibleIds, allSelected ? 'deselect_all' : 'select_all'); }} sx={{ p: 0.5 }} />
        <Typography fontSize={10} fontWeight={700} color="#475569" textTransform="uppercase" letterSpacing="0.06em" ml={0.75}>Select All Visible ({allVisibleIds.length})</Typography>
        {someSelected && <Typography fontSize={10} color="#0284c7" fontWeight={700} ml="auto">{selectedKraSet.size} / {totalKraLevelCount} total</Typography>}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', pr: 0.5, ...SX.scrollbar }}>
        {groupedWithRows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}><AssignmentIcon sx={{ fontSize: 24, color: '#cbd5e1' }} /></Box>
            <Typography fontSize={13} fontWeight={600} color="#94a3b8">No KRAs found</Typography>
            <Typography fontSize={11} color="#cbd5e1" mt={0.25}>Try adjusting your filters</Typography>
          </Box>
        ) : groupedWithRows.map(group => {
          const catLevelIds = group.rows.map(r => r.kraLevelId);
          const catAll = catLevelIds.length > 0 && catLevelIds.every(id => selectedKraSet.has(id));
          const catSome = catLevelIds.some(id => selectedKraSet.has(id));
          const isOpen = !!expanded[group.cid];
          const tc = typeColor(group.isStd);
          const selCount = catLevelIds.filter(id => selectedKraSet.has(id)).length;
          return (
            <Box key={group.cid} sx={{ mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.85, borderRadius: 1.5, bgcolor: tc.bg, border: `1px solid ${tc.border}`, mb: 0.4 }}>
                <Checkbox size="small" disabled={isReadOnly || (isManager && group.isStd)} indeterminate={catSome && !catAll} checked={catAll && catLevelIds.length > 0} onChange={() => {}} onClick={e => { e.stopPropagation(); if (isReadOnly || (isManager && group.isStd)) return; onToggleKRA(catLevelIds, catAll ? 'deselect_all' : 'select_all'); }} sx={{ p: 0.5, mr: 0.5, flexShrink: 0, color: tc.text, '&.Mui-checked': { color: tc.text } }} />
                <Box flex={1} minWidth={0} onClick={() => toggleExpand(group.cid)} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', userSelect: 'none' }}>
                  <Typography fontSize={12} fontWeight={800} color={tc.text} noWrap>{group.name}</Typography>
                  <Typography fontSize={11} fontWeight={600} color={tc.text} sx={{ opacity: 0.7 }}>({group.rows.length})</Typography>
                  {selCount > 0 && <Chip label={`${selCount} ✓`} size="small" sx={{ height: 15, fontSize: 8, fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRadius: 0.75 }} />}
                  <Box flex={1} />
                  <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{isOpen ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}</Box>
                </Box>
              </Box>
              <Collapse in={isOpen} unmountOnExit>
                <Box sx={{ pl: 1.5 }}>
                  {group.rows.map(({ kra, level, kraLevelId }) => {
                    const isSelected = selectedKraSet.has(kraLevelId);
                    const ktc        = typeColor(kra.is_standard);
                    const dupCount   = employeeDuplicateMap?.get(kraLevelId) ?? 0;
                    const hasDup     = dupCount > 0;
                    const isOrgLocked = isManager && kra.is_standard;
                    const toggle     = () => { if (!isReadOnly && !isOrgLocked) onToggleKRA([kraLevelId], isSelected ? 'deselect' : 'select'); };
                    return (
                      <Box key={kraLevelId} onClick={toggle} sx={{
                        ...SX.kraItemBase,
                        cursor: isReadOnly || isOrgLocked ? 'default' : 'pointer',
                        opacity: isOrgLocked ? 0.5 : 1,
                        bgcolor: isSelected ? '#eff6ff' : hasDup ? '#fefce8' : 'transparent',
                        border: `1px solid ${isSelected ? '#93c5fd' : hasDup ? '#fde68a' : 'transparent'}`,
                        '&:hover': { bgcolor: isReadOnly || isOrgLocked ? 'transparent' : isSelected ? '#dbeafe' : '#f8fafc', border: `1px solid ${isReadOnly || isOrgLocked ? 'transparent' : isSelected ? '#93c5fd' : '#e2e8f0'}` },
                      }}>
                        <Checkbox size="small" checked={isSelected} disabled={isReadOnly || isOrgLocked} onChange={() => {}} onClick={e => { e.stopPropagation(); toggle(); }} sx={{ p: 0, mr: 1.25, flexShrink: 0 }} />
                        <Box flex={1} minWidth={0}>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Typography fontSize={12} fontWeight={isSelected ? 700 : 500} color="#1e293b" noWrap>
                              {kra.name}
                            </Typography>
                            <Typography fontSize={10.5} fontWeight={600} color="#94a3b8" noWrap flexShrink={0}>
                              {level.level_name}
                            </Typography>
                            {hasDup && (
                              <Tooltip title={`${dupCount} selected employee${dupCount > 1 ? 's' : ''} already have this KRA`}>
                                <Chip label={`${dupCount} assigned`} size="small" icon={<WarningAmberIcon sx={{ fontSize: '10px !important', color: '#b45309 !important' }} />} sx={{ height: 15, fontSize: 8, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e', cursor: 'help' }} />
                              </Tooltip>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}); // end KRAPanel memo

// ─── Employee Panel ───────────────────────────────────────────────────────────
const COL_SX = {
  id: { width: 48, flexShrink: 0 },
  name: { flex: 1, minWidth: 0 },
  role: { flex: 1, minWidth: 0 },
};
const HEADER_LABEL_SX = {
  fontSize: 10, fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  '& .MuiTableSortLabel-root': { fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  '& .MuiTableSortLabel-root.Mui-active': { color: '#1E3A8A' },
  '& .MuiTableSortLabel-icon': { fontSize: 13 },
};

// FIX: virtualised employee row — only renders rows visible in the scroll window
const EMP_ROW_H = 52; // px — approximate height of one employee row
const VIRT_OVERSCAN = 5;

const VirtualEmpList = memo(function VirtualEmpList({ items, selectedEmpSet, onToggleEmployee, isReadOnly, onView }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportH(el.clientHeight);
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewportH(el.clientHeight);
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, []);

  const totalH = items.length * EMP_ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / EMP_ROW_H) - VIRT_OVERSCAN);
  const visibleCt = Math.ceil(viewportH / EMP_ROW_H) + VIRT_OVERSCAN * 2;
  const endIdx = Math.min(items.length, startIdx + visibleCt);
  const visible = items.slice(startIdx, endIdx);
  const offsetTop = startIdx * EMP_ROW_H;

  return (
    <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', ...SX.scrollbar }}>
      <Box sx={{ height: totalH, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
          {visible.map(emp => {
            const isSel = selectedEmpSet.has(emp.employee_id);
            const isAssigned = emp.assigned_to_cycle;
            return (
              <Box key={emp.employee_id} sx={{
                ...SX.empItemBase,
                bgcolor: isSel ? '#eff6ff' : 'transparent',
                border: `1px solid ${isSel ? '#93c5fd' : 'transparent'}`,
                '&:hover': { bgcolor: isSel ? '#eff6ff' : '#f8fafc' },
              }}>
                <Checkbox size="small" checked={isSel} disabled={isReadOnly}
                  onChange={() => !isReadOnly && onToggleEmployee([emp.employee_id], isSel ? 'deselect' : 'select')}
                  sx={{ p: 0.5, flexShrink: 0, mr: 0.25 }} />
                <Typography fontSize={10.5} fontWeight={600} color="#94a3b8" sx={COL_SX.id}>
                  {emp.employee_id}
                </Typography>
                <Box sx={{ ...COL_SX.name, ml: 1, minWidth: 0 }}
                  onClick={() => isAssigned && onView(emp)}
                  style={{ cursor: isAssigned ? 'pointer' : 'default' }}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography fontSize={12.5} fontWeight={600} color={isAssigned ? '#1d4ed8' : '#1e293b'} noWrap
                      sx={isAssigned ? { '&:hover': { textDecoration: 'underline' } } : {}}>
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
                <Box sx={{ ...COL_SX.role, ml: 1, minWidth: 0 }}>
                  <Typography fontSize={11} color="#374151" noWrap fontWeight={500}>{emp.title || '—'}</Typography>
                  <Typography fontSize={10} color="#94a3b8" noWrap>{[emp.department, emp.level].filter(Boolean).join(' · ')}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}); // end VirtualEmpList memo

const EmployeePanel = memo(function EmployeePanel({ employees, selectedEmpSet, onToggleEmployee, isReadOnly, onView }) {
  const [searchRaw, setSearchRaw] = useState('');
  const [tab, setTab] = useState(0);
  const [deptFilter, setDept] = useState('');
  const [levelFilter, setLevel] = useState('');
  const [sort, setSort] = useState({ col: 'id', dir: 'asc' });

  //  debounce search
  const search = useDebounce(searchRaw, 180);

  //  pre-build an employee id→object Map so employeeDuplicateMap lookup is O(1)
  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach(e => m.set(e.employee_id, e));
    return m;
  }, [employees]);

  const depts = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
  const levels = useMemo(() => [...new Set(employees.map(e => e.level).filter(Boolean))].sort(), [employees]);

  const handleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    );
  };

  // This eliminates the full re-sort on every checkbox click.
  const filtered = useMemo(() => {
    let list = employees;
    if (tab === 1) list = list.filter(e => e.assigned_to_cycle);
    if (tab === 2) list = list.filter(e => !e.assigned_to_cycle);
    if (deptFilter) list = list.filter(e => e.department === deptFilter);
    if (levelFilter) list = list.filter(e => e.level === levelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.level?.toLowerCase().includes(q) ||
        String(e.employee_id).includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const aSelected = selectedEmpSet.has(a.employee_id);
      const bSelected = selectedEmpSet.has(b.employee_id);

      // selected on top
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      let va, vb;

      if (sort.col === 'id') {
        va = Number(a.employee_id);
        vb = Number(b.employee_id);
        return sort.dir === 'asc' ? va - vb : vb - va;
      }

      if (sort.col === 'name') {
        va = a.full_name?.toLowerCase() ?? '';
        vb = b.full_name?.toLowerCase() ?? '';
      }

      if (sort.col === 'role') {
        va = (a.title || a.department || '').toLowerCase();
        vb = (b.title || b.department || '').toLowerCase();
      }

      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;

      return 0;
    });
    return list;
  }, [employees, tab, deptFilter, levelFilter, search, sort, selectedEmpSet]); // ← selectedEmpSet removed

  // These counts are cheap — they only read employees, not selectedEmpSet
  const assigned = useMemo(() => employees.filter(e => e.assigned_to_cycle).length, [employees]);
  const unassigned = employees.length - assigned;

  // useMemo: avoid re-running .every()/.some() on every render
  const allSel = useMemo(
    () => filtered.length > 0 && filtered.every(e => selectedEmpSet.has(e.employee_id)),
    [filtered, selectedEmpSet]
  );
  const someSel = useMemo(
    () => filtered.some(e => selectedEmpSet.has(e.employee_id)),
    [filtered, selectedEmpSet]
  );
  const hasFilters = deptFilter || levelFilter;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography fontWeight={800} fontSize={13} color="#0f172a">Target Employees</Typography>
          {selectedEmpSet.size > 0 && (
            <Chip label={`${selectedEmpSet.size} selected`} size="small"
              deleteIcon={<ClearIcon sx={{ fontSize: '13px !important' }} />}
              onDelete={() => onToggleEmployee([...selectedEmpSet], 'deselect_all')}
              sx={{ height: 18, fontSize: 9.5, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }} />
          )}
        </Stack>
        <Stack direction="row" gap={0.5}>
          {[{ l: 'All', c: employees.length, v: 0 }, { l: 'Assigned', c: assigned, v: 1 }, { l: 'Unassigned', c: unassigned, v: 2 }].map(t => (
            <Chip key={t.v} label={`${t.l} (${t.c})`} size="small" onClick={() => setTab(t.v)}
              sx={{ height: 22, fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 1.5, bgcolor: tab === t.v ? '#1E3A8A' : '#f1f5f9', color: tab === t.v ? '#fff' : '#64748b' }} />
          ))}
        </Stack>
      </Stack>

      <TextField size="small" placeholder="Search anything…" value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#94a3b8' }} /></InputAdornment>,
          endAdornment: searchRaw ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearchRaw('')}><ClearIcon sx={{ fontSize: 13 }} /></IconButton></InputAdornment> : null,
        }}
        sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 36, bgcolor: '#f8fafc' } }} />

      <Stack direction="row" gap={1} mb={1.25}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <Select value={deptFilter} onChange={e => setDept(e.target.value)} displayEmpty
            sx={{ fontSize: 10.5, height: 30, borderRadius: 1.5, bgcolor: deptFilter ? '#eff6ff' : '#f8fafc' }}>
            <MenuItem value="" sx={{ fontSize: 10.5 }}>All Departments</MenuItem>
            {depts.map(v => <MenuItem key={v} value={v} sx={{ fontSize: 10.5 }}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ flex: 1 }}>
          <Select value={levelFilter} onChange={e => setLevel(e.target.value)} displayEmpty
            sx={{ fontSize: 10.5, height: 30, borderRadius: 1.5, bgcolor: levelFilter ? '#eff6ff' : '#f8fafc' }}>
            <MenuItem value="" sx={{ fontSize: 10.5 }}>All Levels</MenuItem>
            {levels.map(v => <MenuItem key={v} value={v} sx={{ fontSize: 10.5 }}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        {hasFilters && (
          <Button size="small" onClick={() => { setDept(''); setLevel(''); }}
            sx={{ fontSize: 10, color: '#64748b', minWidth: 0, px: 1, height: 30, flexShrink: 0 }}>Clear</Button>
        )}
      </Stack>

      {/* Table header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pb: 0.75, mb: 0.25, borderBottom: '2px solid #f1f5f9' }}>
        <Checkbox size="small" disabled={isReadOnly}
          indeterminate={someSel && !allSel} checked={allSel && filtered.length > 0}
          onChange={() => !isReadOnly && onToggleEmployee(filtered.map(e => e.employee_id), allSel ? 'deselect_all' : 'select_all')}
          sx={{ p: 0.5, flexShrink: 0, mr: 0.25 }} />
        <Box sx={{ ...COL_SX.id, ...HEADER_LABEL_SX }}>
          <TableSortLabel active={sort.col === 'id'} direction={sort.col === 'id' ? sort.dir : 'asc'} onClick={() => handleSort('id')}
            sx={{ fontSize: 10, fontWeight: 700, color: sort.col === 'id' ? '#1E3A8A' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', '& .MuiTableSortLabel-icon': { fontSize: 13 } }}>ID</TableSortLabel>
        </Box>
        <Box sx={{ ...COL_SX.name, ml: 1, ...HEADER_LABEL_SX }}>
          <TableSortLabel active={sort.col === 'name'} direction={sort.col === 'name' ? sort.dir : 'asc'} onClick={() => handleSort('name')}
            sx={{ fontSize: 10, fontWeight: 700, color: sort.col === 'name' ? '#1E3A8A' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', '& .MuiTableSortLabel-icon': { fontSize: 13 } }}>Employee</TableSortLabel>
        </Box>
        <Box sx={{ ...COL_SX.role, ml: 1, ...HEADER_LABEL_SX }}>
          <TableSortLabel active={sort.col === 'role'} direction={sort.col === 'role' ? sort.dir : 'asc'} onClick={() => handleSort('role')}
            sx={{ fontSize: 10, fontWeight: 700, color: sort.col === 'role' ? '#1E3A8A' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', '& .MuiTableSortLabel-icon': { fontSize: 13 } }}>Role / Level</TableSortLabel>
        </Box>
      </Box>

      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
            <PersonIcon sx={{ fontSize: 24, color: '#cbd5e1' }} />
          </Box>
          <Typography fontSize={13} fontWeight={600} color="#94a3b8">No employees found</Typography>
        </Box>
      ) : (
        //  virtualised list — only DOM nodes for visible rows are created
        <VirtualEmpList
          key={`${filtered.length}-${selectedEmpSet.size}`}
          items={filtered}
          selectedEmpSet={selectedEmpSet}
          onToggleEmployee={onToggleEmployee}
          isReadOnly={isReadOnly}
          onView={onView}
        />
      )}
    </Box>
  );
}); // end EmployeePanel memo

// ─── Preview & Assign Modal ───────────────────────────────────────────────────
function PreviewAssignModal({
  open, onClose,
  selectedKraLevelIds, selectedEmployeeIds,
  kraLibrary, categories, employees,
  onConfirmAssign,
  assigning,
}) {
  const [localKraIds, setLocalKraIds] = useState([]);
  const [localEmpIds, setLocalEmpIds] = useState([]);

  useEffect(() => {
    if (open) {
      setLocalKraIds([...selectedKraLevelIds]);
      setLocalEmpIds([...selectedEmployeeIds]);
    }
  }, [open, selectedKraLevelIds, selectedEmployeeIds]);

  //  build a Set for O(1) localKraIds lookup
  const localKraIdSet = useMemo(() => new Set(localKraIds), [localKraIds]);

  const selectedKraObjects = useMemo(() =>
    kraLibrary.flatMap(kra =>
      (kra.levels ?? [])
        .filter(level => localKraIdSet.has(makeKey(kra.id, level)))
        .map(level => ({
          kra, level,
          key: makeKey(kra.id, level),
          categoryName: categories.find(c => c.id === kra.category_id)?.name ?? kra.category_name ?? '',
        }))
    ), [kraLibrary, localKraIdSet, categories]);

  // FIX: build a Set for O(1) localEmpIds lookup
  const localEmpIdSet = useMemo(() => new Set(localEmpIds), [localEmpIds]);
  const selectedEmps = useMemo(
    () => employees.filter(e => localEmpIdSet.has(e.employee_id)),
    [employees, localEmpIdSet]
  );

  const groupedKras = useMemo(() => {
    const map = {};
    selectedKraObjects.forEach(item => {
      const cid = item.kra.category_id ?? '__none__';
      if (!map[cid]) map[cid] = { name: item.categoryName, isStd: item.kra.is_standard, items: [] };
      map[cid].items.push(item);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedKraObjects]);

  const canAssign = localKraIds.length > 0 && localEmpIds.length > 0 && !assigning;

  const handleAssign = async () => {
    const kraLevelIds = [];
    const kraLevelToKraId = {};
    const kraSelections = [];
    localKraIds.forEach(compositeKey => {
      for (const kra of kraLibrary) {
        for (const level of (kra.levels ?? [])) {
          if (makeKey(kra.id, level) === compositeKey) {
            const actualLevelId = getLevelId(level);
            if (!isNaN(actualLevelId) && actualLevelId > 0) {
              kraLevelIds.push(actualLevelId);
              kraLevelToKraId[actualLevelId] = kra.id;
              kraSelections.push({ kra_id: kra.id, kra_level_id: level.level_id ?? actualLevelId });
            }
            break;
          }
        }
      }
    });
    const selectedKras = kraLibrary.filter(k => (k.levels ?? []).some(l => localKraIdSet.has(makeKey(k.id, l))));
    const uniqueCatIds = [...new Set(selectedKras.map(k => k.category_id))];
    const cats = uniqueCatIds.map(cid => ({ category_id: cid, weightage: '0' }));
    await onConfirmAssign({ localEmpIds, kraLevelIds, kraSelections, kraLevelToKraId, categories: cats, kra_level_ids: kraLevelIds });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: '82vh', maxHeight: '82vh', display: 'flex', flexDirection: 'column' } }}>

      <Box sx={{ background: G, px: 3, py: 2, color: '#fff', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography fontWeight={800} fontSize={15}>Assignment Preview</Typography>
            <Typography fontSize={11} sx={{ opacity: 0.7, mt: 0.15 }}>Review selections — deselect any you don't want, then assign</Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="center" sx={{ ml: 'auto', mr: 2 }}>
            <Chip label={`${localKraIds.length} KRA${localKraIds.length !== 1 ? 's' : ''}`} size="small" sx={{ height: 20, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
            <Chip label={`${localEmpIds.length} employee${localEmpIds.length !== 1 ? 's' : ''}`} size="small" sx={{ height: 20, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
            {selectedEmps.some(e => e.assigned_to_cycle) && (
              <Chip label="Some already have KRAs — will append" size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 650, bgcolor: 'rgba(253,230,138,0.2)', color: '#fde68a' }} />
            )}
          </Stack>
        </Stack>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'hidden', flex: 1, display: 'flex', minHeight: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', width: '100%' }}>
          <Box sx={{ borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, pt: 1.75, pb: 1, borderBottom: '1px solid #f8fafc', flexShrink: 0 }}>
              <Typography fontWeight={700} fontSize={12} color="#475569" textTransform="uppercase" letterSpacing="0.05em">KRAs</Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1, ...SX.scrollbar }}>
              {localKraIds.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}><Typography fontSize={12} color="#94a3b8">No KRAs selected</Typography></Box>
              ) : groupedKras.map(group => {
                const tc = group.isStd ? ORG_COLOR : PROJ_COLOR;
                return (
                  <Box key={group.name} sx={{ mb: 1 }}>
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ px: 0.75, py: 0.4, mb: 0.25, borderRadius: 1, bgcolor: tc.bg, border: `1px solid ${tc.border}` }}>
                      <Typography fontSize={10} fontWeight={800} color={tc.text} noWrap>{group.name}</Typography>
                      <Chip label={group.isStd ? 'Org' : 'Proj'} size="small" sx={{ height: 13, fontSize: 7.5, fontWeight: 700, bgcolor: tc.chip, color: tc.text, borderRadius: 0.5 }} />
                    </Stack>
                    {group.items.map(({ kra, level, key }) => (
                      <Stack key={key} direction="row" alignItems="center" gap={0.75} sx={{ px: 0.75, py: 0.60, borderRadius: 1, mb: 0.2, bgcolor: '#fafafa', border: '1px solid transparent', '&:hover': { bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }, transition: 'all 0.1s' }}>
                        <Typography fontSize={12} fontWeight={500} color="#1e293b" noWrap sx={{ flex: 1, minWidth: 0 }}>{kra.name}</Typography>
                        <Chip label={level.level_name} size="small" sx={{ height: 15, fontSize: 8, fontWeight: 600, bgcolor: '#f0f9ff', color: '#0369a1', flexShrink: 0 }} />
                        <IconButton size="small" onClick={() => setLocalKraIds(p => p.filter(k => k !== key))}
                          sx={{ p: 0.3, flexShrink: 0, color: '#cbd5e1', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}>
                          <CloseIcon sx={{ fontSize: 11 }} />
                        </IconButton>
                      </Stack>
                    ))}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, pt: 1.75, pb: 1, borderBottom: '1px solid #f8fafc', flexShrink: 0 }}>
              <Typography fontWeight={700} fontSize={12} color="#475569" textTransform="uppercase" letterSpacing="0.05em">Employees</Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1, ...SX.scrollbar }}>
              {localEmpIds.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}><Typography fontSize={12} color="#94a3b8">No employees selected</Typography></Box>
              ) : selectedEmps.map(emp => {
                const hasExisting = emp.assigned_to_cycle;
                return (
                  <Stack key={emp.employee_id} direction="row" alignItems="center" gap={0.75} sx={{ px: 0.75, py: 0.65, borderRadius: 1, mb: 0.3, bgcolor: hasExisting ? '#fffbeb' : '#fafafa', border: `1px solid ${hasExisting ? '#fde68a' : 'transparent'}`, '&:hover': { bgcolor: hasExisting ? '#fef9c3' : '#f1f5f9', border: `1px solid ${hasExisting ? '#fbbf24' : '#e2e8f0'}` }, transition: 'all 0.1s' }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: 0.75, background: G, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                      {initials(emp.full_name)}
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Typography fontSize={12} fontWeight={600} color="#1e293b" noWrap>{emp.full_name}</Typography>
                        {hasExisting && (
                          <Tooltip title="Already has KRAs — new ones will be appended">
                            <CheckCircleIcon sx={{ fontSize: 11, color: '#f59e0b', flexShrink: 0 }} />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography fontSize={10} color="#94a3b8" noWrap>{[emp.department, emp.level].filter(Boolean).join(' · ')}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setLocalEmpIds(p => p.filter(id => id !== emp.employee_id))}
                      sx={{ p: 0.3, flexShrink: 0, color: '#cbd5e1', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}>
                      <CloseIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Stack>
                );
              })}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #f1f5f9', gap: 1 }}>
        <Button onClick={onClose} sx={{ color: '#64748b', fontWeight: 600, fontSize: 12, borderRadius: 1.5 }}>Cancel</Button>
        <Button variant="contained" disabled={!canAssign} onClick={handleAssign}
          startIcon={assigning ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <AssignmentIcon sx={{ fontSize: 15 }} />}
          sx={{ fontSize: 12, fontWeight: 700, background: G, borderRadius: 1.75, px: 2.5, height: 36, '&:hover': { opacity: 0.9 }, '&:disabled': { opacity: 0.4 } }}>
          {assigning ? 'Assigning…' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Compact Selection Bar ────────────────────────────────────────────────────
function SelectionBar({ selectedKraIds, selectedEmpIds, onClearAll, onPreview, onAssign, assigning, isReadOnly }) {
  if (selectedKraIds.length === 0 && selectedEmpIds.length === 0) return null;
  const canAssign = !assigning && selectedKraIds.length > 0 && selectedEmpIds.length > 0 && !isReadOnly;
  return (
    <Paper elevation={0} sx={{ position: 'sticky', bottom: 0, zIndex: 10, borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#fff', boxShadow: '0 -4px 20px -4px rgba(30,58,138,0.12)', overflow: 'hidden', alignSelf: 'flex-end' }}>
      <Box sx={{ px: 2, py: 0.85 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Button size="small" onClick={onClearAll} startIcon={<ClearIcon sx={{ fontSize: 12 }} />}
            sx={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 1.5, height: 30, px: 1.25, flexShrink: 0, '&:hover': { color: '#ef4444', bgcolor: '#fef2f2', borderColor: '#fecaca' } }}>
            Clear all
          </Button>
          <Button size="small" onClick={onPreview} disabled={!canAssign} startIcon={<VisibilityIcon sx={{ fontSize: 13 }} />}
            sx={{ fontSize: 11, fontWeight: 700, color: '#1E3A8A', border: '1px solid #bfdbfe', borderRadius: 1.5, height: 30, px: 1.5, bgcolor: '#eff6ff', flexShrink: 0, '&:hover': { bgcolor: '#dbeafe' }, '&:disabled': { opacity: 0.4 } }}>
            Preview
          </Button>
          <Button variant="contained" size="small" disabled={!canAssign} onClick={onAssign}
            startIcon={assigning ? <CircularProgress size={11} sx={{ color: '#fff' }} /> : <AssignmentIcon sx={{ fontSize: 13 }} />}
            sx={{ fontSize: 11, fontWeight: 800, background: G, color: '#fff', borderRadius: 1.5, height: 30, px: 1.75, flexShrink: 0, boxShadow: '0 2px 8px rgba(30,58,138,0.3)', '&:hover': { opacity: 0.9 }, '&:disabled': { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none' } }}>
            {assigning ? 'Assigning…' : 'Assign'}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

function ToastStack({ toasts }) {
  return (
    <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
      {toasts.map(t => (
        <Fade key={t.id} in>
          <Alert severity={t.severity} sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12.5, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 300, maxWidth: 480 }}>{t.msg}</Alert>
        </Fade>
      ))}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkAssignmentPage() {
  const { toasts, push: showToast } = useToasts();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refetching, setRefetching] = useState(false);
  const [categories, setCategories] = useState([]);
  const [allCycles, setAllCycles] = useState({ active: [], draft: [], closed: [] });
  const [kraLibrary, setKraLibrary] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [assignedKRAMap, setAssignedKRAMap] = useState({});

  const [selectedKraSet, setSelectedKraSet] = useState(new Set());
  const [selectedEmpSet, setSelectedEmpSet] = useState(new Set());

  const [assigning, setAssigning] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [cloneDefault, setCloneDefault] = useState(false);
  const hasMounted = useRef(false);
  const [leftPct, setLeftPct] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const isReadOnly = !WRITE_STAGES.includes(activeCycle?.status);
  const canEdit    = !isReadOnly;
  const { isManager, isAdmin } = useRoleAccess();
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(Math.max(pct, 25), 75));
    };
    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const selectedKraLevelIds = useMemo(() => [...selectedKraSet], [selectedKraSet]);
  const selectedEmployeeIds = useMemo(() => [...selectedEmpSet], [selectedEmpSet]);

  //  pre-index kraLibrary by levelId for O(1) lookups everywhere
  const kraLevelIndexMap = useMemo(() => {
    const idx = new Map();
    kraLibrary.forEach(kra => {
      (kra.levels ?? []).forEach(level => {
        idx.set(getLevelId(level), { kra, level });
      });
    });
    return idx;
  }, [kraLibrary]);

  //  pre-index employees by employee_id — eliminates O(n) .find() inside loops
  const employeeIndexMap = useMemo(() => {
    const m = new Map();
    employees.forEach(e => m.set(e.employee_id, e));
    return m;
  }, [employees]);

  const employeeDuplicateMap = useMemo(() => {
    const map = new Map();
    selectedEmpSet.forEach(empId => {
      const emp = employeeIndexMap.get(empId);          // O(1)
      if (!emp?.assigned_to_cycle || !emp.employee_kra_cycle_id) return;
      const cached = assignedKRAMap[emp.employee_kra_cycle_id] ?? [];
      cached.forEach(levelId => {
        const entry = kraLevelIndexMap.get(levelId);    // O(1)
        if (!entry) return;
        const compositeKey = makeKey(entry.kra.id, entry.level);
        map.set(compositeKey, (map.get(compositeKey) ?? 0) + 1);
      });
    });
    return map;
  }, [selectedEmpSet, employeeIndexMap, assignedKRAMap, kraLevelIndexMap]);

    const rebuildAssignedMap = useCallback((empList) => {
    const map = {};
    const corrections = {}; 

    empList.forEach(e => {
      if (!e.employee_kra_cycle_id) {
        // No cycle record at all — ensure marked unassigned
        if (e.assigned_to_cycle) corrections[e.employee_id] = false;
        return;
      }

      const apiKraLevelIds = (e.assigned_kras ?? [])
        .map(k => k.kra_level_id)
        .filter(Boolean);

      const apiCategories = e.assigned_categories ?? [];
      const existingCache = getAssignmentFromCache(e.employee_kra_cycle_id);

      const apiHasRealWeightages = apiCategories.some(c => parseFloat(c.weightage) > 0);
      const categoriesToSave = apiHasRealWeightages
        ? apiCategories
        : (existingCache?.categories?.length ? existingCache.categories : apiCategories);

      if (apiKraLevelIds.length > 0) {
        saveAssignmentToCache({
          employee_kra_cycle_id: e.employee_kra_cycle_id,
          cycle_id: activeCycle?.id,
          categories: categoriesToSave,
          kra_level_ids: apiKraLevelIds,
        });
        map[e.employee_kra_cycle_id] = apiKraLevelIds;

        if (!e.assigned_to_cycle) corrections[e.employee_id] = true;

      } else {
        removeAssignmentFromCache(e.employee_kra_cycle_id);
        map[e.employee_kra_cycle_id] = [];

        if (e.assigned_to_cycle) corrections[e.employee_id] = false;
      }
    });

    setAssignedKRAMap(map);

    if (Object.keys(corrections).length > 0) {
      setEmployees(prev => prev.map(e =>
        e.employee_id in corrections
          ? { ...e, assigned_to_cycle: corrections[e.employee_id] }
          : e
      ));
    }
  }, [activeCycle?.id]);

  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    (async () => {
      try {
        setLoading(true);
        const { categories: cats, activeCycle: ac, allCycles: cycles, kraLibrary: kl } = await loadKRAAssignmentPageData();
        setCategories(cats); setKraLibrary(kl); setAllCycles(cycles);
        const paramCycleId = searchParams.get('cycleId');
        const allFlat = [...(cycles.active ?? []), ...(cycles.draft ?? []), ...(cycles.closed ?? [])];
        const preSelected = paramCycleId ? allFlat.find(c => String(c.id) === String(paramCycleId)) : null;
        const chosenCycle = preSelected ?? ac;
        setActiveCycle(chosenCycle);
        if (chosenCycle) {
          const res = await getEmployees(chosenCycle.id);
          const emps = res.data.employees ?? [];
          setEmployees(emps);
          rebuildAssignedMap(emps);
        }
      } catch { setError('Unable to load the page. Please check your connection and try again.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleRefresh = useCallback(async (cycleId, { includeKraLibrary = false } = {}) => {
    const id = cycleId ?? activeCycle?.id;
    if (!id) return;
    try {
      setRefetching(true);
      const fetches = [getEmployees(id)];
      if (includeKraLibrary) fetches.push(loadKRAAssignmentPageData());
      const [empRes, pageData] = await Promise.all(fetches);
      const emps = empRes.data.employees ?? [];
      setEmployees(emps);
      rebuildAssignedMap(emps);
      if (pageData) { setKraLibrary(pageData.kraLibrary); setCategories(pageData.categories); }
    } catch { showToast('Could not refresh data.', 'error'); }
    finally { setRefetching(false); }
  }, [activeCycle, rebuildAssignedMap]);

  const handleManualRefresh = useCallback(() => {
    handleRefresh(undefined, { includeKraLibrary: true });
  }, [handleRefresh]);

  const handleCycleChange = async (cycleId) => {
    const found = [...(allCycles.active ?? []), ...(allCycles.draft ?? []), ...(allCycles.closed ?? [])].find(c => c.id === cycleId);
    if (!found) return;
    setActiveCycle(found);
    setSelectedKraSet(new Set());
    setSelectedEmpSet(new Set());
    setGlobalLoading(true);
    setGlobalLoadingMsg('Loading cycle data…');
    try {
      await handleRefresh(cycleId, { includeKraLibrary: true });
    } finally {
      setGlobalLoading(false);
      setGlobalLoadingMsg('');
    }
  };

  const handleToggleKRA = useCallback((ids, mode) => {
    setSelectedKraSet(prev => {
      const next = new Set(prev);
      if (mode === 'select_all' || mode === 'select') ids.forEach(id => next.add(id));
      if (mode === 'deselect_all' || mode === 'deselect') ids.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const handleToggleEmployee = useCallback((ids, mode) => {
    setSelectedEmpSet(prev => {
      const next = new Set(prev);
      if (mode === 'select_all' || mode === 'select') ids.forEach(id => next.add(id));
      if (mode === 'deselect_all' || mode === 'deselect') ids.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const doAssign = useCallback(async ({ localEmpIds, kraLevelIds, kraSelections, kraLevelToKraId, categories: cats, kra_level_ids }) => {
    setAssigning(true);
    setPreviewOpen(false);
    setGlobalLoading(true);
    setGlobalLoadingMsg('Assigning KRAs…');
    try {
      const selEmps = localEmpIds.map(id => employeeIndexMap.get(id)).filter(Boolean);
      const payload = {
        assignments: selEmps.map(e => ({ employee_id: e.employee_id, employee_level_id: e.level_id ?? null })),
        shared: {
          categories: cats,
          kra_level_ids,
          kra_selections: kraSelections ?? [],
          kra_level_to_kra_id: kraLevelToKraId ?? {},
          is_date_based: false,
        },
        enrol_mode: 'append',
      };
      const res = await bulkAssignKRAs(activeCycle.id, payload);
      const { enrolled = [], skipped = [], failed = [] } = res.data;

      if (enrolled.length > 0) {
        const enrolledMap = new Map(enrolled.map(e => [e.employee_id, e]));
        setEmployees(prev => prev.map(emp => {
          const entry = enrolledMap.get(emp.employee_id);
          if (!entry) return emp;
          return {
            ...emp,
            assigned_to_cycle: true,
            employee_kra_cycle_id: entry.employee_kra_cycle_id ?? emp.employee_kra_cycle_id,
          };
        }));
      }

      if (failed.length === 0) {
        const parts = [];
        if (enrolled.length) parts.push(`${enrolled.length} assigned`);
        if (skipped.length) parts.push(`${skipped.length} skipped (already had these KRAs)`);
        showToast(parts.join(', ') + '.', 'success');
      } else {
        showToast(
          enrolled.length > 0
            ? `${enrolled.length} assigned, ${failed.length} failed.`
            : 'Assignment failed.',
          enrolled.length > 0 ? 'warning' : 'error'
        );
      }

      await handleRefresh();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Assignment failed.', 'error');
    } finally {
      setAssigning(false);
      setGlobalLoading(false);
      setGlobalLoadingMsg('');
    }
  }, [activeCycle, employeeIndexMap, showToast, handleRefresh]);

  const handleDirectAssign = useCallback(async () => {
    const kraLevelIds = [];
    const kraLevelToKraId = {};
    const kraSelections = [];
    selectedKraLevelIds.forEach(compositeKey => {
      for (const kra of kraLibrary) {
        for (const level of (kra.levels ?? [])) {
          if (makeKey(kra.id, level) === compositeKey) {
            const actualLevelId = getLevelId(level);
            if (!isNaN(actualLevelId) && actualLevelId > 0) {
              kraLevelIds.push(actualLevelId);
              kraLevelToKraId[actualLevelId] = kra.id;
              kraSelections.push({ kra_id: kra.id, kra_level_id: level.level_id ?? actualLevelId });
            }
            break;
          }
        }
      }
    });
    const selectedKras = kraLibrary.filter(k => (k.levels ?? []).some(l => selectedKraLevelIds.includes(makeKey(k.id, l))));
    const uniqueCatIds = [...new Set(selectedKras.map(k => k.category_id))];
    const cats = uniqueCatIds.map(cid => ({ category_id: cid, weightage: '0' }));
    await doAssign({ localEmpIds: selectedEmployeeIds, kraLevelIds, kraSelections, kraLevelToKraId, categories: cats, kra_level_ids: kraLevelIds });
  }, [selectedKraLevelIds, selectedEmployeeIds, kraLibrary, doAssign]);

    const handleSaveWeightages = async (emp, weightagesMap) => {
      const cats = Object.entries(weightagesMap).map(([category_id, weightage]) => ({
        category_id: Number(category_id),
        weightage: String(parseFloat(weightage) || 0),
      }));
      const kraLevelIds = assignedKRAMap[emp.employee_kra_cycle_id] ?? [];
      await updateAssignment(emp.employee_kra_cycle_id, {
        employee_level_id: emp.level_id ?? null,
        is_date_based: false,
        categories: cats,
        kra_level_ids: kraLevelIds,
      });

      saveAssignmentToCache({
        employee_kra_cycle_id: emp.employee_kra_cycle_id,
        cycle_id: activeCycle?.id,
        categories: cats,
        kra_level_ids: kraLevelIds,
      });

      setEmployees(prev => prev.map(e =>
        e.employee_id === emp.employee_id
          ? { ...e, assigned_categories: cats }
          : e
      ));

      await handleRefresh();
    };

  const handleDeleteKRAs = async (emp, kraKeys) => {
    // Extract numeric level IDs from composite "kraId-levelId" keys
    const levelIdsToDelete = new Set(
      kraKeys
        .map(key => {
          const parts = key.split('-');
          return Number(parts[parts.length - 1]);
        })
        .filter(n => !isNaN(n) && n > 0)
    );

    // Use API data (emp.assigned_kras) as source of truth, NOT the local cache
    // Cache can be stale/merged with ghost IDs from previous operations
    const apiKraLevelIds = (emp.assigned_kras ?? [])
      .map(k => k.kra_level_id)
      .filter(Boolean);

    // Fall back to cache only if API gave us nothing
    const baseIds = apiKraLevelIds.length > 0
      ? apiKraLevelIds
      : (assignedKRAMap[emp.employee_kra_cycle_id] ?? []);

    const kraLevelIdsToKeep = baseIds.filter(levelId => !levelIdsToDelete.has(levelId));

    const remainingCatIds = new Set(
      kraLevelIdsToKeep.flatMap(levelId => {
        const entry = kraLevelIndexMap.get(levelId);
        return entry ? [entry.kra.category_id] : [];
      })
    );

    // Use API categories (emp.assigned_categories) as source of truth too
    const sourceCats = emp.assigned_categories?.length
      ? emp.assigned_categories
      : getAssignmentFromCache(emp.employee_kra_cycle_id)?.categories ?? [];

    const cachedCats = sourceCats.filter(c => remainingCatIds.has(c.category_id));

    try {
      await updateAssignment(emp.employee_kra_cycle_id, {
        employee_level_id: emp.level_id ?? null,
        is_date_based: false,
        categories: cachedCats,
        kra_level_ids: kraLevelIdsToKeep,
      });

      // After successful API call, update cache with clean data
      saveAssignmentToCache({
        employee_kra_cycle_id: emp.employee_kra_cycle_id,
        cycle_id: activeCycle.id,
        categories: cachedCats,
        kra_level_ids: kraLevelIdsToKeep,
      });

      setAssignedKRAMap(prev => ({
        ...prev,
        [emp.employee_kra_cycle_id]: kraLevelIdsToKeep,
      }));

      if (kraLevelIdsToKeep.length === 0) {
        setEmployees(prev => prev.map(e =>
          e.employee_kra_cycle_id === emp.employee_kra_cycle_id
            ? { ...e, assigned_to_cycle: false }
            : e
        ));
      }

      showToast(
        `${kraKeys.length} KRA${kraKeys.length !== 1 ? 's' : ''} deleted.`,
        'success'
      );
      handleRefresh();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Delete failed.', 'error');
    }
  };

  const handleDeleteEmployee = async (emp) => {
    try {
      await removeEmployeeFromCycle(emp.employee_kra_cycle_id);
      removeAssignmentFromCache(emp.employee_kra_cycle_id);
      setEmployees(prev => prev.map(e =>
        e.employee_id === emp.employee_id ? { ...e, assigned_to_cycle: false, employee_kra_cycle_id: null } : e
      ));
      setAssignedKRAMap(prev => { const next = { ...prev }; delete next[emp.employee_kra_cycle_id]; return next; });
      showToast(`${emp.full_name} removed.`, 'success');
      handleRefresh();  // ← add this
    } catch (e) { showToast(e?.response?.data?.message || 'Remove failed.', 'error'); }
  };

  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalLoadingMsg, setGlobalLoadingMsg] = useState('');
  const handleBulkDelete = async () => {
    setGlobalLoading(true);
    setGlobalLoadingMsg('Unassigning KRAs from employees...');
    const toDelete = employees.filter(e => selectedEmpSet.has(e.employee_id) && e.assigned_to_cycle && e.employee_kra_cycle_id);
    if (!toDelete.length) { showToast('None of the selected employees have assignments to remove.', 'info'); return; }
    try {
      await bulkRemoveEmployees(toDelete.map(e => e.employee_kra_cycle_id));
      bulkRemoveFromCache(toDelete.map(e => e.employee_kra_cycle_id));
      const removedEkIds = new Set(toDelete.map(e => e.employee_kra_cycle_id));
      const removedEmpIds = new Set(toDelete.map(e => e.employee_id));
      setEmployees(prev => prev.map(e =>
        removedEmpIds.has(e.employee_id) ? { ...e, assigned_to_cycle: false, employee_kra_cycle_id: null } : e
      ));
      setAssignedKRAMap(prev => { const next = { ...prev }; removedEkIds.forEach(id => delete next[id]); return next; });
      setSelectedEmpSet(new Set());
      showToast(`${toDelete.length} employee${toDelete.length !== 1 ? 's' : ''} removed.`, 'success');
      handleRefresh();
    } catch { showToast('Bulk remove failed.', 'error'); }
    finally { setGlobalLoading(false); setGlobalLoadingMsg(''); }

  };

  const handleCloneEmployee = (emp) => { setCloneDefault(true); setViewEmployee(emp); };
  const handleViewEmployee = (emp) => { setCloneDefault(false); setViewEmployee(emp); };

  const handleCloneTo = async (targetEmployeeIds, mode, selectedKraKeys = []) => {
    try {
      const allSelected = employees.filter(e => targetEmployeeIds.includes(e.employee_id));
      const assigned = allSelected.filter(e => e.employee_kra_cycle_id != null);
      const unassigned = allSelected.filter(e => e.employee_kra_cycle_id == null);

      const sourceCache = getAssignmentFromCache(viewEmployee.employee_kra_cycle_id);
      const allSourceKraIds = sourceCache?.kra_level_ids ?? [];
      const sourceCategories = sourceCache?.categories ?? [];

      // Keys from checkedKRAs are "kraId-levelId" (dash-separated).
      // Extract the numeric kra_level_id from each key and filter allSourceKraIds.
      let kraIdsToClone;
      if (selectedKraKeys.length > 0) {
        const selectedLevelIds = new Set(
          selectedKraKeys.map(key => {
            const parts = key.split('-');
            return Number(parts[parts.length - 1]);
          }).filter(n => !isNaN(n) && n > 0)
        );
        kraIdsToClone = allSourceKraIds.filter(id => selectedLevelIds.has(id));
        // If nothing matched (e.g. key format mismatch), fall back to all
        if (kraIdsToClone.length === 0) kraIdsToClone = allSourceKraIds;
      } else {
        kraIdsToClone = allSourceKraIds;
      }

      // Derive categories that are relevant to the KRAs being cloned
      const kraIdsToCloneSet = new Set(kraIdsToClone);
      const relevantCatIds = new Set(
        kraIdsToClone.flatMap(levelId => {
          const entry = kraLevelIndexMap.get(levelId);
          return entry ? [entry.kra.category_id] : [];
        })
      );
      //  AFTER — zero out weightages for clone targets
      const relevantCatIdsForClone = new Set(
        kraIdsToClone.flatMap(levelId => {
          const entry = kraLevelIndexMap.get(levelId);
          return entry ? [entry.kra.category_id] : [];
        })
      );
      const finalCategories = [...relevantCatIdsForClone].map(cid => ({
        category_id: cid,
        weightage: '0',
      }));

      // Step 1 — enrol unassigned employees with only the selected KRAs
      let newlyEnrolled = [];
      if (unassigned.length > 0) {
        const enrolRes = await bulkAssignKRAs(
          activeCycle.id,
          {
            assignments: unassigned.map(e => ({ employee_id: e.employee_id })),
            shared: {
              kra_level_ids: kraIdsToClone,
              categories: finalCategories,
              is_date_based: false,
            },
            enrol_mode: 'skip',
          }
        );

        newlyEnrolled = enrolRes?.data?.enrolled ?? [];

        // Update employees state with their new employee_kra_cycle_id
        setEmployees(prev => {
          const enrolMap = {};
          newlyEnrolled.forEach(e => { enrolMap[e.employee_id] = e.employee_kra_cycle_id; });
          return prev.map(e =>
            enrolMap[e.employee_id]
              ? { ...e, assigned_to_cycle: true, employee_kra_cycle_id: enrolMap[e.employee_id] }
              : e
          );
        });
      }

      // Step 2 — copy selected KRAs to already-assigned employees via bulk assign append
      const assignedCycleIds = assigned.map(e => e.employee_kra_cycle_id);
      const newlyEnrolledCycleIds = newlyEnrolled.map(e => e.employee_kra_cycle_id);
      const allTargetCycleIds = [...assignedCycleIds, ...newlyEnrolledCycleIds];

      if (assigned.length > 0) {
        await bulkAssignKRAs(
          activeCycle.id,
          {
            assignments: assigned.map(e => ({ employee_id: e.employee_id })),
            shared: {
              kra_level_ids: kraIdsToClone,
              categories: finalCategories,
              is_date_based: false,
            },
            enrol_mode: 'append',
          }
        );
      }

      // Step 3 — update cache for all targets
      allTargetCycleIds.forEach(ekId => {
        const targetCache = getAssignmentFromCache(ekId);
        const mergedIds = [...new Set([...(targetCache?.kra_level_ids ?? []), ...kraIdsToClone])];
        const catMap = {};
        (targetCache?.categories ?? []).forEach(c => { catMap[c.category_id] = c; });
        finalCategories.forEach(c => { if (!catMap[c.category_id]) catMap[c.category_id] = c; });
        saveAssignmentToCache({
          employee_kra_cycle_id: ekId,
          cycle_id: activeCycle.id,
          categories: Object.values(catMap),
          kra_level_ids: mergedIds,
        });
      });

      // Step 4 — update assignedKRAMap
      setAssignedKRAMap(prev => {
        const next = { ...prev };
        allTargetCycleIds.forEach(ekId => {
          next[ekId] = [...new Set([...(prev[ekId] ?? []), ...kraIdsToClone])];
        });
        return next;
      });

      const total = allTargetCycleIds.length;
      showToast(
        `${kraIdsToClone.length} KRA${kraIdsToClone.length !== 1 ? 's' : ''} copied to ${total} employee${total !== 1 ? 's' : ''}${unassigned.length > 0 ? ` (${unassigned.length} newly enrolled)` : ''}.`,
        'success'
      );

      await handleRefresh();

    } catch (e) {
      showToast(e?.response?.data?.error || 'Copy failed.', 'error');
    }
  };

  // useMemo: only recompute when employees or selection changes
  const selectedAssigned = useMemo(
    () => employees.filter(e => selectedEmpSet.has(e.employee_id) && e.assigned_to_cycle),
    [employees, selectedEmpSet]
  );

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2, bgcolor: '#f8fafc' }}>
      <Box sx={{ width: 56, height: 56, borderRadius: 2, background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(30,58,138,0.3)' }}><AssignmentIcon sx={{ fontSize: 28, color: '#fff' }} /></Box>
      <CircularProgress size={20} sx={{ color: '#1E3A8A' }} />
      <Typography fontSize={13} color="#94a3b8" fontWeight={500}>Loading KRA Assignment…</Typography>
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3 }}><Alert severity="error" action={<Button size="small" onClick={() => window.location.reload()}>Retry</Button>}>{error}</Alert></Box>
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
                sx={{ fontSize: 11, fontWeight: 700, color: '#ef4444', border: '1px solid #fecaca', borderRadius: 1.5, height: 32, px: 1.5, '&:hover': { bgcolor: '#fef2f2', border: '1px solid #f87171' } }}>
                Unassign {selectedAssigned.length} Selected
              </Button>
            )}
            <Tooltip title="Refresh KRAs and employees">
              <IconButton size="small" onClick={handleManualRefresh} disabled={refetching}
                sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, width: 32, height: 32, color: '#64748b', '&:hover': { color: '#1E3A8A', border: '1px solid #bfdbfe', bgcolor: '#eff6ff' } }}>
                <RefreshIcon fontSize="small" sx={{ animation: refetching ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <CycleBanner cycle={activeCycle} allCycles={allCycles} onCycleChange={handleCycleChange} isReadOnly={isReadOnly} />
        {isReadOnly && activeCycle && <Alert severity="info" icon={<LockIcon fontSize="small" />} sx={{ borderRadius: 2, fontSize: 12, py: 0.5 }}><strong>View Only.</strong> This cycle is {activeCycle.status?.toLowerCase()}.</Alert>}
        {refetching && <LinearProgress sx={{ borderRadius: 1, height: 2 }} />}

        {activeCycle ? (
          <Box ref={containerRef} sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 0 }}>
            <Paper elevation={0} sx={{ width: `${leftPct}%`, flexShrink: 0, borderRadius: 2.5, border: '1px solid #e2e8f0', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
              <KRAPanel
                kras={kraLibrary}
                categories={categories}
                selectedKraSet={selectedKraSet}
                onToggleKRA={handleToggleKRA}
                isReadOnly={isReadOnly}
                isManager={isManager}
                employeeDuplicateMap={employeeDuplicateMap}

              />
            </Paper>

            {/* Drag handle */}
            <Box onMouseDown={onMouseDown} sx={{
              width: 12, flexShrink: 0, cursor: 'col-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              '&:hover .hdl': { bgcolor: '#1E3A8A', height: 56 },
            }}>
              <Box className="hdl" sx={{
                width: 3, height: 40, borderRadius: 2,
                bgcolor: '#e2e8f0', transition: 'all 0.15s',
              }} />
            </Box>

            <Paper elevation={0} sx={{ flex: 1, minWidth: 0, borderRadius: 2.5, border: '1px solid #e2e8f0', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
              <EmployeePanel
                employees={employees}
                selectedEmpSet={selectedEmpSet}
                onToggleEmployee={handleToggleEmployee}
                isReadOnly={isReadOnly}
                onView={handleViewEmployee}
              />
            </Paper>
          </Box>

        ) : (
          <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', p: 6, textAlign: 'center', bgcolor: '#fff' }}>
            <Box sx={{ width: 64, height: 64, borderRadius: 2.5, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}><AssignmentIcon sx={{ fontSize: 32, color: '#cbd5e1' }} /></Box>
            <Typography fontSize={15} fontWeight={800} color="#374151">No Active Cycle</Typography>
            <Typography fontSize={13} color="#94a3b8" mt={0.5}>Activate a KRA cycle to start assigning KRAs to employees.</Typography>
          </Paper>
        )}

        {!isReadOnly && (selectedKraSet.size > 0 || selectedEmpSet.size > 0) && (
          <SelectionBar
            selectedKraIds={selectedKraLevelIds}
            selectedEmpIds={selectedEmployeeIds}
            onClearAll={() => { setSelectedKraSet(new Set()); setSelectedEmpSet(new Set()); }}
            onPreview={() => setPreviewOpen(true)}
            onAssign={handleDirectAssign}
            assigning={assigning}
            isReadOnly={isReadOnly}
          />
        )}
      </Box>

      <PreviewAssignModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        selectedKraLevelIds={selectedKraLevelIds}
        selectedEmployeeIds={selectedEmployeeIds}
        kraLibrary={kraLibrary}
        categories={categories}
        employees={employees}
        onConfirmAssign={doAssign}
        assigning={assigning}
      />

      {viewEmployee && (() => {
        const freshEmployee = employeeIndexMap.get(viewEmployee.employee_id) ?? viewEmployee;
        return (
          <EmployeeKRAView
            open={!!viewEmployee}
            employee={freshEmployee}
            kraLibrary={kraLibrary}
            categories={categories}
            cachedData={{ kra_level_ids: assignedKRAMap[freshEmployee.employee_kra_cycle_id] ?? [], categories: getAssignmentFromCache(freshEmployee.employee_kra_cycle_id)?.categories ?? [] }}
            employees={employees.filter(e => e.employee_id !== freshEmployee.employee_id)}
            activeCycleId={activeCycle?.id}
            defaultTab={cloneDefault ? 'clone' : 'kras'}
            onClose={() => { setViewEmployee(null); setCloneDefault(false); }}
            onCloneTo={(targetEmployeeIds, mode, selectedKraKeys) => handleCloneTo(targetEmployeeIds, mode, selectedKraKeys)}
            onDeleteKRAs={(kraKeys) => handleDeleteKRAs(freshEmployee, kraKeys)}
            onSaveWeightages={(weightagesMap) => handleSaveWeightages(freshEmployee, weightagesMap)}
            isManager={isManager}
          />
        );
      })()}

      {/* Global loading overlay */}
      {globalLoading && (
        <Box sx={{
          position: 'fixed', inset: 0, zIndex: 9999,
          bgcolor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Paper elevation={0} sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, px: 4, py: 3.5, borderRadius: 3,
            border: '1px solid #e2e8f0', bgcolor: '#fff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <CircularProgress size={36} sx={{ color: '#1E3A8A' }} />
            <Typography fontSize={13.5} fontWeight={600} color="#1e293b">
              {globalLoadingMsg || 'Processing…'}
            </Typography>
          </Paper>
        </Box>
      )}

      <ToastStack toasts={toasts} />
    </Box>
  );
}