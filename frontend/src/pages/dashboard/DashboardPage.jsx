import React, { useState, useMemo, useEffect  } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, Tabs, Tab, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Tooltip, InputAdornment, TextField, Menu, MenuItem, ListItemIcon,
  TableSortLabel,
} from '@mui/material';
import AddIcon              from '@mui/icons-material/Add';
import ContentCopyIcon      from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutline';
import SearchIcon           from '@mui/icons-material/Search';
import BlockIcon            from '@mui/icons-material/Block';
import PlayArrowIcon        from '@mui/icons-material/PlayArrow';
import PauseIcon            from '@mui/icons-material/Pause';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import EditIcon             from '@mui/icons-material/Edit';
import MoreVertIcon         from '@mui/icons-material/MoreVert';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import OpenInNewIcon        from '@mui/icons-material/OpenInNew';
import { useNavigate }      from 'react-router-dom';
import ROUTES               from '../../config/routes';
import { useCycles, invalidateCyclesCache } from '../../hooks/useCycles';
import { updateCycle, advanceCycleStage, getReferenceData  }   from '../../api/cyclesApi';
import useRoleAccess        from '../../hooks/useRoleAccess';
import { Dialog, DialogContent, DialogActions } from '@mui/material';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const STATUS_STYLES = {
  ACTIVE:    { bgcolor: '#dbeafe', color: '#1d4ed8' },
  DRAFT:     { bgcolor: '#f1f5f9', color: '#475569' },
  CLOSED:    { bgcolor: '#dcfce7', color: '#166534' },
  ON_HOLD:   { bgcolor: '#fde8d8', color: '#9a3412' },
  CANCELLED: { bgcolor: '#fee2e2', color: '#991b1b' },
};


const STATUS_ACTIONS = {
  DRAFT:     ['ACTIVE'],
  ACTIVE:    ['ON_HOLD', 'CLOSED', 'CANCELLED'],
  ON_HOLD:   ['ACTIVE', 'CANCELLED'],
  CLOSED:    [],
  CANCELLED: [],
};

const ACTION_CONFIG = {
  ACTIVE:    { label: 'Activate',    icon: <PlayArrowIcon fontSize="small" />,   confirmColor: '#1E3A8A' },
  ON_HOLD:   { label: 'Put On Hold', icon: <PauseIcon fontSize="small" />,       confirmColor: '#9a3412' },
  CLOSED:    { label: 'Close',       icon: <CheckCircleIcon fontSize="small" />, confirmColor: '#15803d' },
  CANCELLED: { label: 'Cancel',      icon: <BlockIcon fontSize="small" />,       confirmColor: '#dc2626' },
};

