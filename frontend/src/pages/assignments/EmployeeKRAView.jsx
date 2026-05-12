import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, Box, Typography, Stack, Button, Chip,
  Avatar, IconButton, Tooltip, Checkbox,
  CircularProgress, Paper, TextField, InputAdornment,
  Collapse,
} from '@mui/material';
import CloseIcon         from '@mui/icons-material/Close';
import ContentCopyIcon   from '@mui/icons-material/ContentCopy';
import SearchIcon        from '@mui/icons-material/Search';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore';
import ExpandLessIcon    from '@mui/icons-material/ExpandLess';
import BusinessIcon      from '@mui/icons-material/Business';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import SaveIcon          from '@mui/icons-material/Save';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function truncateWords(str = '', max = 8) {
  const words = str.trim().split(/\s+/);
  if (words.length <= max) return { text: str, truncated: false };
  return { text: words.slice(0, max).join(' ') + '…', truncated: true, full: str };
}

// ── Close dialog — only rendered when dirty=true ─────────────────────────────
function CloseConfirmDialog({ open, onGoBack, onSaveClose, saving }) {
  return (
    <Dialog open={open} onClose={onGoBack} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #fde68a' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
          <Typography fontWeight={700} fontSize={14} color="#92400e">Unsaved changes</Typography>
        </Stack>
      </Box>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography fontSize={13} color="#374151" lineHeight={1.6}>
          You have unsaved weightage changes. Go back to keep editing, or save everything now and close.
        </Typography>
      </Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ px: 2.5, pb: 2.5 }}>
        <Button onClick={onGoBack} disabled={saving}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>
          Go Back
        </Button>
        <Button onClick={onSaveClose} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13,
            background: gradient, '&:hover': { opacity: 0.9 } }}>
          {saving ? 'Saving…' : 'Save & Close'}
        </Button>
      </Stack>
    </Dialog>
  );
}

function WarnDialog({ open, title, message, confirmLabel, confirmColor = '#dc2626', onConfirm, onCancel, loading }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #fde68a' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
          <Typography fontWeight={700} fontSize={14} color="#92400e">{title}</Typography>
        </Stack>
      </Box>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography fontSize={13} color="#374151">{message}</Typography>
      </Box>
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ px: 2.5, pb: 2.5 }}>
        <Button onClick={onCancel} disabled={loading}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>
          Go Back
        </Button>
        <Button onClick={onConfirm} disabled={loading} variant="contained"
          startIcon={loading ? <CircularProgress size={12} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13,
            bgcolor: confirmColor, '&:hover': { bgcolor: confirmColor, opacity: 0.88 } }}>
          {loading ? 'Processing…' : confirmLabel}
        </Button>
      </Stack>
    </Dialog>
  );
}

