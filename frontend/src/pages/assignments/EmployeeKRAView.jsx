import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Stack, Button, Chip, Divider,
  Avatar, IconButton, Tooltip, Checkbox,
  Alert, CircularProgress, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, TextField, InputAdornment,
  Collapse, LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BusinessIcon from '@mui/icons-material/Business';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

function getInitials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── KRA Table grouped by category ─────────────────────────────────────────────
// is_standard: true=Org (green), false=Project (blue)

function KRATable({ kraLibrary, kraLevelIds = [], categories }) {
  const [expandedCats, setExpandedCats] = useState({});

  const grouped = useMemo(() => {
    const map = {};
    kraLibrary.forEach((kra) => {
      kra.levels.forEach((level) => {
        if (kraLevelIds.includes(level.kra_level_id?? level.id)) {
          const cid = kra.category_id;
          if (!map[cid]) {
            map[cid] = {
              category_id: cid,
              category_name: categories.find((c) => c.id === cid)?.name ?? kra.category_name ?? `Category ${cid}`,
              rows: [],
            };
          }
          map[cid].rows.push({
            kra_id:      kra.id,
            kra_name:    kra.name,
            level_name:  level.level_name,
            description: level.description || kra.description || '',
            is_standard: kra.is_standard, // true=Org, false=Project
          });
        }
      });
    });
    return Object.values(map).sort((a, b) => a.category_name.localeCompare(b.category_name));
  }, [kraLibrary, kraLevelIds, categories]);

  if (grouped.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, color: '#94a3b8' }}>
        <AssignmentIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
        <Typography fontSize={13}>No KRAs found for this assignment.</Typography>
        <Typography fontSize={12} color="#b0bec5" mt={0.5}>Assignment data may not be cached locally. Try refreshing.</Typography>
      </Box>
    );
  }

  const toggleCat = (cid) =>
    setExpandedCats((prev) => ({ ...prev, [cid]: !prev[cid] }));

  return (
    <Stack spacing={1.5}>
      {grouped.map((group) => {
        const isExpanded = expandedCats[group.category_id] !== false; // default open
        const allOrg = group.rows.every((r) => r.is_standard === true);
        const allProj = group.rows.every((r) => r.is_standard === false);
        const typeLabel = allOrg ? 'Org' : allProj ? 'Project' : 'Mixed';
        const typeColor = allOrg
          ? { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
          : { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' };

        return (
          <Paper
            key={group.category_id}
            elevation={0}
            sx={{ border: `1px solid ${typeColor.border}`, borderRadius: 2, overflow: 'hidden' }}
          >
            {/* Category header */}
            <Box
              onClick={() => toggleCat(group.category_id)}
              sx={{
                px: 2, py: 1.25,
                bgcolor: typeColor.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': { opacity: 0.9 },
                transition: 'opacity 0.12s',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                {allOrg
                  ? <BusinessIcon sx={{ fontSize: 14, color: typeColor.color }} />
                  : <FolderSpecialIcon sx={{ fontSize: 14, color: typeColor.color }} />
                }
                <Typography fontSize={12.5} fontWeight={700} color={typeColor.color}>
                  {group.category_name}
                </Typography>
                <Chip
                  label={typeLabel}
                  size="small"
                  sx={{ fontSize: 8.5, height: 16, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.6)', color: typeColor.color }}
                />
                <Chip
                  label={`${group.rows.length} KRA${group.rows.length !== 1 ? 's' : ''}`}
                  size="small"
                  sx={{ fontSize: 8.5, height: 16, fontWeight: 600, bgcolor: 'rgba(0,0,0,0.06)', color: '#475569' }}
                />
              </Stack>
              <IconButton size="small" sx={{ p: 0.25 }}>
                {isExpanded
                  ? <ExpandLessIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                  : <ExpandMoreIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                }
              </IconButton>
            </Box>

            <Collapse in={isExpanded}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', py: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      KRA Title
                    </TableCell>
                    <TableCell sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', py: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em', width: 90 }}>
                      Level
                    </TableCell>
                    <TableCell sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', py: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em', width: 70 }}>
                      Type
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.rows.map((row, i) => (
                    <TableRow
                      key={`${row.kra_id}-${i}`}
                      sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}
                    >
                      <TableCell sx={{ py: 1 }}>
                        <Typography fontSize={12.5} fontWeight={500} color="#1e293b">
                          {row.kra_name}
                        </Typography>
                        {row.description && (
                          <Typography fontSize={10.5} color="#94a3b8" noWrap>{row.description}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Chip
                          label={row.level_name}
                          size="small"
                          sx={{ fontSize: 9, height: 18, fontWeight: 600, bgcolor: '#f0f9ff', color: '#0369a1' }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {/* is_standard: true=Org (green), false=Project (blue) */}
                        <Chip
                          label={row.is_standard ? 'Org' : 'Project'}
                          size="small"
                          sx={{
                            fontSize: 9, height: 18, fontWeight: 700,
                            bgcolor: row.is_standard ? '#dcfce7' : '#dbeafe',
                            color:   row.is_standard ? '#166534' : '#1d4ed8',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Collapse>
          </Paper>
        );
      })}
    </Stack>
  );
}

// ── Weightage Summary ──────────────────────────────────────────────────────────

function WeightageSummary({ categories: allCategories, cachedCategories = [], kraLibrary }) {
  if (!cachedCategories || cachedCategories.length === 0) {
    return (
      <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ borderRadius: 2, fontSize: 12 }}>
        Weightage data is not available locally. Open the edit modal to view or update the current values.
      </Alert>
    );
  }

  const total = cachedCategories.reduce((s, c) => s + parseFloat(c.weightage || 0), 0);

  return (
    <Stack spacing={1.25}>
      {cachedCategories.map((cat) => {
        const pct      = parseFloat(cat.weightage || 0);
        const catName  = cat.category_name || allCategories.find((c) => c.id === cat.category_id)?.name || `Category ${cat.category_id}`;
        // Get is_standard from kraLibrary
        const sampleKRA = kraLibrary?.find((k) => k.category_id === cat.category_id);
        const isStandard = sampleKRA?.is_standard ?? true;
        const barColor   = isStandard ? '#16a34a' : '#1d4ed8';

        return (
          <Box key={cat.category_id}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                {isStandard
                  ? <BusinessIcon sx={{ fontSize: 13, color: '#15803d' }} />
                  : <FolderSpecialIcon sx={{ fontSize: 13, color: '#1d4ed8' }} />
                }
                <Typography fontSize={12} fontWeight={600} color="#374151">{catName}</Typography>
                <Chip
                  label={isStandard ? 'Org' : 'Project'}
                  size="small"
                  sx={{
                    fontSize: 8.5, height: 15, fontWeight: 700,
                    bgcolor: isStandard ? '#dcfce7' : '#dbeafe',
                    color:   isStandard ? '#166534' : '#1d4ed8',
                  }}
                />
              </Stack>
              <Typography fontSize={12} fontWeight={800} color="#1E3A8A">{pct}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              sx={{
                height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
                '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
              }}
            />
          </Box>
        );
      })}

      <Divider />
      <Stack direction="row" justifyContent="flex-end">
        <Chip
          label={`Total: ${total.toFixed(0)}%`}
          size="small"
          sx={{
            fontWeight: 800, fontSize: 11,
            bgcolor: Math.abs(total - 100) < 0.01 ? '#dcfce7' : '#fee2e2',
            color:   Math.abs(total - 100) < 0.01 ? '#166534' : '#dc2626',
          }}
        />
      </Stack>
    </Stack>
  );
}

// ── Clone Panel ────────────────────────────────────────────────────────────────

function ClonePanel({ employees, sourceEmployee, onClone, cloning }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [mode, setMode] = useState('append'); // ← add this

  const eligible = useMemo(
  () =>
    employees.filter(
      (e) =>
        e.employee_id !== sourceEmployee.employee_id &&
        (search.trim() === '' || e.full_name.toLowerCase().includes(search.toLowerCase()))
    ),
  [employees, sourceEmployee, search]
);

  const toggleId = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = (checked) =>
    setSelectedIds(checked ? eligible.map((e) => e.employee_id) : []);

  const handleClone = () => {
    if (selectedIds.length === 0) return;
    const targetKraCycleIds = employees
      .filter((e) => selectedIds.includes(e.employee_id))
      .map((e) => e.employee_kra_cycle_id)
      .filter(Boolean);
      console.log('Cloning with mode:', mode, 'targets:', targetKraCycleIds);
    onClone(targetKraCycleIds, mode); // ← pass mode
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <SwapHorizIcon sx={{ fontSize: 16, color: '#1E3A8A' }} />
        <Typography fontSize={13} fontWeight={700} color="#1e293b">
          Copy KRAs to Other Employees
        </Typography>
      </Stack>
      <Typography fontSize={12} color="#64748b" mb={1.5}>
        Select employees below to receive the same KRAs as{' '}
        <strong>{sourceEmployee.full_name}</strong>.
      </Typography>

      {/* ── Mode Selector ── */}
      <Box sx={{ mb: 1.5 }}>
        <Typography fontSize={11} fontWeight={700} color="#475569" textTransform="uppercase" letterSpacing="0.06em" mb={0.75}>
          If employee already has KRAs
        </Typography>
        <Stack direction="row" gap={1}>
          {[
            {
              value: 'append',
              label: 'Append',
              desc: 'Keep existing KRAs, add missing ones from source',
              color: '#1d4ed8',
              bg: '#eff6ff',
              border: '#93c5fd',
            },
            {
              value: 'overwrite',
              label: 'Overwrite',
              desc: 'Replace all existing KRAs with source KRAs',
              color: '#dc2626',
              bg: '#fef2f2',
              border: '#fca5a5',
            },
          ].map((opt) => (
            <Box
              key={opt.value}
              onClick={() => setMode(opt.value)}
              sx={{
                flex: 1, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                border: `2px solid ${mode === opt.value ? opt.border : '#e2e8f0'}`,
                bgcolor: mode === opt.value ? opt.bg : '#fafafa',
                transition: 'all 0.15s',
                '&:hover': { border: `2px solid ${opt.border}`, bgcolor: opt.bg },
              }}
            >
              <Stack direction="row" alignItems="center" gap={0.75} mb={0.25}>
                <Box sx={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${mode === opt.value ? opt.color : '#cbd5e1'}`,
                  bgcolor: mode === opt.value ? opt.color : 'transparent',
                  transition: 'all 0.15s',
                }} />
                <Typography fontSize={12} fontWeight={700} color={mode === opt.value ? opt.color : '#374151'}>
                  {opt.label}
                </Typography>
              </Stack>
              <Typography fontSize={10.5} color="#64748b">{opt.desc}</Typography>
            </Box>
          ))}
        </Stack>

        {/* Contextual warning based on selected mode */}
        {mode === 'overwrite' && (
          <Alert severity="warning" sx={{ borderRadius: 2, fontSize: 11, mt: 1, py: 0.5 }}>
            <strong>Destructive:</strong> All existing KRAs on selected employees will be deleted and replaced with {sourceEmployee.full_name}'s KRAs.
          </Alert>
        )}
        {mode === 'append' && (
          <Alert severity="info" sx={{ borderRadius: 2, fontSize: 11, mt: 1, py: 0.5 }}>
            <strong>Safe:</strong> Only KRAs not already assigned will be added. Existing KRAs are untouched.
          </Alert>
        )}
      </Box>

      <TextField
        size="small"
        placeholder="Search employees..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: '#94a3b8' }} /></InputAdornment>,
        }}
        sx={{ mb: 1, width: '100%', '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 34 } }}
      />

      {/* Select all */}
      <Stack direction="row" alignItems="center" sx={{ px: 0.5, mb: 0.5 }}>
        <Checkbox
          size="small"
          indeterminate={selectedIds.length > 0 && selectedIds.length < eligible.length}
          checked={eligible.length > 0 && selectedIds.length === eligible.length}
          onChange={(e) => toggleAll(e.target.checked)}
          sx={{ p: 0.5 }}
        />
        <Typography fontSize={10} fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.04em" ml={0.5}>
          Select All ({eligible.length})
        </Typography>
        {selectedIds.length > 0 && (
          <Chip
            label={`${selectedIds.length} selected`}
            size="small"
            sx={{ fontSize: 9, height: 16, fontWeight: 700, ml: 1, bgcolor: '#eff6ff', color: '#1d4ed8' }}
          />
        )}
      </Stack>

      {/* Employee list */}
      <Box sx={{
        maxHeight: 220, overflow: 'auto',
        border: '1px solid #e2e8f0', borderRadius: 2, mb: 1.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
      }}>
        {eligible.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
            <PersonIcon sx={{ fontSize: 28, mb: 0.5, opacity: 0.4 }} />
            <Typography fontSize={12}>No other assigned employees found</Typography>
            <Typography fontSize={11} color="#b0bec5" mt={0.25}>Only employees already assigned to this cycle can receive copied KRAs</Typography>
          </Box>
        ) : (
          eligible.map((emp) => {
            const isSelected = selectedIds.includes(emp.employee_id);
            return (
              <Box
                key={emp.employee_id}
                onClick={() => toggleId(emp.employee_id)}
                sx={{
                  display: 'flex', alignItems: 'center',
                  px: 1.5, py: 0.9, cursor: 'pointer',
                  bgcolor: isSelected ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid #f1f5f9',
                  '&:last-child': { borderBottom: 0 },
                  '&:hover': { bgcolor: isSelected ? '#eff6ff' : '#f8fafc' },
                  transition: 'background 0.1s',
                }}
              >
                <Checkbox
                  size="small" checked={isSelected} onChange={() => {}}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ p: 0, mr: 1.25, flexShrink: 0 }}
                />
                <Box minWidth={0}>
                  <Typography fontSize={12} fontWeight={600} color="#1e293b" noWrap>{emp.full_name}</Typography>
                  <Typography fontSize={10} color="#94a3b8" noWrap>
                    {emp.level}{emp.department ? ` • ${emp.department}` : ''}
                  </Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Button
        variant="contained" fullWidth
        disabled={selectedIds.length === 0 || cloning}
        startIcon={cloning ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
        onClick={handleClone}
        sx={{
          fontSize: 12, fontWeight: 700,
          background: mode === 'overwrite'
            ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
            : gradient,
          color: '#ffffff', borderRadius: 2, height: 38,
          '&:hover': { opacity: 0.9 },
          '&:disabled': { opacity: 0.5, background: gradient, color: '#ffffff' },
        }}
      >
        {cloning
          ? 'Copying KRAs…'
          : selectedIds.length > 0
            ? `${mode === 'overwrite' ? 'Overwrite' : 'Append'} KRAs for ${selectedIds.length} Employee${selectedIds.length !== 1 ? 's' : ''}`
            : 'Select employees to copy to'
        }
      </Button>
    </Box>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function EmployeeKRAView({
  open,
  employee,
  kraLibrary,
  categories,
  cachedData,       // { categories: [...], kra_level_ids: [...] }
  employees,
  activeCycleId,
  defaultTab = 'kras',  // 'kras' | 'weightage' | 'clone'
  onClose,
  onCloneTo,        // async (targetEmployeeKraCycleIds: number[]) => void
}) {
  const [tab, setTab]       = useState(defaultTab);
  const [cloning, setCloning] = useState(false);

  // Reset tab when modal opens with a new defaultTab
  React.useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  if (!employee) return null;

const kraLevelIds = employee.assigned_kras?.map(k => k.kra_level_id) ?? cachedData?.kra_level_ids ?? [];
const cachedCategories = 
  (employee.assigned_categories?.length > 0)
    ? employee.assigned_categories
    : (cachedData?.categories ?? []);
  const totalKRAs        = kraLevelIds.length;

  const handleClone = async (targetIds, mode) => {
    setCloning(true);
    try {
      await onCloneTo(targetIds, mode);
    } finally {
      setCloning(false);
    }
  };

  const TABS = [
    { key: 'kras',      label: `KRAs (${totalKRAs})` },
    { key: 'weightage', label: `Weightage (${cachedCategories.length})` },
    { key: 'clone',     label: 'Copy to Others' },
  ];

  return (
    <Dialog
      open={open}
      onClose={!cloning ? onClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 0, flexShrink: 0 }}>
        <Box sx={{ background: gradient, px: 3, py: 2.5, color: '#fff', borderRadius: '12px 12px 0 0' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {/* <Avatar sx={{ width: 42, height: 42, fontSize: 15, fontWeight: 800, bgcolor: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}>
                {getInitials(employee.full_name)}
              </Avatar> */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography fontWeight={800} fontSize="1rem" lineHeight={1.2}>{employee.full_name}</Typography>
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '11px !important', color: '#86efac !important' }} />}
                    label="Assigned"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#bbf7d0', fontSize: 9, fontWeight: 700, height: 18 }}
                  />
                </Stack>
                <Typography fontSize={11} sx={{ opacity: 0.7, mt: 0.2 }}>
                  {[employee.title, employee.level, employee.department, employee.email].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={onClose} disabled={cloning} sx={{ color: 'rgba(255,255,255,0.7)', mt: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {/* Stats */}
          <Stack direction="row" spacing={2} mt={2}>
            {[
              { label: 'KRAs Assigned', value: totalKRAs },
              { label: 'Categories',    value: cachedCategories.length },
              { label: 'Cycle ID',      value: activeCycleId ?? '—' },
            ].map((stat) => (
              <Box key={stat.label} sx={{ px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5, minWidth: 80, textAlign: 'center' }}>
                <Typography fontSize={16} fontWeight={800} lineHeight={1}>{stat.value}</Typography>
                <Typography fontSize={9.5} sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Tab bar */}
        <Stack direction="row" sx={{ borderBottom: '1px solid #e2e8f0', px: 2, pt: 0.5, bgcolor: '#fff' }}>
          {TABS.map((t) => (
            <Box
              key={t.key}
              onClick={() => setTab(t.key)}
              sx={{
                px: 2, py: 1.25,
                cursor: 'pointer', userSelect: 'none',
                fontSize: 12.5,
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? '#1E3A8A' : '#64748b',
                borderBottom: tab === t.key ? '2px solid #1E3A8A' : '2px solid transparent',
                transition: 'all 0.12s',
                '&:hover': { color: '#1E3A8A' },
              }}
            >
              {t.label}
            </Box>
          ))}
        </Stack>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 2.5, overflow: 'auto', flex: 1 }}>
        {tab === 'kras' && (
          totalKRAs === 0
            ? (
              <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>
                KRA data is not cached locally. Refresh the page to reload assignment information.
              </Alert>
            )
            : (
              <KRATable kraLibrary={kraLibrary} kraLevelIds={kraLevelIds} categories={categories} />
            )
        )}

        {tab === 'weightage' && (
          <Box>
            <Typography fontSize={13} fontWeight={700} color="#1e293b" mb={1.5}>
              Category Weightage Distribution
            </Typography>
            <WeightageSummary
              categories={categories}
              cachedCategories={cachedCategories}
              kraLibrary={kraLibrary}
            />
          </Box>
        )}

        {tab === 'clone' && (
  <ClonePanel
    employees={employees.filter(e => e.assigned_to_cycle && e.employee_kra_cycle_id != null)}
    sourceEmployee={employee}
    onClone={handleClone}
    cloning={cloning}
  />
)}
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
        <Typography fontSize={11} color="#94a3b8" flex={1}>
          Assignment ID: {employee.employee_kra_cycle_id ?? '—'}
        </Typography>
        <Button onClick={onClose} disabled={cloning} sx={{ color: '#64748b', fontWeight: 600, borderRadius: 2, fontSize: 12 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}