const TAB_FILTERS = [null, 'DRAFT', 'CLOSED', 'ON_HOLD', 'CANCELLED'];
const TAB_LABELS  = ['All', 'Draft', 'Closed', 'On Hold', 'Cancelled'];
const ROWS_PER_PAGE = 7;

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(String(dateStr).split('T')[0] + 'T00:00:00');
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Stage stepper for active cycle banner ── */
function BannerStepper({stages, currentStageId, canAdvance, onAdvanceClick }) {
  return (
    <Box sx={{ position: 'relative', mt: 1.5 }}>
      <Box sx={{ position: 'absolute', top: 12, left: '5%', right: '5%', height: 2, bgcolor: 'rgba(255,255,255,0.2)', zIndex: 0 }} />
      <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
        {stages.map((stage) => {
          const done   = stage.id < currentStageId;
          const active = stage.id === currentStageId;
          const isNext = canAdvance && stage.id === currentStageId + 1;
          return (
            <Tooltip key={stage.id} title={isNext ? `Advance to "${stage.name}"` : stage.name}>
              <Stack alignItems="center" spacing={0.5} sx={{
                width: '18%', cursor: isNext ? 'pointer' : 'default',
                '&:hover .sdot': isNext ? { bgcolor: 'rgba(255,255,255,0.3) !important', transform: 'scale(1.12)' } : {},
              }}
                onClick={isNext ? () => onAdvanceClick(stage) : undefined}>
                <Box className="sdot" sx={{
                  width: active ? 36 : 28, height: active ? 36 : 28, borderRadius: '50%',
                  bgcolor: done ? '#10b981' : active ? '#fff' : 'rgba(255,255,255,0.15)',
                  border: `2px solid ${isNext ? 'rgba(255,255,255,0.5)' : active ? 'rgba(255,255,255,0.5)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  outline: active ? '4px solid rgba(255,255,255,0.12)' : 'none',
                  transition: 'all 0.2s', flexShrink: 0,
                }}>
                  {done   && <CheckCircleIcon sx={{ color: '#fff', fontSize: 16 }} />}
                  {active && <Typography sx={{ fontSize: 12, color: '#1E3A8A', fontWeight: 800 }}>{stage.id}</Typography>}
                  {!done && !active && (
                    <Typography sx={{ fontSize: 9, color: isNext ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                      {stage.id}
                    </Typography>
                  )}
                </Box>
                <Typography sx={{
                  fontSize: 11, fontWeight: active ? 700 : 500, textAlign: 'center', lineHeight: 1.2,
                  color: active ? '#fff' : done ? '#86efac' : isNext ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                  maxWidth: 72,
                }}>
                  {stage.name}
                </Typography>
                {isNext && <Typography sx={{ fontSize: 8, color: 'rgba(147,197,253,0.9)', fontWeight: 700 }}>tap →</Typography>}
              </Stack>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}

/* ── Confirm dialog ── */
function ConfirmDialog({ open, title, message, warning, confirmLabel, confirmColor, onClose, onConfirm, loading, error }) {
  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #fde68a' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
          <Typography fontWeight={700} fontSize={14} color="#92400e">{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Typography fontSize={13} color="#374151" mb={warning ? 1.5 : 0}>{message}</Typography>
        {warning && (
          <Box sx={{ px: 1.5, py: 1, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
            <Typography fontSize={12} color="#991b1b">{warning}</Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5, fontSize: 12, borderRadius: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>Cancel</Button>
        <Button onClick={onConfirm} disabled={loading} variant="contained"
          startIcon={loading ? <CircularProgress size={12} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13, bgcolor: confirmColor, '&:hover': { bgcolor: confirmColor, opacity: 0.88 }, '&:disabled': { opacity: 0.6 } }}>
          {loading ? 'Processing…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ══════════════ MAIN ══════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { canManageCycles } = useRoleAccess();
  const { data: allCycles, loading, error, refetch } = useCycles();

  const [stages, setStages] = useState([]);

  useEffect(() => {
    getReferenceData()
      .then(res => setStages(res.data.stages ?? []))
      .catch(() => {});
  }, []);
  const [tab, setTab]       = useState(0);
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');

  /* ── Sort state ── */
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const [successMsg, setSuccessMsg] = useState('');
  const [actionsAnchor, setActionsAnchor] = useState(null);

  const [confirm, setConfirm]               = useState({ open: false, action: null, cycle: null });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError]     = useState('');

  const [advanceConfirm, setAdvanceConfirm] = useState({ open: false, toStage: null, cycle: null });
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError]     = useState('');

  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  function flash(msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); }

  const activeCycle = useMemo(() => (allCycles ?? []).find(c => c.status === 'ACTIVE') ?? null, [allCycles]);

  const tabCounts = useMemo(() => {
    const all = allCycles ?? [];
    return TAB_FILTERS.map(f => f ? all.filter(c => c.status === f).length : all.length);
  }, [allCycles]);

  /* ── Filter → sort pipeline ── */
  const filteredAndSorted = useMemo(() => {
    const sf   = TAB_FILTERS[tab];
    let base   = sf ? (allCycles ?? []).filter(c => c.status === sf) : (allCycles ?? []);

    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      );
    }

    // Alphabetical sort using localeCompare (MUI TableSortLabel drives the direction)
    return [...base].sort((a, b) =>
      sortDir === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    );
  }, [allCycles, tab, search, sortDir]);

  function handleSortToggle() {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    setPage(0); // reset to first page on sort change
  }

  function openConfirm(cycle, action) {
    setConfirmError('');
    setConfirm({ open: true, action, cycle });
    setActionsAnchor(null);
  }

  async function handleConfirmAction() {
    const { cycle, action } = confirm;
    if (!cycle || !action) return;
    if (action === 'ACTIVE') {
      const other = (allCycles ?? []).find(c => c.status === 'ACTIVE' && c.id !== cycle.id);
      if (other) { setConfirmError(`"${other.name}" is already active. Close or put it on hold first.`); return; }
    }
    setConfirmLoading(true); setConfirmError('');
    try {
      await updateCycle(cycle.id, { status: action });
      invalidateCyclesCache(); await refetch();
      setConfirm({ open: false, action: null, cycle: null });
      const labels = { ACTIVE: 'activated', ON_HOLD: 'put on hold', CLOSED: 'closed', CANCELLED: 'cancelled' };
      flash(`"${cycle.name}" ${labels[action] ?? 'updated'}.`);
    } catch (err) {
      setConfirmError(err?.response?.data?.error || 'Action failed. Please try again.');
    } finally { setConfirmLoading(false); }
  }

  async function handleAdvanceStage() {
    const { cycle, toStage } = advanceConfirm;
    if (!cycle || !toStage) return;
    setAdvanceLoading(true); setAdvanceError('');
    try {
      await advanceCycleStage(cycle.id, {});
      invalidateCyclesCache(); await refetch();
      setAdvanceConfirm({ open: false, toStage: null, cycle: null });
      flash(`Cycle advanced to Stage ${toStage.id}: "${toStage.name}".`);
    } catch (err) {
      setAdvanceError(err?.response?.data?.error || 'Failed to advance stage.');
    } finally { setAdvanceLoading(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteTarget.status !== 'DRAFT') return;
    setDeleteLoading(true); setDeleteError('');
    try {
      await updateCycle(deleteTarget.id, { is_deleted: true });
      invalidateCyclesCache(); await refetch();
      setDeleteOpen(false);
      flash(`"${deleteTarget.name}" deleted.`);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Delete failed.');
    } finally { setDeleteLoading(false); }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress sx={{ color: '#1E3A8A' }} />
    </Box>
  );
  if (error) return (
    <Alert severity="error" action={<Button onClick={refetch}>Retry</Button>}>{error}</Alert>
  );

  const currentStageId   = activeCycle?.current_stage?.id ?? null;
  const activeActions    = activeCycle ? (STATUS_ACTIONS[activeCycle.status] ?? []) : [];
  const maxStageId = stages.length > 0 ? Math.max(...stages.map(s => s.id)) : 5;
  const canAdvanceActive = !!activeCycle && activeCycle.status === 'ACTIVE' && canManageCycles && currentStageId && currentStageId < maxStageId;

  const paginatedRows = filteredAndSorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  return (
    <Box sx={{ height: '100vh', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8fafc', gap: 1.5, boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexShrink={0}>
        <Box>
          <Typography fontWeight={800} color="#0f172a" sx={{ fontSize: '1.15rem', lineHeight: 1.2 }}>Performance Dashboard</Typography>
          <Typography fontSize={12} color="#64748b">KRA cycle overview</Typography>
        </Box>
        {canManageCycles && (
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => navigate(ROUTES.CYCLE_DETAIL.replace(':id', 'new'))}
            sx={{ px: 2.5, background: gradient, borderRadius: 2, fontWeight: 700, boxShadow: '0 4px 12px rgba(30,58,138,0.3)', '&:hover': { background: gradient, opacity: 0.9 } }}>
            New Cycle
          </Button>
        )}
      </Stack>

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ borderRadius: 2, flexShrink: 0 }}>{successMsg}</Alert>
      )}

      {/* ── Active cycle banner ── */}
      {activeCycle && (
        <Paper elevation={0} sx={{ borderRadius: 2, flexShrink: 0, overflow: 'hidden', boxShadow: '0 4px 20px rgba(30,58,138,0.18)' }}>
          <Box sx={{ px: 2.5, pt: 2, pb: 2, background: gradient, color: '#fff' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1} minWidth={0} pr={2}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap" gap={0.5}>
                  <Chip label="LIVE" size="small" sx={{ bgcolor: '#10b981', color: '#fff', fontSize: 9, fontWeight: 800, height: 17 }} />
                  <Typography fontWeight={800} sx={{ fontSize: '1rem' }} noWrap>{activeCycle.name}</Typography>
                  <Typography fontSize={11} sx={{ opacity: 0.65 }}>
                    {formatDate(activeCycle.start_date)} — {formatDate(activeCycle.end_date)}
                  </Typography>
                </Stack>
              </Box>

              <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                {canManageCycles && (
                  <Tooltip title="Clone this cycle">
                    <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                      onClick={() => navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', 'new')}?clone=${activeCycle.id}`)}
                      sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, fontSize: 11, fontWeight: 600, px: 1.25, py: 0.4, textTransform: 'none', minWidth: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                      Clone
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="Edit cycle details">
                  <Button size="small" startIcon={<EditIcon sx={{ fontSize: 13 }} />}
                    onClick={() => navigate(ROUTES.CYCLE_DETAIL.replace(':id', activeCycle.id))}
                    sx={{ bgcolor: '#fff', color: '#1E3A8A', borderRadius: 99, fontSize: 11, fontWeight: 700, px: 1.25, py: 0.4, textTransform: 'none', minWidth: 0, '&:hover': { bgcolor: '#f0f6ff' } }}>
                    Edit
                  </Button>
                </Tooltip>
                {canManageCycles && activeActions.filter(a => ['ON_HOLD', 'CANCELLED', 'CLOSED'].includes(a)).length > 0 && (
                  <>
                    <Tooltip title="Quick actions">
                      <IconButton size="small" onClick={e => setActionsAnchor(e.currentTarget)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, width: 28, height: 28, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                        <MoreVertIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
                      PaperProps={{ sx: { borderRadius: 2, mt: 0.5, minWidth: 160, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '0.5px solid #e2e8f0' } }}>
                      {activeActions.filter(a => ['ON_HOLD', 'CANCELLED', 'CLOSED'].includes(a)).map(action => {
                        const cfg = ACTION_CONFIG[action];
                        return (
                          <MenuItem key={action} onClick={() => openConfirm(activeCycle, action)}
                            sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1 }}>
                            <ListItemIcon sx={{ minWidth: 24 }}>{cfg.icon}</ListItemIcon>
                            {cfg.label}
                          </MenuItem>
                        );
                      })}
                    </Menu>
                  </>
                )}
              </Stack>
            </Stack>

            <BannerStepper
              stages={stages}
              currentStageId={currentStageId ?? 1}
              canAdvance={canAdvanceActive}
              onAdvanceClick={(stage) => {
                setAdvanceError('');
                setAdvanceConfirm({ open: true, toStage: stage, cycle: activeCycle });
              }}
            />
            {canAdvanceActive && (
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', mt: 0.75, textAlign: 'center' }}>
                Click next stage dot to advance
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {/* ── Cycles table ── */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: 444 }}>

        {/* Tab bar + search */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ borderBottom: '1px solid #f1f5f9', px: 1.5, bgcolor: '#fff', flexShrink: 0 }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }}
            variant="scrollable" scrollButtons={false}
            sx={{
              minHeight: 42, flex: 1,
              '& .MuiTab-root': { fontSize: 12, fontWeight: 600, textTransform: 'none', minHeight: 42, py: 0, px: 1.5 },
              '& .Mui-selected': { color: '#1E3A8A' },
              '& .MuiTabs-indicator': { bgcolor: '#1E3A8A', height: 2.5 },
            }}>
            {TAB_LABELS.map((label, i) => (
              <Tab key={label} label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <span>{label}</span>
                  <Box sx={{ px: 0.75, py: 0.1, bgcolor: tab === i ? '#1E3A8A' : '#f1f5f9', borderRadius: 99, minWidth: 18, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: tab === i ? '#fff' : '#64748b', lineHeight: 1.6 }}>
                      {tabCounts[i]}
                    </Typography>
                  </Box>
                </Stack>
              } />
            ))}
          </Tabs>
          <TextField size="small" placeholder="Search cycles…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#94a3b8' }} /></InputAdornment> }}
            sx={{ ml: 1.5, width: 200, flexShrink: 0, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 32 } }}
          />
        </Stack>

        {/* Table */}
        <TableContainer sx={{ flex: 1, overflow: 'overflow', '&::-webkit-scrollbar': { width: 0, height: 0 } }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {/* ── Cycle Name header with MUI TableSortLabel for A→Z / Z→A ── */}
                <TableCell
                  sx={{ fontWeight: 700, fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', bgcolor: '#f8fafc', py: 0.6, borderBottom: '1px solid #e2e8f0' }}>
                  <TableSortLabel
                    active={true}
                    direction={sortDir}
                    onClick={handleSortToggle}
                    sx={{
                      color: '#94a3b8 !important',
                      fontWeight: 700,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      '&.Mui-active': { color: '#1E3A8A !important' },
                      '& .MuiTableSortLabel-icon': { color: '#1E3A8A !important', fontSize: 14 },
                    }}>
                    Cycle Name
                  </TableSortLabel>
                </TableCell>

                {/* Static columns */}
                {['Period', 'Duration', 'Stage', 'Status', ''].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', bgcolor: '#f8fafc', py: 0.6, borderBottom: '1px solid #e2e8f0' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedRows.map((cycle) => {
                const stageId   = cycle.current_stage?.id ?? 1;
                const stageName = cycle.current_stage
                  ? (stages.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name)
                  : (stages[0]?.name ?? '—');
                const canDelete = cycle.status === 'DRAFT';
                const isActive  = cycle.status === 'ACTIVE';

                let duration = '—';
                if (cycle.start_date && cycle.end_date) {
                  const days = Math.round((new Date(String(cycle.end_date).split('T')[0]) - new Date(String(cycle.start_date).split('T')[0])) / 86400000);
                  duration = days >= 0 ? `${days}d` : '—';
                }

                return (
                  <TableRow key={cycle.id} hover
                    sx={{
                      height: 40, cursor: 'default',
                      bgcolor: isActive ? 'rgba(30,58,138,0.02)' : 'transparent',
                      '&:hover': { bgcolor: isActive ? 'rgba(30,58,138,0.05)' : '#f8fafc' },
                    }}
                  >

                    <TableCell sx={{ maxWidth: 240, pl: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {isActive && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />}
                        <Box minWidth={0}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1E3A8A' }} noWrap>{cycle.name}</Typography>
                          {cycle.description && (
                            <Typography sx={{ fontSize: 11, color: '#94a3b8' }} noWrap>{cycle.description}</Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                    </TableCell>

                    <TableCell sx={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {duration}
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                          {stageId}
                        </Box>
                        <Typography sx={{ fontSize: 12, color: '#475569' }} noWrap>{stageName}</Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Chip label={cycle.status.replace('_', ' ')} size="small"
                        sx={{ fontSize: 10, height: 20, fontWeight: 700, borderRadius: 99, ...(STATUS_STYLES[cycle.status] ?? STATUS_STYLES.DRAFT) }} />
                    </TableCell>

                    <TableCell onClick={e => e.stopPropagation()} sx={{ pr: 1.5 }}>
                      <Stack direction="row" spacing={0} justifyContent="flex-end">
                        <Tooltip title="Open">
                          <IconButton size="small"
                            onClick={e => { e.stopPropagation(); navigate(ROUTES.CYCLE_DETAIL.replace(':id', cycle.id)); }}
                            sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' }, p: 0.4 }}>
                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        {canManageCycles && (
                          <>
                            <Tooltip title="Clone">
                              <IconButton size="small"
                                onClick={e => { e.stopPropagation(); navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', 'new')}?clone=${cycle.id}`); }}
                                sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' }, p: 0.4 }}>
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={canDelete ? 'Delete' : 'Only draft cycles can be deleted'}>
                              <span>
                                <IconButton size="small" disabled={!canDelete}
                                  onClick={e => { e.stopPropagation(); if (canDelete) { setDeleteTarget(cycle); setDeleteError(''); setDeleteOpen(true); } }}
                                  sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' }, '&.Mui-disabled': { color: '#e2e8f0' }, p: 0.4 }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredAndSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#94a3b8', fontSize: 13 }}>
                    {search ? `No cycles match "${search}"` : 'No cycles found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Pagination footer — 6 rows per page ── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 2, py: 0.20, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa', flexShrink: 0 }}>
          <Typography fontSize={11} color="#94a3b8">
            {filteredAndSorted.length > 0
              ? `${page * ROWS_PER_PAGE + 1}–${Math.min((page + 1) * ROWS_PER_PAGE, filteredAndSorted.length)} of ${filteredAndSorted.length}`
              : '0 results'}
          </Typography>
          <TablePagination
            rowsPerPageOptions={[ROWS_PER_PAGE]}
            component="div"
            count={filteredAndSorted.length}
            rowsPerPage={ROWS_PER_PAGE}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            sx={{
              border: 'none',
              '& .MuiToolbar-root': { minHeight: 28, px: 0 },
              '& .MuiTablePagination-displayedRows': { display: 'none' },
            }}
          />
        </Stack>
      </Paper>

      {/* ── Dialogs ── */}
      {confirm.open && confirm.action && (
        <ConfirmDialog
          open={confirm.open}
          title={`${ACTION_CONFIG[confirm.action]?.label} Cycle`}
          message={`Are you sure you want to ${ACTION_CONFIG[confirm.action]?.label?.toLowerCase()} "${confirm.cycle?.name}"?`}
          warning={
            confirm.action === 'CANCELLED' ? 'This action cannot be undone. All assignments will be permanently cancelled.'
              : confirm.action === 'CLOSED' ? 'Closing will lock all assessments. This cannot be reversed.'
              : confirm.action === 'ACTIVE' ? 'Activating will send email notifications to all VLs and HRs.'
              : null
          }
          confirmLabel={ACTION_CONFIG[confirm.action]?.label}
          confirmColor={ACTION_CONFIG[confirm.action]?.confirmColor}
          loading={confirmLoading}
          error={confirmError}
          onClose={() => { setConfirm({ open: false, action: null, cycle: null }); setConfirmError(''); }}
          onConfirm={handleConfirmAction}
        />
      )}
      <ConfirmDialog
        open={advanceConfirm.open}
        title="Advance Stage"
        message={`Move "${advanceConfirm.cycle?.name}" to Stage ${advanceConfirm.toStage?.id}: "${advanceConfirm.toStage?.name}"?`}
        warning="All enrolled employees will be moved to the new stage."
        confirmLabel="Advance Stage"
        confirmColor="#1E3A8A"
        loading={advanceLoading}
        error={advanceError}
        onClose={() => { setAdvanceConfirm({ open: false, toStage: null, cycle: null }); setAdvanceError(''); }}
        onConfirm={handleAdvanceStage}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Cycle"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="#dc2626"
        loading={deleteLoading}
        error={deleteError}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}