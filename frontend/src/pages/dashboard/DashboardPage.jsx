import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, Tabs, Tab, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip, InputAdornment, Drawer, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { useCycles, invalidateCyclesCache } from '../../hooks/useCycles';
import { cloneCycle, updateCycle, advanceCycleStage } from '../../api/cyclesApi';
import useRoleAccess from '../../hooks/useRoleAccess';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const STATUS_STYLES = {
  ACTIVE:    { bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 },
  DRAFT:     { bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700 },
  CLOSED:    { bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 },
  INACTIVE:  { bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 },
  ON_HOLD:   { bgcolor: '#fde8d8', color: '#9a3412', fontWeight: 700 },
  CANCELLED: { bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 },
};

const STAGES = [
  { id: 1, name: 'KRA Assignment By Lead' },
  { id: 2, name: 'Self Assessment' },
  { id: 3, name: 'Lead Assessment' },
  { id: 4, name: 'HR Validation' },
  { id: 5, name: 'Completed' },
];

const STATUS_ACTIONS = {
  DRAFT:     ['ACTIVE'],
  ACTIVE:    ['ON_HOLD', 'CLOSED', 'CANCELLED'],
  ON_HOLD:   ['ACTIVE', 'CANCELLED'],
  INACTIVE:  ['ACTIVE', 'CANCELLED'],
  CLOSED:    [],
  CANCELLED: [],
};

const ACTION_CONFIG = {
  ACTIVE:    { label: 'Activate',    icon: <PlayArrowIcon />,        color: gradient,  textColor: '#fff',    borderColor: null },
  ON_HOLD:   { label: 'Put On Hold', icon: <PauseIcon />,            color: '#fde8d8', textColor: '#9a3412', borderColor: '#fdba74' },
  INACTIVE:  { label: 'Deactivate',  icon: <PowerSettingsNewIcon />, color: '#fef3c7', textColor: '#92400e', borderColor: '#fcd34d' },
  CLOSED:    { label: 'Close',       icon: <CheckCircleIcon />,      color: '#dcfce7', textColor: '#15803d', borderColor: '#86efac' },
  CANCELLED: { label: 'Cancel',      icon: <BlockIcon />,            color: '#fee2e2', textColor: '#991b1b', borderColor: '#fca5a5' },
};

const TAB_FILTERS = [null, 'ACTIVE', 'DRAFT', 'CLOSED', 'ON_HOLD', 'INACTIVE', 'CANCELLED'];
const TAB_LABELS  = ['All', 'Active', 'Draft', 'Closed', 'On Hold', 'Inactive', 'Cancelled'];

