import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Stack, Paper, Button, TextField,
  Divider, IconButton, Chip, CircularProgress, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { createCycle } from '../../api/cyclesApi';
import { getStages } from '../../api/referenceDataApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';
const shadow = '0px 12px 32px -4px rgba(30,58,138,0.06)';

export default function CycleCreatePage() {
  const navigate = useNavigate();

  // Cycle-level fields
  const [cycleName, setCycleName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Stages from reference data
  const [stagesRef, setStagesRef] = useState([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState('');

  // Per-stage dates
  const [stageDates, setStageDates] = useState({}); // { [stage_id]: { start_date, end_date } }

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Load stages from reference data
  useEffect(() => {
    setRefLoading(true);
    getStages()
      .then(res => {
        const stages = res.data ?? [];
        setStagesRef(stages);
        // Pre-fill empty stage dates
        const init = {};
        stages.forEach(s => { init[s.id] = { start_date: '', end_date: '' }; });
        setStageDates(init);
      })
      .catch(err => {
        setRefError(err?.response?.data?.error || err?.response?.data?.detail || 'Could not load stages.');
      })
      .finally(() => setRefLoading(false));
  }, []);

  function updateStageDate(stageId, field, value) {
    setStageDates(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }));
  }

  function validate() {
    if (!cycleName.trim()) return 'Cycle name is required.';
    if (!startDate) return 'Start date is required.';
    if (!endDate) return 'End date is required.';
    if (endDate <= startDate) return 'End date must be after start date.';
    for (const s of stagesRef) {
      const d = stageDates[s.id];
      if (!d?.start_date || !d?.end_date) return `Stage "${s.name}" requires both start and end dates.`;
      if (d.end_date < d.start_date) return `Stage "${s.name}" end date must be after its start date.`;
    }
    return null;
  }

  async function handleSubmit(saveAsDraft) {
    const validationError = validate();
    if (validationError) { setSubmitError(validationError); return; }

    setSubmitting(true);
    setSubmitError('');

    const payload = {
      name: cycleName.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      stages: stagesRef.map(s => ({
        stage_id: s.id,
        start_date: stageDates[s.id]?.start_date,
        end_date: stageDates[s.id]?.end_date,
      })),
    };

    try {
      await createCycle(payload);
      invalidateCyclesCache();
      navigate(ROUTES.CYCLES);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        'Failed to create cycle. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Page header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E3A8A' }}>Add New KRA Cycle</Typography>
          <Typography sx={{ fontSize: 14, color: '#64748b', mt: 0.3 }}>Define the timeline and review stages for the next assessment period.</Typography>
        </Box>
        <IconButton onClick={() => navigate(ROUTES.CYCLES)} sx={{ color: '#64748b' }}><CloseIcon /></IconButton>
      </Stack>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSubmitError('')}>
          {submitError}
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid rgba(197,197,211,0.25)', boxShadow: shadow, overflow: 'hidden' }}>

        {/* Section 01: Timeline */}
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <Box sx={{ px: 1.5, py: 0.4, bgcolor: '#1E3A8A', borderRadius: 1 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>SECTION 01</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Timeline Configuration</Typography>
          </Stack>

          <Stack spacing={2.5}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cycle Name *</Typography>
              <TextField
                fullWidth
                placeholder="e.g., FY25 Q1 - Strategic Expansion"
                value={cycleName}
                onChange={e => setCycleName(e.target.value)}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</Typography>
              <TextField
                fullWidth
                placeholder="Optional description for this cycle"
                value={description}
                onChange={e => setDescription(e.target.value)}
                size="small"
                multiline
                rows={2}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
              />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start Date *</Typography>
                <TextField
                  fullWidth type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
                />
              </Box>
              <Box flex={1}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>End Date *</Typography>
                <TextField
                  fullWidth type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
                />
              </Box>
            </Stack>
          </Stack>
        </Box>

        <Divider sx={{ mx: 3 }} />

        {/* Section 02: Workflow Stages */}
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <Box sx={{ px: 1.5, py: 0.4, bgcolor: '#1E3A8A', borderRadius: 1 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>SECTION 02</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Workflow Stages</Typography>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Set date windows for each stage</Typography>
          </Stack>

          {refLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#1E3A8A' }} />
            </Box>
          ) : refError ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>{refError} — stage dates cannot be configured.</Alert>
          ) : (
            <Stack spacing={0}>
              {stagesRef.map((stage, idx) => {
                const dates = stageDates[stage.id] ?? { start_date: '', end_date: '' };
                const hasStart = !!dates.start_date;
                const hasEnd = !!dates.end_date;
                const configured = hasStart && hasEnd;

                return (
                  <Stack key={stage.id} direction="row" alignItems="flex-start" spacing={0} sx={{ position: 'relative' }}>
                    {/* Timeline dot + line */}
                    <Stack alignItems="center" sx={{ mr: 2, mt: 0.5 }}>
                      <Box sx={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: configured ? gradient : '#f1f5f9',
                        border: configured ? 'none' : '2px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {configured
                          ? <CheckCircleIcon sx={{ color: '#fff', fontSize: 18 }} />
                          : <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{stage.id}</Typography>}
                      </Box>
                      {idx < stagesRef.length - 1 && (
                        <Box sx={{ width: 2, flex: 1, minHeight: 32, bgcolor: '#e2e8f0', my: 0.5 }} />
                      )}
                    </Stack>

                    {/* Stage card */}
                    <Paper elevation={0} sx={{
                      flex: 1, mb: 2, p: 2.5, borderRadius: 2,
                      border: configured ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                      bgcolor: configured ? '#eff6ff' : '#fafafa',
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography sx={{ fontWeight: 700, fontSize: 14, color: configured ? '#1E3A8A' : '#1a1a2e' }}>
                              {stage.name}
                            </Typography>
                            {configured && (
                              <Chip label="Configured" size="small" sx={{ fontSize: 10, fontWeight: 700, bgcolor: '#bfdbfe', color: '#1d4ed8', height: 20, borderRadius: '9999px' }} />
                            )}
                          </Stack>
                          {configured && (
                            <Typography sx={{ fontSize: 12, color: '#3b82f6', mt: 0.3 }}>
                              {dates.start_date} → {dates.end_date}
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 0.5 }}>Start</Typography>
                            <TextField
                              type="date"
                              size="small"
                              value={dates.start_date}
                              onChange={e => updateStageDate(stage.id, 'start_date', e.target.value)}
                              InputLabelProps={{ shrink: true }}
                              inputProps={{ style: { fontSize: 12 } }}
                              sx={{ width: 145, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                            />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b', mb: 0.5 }}>End</Typography>
                            <TextField
                              type="date"
                              size="small"
                              value={dates.end_date}
                              onChange={e => updateStageDate(stage.id, 'end_date', e.target.value)}
                              InputLabelProps={{ shrink: true }}
                              inputProps={{ style: { fontSize: 12 } }}
                              sx={{ width: 145, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                            />
                          </Box>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Footer actions */}
        <Box sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button onClick={() => navigate(ROUTES.CYCLES)} sx={{ color: '#64748b', fontWeight: 600 }} disabled={submitting}>
              Discard
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSubmit()}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <EditCalendarIcon />}
              sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}
            >
              {submitting ? 'Creating...' : 'Create Cycle'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}