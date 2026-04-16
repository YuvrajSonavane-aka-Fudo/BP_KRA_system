import React, { useState } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, Tabs, Tab, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { useCycles, invalidateCyclesCache } from '../../hooks/useCycles';
import { cloneCycle, updateCycle } from '../../api/cyclesApi';
import useRoleAccess from '../../hooks/useRoleAccess';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';
const shadow = '0px 12px 32px -4px rgba(30,58,138,0.06)';

const STATUS_STYLES = {
  ACTIVE:  { bgcolor: '#dbeafe', color: '#1d4ed8' },
  DRAFT:   { bgcolor: '#f1f5f9', color: '#64748b' },
  CLOSED:  { bgcolor: '#dcfce7', color: '#15803d' },
};

const STAGES = [
  'KRA Assignment By Lead',
  'KRA Tracking',
  'Assessment',
  'HR Validation',
  'Closure',
];

export default function CyclesListPage() {
  const navigate = useNavigate();
  const { canManageCycles } = useRoleAccess();
  const [tab, setTab] = useState(0);

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneStart, setCloneStart] = useState('');
  const [cloneEnd, setCloneEnd] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: allCycles, loading, error, refetch } = useCycles();

  const activeCycles = allCycles?.filter(c => c.status === 'ACTIVE') ?? [];
  const activeCycle  = activeCycles[0] ?? null;

  const filtered =
    tab === 0 ? allCycles ?? [] :
    tab === 1 ? allCycles?.filter(c => c.status === 'ACTIVE')  ?? [] :
    tab === 2 ? allCycles?.filter(c => c.status === 'DRAFT')   ?? [] :
                allCycles?.filter(c => c.status === 'CLOSED')  ?? [];

  function openClone(cycle) {
    setCloneSource(cycle);
    setCloneName(`${cycle.name} (Copy)`);
    setCloneStart('');
    setCloneEnd('');
    setCloneError('');
    setCloneOpen(true);
  }

  function openDelete(cycle) {
    setDeleteTarget(cycle);
    setDeleteError('');
    setDeleteOpen(true);
  }

  async function handleClone() {
    if (!cloneName || !cloneStart || !cloneEnd) {
      setCloneError('All fields are required.');
      return;
    }
    setCloneLoading(true);
    setCloneError('');
    try {
      await cloneCycle(cloneSource.id, { name: cloneName, start_date: cloneStart, end_date: cloneEnd });
      invalidateCyclesCache();
      refetch();
      setCloneOpen(false);
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
      await updateCycle(deleteTarget.id, { is_deleted: true });
      invalidateCyclesCache();
      refetch();
      setDeleteOpen(false);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || err?.response?.data?.detail || 'Delete failed.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function goToDetail(id) {
    navigate(ROUTES.CYCLE_DETAIL.replace(':id', id));
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
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Alert severity="error" action={<Button size="small" onClick={refetch} startIcon={<RefreshIcon />}>Retry</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E3A8A' }}>KRA Cycles</Typography>
          <Typography sx={{ fontSize: 14, color: '#64748b', mt: 0.3 }}>Manage performance cycles across the organisation</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button onClick={refetch} startIcon={<RefreshIcon />} sx={{ color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 2 }}>
            Refresh
          </Button>
          {canManageCycles && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => navigate(ROUTES.CYCLE_CREATE)}
              sx={{ background: gradient, color: '#fff', fontWeight: 700, px: 3, borderRadius: 2, '&:hover': { background: gradient, opacity: 0.9 } }}
            >
              New Cycle
            </Button>
          )}
        </Stack>
      </Stack>

      {activeCycle && (
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(197,197,211,0.2)', boxShadow: shadow, mb: 3 }}>
          <Box sx={{ background: gradient, p: 4, color: '#fff' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
              <Box>
                <Box sx={{ display: 'inline-block', px: 1, py: 0.3, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 1, mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Currently Active</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2 }}>{activeCycle.name}</Typography>
                <Typography sx={{ color: 'rgba(219,234,254,0.8)', mt: 0.5 }}>
                  {activeCycle.start_date} — {activeCycle.end_date}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} flexShrink={0}>
                {canManageCycles && (
                  <Button
                    startIcon={<ContentCopyIcon />}
                    onClick={() => openClone(activeCycle)}
                    sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, borderRadius: 2 }}
                  >
                    Clone
                  </Button>
                )}
                <Button
                  onClick={() => goToDetail(activeCycle.id)}
                  startIcon={<OpenInNewIcon />}
                  sx={{ bgcolor: '#fff', color: '#1E3A8A', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#eff6ff' } }}
                >
                  Manage
                </Button>
              </Stack>
            </Stack>

            {activeCycle.current_stage && (
              <Box sx={{ position: 'relative', mt: 4, px: 1 }}>
                <Box sx={{ position: 'absolute', top: 11, left: 12, right: 12, height: 2, bgcolor: 'rgba(255,255,255,0.15)', zIndex: 0 }} />
                <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
                  {STAGES.map((stage, i) => {
                    const n = i + 1;
                    const done = n < activeCycle.current_stage.id;
                    const active = n === activeCycle.current_stage.id;
                    return (
                      <Stack key={stage} alignItems="center" spacing={1}>
                        <Box sx={{
                          width: active ? 32 : 24, height: active ? 32 : 24, borderRadius: '50%',
                          bgcolor: done || active ? '#fff' : 'rgba(255,255,255,0.2)',
                          border: '3px solid rgba(255,255,255,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          outline: active ? '4px solid rgba(255,255,255,0.15)' : 'none',
                        }}>
                          {done && <Typography sx={{ fontSize: 10, color: '#1E3A8A', fontWeight: 800 }}>✓</Typography>}
                          {active && <Typography sx={{ fontSize: 10, color: '#1E3A8A', fontWeight: 800 }}>0{n}</Typography>}
                        </Box>
                        <Typography sx={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: active ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textAlign: 'center', maxWidth: 70 }}>
                          {stage}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Stack direction="row" spacing={5} mt={4} pt={3} sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'rgba(191,214,254,0.7)', fontWeight: 500 }}>Current Stage</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>{activeCycle.current_stage?.name ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'rgba(191,214,254,0.7)', fontWeight: 500 }}>Start Date</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>{activeCycle.start_date}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'rgba(191,214,254,0.7)', fontWeight: 500 }}>End Date</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>{activeCycle.end_date}</Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>
      )}

      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid rgba(197,197,211,0.2)', boxShadow: shadow, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: '1px solid #f3f4f5' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2, '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', minHeight: 48 }, '& .Mui-selected': { color: '#1E3A8A' }, '& .MuiTabs-indicator': { bgcolor: '#1E3A8A' } }}
          >
            <Tab label={`All (${allCycles?.length ?? 0})`} />
            <Tab label={`Active (${allCycles?.filter(c => c.status === 'ACTIVE').length ?? 0})`} />
            <Tab label={`Draft (${allCycles?.filter(c => c.status === 'DRAFT').length ?? 0})`} />
            <Tab label={`Closed (${allCycles?.filter(c => c.status === 'CLOSED').length ?? 0})`} />
          </Tabs>
        </Box>

        {filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>No cycles found.</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f3f4f5' }}>
                {['Cycle Name', 'Period', 'Current Stage', 'Status', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', py: 1.5 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((cycle) => (
                <TableRow key={cycle.id} sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'background 0.15s' }}>
                  <TableCell>
                    <Typography
                      sx={{ fontWeight: 700, fontSize: 14, color: '#1E3A8A', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => goToDetail(cycle.id)}
                    >
                      {cycle.name}
                    </Typography>
                    {cycle.description && (
                      <Typography sx={{ fontSize: 12, color: '#64748b' }}>{cycle.description}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: '#575e72', fontSize: 13 }}>
                    {cycle.start_date} — {cycle.end_date}
                  </TableCell>
                  <TableCell>
                    {cycle.current_stage ? (
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A' }}>
                        Stage {cycle.current_stage.id}: {cycle.current_stage.name}
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cycle.status}
                      size="small"
                      sx={{ fontSize: 10, fontWeight: 700, height: 22, borderRadius: '9999px', ...(STATUS_STYLES[cycle.status] ?? STATUS_STYLES.DRAFT) }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View / Manage">
                        <IconButton size="small" onClick={() => goToDetail(cycle.id)} sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' } }}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManageCycles && (
                        <>
                          <Tooltip title="Clone">
                            <IconButton size="small" onClick={() => openClone(cycle)} sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' } }}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => openDelete(cycle)} sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Clone Dialog */}
      <Dialog open={cloneOpen} onClose={() => !cloneLoading && setCloneOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#1E3A8A', fontSize: '1.1rem' }}>Clone Cycle</DialogTitle>
        <DialogContent>
          {cloneSource && (
            <Typography sx={{ fontSize: 13, color: '#64748b', mb: 2 }}>
              Cloning from: <strong>{cloneSource.name}</strong>
            </Typography>
          )}
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
          {deleteTarget && (
            <Typography sx={{ fontSize: 14, color: '#374151' }}>
              Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This action cannot be undone.
            </Typography>
          )}
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