/* ── Banner stage stepper ─────────────────────────────────────────────────── */
function BannerStageStepper({ currentStageId, canAdvance, onAdvance }) {
  return (
    <Box sx={{ position: 'relative', mt: 1.5, pb: 0.5 }}>
      <Box sx={{
        position: 'absolute', top: 13, left: '9%', right: '9%',
        height: 2, bgcolor: 'rgba(255,255,255,0.2)', zIndex: 0,
      }} />
      <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1, px: 1 }}>
        {STAGES.map((stage, i) => {
          const n = i + 1;
          const isDone   = n < currentStageId;
          const isActive = n === currentStageId;
          const isNext   = canAdvance && n === currentStageId + 1;
          return (
            <Tooltip key={stage.id} title={isNext ? `Advance to "${stage.name}"` : ''} disableHoverListener={!isNext}>
              <Stack
                alignItems="center" spacing={0.75}
                sx={{
                  width: '18%',
                  cursor: isNext ? 'pointer' : 'default',
                  '&:hover .sdot': isNext ? {
                    bgcolor: 'rgba(96,165,250,0.45) !important',
                    border: '2px solid rgba(96,165,250,0.8) !important',
                    transform: 'scale(1.18)',
                  } : {},
                }}
                onClick={isNext ? onAdvance : undefined}
              >
                <Box className="sdot" sx={{
                  width: 28, height: 28, borderRadius: '50%',
                  bgcolor: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.12)',
                  border: `2px solid ${isActive ? '#60a5fa' : isDone ? 'rgba(255,255,255,0.6)' : isNext ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  color: isDone || isActive ? '#1e3a8a' : 'rgba(255,255,255,0.5)',
                  boxShadow: isActive ? '0 0 0 4px rgba(96,165,250,0.3)' : 'none',
                  flexShrink: 0, transition: 'all 0.18s',
                }}>
                  {isDone ? '✓' : isActive ? `0${n}` : isNext ? <SkipNextIcon sx={{ fontSize: 13, opacity: 0.7 }} /> : n}
                </Box>
                <Typography sx={{
                  fontSize: 9, fontWeight: isActive ? 700 : 500, textAlign: 'center', lineHeight: 1.3,
                  color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.75)' : isNext ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.45)',
                  maxWidth: 68,
                }}>
                  {stage.name}
                </Typography>
                {isNext && (
                  <Typography sx={{ fontSize: 8, color: 'rgba(96,165,250,0.9)', fontWeight: 700, letterSpacing: '0.02em' }}>
                    advance →
                  </Typography>
                )}
              </Stack>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}

/* ── Cycle Detail Drawer ──────────────────────────────────────────────────── */
function CycleDetailDrawer({ open, cycle, onClose, canManageCycles, onAdvanceStage, onStatusChange, onClone, onDelete, onNavigate, hasAnotherActiveCycle }) {
  if (!cycle) return null;
  const currentStatus    = cycle.status;
  const currentStageId   = cycle.current_stage?.id ?? null;
  const availableActions = STATUS_ACTIONS[currentStatus] ?? [];
  const canAdvance       = currentStatus === 'ACTIVE' && canManageCycles && currentStageId && currentStageId < 5;
  const isFrozen         = currentStatus === 'CLOSED' || currentStatus === 'CANCELLED';

  // ── Delete permission: only DRAFT ─────────────────────────────────────────
  const canDelete     = currentStatus === 'DRAFT';
  const deleteTooltip = canDelete ? 'Delete cycle' : 'Only draft cycles can be deleted';

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, borderRadius: '12px 0 0 12px', boxShadow: '-8px 0 32px rgba(0,0,0,0.10)' } }}
    >
      {/* Gradient header with stepper */}
      <Box sx={{ background: gradient, px: 3, pt: 3, pb: 2.5, color: '#fff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1} minWidth={0} pr={1}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap" gap={0.5}>
              <Chip label={cycle.status.replace('_', ' ')} size="small"
                sx={{ height: 18, fontSize: 9, fontWeight: 700, ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
              {cycle.current_stage && (
                <Chip label={`Stage ${cycle.current_stage.id}: ${STAGES.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name}`} size="small"
                  sx={{ bgcolor: 'rgba(96,165,250,0.25)', color: '#bfdbfe', fontSize: 9, fontWeight: 600, height: 18 }} />
              )}
            </Stack>
            <Typography fontWeight={800} sx={{ fontSize: '1.05rem', lineHeight: 1.3 }}>{cycle.name}</Typography>
            <Typography fontSize={11} sx={{ opacity: 0.7, mt: 0.3 }}>{formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.7)', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Mini stepper */}
        <Box sx={{ mt: 2, position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 11, left: 0, right: 0, height: 2, bgcolor: 'rgba(255,255,255,0.15)', zIndex: 0 }} />
          <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
            {STAGES.map((stage) => {
              const done   = currentStageId && stage.id < currentStageId;
              const active = currentStageId === stage.id;
              return (
                <Stack key={stage.id} alignItems="center" spacing={0.75} sx={{ width: '18%' }}>
                  <Box sx={{
                    width: active ? 28 : 22, height: active ? 28 : 22, borderRadius: '50%',
                    bgcolor: done ? '#10b981' : active ? '#fff' : 'rgba(255,255,255,0.15)',
                    border: active ? '3px solid rgba(255,255,255,0.5)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    outline: active ? '4px solid rgba(255,255,255,0.12)' : 'none', transition: 'all 0.2s',
                  }}>
                    {done   && <CheckCircleIcon sx={{ color: '#fff', fontSize: 13 }} />}
                    {active && <Typography sx={{ fontSize: 10, color: '#1E3A8A', fontWeight: 800 }}>{stage.id}</Typography>}
                    {!done && !active && <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{stage.id}</Typography>}
                  </Box>
                  <Typography sx={{
                    fontSize: 8, fontWeight: active ? 700 : 500, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: active ? '#fff' : done ? '#86efac' : 'rgba(255,255,255,0.45)',
                    textAlign: 'center', maxWidth: 62, lineHeight: 1.3,
                  }}>
                    {stage.name}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Box>

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
          Cycle Details
        </Typography>
        <Stack spacing={1.5} mb={3}>
          {[
            { label: 'Cycle Name', value: cycle.name },
            { label: 'Description', value: cycle.description || '—' },
            { label: 'Start Date', value: formatDate(cycle.start_date) },
            { label: 'End Date', value: formatDate(cycle.end_date) },
          ].map(({ label, value }) => (
            <Box key={label}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
              <Typography sx={{ fontSize: 13, color: '#1e293b', fontWeight: 500, mt: 0.25 }}>{value}</Typography>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {canManageCycles && (
          <>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
              Actions
            </Typography>

            {hasAnotherActiveCycle && availableActions.includes('ACTIVE') && (
              <Alert severity="warning" sx={{ mb: 1.5, fontSize: 12, borderRadius: 2 }}>
                <strong>Cannot activate this cycle.</strong> Another cycle is already active. Please close or put it on hold first.
              </Alert>
            )}

            {canAdvance && (
              <Button fullWidth startIcon={<SkipNextIcon />} onClick={() => onAdvanceStage(cycle)}
                sx={{ mb: 1, justifyContent: 'flex-start', fontWeight: 700, fontSize: 13, color: '#1E3A8A', border: '1px solid #bfdbfe', borderRadius: 2, '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' } }}>
                Advance to Stage {currentStageId + 1}: {STAGES.find(s => s.id === currentStageId + 1)?.name}
              </Button>
            )}

            {availableActions.map((targetStatus) => {
              const cfg = ACTION_CONFIG[targetStatus];
              const isGrad = targetStatus === 'ACTIVE';
              const isDisabled = targetStatus === 'ACTIVE' && hasAnotherActiveCycle;
              return (
                <Tooltip key={targetStatus} title={isDisabled ? 'Another cycle is already active. Close or put it on hold first.' : ''} disableHoverListener={!isDisabled}>
                  <span style={{ display: 'block', marginBottom: 8 }}>
                    <Button
                      fullWidth
                      startIcon={cfg.icon}
                      disabled={isDisabled}
                      onClick={() => !isDisabled && onStatusChange(cycle, targetStatus)}
                      sx={isGrad
                        ? { justifyContent: 'flex-start', fontWeight: 700, fontSize: 13, background: isDisabled ? undefined : gradient, color: isDisabled ? undefined : '#fff', borderRadius: 2, '&:hover': { background: gradient, opacity: 0.9 }, '&.Mui-disabled': { opacity: 0.45 } }
                        : { justifyContent: 'flex-start', fontWeight: 700, fontSize: 13, color: cfg.textColor, border: `1px solid ${cfg.borderColor}`, bgcolor: cfg.color, borderRadius: 2, '&:hover': { opacity: 0.85 } }
                      }>
                      {cfg.label}
                    </Button>
                  </span>
                </Tooltip>
              );
            })}

            {/* Clone + Delete row */}
            <Stack direction="row" spacing={1} mt={1.5}>
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={() => onClone(cycle)}
                sx={{ flex: 1, fontWeight: 600, fontSize: 12, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                Clone
              </Button>

              {/* DRAWER DELETE BUTTON — disabled for non-DRAFT */}
              <Tooltip title={deleteTooltip}>
                <span style={{ flex: 1 }}>
                  <Button
                    fullWidth
                    startIcon={<DeleteOutlineIcon />}
                    disabled={!canDelete}
                    onClick={() => { if (!canDelete) return; onDelete(cycle); }}
                    sx={{
                      fontWeight: 600, fontSize: 12, color: '#ef4444',
                      border: '1px solid #fecaca', borderRadius: 2,
                      '&:hover': { bgcolor: '#fef2f2' },
                      '&.Mui-disabled': { color: '#fca5a5', borderColor: '#fee2e2', bgcolor: 'transparent' },
                    }}>
                    Delete
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            {isFrozen && (
              <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>
                This cycle is <strong>{currentStatus.replace('_', ' ').toLowerCase()}</strong>. No further changes are possible.
              </Alert>
            )}
          </>
        )}

        <Button fullWidth startIcon={<OpenInNewIcon />} onClick={() => onNavigate(cycle)}
          sx={{ mt: 2, fontWeight: 600, fontSize: 12, color: '#1E3A8A', border: '1px solid #dbeafe', borderRadius: 2, '&:hover': { bgcolor: '#eff6ff' } }}>
          Open Full Cycle Page
        </Button>
      </Box>
    </Drawer>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { canManageCycles } = useRoleAccess();
  const { data: allCycles, loading, error, refetch } = useCycles();

  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const rowsPerPage = 5;

  const [drawerCycle, setDrawerCycle]   = useState(null);
  const [successMsg, setSuccessMsg]     = useState('');

  const [cloneOpen, setCloneOpen]       = useState(false);
  const [cloneSource, setCloneSource]   = useState(null);
  const [cloneName, setCloneName]       = useState('');
  const [cloneStart, setCloneStart]     = useState('');
  const [cloneEnd, setCloneEnd]         = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError]     = useState('');

  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  const [advanceOpen, setAdvanceOpen]       = useState(false);
  const [advanceTarget, setAdvanceTarget]   = useState(null);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError]     = useState('');

  const [confirmAction, setConfirmAction]   = useState(null); // { cycle, targetStatus }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError]     = useState('');

  function flash(msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); }

  const activeCycles    = allCycles?.filter(c => c.status === 'ACTIVE')    ?? [];
  const draftCycles     = allCycles?.filter(c => c.status === 'DRAFT')     ?? [];
  const closedCycles    = allCycles?.filter(c => c.status === 'CLOSED')    ?? [];
  const onHoldCycles    = allCycles?.filter(c => c.status === 'ON_HOLD')   ?? [];
  const inactiveCycles  = allCycles?.filter(c => c.status === 'INACTIVE')  ?? [];
  const cancelledCycles = allCycles?.filter(c => c.status === 'CANCELLED') ?? [];
  const activeCycle     = activeCycles[0] ?? null;

  const tabCounts = [
    allCycles?.length ?? 0,
    activeCycles.length, draftCycles.length, closedCycles.length,
    onHoldCycles.length, inactiveCycles.length, cancelledCycles.length,
  ];

  const filteredByTab = useMemo(() => {
    const sf = TAB_FILTERS[tab];
    const base = sf ? (allCycles ?? []).filter(c => c.status === sf) : (allCycles ?? []);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(c => c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.current_stage?.name?.toLowerCase().includes(q));
  }, [allCycles, tab, search]);

  function openClone(cycle) {
    setCloneSource(cycle); setCloneName(`${cycle.name} (Copy)`); setCloneStart(''); setCloneEnd(''); setCloneError(''); setCloneOpen(true); setDrawerCycle(null);
  }

  // ── openDelete: guard — only allow DRAFT ──────────────────────────────────
  function openDelete(cycle) {
    if (cycle.status !== 'DRAFT') return; // 🛡️ hard guard
    setDeleteTarget(cycle); setDeleteError(''); setDeleteOpen(true); setDrawerCycle(null);
  }

  function openAdvance(cycle) { setAdvanceTarget(cycle); setAdvanceError(''); setAdvanceOpen(true); }

  function openStatusChange(cycle, targetStatus) {
    if (targetStatus === 'ACTIVE') {
      const alreadyActive = (allCycles ?? []).find(c => c.status === 'ACTIVE' && c.id !== cycle.id);
      if (alreadyActive) {
        setConfirmAction({ cycle, targetStatus });
        setConfirmError(`"${alreadyActive.name}" is currently active. You must close it or put it on hold before activating another cycle. Only one cycle can be active at a time.`);
        return;
      }
    }
    setConfirmAction({ cycle, targetStatus });
    setConfirmError('');
    setDrawerCycle(null);
  }

  async function handleClone() {
    if (!cloneName || !cloneStart || !cloneEnd) { setCloneError('All fields are required.'); return; }
    setCloneLoading(true); setCloneError('');
    try {
      const res = await cloneCycle(cloneSource.id, { name: cloneName, start_date: cloneStart, end_date: cloneEnd });
      invalidateCyclesCache(); refetch(); setCloneOpen(false);
      navigate(ROUTES.CYCLE_DETAIL.replace(':id', res.data.id));
    } catch (err) { setCloneError(err?.response?.data?.error || err?.response?.data?.detail || 'Clone failed. Please try again.'); }
    finally { setCloneLoading(false); }
  }

  // ── handleDelete: only DRAFT cycles allowed ────────────────────────────────
  async function handleDelete() {
    if (deleteTarget?.status !== 'DRAFT') return; // 🛡️ hard guard
    setDeleteLoading(true); setDeleteError('');
    try {
      await updateCycle(deleteTarget.id, { is_deleted: true });
      invalidateCyclesCache(); refetch(); setDeleteOpen(false);
      flash(`"${deleteTarget.name}" has been deleted.`);
    } catch (err) { setDeleteError(err?.response?.data?.error || err?.response?.data?.detail || 'Delete failed. Please try again.'); }
    finally { setDeleteLoading(false); }
  }

  async function handleAdvanceStage() {
    if (!advanceTarget) return;
    setAdvanceLoading(true); setAdvanceError('');
    try {
      const res = await advanceCycleStage(advanceTarget.id, {});
      invalidateCyclesCache(); await refetch(); setAdvanceOpen(false);
      flash(res.data?.message || 'Stage advanced successfully.');
    } catch (err) { setAdvanceError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to advance stage. Please try again.'); }
    finally { setAdvanceLoading(false); }
  }

  async function handleStatusChange() {
    if (!confirmAction) return;
    const { cycle: tc, targetStatus } = confirmAction;
    if (targetStatus === 'ACTIVE') {
      const alreadyActive = (allCycles ?? []).find(c => c.status === 'ACTIVE' && c.id !== tc.id);
      if (alreadyActive) {
        setConfirmError(`"${alreadyActive.name}" is currently active. You must close it or put it on hold before activating another cycle. Only one cycle can be active at a time.`);
        setConfirmLoading(false);
        return;
      }
    }
    setConfirmLoading(true); setConfirmError('');
    try {
      await updateCycle(tc.id, { status: targetStatus });
      invalidateCyclesCache(); await refetch(); setConfirmAction(null);
      const labels = { ACTIVE: 'activated', ON_HOLD: 'put on hold', INACTIVE: 'deactivated', CLOSED: 'closed', CANCELLED: 'cancelled' };
      flash(`Cycle "${tc.name}" ${labels[targetStatus] ?? 'updated'} successfully.${targetStatus === 'ACTIVE' ? ' Notifications sent to all VLs and HRs.' : ''}`);
    } catch (err) { setConfirmError(err?.response?.data?.error || err?.response?.data?.detail || 'Action failed. Please try again.'); }
    finally { setConfirmLoading(false); }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error" action={<Button onClick={refetch}>Retry</Button>}>{error}</Alert>;

  const advStageId   = advanceTarget?.current_stage?.id ?? null;
  const advNextStage = STAGES.find(s => s.id === advStageId + 1);

  return (
    <Box sx={{ height: '100vh', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8fafc', gap: 1.5, boxSizing: 'border-box' }}>

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexShrink={0}>
        <Box>
          <Typography fontWeight={800} color="#0f172a" sx={{ fontSize: '1.15rem', lineHeight: 1.2 }}>Performance Dashboard</Typography>
          <Typography fontSize={12} color="#64748b">Real-time KRA cycle overview</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {canManageCycles && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => navigate(ROUTES.CYCLE_CREATE)}
              sx={{ px: 2.5, background: gradient, borderRadius: 2, fontWeight: 700, '&:hover': { background: gradient, opacity: 0.9 } }}>
              New Cycle
            </Button>
          )}
        </Stack>
      </Stack>

      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ borderRadius: 2, flexShrink: 0 }}>{successMsg}</Alert>}

      {/* Stat cards */}
      <Stack direction="row" spacing={1.5} flexShrink={0}>
        {[
          { label: 'Total',     value: allCycles?.length ?? 0,  icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,         color: '#1e40af', bg: '#dbeafe' },
          { label: 'Active',    value: activeCycles.length,     icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,         color: '#15803d', bg: '#dcfce7' },
          { label: 'Draft',     value: draftCycles.length,      icon: <PendingActionsIcon sx={{ fontSize: 16 }} />,     color: '#d97706', bg: '#fef3c7' },
          { label: 'On Hold',   value: onHoldCycles.length,     icon: <PauseCircleOutlineIcon sx={{ fontSize: 16 }} />, color: '#9a3412', bg: '#fde8d8' },
          { label: 'Closed',    value: closedCycles.length,     icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />, color: '#334155', bg: '#f1f5f9' },
          { label: 'Cancelled', value: cancelledCycles.length,  icon: <BlockIcon sx={{ fontSize: 16 }} />,              color: '#991b1b', bg: '#fee2e2' },
        ].map((item, i) => (
          <Paper key={i} elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', '&:hover': { boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)' } }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: item.bg, color: item.color, flexShrink: 0 }}>{item.icon}</Box>
              <Box>
                <Typography fontSize={10} fontWeight={600} color="#64748b" noWrap>{item.label}</Typography>
                <Typography fontSize={20} fontWeight={800} lineHeight={1} color="#0f172a">{item.value}</Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* Active cycle banner */}
      {activeCycle && (() => {
        const sid       = activeCycle.current_stage?.id ?? 1;
        const canAdvBnr = canManageCycles && sid < 5;
        return (
          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid rgba(30,58,138,0.2)', flexShrink: 0 }}>
            <Box sx={{ p: 2, background: gradient, color: '#fff', borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Box flex={1} minWidth={0}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap" gap={0.5}>
                    <Chip label="LIVE • ACTIVE CYCLE" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 9, fontWeight: 700, height: 18 }} />
                    {activeCycle.current_stage && (
                      <Chip
                        label={`Stage ${activeCycle.current_stage.id}: ${STAGES.find(s => s.id === activeCycle.current_stage.id)?.name ?? activeCycle.current_stage.name}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(96,165,250,0.25)', color: '#bfdbfe', fontSize: 9, fontWeight: 600, height: 18 }}
                      />
                    )}
                  </Stack>
                  <Typography fontWeight={800} sx={{ fontSize: '1.05rem', lineHeight: 1.2 }} noWrap>{activeCycle.name}</Typography>
                  <Typography fontSize={11} sx={{ opacity: 0.75, mt: 0.25 }}>{formatDate(activeCycle.start_date)} — {formatDate(activeCycle.end_date)}</Typography>
                </Box>
                <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0} ml={2}>
                  {canManageCycles && (
                    <Tooltip title="Cycle actions">
                      <IconButton size="small" onClick={() => setDrawerCycle(activeCycle)}
                        sx={{ bgcolor: '#fff', color: '#1e3a8a', fontWeight: 700, borderRadius: 2, px: 2.5, fontSize: 12, '&:hover': { bgcolor: '#f0f6ff' } }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              <BannerStageStepper currentStageId={sid} canAdvance={canAdvBnr} onAdvance={() => openAdvance(activeCycle)} />
            </Box>
          </Paper>
        );
      })()}

      {/* Cycles table */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ borderBottom: '1px solid #f1f5f9', px: 1.5, bgcolor: '#fff', flexShrink: 0 }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }} variant="scrollable" scrollButtons={false}
            sx={{ minHeight: 40, flex: 1, '& .MuiTab-root': { fontSize: 11, fontWeight: 600, textTransform: 'none', minHeight: 40, py: 0, px: 1.5 }, '& .Mui-selected': { color: '#1E3A8A' }, '& .MuiTabs-indicator': { bgcolor: '#1E3A8A' } }}>
            {TAB_LABELS.map((label, i) => <Tab key={label} label={`${label} (${tabCounts[i]})`} />)}
          </Tabs>
          <TextField size="small" placeholder="Search cycles…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} /></InputAdornment> }}
            sx={{ ml: 1.5, width: 190, flexShrink: 0, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 32 } }} />
        </Stack>

        <TableContainer sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 0, height: 0 }, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['Cycle Name', 'Period', 'Stage', 'Status', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: '#f8fafc', py: 1 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredByTab.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((cycle) => {
                // Per-row delete permission
                const rowCanDelete = cycle.status === 'DRAFT';
                return (
                  <TableRow key={cycle.id} hover sx={{ height: 44, cursor: 'pointer' }} onClick={() => setDrawerCycle(cycle)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1E3A8A', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        onClick={() => setDrawerCycle(cycle)}>
                        {cycle.name}
                      </Typography>
                      {cycle.description && <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>{cycle.description}</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                    </TableCell>
                    <TableCell>
                      {cycle.current_stage ? (
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                            {cycle.current_stage.id}
                          </Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#1E3A8A' }}>
                            {STAGES.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name}
                          </Typography>
                        </Stack>
                      ) : <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>—</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip label={cycle.status.replace('_', ' ')} size="small"
                        sx={{ fontSize: 10, height: 22, borderRadius: '9999px', ...(STATUS_STYLES[cycle.status] ?? STATUS_STYLES.DRAFT) }} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Stack direction="row" spacing={0}>
                        <Tooltip title="View / Edit">
                          <IconButton size="small" onClick={() => setDrawerCycle(cycle)} sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' } }}>
                            <EditIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        {canManageCycles && (
                          <>
                            <Tooltip title="Clone">
                              <IconButton size="small" onClick={() => openClone(cycle)} sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' } }}>
                                <ContentCopyIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>

                            {/* TABLE DELETE ICON — disabled for non-DRAFT */}
                            <Tooltip title={rowCanDelete ? 'Delete' : 'Only draft cycles can be deleted'}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!rowCanDelete}
                                  onClick={() => rowCanDelete && openDelete(cycle)}
                                  sx={{
                                    color: '#94a3b8',
                                    '&:hover': { color: '#ef4444' },
                                    '&.Mui-disabled': { color: '#e2e8f0' },
                                  }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 15 }} />
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
              {filteredByTab.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#94a3b8', fontSize: 13 }}>
                    {search ? `No cycles match "${search}"` : 'No cycles found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination rowsPerPageOptions={[5]} component="div"
          count={filteredByTab.length} rowsPerPage={rowsPerPage} page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          sx={{ borderTop: '1px solid #f1f5f9', minHeight: 40, flexShrink: 0, '& .MuiToolbar-root': { minHeight: 40 } }} />
      </Paper>

      {/* Cycle detail drawer */}
      <CycleDetailDrawer
        open={!!drawerCycle}
        cycle={drawerCycle}
        onClose={() => setDrawerCycle(null)}
        canManageCycles={canManageCycles}
        onAdvanceStage={openAdvance}
        onStatusChange={openStatusChange}
        onClone={openClone}
        onDelete={openDelete}
        onNavigate={(c) => navigate(ROUTES.CYCLE_DETAIL.replace(':id', c.id))}
        hasAnotherActiveCycle={drawerCycle ? (allCycles ?? []).some(c => c.status === 'ACTIVE' && c.id !== drawerCycle.id) : false}
      />

      {/* Advance stage dialog */}
      <Dialog open={advanceOpen} onClose={() => !advanceLoading && setAdvanceOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>Advance to Next Stage</DialogTitle>
        <DialogContent>
          {advanceTarget && (
            <Typography sx={{ fontSize: 14, color: '#374151', mb: 1 }}>
              This will move <strong>{advanceTarget.name}</strong> from{' '}
              <strong>Stage {advStageId}: {STAGES.find(s => s.id === advStageId)?.name}</strong> to{' '}
              <strong>Stage {advStageId + 1}: {advNextStage?.name}</strong>.
            </Typography>
          )}
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>All enrolled employees will be moved to the new stage.</Typography>
          {advanceError && <Alert severity="error" sx={{ mt: 2 }}>{advanceError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAdvanceOpen(false)} disabled={advanceLoading} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleAdvanceStage} disabled={advanceLoading}
            sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}>
            {advanceLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Advancing...</> : 'Advance Stage'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm status change dialog */}
      <Dialog open={!!confirmAction} onClose={() => !confirmLoading && setConfirmAction(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {confirmAction && (() => {
          const cfg      = ACTION_CONFIG[confirmAction.targetStatus];
          const isGrd    = confirmAction.targetStatus === 'ACTIVE';
          const isBlocked = confirmAction.targetStatus === 'ACTIVE' && (allCycles ?? []).some(c => c.status === 'ACTIVE' && c.id !== confirmAction.cycle.id);
          return (
            <>
              <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>{cfg.label} Cycle</DialogTitle>
              <DialogContent>
                {isBlocked ? (
                  <Alert severity="error" sx={{ fontSize: 13 }}>
                    <strong>Action not allowed.</strong> Another cycle is already active. Please close it or put it on hold before activating this one. Only one cycle can be active at a time.
                  </Alert>
                ) : (
                  <Typography sx={{ fontSize: 14, color: '#374151' }}>
                    Are you sure you want to <strong>{cfg.label.toLowerCase()}</strong> the cycle{' '}
                    <strong>"{confirmAction.cycle.name}"</strong>?
                  </Typography>
                )}
                {confirmAction.targetStatus === 'ACTIVE' && !isBlocked && (
                  <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>Activation will send email notifications to all VLs and HRs.</Alert>
                )}
                {confirmError && <Alert severity="error" sx={{ mt: 2 }}>{confirmError}</Alert>}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={() => { setConfirmAction(null); setConfirmError(''); }} disabled={confirmLoading} sx={{ color: '#64748b', fontWeight: 600 }}>
                  {isBlocked ? 'OK' : 'Cancel'}
                </Button>
                {!isBlocked && (
                  <Button onClick={handleStatusChange} disabled={confirmLoading}
                    sx={isGrd
                      ? { background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }
                      : { bgcolor: cfg.color, color: cfg.textColor, border: `1px solid ${cfg.borderColor}`, fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { opacity: 0.85 }, '&:disabled': { opacity: 0.6 } }
                    }>
                    {confirmLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Processing...</> : cfg.label}
                  </Button>
                )}
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* Clone dialog */}
      <Dialog open={cloneOpen} onClose={() => !cloneLoading && setCloneOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1rem' }}>Clone Cycle</DialogTitle>
        <DialogContent>
          {cloneSource && <Typography sx={{ fontSize: 13, color: '#64748b', mb: 1.5 }}>Cloning from: <strong>{cloneSource.name}</strong></Typography>}
          <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>Cycle details and employee assignments will be cloned. Individual KRA assignments will not be carried over.</Alert>
          {cloneError && <Alert severity="error" sx={{ mb: 2 }}>{cloneError}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField label="New Cycle Name" fullWidth value={cloneName} onChange={e => setCloneName(e.target.value)} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <Stack direction="row" spacing={2}>
              <TextField label="Start Date" type="date" fullWidth value={cloneStart} onChange={e => setCloneStart(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <TextField label="End Date" type="date" fullWidth value={cloneEnd} onChange={e => setCloneEnd(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCloneOpen(false)} disabled={cloneLoading} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleClone} disabled={cloneLoading}
            sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}>
            {cloneLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Cloning...</> : 'Clone Cycle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={() => !deleteLoading && setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#ef4444', fontSize: '1rem' }}>Delete Cycle</DialogTitle>
        <DialogContent>
          {deleteTarget && (
            <Typography sx={{ fontSize: 14, color: '#374151' }}>
              Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This action cannot be undone.
            </Typography>
          )}
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>

          {/* DIALOG DELETE BUTTON — belt-and-suspenders guard for non-DRAFT */}
          <Tooltip title={deleteTarget?.status !== 'DRAFT' ? 'Only draft cycles can be deleted' : ''} disableHoverListener={deleteTarget?.status === 'DRAFT'}>
            <span>
              <Button
                onClick={handleDelete}
                disabled={deleteLoading || deleteTarget?.status !== 'DRAFT'}
                sx={{
                  bgcolor: '#ef4444', color: '#fff', fontWeight: 700, borderRadius: 2, px: 3,
                  '&:hover': { bgcolor: '#dc2626' },
                  '&:disabled': { opacity: 0.6 },
                }}>
                {deleteLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Deleting...</> : 'Delete'}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

    </Box>
  );
}