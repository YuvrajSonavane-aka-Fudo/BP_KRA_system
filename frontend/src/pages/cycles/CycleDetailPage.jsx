import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate, useParams } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { getCycleById, updateCycle, cloneCycle, advanceCycleStage } from '../../api/cyclesApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';
import useRoleAccess from '../../hooks/useRoleAccess';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';
const shadow = '0px 12px 32px -4px rgba(30,58,138,0.06)';

const STATUS_STYLES = {
  ACTIVE:  { bgcolor: '#dbeafe', color: '#1d4ed8' },
  DRAFT:   { bgcolor: '#f1f5f9', color: '#64748b' },
  CLOSED:  { bgcolor: '#dcfce7', color: '#15803d' },
};

const STAGES = [
  { id: 1, name: 'KRA Assignment By Lead' },
  { id: 2, name: 'KRA Tracking' },
  { id: 3, name: 'Assessment' },
  { id: 4, name: 'HR Validation' },
  { id: 5, name: 'Closure' },
];

export default function CycleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageCycles } = useRoleAccess();

  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Clone dialog
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneStart, setCloneStart] = useState('');
  const [cloneEnd, setCloneEnd] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Advance stage dialog
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  const fetchCycle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCycleById(id);
      setCycle(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to load cycle.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCycle(); }, [fetchCycle]);

  function flash(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function handleActivate() {
    setActionLoading('activate');
    setActionError('');
    try {
      await updateCycle(id, { status: 'ACTIVE' });
      invalidateCyclesCache();
      await fetchCycle();
      flash('Cycle activated successfully. Notifications sent to all VLs and HRs.');
    } catch (err) {
      setActionError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to activate cycle.');
    } finally {
      setActionLoading('');
    }
  }

  async function handleClose() {
    setActionLoading('close');
    setActionError('');
    try {
      await updateCycle(id, { status: 'CLOSED' });
      invalidateCyclesCache();
      await fetchCycle();
      flash('Cycle closed successfully.');
    } catch (err) {
      setActionError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to close cycle.');
    } finally {
      setActionLoading('');
    }
  }

  async function handleAdvanceStage() {
    setAdvanceLoading(true);
    setAdvanceError('');
    try {
      const res = await advanceCycleStage(id, {});
      invalidateCyclesCache();
      await fetchCycle();
      setAdvanceOpen(false);
      flash(res.data?.message || 'Stage advanced successfully.');
    } catch (err) {
      setAdvanceError(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to advance stage.');
    } finally {
      setAdvanceLoading(false);
    }
  }

  async function handleClone() {
    if (!cloneName || !cloneStart || !cloneEnd) {
      setCloneError('All fields are required.');
      return;
    }
    setCloneLoading(true);
    setCloneError('');
    try {
      const res = await cloneCycle(id, { name: cloneName, start_date: cloneStart, end_date: cloneEnd });
      invalidateCyclesCache();
      setCloneOpen(false);
      navigate(ROUTES.CYCLE_DETAIL.replace(':id', res.data.id));
    } catch (err) {
      setCloneError(err?.response?.data?.error || err?.response?.data?.detail || 'Clone failed.');
    } finally {
      setCloneLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await updateCycle(id, { is_deleted: true });
      invalidateCyclesCache();
      navigate(ROUTES.CYCLES);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || err?.response?.data?.detail || 'Delete failed.');
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#1E3A8A' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Alert severity="error" action={<Button size="small" onClick={fetchCycle} startIcon={<RefreshIcon />}>Retry</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!cycle) return null;

  const isDraft  = cycle.status === 'DRAFT';
  const isActive = cycle.status === 'ACTIVE';
  const isClosed = cycle.status === 'CLOSED';
  const currentStageId = cycle.current_stage?.id ?? null;
  const canAdvance = isActive && canManageCycles && currentStageId && currentStageId < 5;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Page Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton onClick={() => navigate(ROUTES.CYCLES)} sx={{ color: '#64748b' }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E3A8A' }}>{cycle.name}</Typography>
              <Chip
                label={cycle.status}
                size="small"
                sx={{ fontSize: 10, fontWeight: 700, height: 22, borderRadius: '9999px', ...(STATUS_STYLES[cycle.status] ?? STATUS_STYLES.DRAFT) }}
              />
            </Stack>
            <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.3 }}>
              {cycle.start_date} — {cycle.end_date}
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
                <Button
                  startIcon={<ContentCopyIcon />}
                  onClick={() => { setCloneName(`${cycle.name} (Copy)`); setCloneStart(''); setCloneEnd(''); setCloneError(''); setCloneOpen(true); }}
                  sx={{ color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 2 }}
                >
                  Clone
                </Button>
              </Tooltip>
              <Tooltip title="Delete cycle">
                <Button
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => { setDeleteError(''); setDeleteOpen(true); }}
                  sx={{ color: '#ef4444', fontWeight: 600, border: '1px solid #fecaca', borderRadius: 2, '&:hover': { bgcolor: '#fef2f2' } }}
                >
                  Delete
                </Button>
              </Tooltip>
            </>
          )}
        </Stack>
      </Stack>

      {/* Alerts */}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {/* Stage Stepper */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid rgba(197,197,211,0.2)', boxShadow: shadow, mb: 3, overflow: 'hidden' }}>
        <Box sx={{ background: gradient, p: 3, color: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Cycle Stages</Typography>
            {canAdvance && (
              <Button
                startIcon={<SkipNextIcon />}
                onClick={() => { setAdvanceError(''); setAdvanceOpen(true); }}
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
              >
                Advance Stage
              </Button>
            )}
          </Stack>
          <Box sx={{ position: 'relative', px: 1 }}>
            <Box sx={{ position: 'absolute', top: 11, left: 12, right: 12, height: 2, bgcolor: 'rgba(255,255,255,0.15)', zIndex: 0 }} />
            <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
              {STAGES.map((stage) => {
                const done = currentStageId && stage.id < currentStageId;
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
                      {done && <CheckCircleIcon sx={{ color: '#fff', fontSize: 16 }} />}
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
              <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{cycle.current_stage.name}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Cycle Info & Actions */}
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
                <Chip label={cycle.status} size="small" sx={{ fontWeight: 700, borderRadius: '9999px', ...(STATUS_STYLES[cycle.status] ?? STATUS_STYLES.DRAFT) }} />
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
                <Typography sx={{ fontSize: 14, color: '#374151' }}>{cycle.start_date}</Typography>
              </Box>
              <Box flex={1}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>End Date</Typography>
                <Typography sx={{ fontSize: 14, color: '#374151' }}>{cycle.end_date}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {canManageCycles && (
          <>
            <Divider />
            <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 2 }}>Actions</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                {isDraft && (
                  <Button
                    variant="contained"
                    startIcon={actionLoading === 'activate' ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                    onClick={handleActivate}
                    disabled={!!actionLoading}
                    sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}
                  >
                    {actionLoading === 'activate' ? 'Activating...' : 'Activate Cycle'}
                  </Button>
                )}
                {isActive && (
                  <Button
                    variant="outlined"
                    startIcon={actionLoading === 'close' ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                    onClick={handleClose}
                    disabled={!!actionLoading}
                    sx={{ fontWeight: 700, borderRadius: 2, px: 3, color: '#15803d', borderColor: '#86efac', '&:hover': { bgcolor: '#f0fdf4', borderColor: '#4ade80' }, '&:disabled': { opacity: 0.6 } }}
                  >
                    {actionLoading === 'close' ? 'Closing...' : 'Close Cycle'}
                  </Button>
                )}
                {canAdvance && (
                  <Button
                    variant="outlined"
                    startIcon={<SkipNextIcon />}
                    onClick={() => { setAdvanceError(''); setAdvanceOpen(true); }}
                    sx={{ fontWeight: 700, borderRadius: 2, px: 3, color: '#1E3A8A', borderColor: '#bfdbfe', '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' } }}
                  >
                    Advance Stage
                  </Button>
                )}
                {isClosed && (
                  <Typography sx={{ fontSize: 13, color: '#94a3b8', alignSelf: 'center' }}>
                    This cycle is closed. No further actions available.
                  </Typography>
                )}
              </Stack>
            </Box>
          </>
        )}
      </Paper>

      {/* Advance Stage Dialog */}
      <Dialog open={advanceOpen} onClose={() => !advanceLoading && setAdvanceOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>Advance Stage</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: '#374151', mb: 1 }}>
            This will advance the cycle from <strong>Stage {currentStageId}: {cycle.current_stage?.name}</strong> to{' '}
            <strong>Stage {currentStageId + 1}: {STAGES.find(s => s.id === currentStageId + 1)?.name}</strong>.
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>
            All enrolled employees will be synced to the new stage.
          </Typography>
          {advanceError && <Alert severity="error" sx={{ mt: 2 }}>{advanceError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAdvanceOpen(false)} disabled={advanceLoading} sx={{ color: '#64748b', fontWeight: 600 }}>Cancel</Button>
          <Button
            onClick={handleAdvanceStage}
            disabled={advanceLoading}
            sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}
          >
            {advanceLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Advancing...</> : 'Advance Stage'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={cloneOpen} onClose={() => !cloneLoading && setCloneOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>Clone Cycle</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#64748b', mb: 2 }}>
            Cloning from: <strong>{cycle.name}</strong>
          </Typography>
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
          <Button onClick={handleClone} disabled={cloneLoading} sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}>
            {cloneLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Cloning...</> : 'Clone Cycle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
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
          <Button onClick={handleDelete} disabled={deleteLoading} sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { bgcolor: '#dc2626' }, '&:disabled': { opacity: 0.6 } }}>
            {deleteLoading ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Deleting...</> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