// ── Clone panel (unchanged) ───────────────────────────────────────────────────
function CloneTargetPanel({ employees, sourceEmployee, onClone, onClose }) {
  const [search,      setSearch]     = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [copyDone,    setCopyDone]    = useState(false);
  const [cloning,     setCloning]     = useState(false);

  const eligible = useMemo(() =>
    employees.filter(e =>
      e.employee_id !== sourceEmployee?.employee_id &&
      (search.trim() === '' || e.full_name?.toLowerCase().includes(search.toLowerCase()))
    ), [employees, sourceEmployee, search]);

  const toggleId  = id => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = c  => setSelectedIds(c ? eligible.map(e => e.employee_id) : []);

  const handleClone = async () => {
    if (!selectedIds.length) return;
    const ids = employees
      .filter(e => selectedIds.includes(e.employee_id))
      .map(e => e.employee_kra_cycle_id)
      .filter(Boolean);
    setCloning(true);
    try { await onClone(ids, 'append'); }
    finally { setCloning(false); }
    setCopyDone(true);
    setTimeout(() => { setCopyDone(false); setSelectedIds([]); setSearch(''); }, 1400);
  };

  return (
    <Box sx={{ p: 1.75, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', mt: 0.75 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.25}>
        <Typography fontSize={12} fontWeight={700} color="#1e293b">Copy KRAs to other employees</Typography>
        <IconButton size="small" onClick={onClose} sx={{ p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
        </IconButton>
      </Stack>
      <Box sx={{ px: 1.5, py: 1, mb: 1.25, borderRadius: 1.5, bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <Typography fontSize={11} color="#1d4ed8" lineHeight={1.6}>
          Selected KRAs will be copied. If someone already has a KRA, it won't be added again.
        </Typography>
      </Box>
      <TextField size="small" placeholder="Search employees…" value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 13, color: '#94a3b8' }} /></InputAdornment> }}
        sx={{ mb: 0.75, width: '100%', '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12, height: 32 } }}
      />
      <Stack direction="row" alignItems="center" sx={{ px: 0.25, mb: 0.4 }}>
        <Checkbox size="small"
          indeterminate={selectedIds.length > 0 && selectedIds.length < eligible.length}
          checked={eligible.length > 0 && selectedIds.length === eligible.length}
          onChange={e => toggleAll(e.target.checked)} sx={{ p: 0.25 }} />
        <Typography fontSize={10} fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.04em">
          All ({eligible.length})
        </Typography>
        {selectedIds.length > 0 && (
          <Chip label={`${selectedIds.length} selected`} size="small"
            sx={{ fontSize: 9, height: 15, fontWeight: 700, ml: 1, bgcolor: '#eff6ff', color: '#1d4ed8' }} />
        )}
      </Stack>
      <Box sx={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 1,
        '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 } }}>
        {eligible.length === 0
          ? <Box sx={{ textAlign: 'center', py: 2.5 }}>
              <Typography fontSize={11} color="#94a3b8">No other employees found</Typography>
            </Box>
          : eligible.map(emp => {
              const sel = selectedIds.includes(emp.employee_id);
              return (
                <Box key={emp.employee_id} onClick={() => toggleId(emp.employee_id)}
                  sx={{ display: 'flex', alignItems: 'center', px: 1.25, py: 0.65, cursor: 'pointer',
                    bgcolor: sel ? '#eff6ff' : 'transparent',
                    borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 0 },
                    '&:hover': { bgcolor: sel ? '#dbeafe' : '#f8fafc' } }}>
                  <Checkbox size="small" checked={sel} onChange={() => toggleId(emp.employee_id)}
                    onClick={e => e.stopPropagation()} sx={{ p: 0, mr: 1, flexShrink: 0 }} />
                  <Box minWidth={0}>
                    <Typography fontSize={11} fontWeight={600} color="#1e293b" noWrap>{emp.full_name}</Typography>
                    <Typography fontSize={9.5} color="#94a3b8" noWrap>
                      {emp.level}{emp.department ? ` · ${emp.department}` : ''}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
      </Box>
      {copyDone && (
        <Box sx={{ mb: 1, p: 1.25, borderRadius: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 16, flexShrink: 0 }} />
          <Typography fontSize={11} fontWeight={600} color="#166534">Done! KRAs copied successfully.</Typography>
        </Box>
      )}
      <Button variant="contained" fullWidth size="small"
        disabled={!selectedIds.length || cloning}
        startIcon={cloning ? <CircularProgress size={11} sx={{ color: '#fff' }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
        onClick={handleClone}
        sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', background: gradient, color: '#fff',
          borderRadius: 1.5, height: 32, '&:hover': { opacity: 0.9 },
          '&:disabled': { opacity: 0.5, background: gradient, color: '#fff' } }}>
        {cloning ? 'Copying…' : selectedIds.length > 0 ? `Copy to ${selectedIds.length} employee${selectedIds.length !== 1 ? 's' : ''}` : 'Select employees'}
      </Button>
    </Box>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function EmployeeKRAView({
  open, employee,
  kraLibrary = [], categories = [],
  cachedData, employees = [],
  onClose, onCloneTo, onDeleteKRAs, onSaveWeightages,
}) {
  const [search,        setSearch]       = useState('');
  const [expandedCats,  setExpandedCats] = useState({});
  const [checkedKRAs,   setCheckedKRAs]  = useState(new Set());
  const [weightages,    setWeightages]   = useState({});
  const [dirty,         setDirty]        = useState(false);
  const [saving,        setSaving]       = useState(false);
  const [saveSuccess,   setSaveSuccess]  = useState(false);
  const [clonePanelOpen, setClonePanelOpen] = useState(false);  // single top-level clone panel

  const [warnClose,       setWarnClose]      = useState(false);
  const [warnBulkDelete,  setWarnBulkDelete] = useState(false);
  const [warnDeleteKRA,   setWarnDeleteKRA]  = useState(null);
  const [deleting,        setDeleting]       = useState(false);

  // ── init on open ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const cats = employee?.assigned_categories?.length
      ? employee.assigned_categories
      : cachedData?.categories ?? [];
    const init = {};
    cats.forEach(c => { init[c.category_id] = String(c.weightage ?? ''); });
    setWeightages(init);
    setCheckedKRAs(new Set());
    setSearch('');
    setClonePanelOpen(false);
    setDirty(false);
    setSaveSuccess(false);
    setExpandedCats({});
  }, [open, employee]);

  // ── build grouped KRAs ──────────────────────────────────────────────────────
  const kraLevelIds = useMemo(() =>
    employee?.assigned_kras?.map(k => k.kra_level_id) ?? cachedData?.kra_level_ids ?? [],
    [employee, cachedData]);

  const grouped = useMemo(() => {
    const map = {};
    kraLibrary.forEach(kra => {
      kra.levels?.forEach(level => {
        const lid = level.kra_level_id ?? level.id;
        if (!kraLevelIds.includes(lid)) return;
        const cid = kra.category_id;
        if (!map[cid]) {
          map[cid] = {
            category_id:   cid,
            category_name: categories.find(c => c.id === cid)?.name ?? kra.category_name ?? `Category ${cid}`,
            is_standard:   kra.is_standard,
            rows: [],
          };
        }
        map[cid].rows.push({
          key:         `${kra.id}-${lid}`,
          kra_id:      kra.id,
          kra_name:    kra.name,
          level_name:  level.level_name,
          description: level.description || kra.description || '',
          category_id: cid,
        });
      });
    });
    return Object.values(map).sort((a, b) => a.category_name.localeCompare(b.category_name));
  }, [kraLibrary, kraLevelIds, categories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.map(g => ({
      ...g,
      rows: g.rows.filter(r =>
        r.kra_name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.level_name.toLowerCase().includes(q) ||
        g.category_name.toLowerCase().includes(q)
      ),
    })).filter(g => g.rows.length > 0);
  }, [grouped, search]);

  const allKeys     = useMemo(() => filtered.flatMap(g => g.rows.map(r => r.key)), [filtered]);
  const totalKRAs   = kraLevelIds.length;
  const allChecked  = allKeys.length > 0 && allKeys.every(k => checkedKRAs.has(k));
  const someChecked = allKeys.some(k => checkedKRAs.has(k));
  const checkedCount = allKeys.filter(k => checkedKRAs.has(k)).length;

  const toggleAll      = c  => setCheckedKRAs(c ? new Set(allKeys) : new Set());
  const toggleCategory = (catId, c) => {
    const keys = filtered.find(g => g.category_id === catId)?.rows.map(r => r.key) ?? [];
    setCheckedKRAs(prev => { const next = new Set(prev); keys.forEach(k => c ? next.add(k) : next.delete(k)); return next; });
  };
  const toggleKRA = (key, c) => {
    setCheckedKRAs(prev => { const next = new Set(prev); c ? next.add(key) : next.delete(key); return next; });
  };
  const catChecked       = cid => { const k = filtered.find(g => g.category_id === cid)?.rows.map(r => r.key) ?? []; return k.length > 0 && k.every(x => checkedKRAs.has(x)); };
  const catIndeterminate = cid => { const k = filtered.find(g => g.category_id === cid)?.rows.map(r => r.key) ?? []; return k.some(x => checkedKRAs.has(x)) && !k.every(x => checkedKRAs.has(x)); };

  const totalW    = Object.values(weightages).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const remaining = parseFloat((100 - totalW).toFixed(1));
  const wValid    = Math.abs(totalW - 100) < 0.01;

  const handleWeightChange = (catId, val) => {
    if (val !== '' && (isNaN(val) || parseFloat(val) < 0)) return;
    setWeightages(p => ({ ...p, [catId]: val }));
    setDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveWeightages?.(weightages);
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  // ── close: skip dialog if nothing changed ───────────────────────────────────
  const handleClose = () => {
    if (dirty) setWarnClose(true);
    else onClose?.();
  };

  const handleSaveAndClose = async () => {
    setSaving(true);
    try {
      await onSaveWeightages?.(weightages);
      setDirty(false);
      setWarnClose(false);
      onClose?.();
    } finally { setSaving(false); }
  };

  const handleClone = async (targetIds, mode) => { await onCloneTo?.(targetIds, mode); };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try { await onDeleteKRAs?.([...checkedKRAs]); setCheckedKRAs(new Set()); setWarnBulkDelete(false); }
    finally { setDeleting(false); }
  };
  const handleDeleteKRA = async () => {
    setDeleting(true);
    try { await onDeleteKRAs?.([warnDeleteKRA]); setWarnDeleteKRA(null); }
    finally { setDeleting(false); }
  };

  const isCatOpen = cid => expandedCats[cid] !== false;
  const toggleCat = cid => setExpandedCats(p => ({ ...p, [cid]: !isCatOpen(cid) }));

  if (!employee) return null;

  return (
    <>
      <Dialog open={open} onClose={() => {}} maxWidth="lg" fullWidth disableEscapeKeyDown
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>

        {/* ── HEADER ── */}
        <Box sx={{ background: gradient, px: 2.5, pt: 2, pb: 1.75, color: '#fff', flexShrink: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ width: 38, height: 38, fontSize: 13, fontWeight: 800, flexShrink: 0,
              bgcolor: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.3)' }}>
              {getInitials(employee.full_name)}
            </Avatar>

            <Box sx={{ flexShrink: 0, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography fontWeight={800} fontSize={14} lineHeight={1.2} noWrap>
                  {employee.full_name}
                </Typography>
                <Chip icon={<CheckCircleIcon sx={{ fontSize: '10px !important', color: '#86efac !important' }} />}
                  label="Assigned" size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#bbf7d0', fontSize: 9, fontWeight: 700, height: 17 }} />
              </Stack>
              <Typography fontSize={10.5} sx={{ opacity: 0.6, mt: 0.15 }} noWrap>
                {[employee.title, employee.level, employee.department, employee.email].filter(Boolean).join(' · ')}
              </Typography>
            </Box>

            {/* Search */}
            <TextField size="small" placeholder={`Search across ${totalKRAs} KRAs…`}
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }}
              sx={{ flex: 1,
                '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 36,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
                },
                '& input': { color: '#fff', '&::placeholder': { color: 'rgba(255,255,255,0.45)', opacity: 1 } },
              }}
            />

            {/* ── Clone button (top only) ── */}
            <Tooltip title={checkedCount === 0 ? 'Select KRAs first to clone' : `Clone ${checkedCount} selected`}>
              <span>
                <Button size="small" disabled={checkedCount === 0}
                  startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                  onClick={() => setClonePanelOpen(v => !v)}
                  sx={{ fontSize: 12, fontWeight: 700, textTransform: 'none', borderRadius: 1.75,
                    px: 1.5, height: 36, flexShrink: 0,
                    bgcolor: checkedCount > 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                    color:   checkedCount > 0 ? '#fff' : 'rgba(255,255,255,0.35)',
                    border:  '1px solid rgba(255,255,255,0.2)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' },
                  }}>
                  Clone{checkedCount > 0 ? ` (${checkedCount})` : ''}
                </Button>
              </span>
            </Tooltip>

            {/* ── Delete button (top only) ── */}
            <Tooltip title={checkedCount === 0 ? 'Select KRAs first to delete' : `Delete ${checkedCount} selected`}>
              <span>
                <Button size="small" disabled={checkedCount === 0}
                  startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
                  onClick={() => setWarnBulkDelete(true)}
                  sx={{ fontSize: 12, fontWeight: 700, textTransform: 'none', borderRadius: 1.75,
                    px: 1.5, height: 36, flexShrink: 0,
                    bgcolor: checkedCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)',
                    color:   checkedCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.35)',
                    border:  `1px solid ${checkedCount > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.3)' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' },
                  }}>
                  Delete{checkedCount > 0 ? ` (${checkedCount})` : ''}
                </Button>
              </span>
            </Tooltip>

            {/* Close */}
            <Tooltip title="Close">
              <IconButton size="small" onClick={handleClose} sx={{ flexShrink: 0,
                color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 1.5, p: 0.6, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' } }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Clone panel — single, attached to header, toggled by top Clone button */}
          {clonePanelOpen && (
            <Box sx={{ mt: 1 }}>
              <CloneTargetPanel
                employees={employees.filter(e => e.assigned_to_cycle && e.employee_kra_cycle_id != null)}
                sourceEmployee={employee}
                onClone={handleClone}
                onClose={() => setClonePanelOpen(false)}
              />
            </Box>
          )}
        </Box>

        {/* ── WEIGHTAGE BANNER ── */}
        <Box sx={{ flexShrink: 0, px: 2, py: 0.9,
          bgcolor: wValid ? '#f0fdf4' : remaining > 0 ? '#fefce8' : '#fef2f2',
          borderBottom: `1px solid ${wValid ? '#bbf7d0' : remaining > 0 ? '#fde68a' : '#fecaca'}` }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Tooltip title={allChecked ? 'Deselect all' : 'Select all KRAs'}>
              <Checkbox size="small" checked={allChecked} indeterminate={someChecked && !allChecked}
                onChange={e => toggleAll(e.target.checked)}
                sx={{ p: 0.4, flexShrink: 0,
                  color: wValid ? '#166534' : remaining > 0 ? '#92400e' : '#991b1b',
                  '&.Mui-checked': { color: wValid ? '#166534' : remaining > 0 ? '#92400e' : '#991b1b' },
                  '&.MuiCheckbox-indeterminate': { color: '#1E3A8A' } }} />
            </Tooltip>
            <Typography fontSize={12.5} fontWeight={700}
              color={wValid ? '#166534' : remaining > 0 ? '#92400e' : '#991b1b'}>
              Total Weightage:
            </Typography>
            <Chip label={`${totalW.toFixed(0)}%`} size="small"
              sx={{ fontSize: 11, height: 20, fontWeight: 800,
                bgcolor: wValid ? '#dcfce7' : remaining > 0 ? '#fef9c3' : '#fee2e2',
                color:   wValid ? '#166534' : remaining > 0 ? '#854d0e' : '#991b1b' }} />
            {!wValid && (
              <Typography fontSize={11.5} color={remaining > 0 ? '#92400e' : '#991b1b'} fontWeight={500}>
                {remaining > 0 ? `${remaining}% still available` : `${Math.abs(remaining)}% over limit`}
              </Typography>
            )}
            {wValid && <Typography fontSize={11} color="#166534" fontWeight={500}>All weightages balanced ✓</Typography>}
            {saveSuccess && (
              <Chip icon={<CheckCircleIcon sx={{ fontSize: '11px !important' }} />} label="Saved!" size="small"
                sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 10 }} />
            )}
            {checkedCount > 0 && (
              <Chip label={`${checkedCount} selected`} size="small"
                sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 10, height: 20 }} />
            )}
          </Stack>
        </Box>

        {/* ── BODY ── */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 99 } }}>
          {filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: '#94a3b8' }}>
              <Typography fontSize={13}>No KRAs match your search.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {filtered.map(group => {
                const isOrg  = group.is_standard;
                const tc     = isOrg
                  ? { header: '#dcfce7', color: '#166534', border: '#bbf7d0' }
                  : { header: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' };
                const catW   = weightages[group.category_id] ?? '';
                const catOpen = isCatOpen(group.category_id);

                return (
                  <Paper key={group.category_id} elevation={0}
                    sx={{ border: `1px solid ${tc.border}`, borderRadius: 2, overflow: 'hidden' }}>

                    {/* ── Category header — NO clone/delete icons here ── */}
                    <Box sx={{ bgcolor: tc.header, px: 1.5, py: 0.85 }}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>

                        <Checkbox size="small"
                          checked={catChecked(group.category_id)}
                          indeterminate={catIndeterminate(group.category_id)}
                          onChange={e => toggleCategory(group.category_id, e.target.checked)}
                          onClick={e => e.stopPropagation()}
                          sx={{ p: 0.4, flexShrink: 0, color: tc.color,
                            '&.Mui-checked': { color: tc.color },
                            '&.MuiCheckbox-indeterminate': { color: tc.color } }}
                        />

                        {isOrg
                          ? <BusinessIcon      sx={{ fontSize: 14, color: tc.color, flexShrink: 0 }} />
                          : <FolderSpecialIcon sx={{ fontSize: 14, color: tc.color, flexShrink: 0 }} />}

                        {/* Category name — clickable to collapse */}
                        <Stack direction="row" alignItems="baseline" spacing={0.75} flex={1}
                          onClick={() => toggleCat(group.category_id)}
                          sx={{ cursor: 'pointer', ml: 0.25, userSelect: 'none', '&:hover': { opacity: 0.8 } }}>
                          <Typography fontSize={13} fontWeight={700} color={tc.color}>
                            {group.category_name}
                            <Box component="sup" sx={{ fontSize: 9, fontWeight: 800, ml: '2px', verticalAlign: 'super', lineHeight: 0 }}>
                              {group.rows.length}
                            </Box>
                          </Typography>
                          <Chip label={isOrg ? 'Org' : 'Project'} size="small"
                            sx={{ fontSize: 8.5, height: 16, fontWeight: 700,
                              bgcolor: 'rgba(255,255,255,0.6)', color: tc.color }} />
                        </Stack>

                        {/* Weightage input */}
                        <Tooltip title="Set category weightage (all must total 100%)" placement="top">
                          <Stack direction="row" alignItems="center" spacing={0.4}>
                            <TextField size="small" value={catW} placeholder="0"
                              onChange={e => handleWeightChange(group.category_id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              inputProps={{ style: { textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '3px 6px' } }}
                              sx={{ width: 58,
                                '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 28, bgcolor: '#fff',
                                  '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
                                  '&:hover fieldset': { borderColor: tc.color },
                                  '&.Mui-focused fieldset': { borderColor: tc.color, borderWidth: 2 } } }}
                            />
                            <Typography fontSize={11} fontWeight={700} color={tc.color}>%</Typography>
                          </Stack>
                        </Tooltip>

                        {/* Collapse toggle */}
                        <IconButton size="small" onClick={() => toggleCat(group.category_id)} sx={{ p: 0.4 }}>
                          {catOpen
                            ? <ExpandLessIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                            : <ExpandMoreIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
                        </IconButton>
                      </Stack>
                    </Box>

                    {/* ── KRA rows — NO clone/delete icons here ── */}
                    <Collapse in={catOpen}>
                      <Box>
                        {group.rows.map((row, idx) => {
                          const isChecked = checkedKRAs.has(row.key);
                          const { text: descText, truncated, full } = truncateWords(row.description, 8);
                          const isLast = idx === group.rows.length - 1;

                          return (
                            <Box key={row.key}>
                              <Stack direction="row" alignItems="center"
                                sx={{ px: 1.5, py: 0.85,
                                  borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                                  bgcolor: isChecked ? '#f0f7ff' : '#fff',
                                  '&:hover': { bgcolor: isChecked ? '#e8f1ff' : '#fafafa' },
                                  transition: 'background 0.1s' }}>

                                <Checkbox size="small" checked={isChecked}
                                  onChange={e => toggleKRA(row.key, e.target.checked)}
                                  sx={{ p: 0.4, mr: 0.75, flexShrink: 0, color: '#cbd5e1',
                                    '&.Mui-checked': { color: '#1E3A8A' } }}
                                />

                                <Typography fontSize={12.5} fontWeight={500} color="#1e293b"
                                  sx={{ width: 175, flexShrink: 0 }}>
                                  {row.kra_name}
                                </Typography>

                                <Box flex={1} minWidth={0} px={1}>
                                  {row.description ? (
                                    truncated ? (
                                      <Tooltip title={full} placement="top" arrow
                                        componentsProps={{ tooltip: { sx: { maxWidth: 340, fontSize: 11, bgcolor: '#1e293b', lineHeight: 1.6 } } }}>
                                        <Typography fontSize={11} color="#94a3b8" sx={{ cursor: 'default' }}>
                                          {descText}
                                        </Typography>
                                      </Tooltip>
                                    ) : (
                                      <Typography fontSize={11} color="#94a3b8">{descText}</Typography>
                                    )
                                  ) : null}
                                </Box>

                                <Chip label={row.level_name} size="small"
                                  sx={{ fontSize: 9, height: 18, fontWeight: 600,
                                    bgcolor: '#f0f9ff', color: '#0369a1', flexShrink: 0 }} />

                                {/* ── NO clone/delete icons per-row — use top header buttons ── */}
                              </Stack>
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* ── FOOTER ── */}
        <Box sx={{ px: 2.5, py: 1.25, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa', flexShrink: 0 }}>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
            {saveSuccess && (
              <Chip icon={<CheckCircleIcon sx={{ fontSize: '11px !important' }} />} label="Saved!" size="small"
                sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 10 }} />
            )}
            <Button onClick={handleSave} disabled={saving || !dirty}
              startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon sx={{ fontSize: 14 }} />}
              variant="contained"
              sx={{ fontSize: 12, fontWeight: 700, textTransform: 'none', borderRadius: 1.75,
                px: 2.5, height: 34, background: gradient, '&:hover': { opacity: 0.9 },
                '&.Mui-disabled': { opacity: 0.38 } }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* ── dirty-only close dialog ── */}
      <CloseConfirmDialog
        open={warnClose}
        onGoBack={() => setWarnClose(false)}
        onSaveClose={handleSaveAndClose}
        saving={saving}
      />

      <WarnDialog
        open={warnBulkDelete}
        title="Delete KRAs"
        message={`Delete ${checkedCount} selected KRA${checkedCount !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete" confirmColor="#dc2626"
        onConfirm={handleBulkDelete}
        onCancel={() => setWarnBulkDelete(false)}
        loading={deleting}
      />

      <WarnDialog
        open={!!warnDeleteKRA}
        title="Delete KRA"
        message="Are you sure you want to delete this KRA? This cannot be undone."
        confirmLabel="Delete" confirmColor="#dc2626"
        onConfirm={handleDeleteKRA}
        onCancel={() => setWarnDeleteKRA(null)}
        loading={deleting}
      />
    </>
  );
}