import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseIcon from '@mui/icons-material/Pause';
import BlockIcon from '@mui/icons-material/Block';
import { useNavigate, useParams } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { getCycles, updateCycle, advanceCycleStage } from '../../api/cyclesApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';
import useRoleAccess from '../../hooks/useRoleAccess';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';
const shadow = '0px 12px 32px -4px rgba(30,58,138,0.06)';

const STATUS_STYLES = {
  ACTIVE:    { bgcolor: '#dbeafe', color: '#1d4ed8' },
  DRAFT:     { bgcolor: '#f1f5f9', color: '#64748b' },
  CLOSED:    { bgcolor: '#dcfce7', color: '#166534' },
  ON_HOLD:   { bgcolor: '#fef3c7', color: '#92400e' },
  INACTIVE:  { bgcolor: '#fef3c7', color: '#92400e' },
  CANCELLED: { bgcolor: '#fee2e2', color: '#991b1b' },
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
  ACTIVE:    { label: 'Activate',    icon: <PlayArrowIcon />,   color: gradient,  textColor: '#fff',    borderColor: null },
  ON_HOLD:   { label: 'Put On Hold', icon: <PauseIcon />,       color: '#fef3c7', textColor: '#92400e', borderColor: '#fcd34d' },
  CLOSED:    { label: 'Close',       icon: <CheckCircleIcon />, color: '#dcfce7', textColor: '#15803d', borderColor: '#86efac' },
  CANCELLED: { label: 'Cancel',      icon: <BlockIcon />,       color: '#fee2e2', textColor: '#991b1b', borderColor: '#fca5a5' },
};

/** Safely format any date string — handles ISO datetime (2024-06-14T00:00:00) and plain YYYY-MM-DD */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const d = new Date(clean + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CycleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageCycles } = useRoleAccess();

  const [cycle, setCycle]           = useState(null);
  const [allCycles, setAllCycles]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  const [advanceOpen, setAdvanceOpen]       = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError]     = useState('');

  const [confirmAction, setConfirmAction]   = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError]     = useState('');

  const fetchCycle = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getCycles();
      const cycles = res.data?.cycles ?? res.data ?? [];
      setAllCycles(cycles);
      const found = cycles.find(c => String(c.id) === String(id));
      if (!found) throw new Error('Cycle not found');
      setCycle(found);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to load cycle.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchCycle(); }, [fetchCycle]);

  function flash(msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); }

  function getOtherActiveCycle() {
    return allCycles.find(c => c.status === 'ACTIVE' && String(c.id) !== String(id));
  }

  function handleOpenStatusChange(targetStatus) {
    setConfirmError('');
    if (targetStatus === 'ACTIVE') {
      const other = getOtherActiveCycle();
      if (other) {
        setConfirmAction(targetStatus);
        setConfirmError(`"${other.name}" is currently active. You must close it or put it on hold before activating another cycle. Only one cycle can be active at a time.`);
        return;
      }
    }
    setConfirmAction(targetStatus);
  }

  async function handleStatusChange(targetStatus) {
    if (targetStatus === 'ACTIVE') {
      const other = getOtherActiveCycle();
      if (other) {
        setConfirmError(`"${other.name}" is currently active. You must close it or put it on hold before activating another cycle. Only one cycle can be active at a time.`);
        setConfirmLoading(false);
        return;
      }
    }
    setConfirmLoading(true); setConfirmError('');
    try {
      await updateCycle(id, { status: targetStatus });
      invalidateCyclesCache();
      await fetchCycle();
      setConfirmAction(null);
      const labels = { ACTIVE: 'activated', ON_HOLD: 'put on hold', CLOSED: 'closed', CANCELLED: 'cancelled' };
      flash(`Cycle "${cycle?.name}" ${labels[targetStatus] ?? 'updated'} successfully.${targetStatus === 'ACTIVE' ? ' Notifications sent to all VLs and HRs.' : ''}`);
    } catch (err) {
      setConfirmError(err?.response?.data?.error || err?.response?.data?.detail || 'Action failed. Please try again.');
    } finally { setConfirmLoading(false); }
  }

  async function handleAdvanceStage() {
    setAdvanceLoading(true); setAdvanceError('');
    try {
      const res = await advanceCycleStage(id, {});
      invalidateCyclesCache();
      await fetchCycle();
      setAdvanceOpen(false);
      flash(res.data?.message || 'Stage advanced successfully.');
    } catch (err) {
      setAdvanceError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to advance stage. Please try again.');
    } finally { setAdvanceLoading(false); }
  }

  function handleOpenClone() {
    navigate(ROUTES.CYCLE_CLONE.replace(':id', id));
  }

  async function handleDelete() {
    if (currentStatus !== 'DRAFT') return;
    setDeleteLoading(true); setDeleteError('');
    try {
      await updateCycle(id, { is_deleted: true });
      invalidateCyclesCache();
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || err?.response?.data?.detail || 'Delete failed. Please try again.');
      setDeleteLoading(false);
    }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <CircularProgress sx={{ color: '#1E3A8A' }} />
    </Box>
  );

  if (error) return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Alert severity="error" action={<Button size="small" onClick={fetchCycle} startIcon={<RefreshIcon />}>Retry</Button>}>{error}</Alert>
    </Box>
  );

  if (!cycle) return null;

  const currentStatus    = cycle.status;
  const currentStageId   = cycle.current_stage?.id ?? null;
  const availableActions = STATUS_ACTIONS[currentStatus] ?? [];
  const canAdvance       = currentStatus === 'ACTIVE' && canManageCycles && currentStageId && currentStageId < 5;
  const isFrozen         = currentStatus === 'CLOSED' || currentStatus === 'CANCELLED';
  const otherActiveCycle = getOtherActiveCycle();

  const canDelete     = currentStatus === 'DRAFT';
  const deleteTooltip = canDelete ? 'Delete cycle' : 'Only draft cycles can be deleted';

  return (
    <Box sx={{
    maxWidth: 1000, mx: 'auto',
    height: '100vh', overflow: 'auto', p: { xs: 2, md: 3 },
    '&::-webkit-scrollbar': { width: 5 },
    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
    '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 99 },
  }}>

      {/* ── Page Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton onClick={() => navigate(ROUTES.DASHBOARD)} sx={{ color: '#64748b' }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E3A8A' }}>{cycle.name}</Typography>
              <Chip label={cycle.status.replace('_', ' ')} size="small"
                sx={{ fontSize: 10, fontWeight: 700, height: 22, borderRadius: '9999px', ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
            </Stack>
            {/* ✅ Fixed: use formatDate() to strip T00:00:00 */}
            <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.3 }}>
              {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh">
            <IconButton onClick={fetchCycle} sx={{ color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManageCycles && (
            <>
              <Tooltip title="Clone this cycle">
                <Button startIcon={<ContentCopyIcon />} onClick={handleOpenClone}
                  sx={{ color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  Clone
                </Button>
              </Tooltip>
              <Tooltip title={deleteTooltip}>
                <span>
                  <Button startIcon={<DeleteOutlineIcon />} disabled={!canDelete}
                    onClick={() => { if (!canDelete) return; setDeleteError(''); setDeleteOpen(true); }}
                    sx={{
                      color: '#ef4444', fontWeight: 600, border: '1px solid #fecaca', borderRadius: 2,
                      '&:hover': { bgcolor: '#fef2f2' },
                      '&.Mui-disabled': { color: '#fca5a5', borderColor: '#fee2e2', bgcolor: 'transparent' },
                    }}>
                    Delete
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Stack>
      </Stack>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      {/* ── Stage Stepper ── */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid rgba(197,197,211,0.2)', boxShadow: shadow, mb: 3, overflow: 'hidden' }}>
        <Box sx={{ background: gradient, p: 3, color: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Cycle Stages</Typography>
            {canAdvance && (
              <Button startIcon={<SkipNextIcon />} onClick={() => { setAdvanceError(''); setAdvanceOpen(true); }}
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                Advance Stage
              </Button>
            )}
          </Stack>
          <Box sx={{ position: 'relative', px: 1 }}>
            <Box sx={{ position: 'absolute', top: 11, left: 12, right: 12, height: 2, bgcolor: 'rgba(255,255,255,0.15)', zIndex: 0 }} />
            <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
              {STAGES.map((stage) => {
                const done   = currentStageId && stage.id < currentStageId;
                const active = currentStageId === stage.id;
                return (
                  <Stack key={stage.id} alignItems="center" spacing={1}>
                    <Box sx={{
                      width: active ? 36 : 26, height: active ? 36 : 26, borderRadius: '50%',
                      bgcolor: done ? '#10b981' : active ? '#fff' : 'rgba(255,255,255,0.15)',
                      border: active ? '3px solid rgba(255,255,255,0.5)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      outline: active ? '5px solid rgba(255,255,255,0.12)' : 'none',
                      transition: 'all 0.2s',
                    }}>
                      {done   && <CheckCircleIcon sx={{ color: '#fff', fontSize: 16 }} />}
                      {active && <Typography sx={{ fontSize: 11, color: '#1E3A8A', fontWeight: 800 }}>{stage.id}</Typography>}
                      {!done && !active && <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{stage.id}</Typography>}
                    </Box>
                    <Typography sx={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: active ? '#fff' : done ? '#86efac' : 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textAlign: 'center', maxWidth: 80 }}>
                      {stage.name}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
          {cycle.current_stage && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography sx={{ fontSize: 12, color: 'rgba(191,214,254,0.7)' }}>Current Stage</Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
                {STAGES.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* ── Cycle Info + Actions ── */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid rgba(197,197,211,0.2)', boxShadow: shadow, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <Box sx={{ px: 1.5, py: 0.4, bgcolor: '#1E3A8A', borderRadius: 1 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>CYCLE INFO</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Details</Typography>
          </Stack>

          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Box flex={1}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>Cycle Name</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{cycle.name}</Typography>
              </Box>
              <Box flex={1}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>Status</Typography>
                <Chip label={cycle.status.replace('_', ' ')} size="small"
                  sx={{ fontWeight: 700, borderRadius: '9999px', ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
              </Box>
            </Stack>
            {cycle.description && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>Description</Typography>
                <Typography sx={{ fontSize: 14, color: '#374151' }}>{cycle.description}</Typography>
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Box flex={1}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>Start Date</Typography>
                {/* ✅ Fixed: formatDate() handles ISO datetime strings */}
                <Typography sx={{ fontSize: 14, color: '#374151' }}>{formatDate(cycle.start_date)}</Typography>
              </Box>
              <Box flex={1}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>End Date</Typography>
                <Typography sx={{ fontSize: 14, color: '#374151' }}>{formatDate(cycle.end_date)}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* Actions section */}
        {canManageCycles && (availableActions.length > 0 || canAdvance) && (
          <>
            <Divider />
            <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 2 }}>
                Actions
              </Typography>
              {otherActiveCycle && availableActions.includes('ACTIVE') && (
                <Alert severity="warning" sx={{ mb: 2, fontSize: 12, borderRadius: 2 }}>
                  <strong>Cannot activate this cycle.</strong> "{otherActiveCycle.name}" is currently active. Please close it or put it on hold first.
                </Alert>
              )}
              <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                {availableActions.map((targetStatus) => {
                  const cfg = ACTION_CONFIG[targetStatus];
                  const isGradient = targetStatus === 'ACTIVE';
                  const isDisabled = targetStatus === 'ACTIVE' && !!otherActiveCycle;
                  return (
                    <Tooltip key={targetStatus} title={isDisabled ? 'Another cycle is already active. Close or put it on hold first.' : ''} disableHoverListener={!isDisabled}>
                      <span>
                        <Button variant={isGradient ? 'contained' : 'outlined'} startIcon={cfg.icon}
                          disabled={isDisabled} onClick={() => handleOpenStatusChange(targetStatus)}
                          sx={isGradient
                            ? { background: isDisabled ? undefined : gradient, color: isDisabled ? undefined : '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&.Mui-disabled': { opacity: 0.45 } }
                            : { fontWeight: 700, borderRadius: 2, px: 3, color: cfg.textColor, borderColor: cfg.borderColor, bgcolor: cfg.color, '&:hover': { opacity: 0.85 } }
                          }>
                          {cfg.label}
                        </Button>
                      </span>
                    </Tooltip>
                  );
                })}
                {canAdvance && (
                  <Button variant="outlined" startIcon={<SkipNextIcon />}
                    onClick={() => { setAdvanceError(''); setAdvanceOpen(true); }}
                    sx={{ fontWeight: 700, borderRadius: 2, px: 3, color: '#1E3A8A', borderColor: '#bfdbfe', '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' } }}>
                    Advance Stage
                  </Button>
                )}
              </Stack>
            </Box>
          </>
        )}

        {isFrozen && (
          <>
            <Divider />
            <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                This cycle is <strong>{currentStatus.toLowerCase().replace('_', ' ')}</strong>. No further actions are available.
              </Typography>
            </Box>
          </>
        )}
      </Paper>

      {/* ── CONFIRM STATUS CHANGE DIALOG ── */}
      <Dialog open={!!confirmAction} onClose={() => !confirmLoading && setConfirmAction(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {confirmAction && (() => {
          const cfg = ACTION_CONFIG[confirmAction];
          const isBlocked = confirmAction === 'ACTIVE' && !!getOtherActiveCycle();
          return (
            <>
              <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>{cfg?.label} Cycle</DialogTitle>
              <DialogContent>
                {isBlocked ? (
                  <Alert severity="error" sx={{ fontSize: 13 }}>
                    <strong>Action not allowed.</strong> "{getOtherActiveCycle()?.name}" is currently active. Please close it or put it on hold before activating this cycle.
                  </Alert>
                ) : (
                  <Typography sx={{ fontSize: 14, color: '#374151' }}>
                    Are you sure you want to <strong>{cfg?.label?.toLowerCase()}</strong> the cycle <strong>"{cycle.name}"</strong>?
                  </Typography>
                )}
                {confirmAction === 'ACTIVE' && !isBlocked && (
                  <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>Activation will send email notifications to all VLs and HRs.</Alert>
                )}
                {confirmError && <Alert severity="error" sx={{ mt: 2 }}>{confirmError}</Alert>}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={() => { setConfirmAction(null); setConfirmError(''); }} disabled={confirmLoading} sx={{ color: '#64748b', fontWeight: 600 }}>
                  {isBlocked ? 'OK' : 'Cancel'}
                </Button>
                {!isBlocked && (
                  <Button onClick={() => handleStatusChange(confirmAction)} disabled={confirmLoading}
                    sx={confirmAction === 'ACTIVE'
                      ? { background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }
                      : { bgcolor: cfg?.color, color: cfg?.textColor, border: `1px solid ${cfg?.borderColor}`, fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { opacity: 0.85 }, '&:disabled': { opacity: 0.6 } }
                    }>
                    {confirmLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Processing...</> : cfg?.label}
                  </Button>
                )}
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* ── ADVANCE STAGE DIALOG ── */}
      <Dialog open={advanceOpen} onClose={() => !advanceLoading && setAdvanceOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>Advance to Next Stage</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: '#374151', mb: 1 }}>
            This will move from{' '}
            <strong>Stage {currentStageId}: {STAGES.find(s => s.id === currentStageId)?.name}</strong> to{' '}
            <strong>Stage {currentStageId + 1}: {STAGES.find(s => s.id === currentStageId + 1)?.name}</strong>.
          </Typography>
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

      {/* ── DELETE DIALOG ── */}
      <Dialog open={deleteOpen} onClose={() => !deleteLoading && setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#ef4444', fontSize: '1.1rem' }}>Delete Cycle</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: '#374151' }}>
            Are you sure you want to delete <strong>"{cycle.name}"</strong>? This action cannot be undone.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>
          <Tooltip title={!canDelete ? 'Only draft cycles can be deleted' : ''} disableHoverListener={canDelete}>
            <span>
              <Button onClick={handleDelete} disabled={deleteLoading || !canDelete}
                sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { bgcolor: '#dc2626' }, '&:disabled': { opacity: 0.6 } }}>
                {deleteLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Deleting...</> : 'Delete'}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

    </Box>
  );
}