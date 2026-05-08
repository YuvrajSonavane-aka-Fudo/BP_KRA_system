import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField, MenuItem, Select,
  CircularProgress, Alert, Divider, Avatar, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Tooltip, IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import LockIcon from '@mui/icons-material/Lock';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RateReviewIcon from '@mui/icons-material/RateReview';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { getCycles } from '../../api/cyclesApi';
import { getReferenceData } from '../../api/referenceDataApi';
import { getAssessmentProgress, submitLeadReview } from '../../api/assessmentsApi';
import { getStageStates, canLeadReview, getStageLockReason } from '../../utils/stageUtils';

const NAVY = '#0f1b4c';
const BLUE = '#1E3A8A';
const ACCENT = '#3b82f6';

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

function selfStatus(kras) {
  if (!kras?.length) return 'locked';
  const rated = kras.filter(k => k.self_rating_id).length;
  if (rated === kras.length) return 'completed';
  if (rated > 0) return 'in_progress';
  return 'pending';
}

function leadStatus(kras) {
  if (!kras?.length) return 'locked';
  const rated = kras.filter(k => k.lead_rating_id).length;
  if (rated === kras.length) return 'completed';
  if (rated > 0) return 'in_progress';
  return 'pending';
}

function StatusBadge({ statusKey }) {
  const map = {
    completed: { label: 'COMPLETED', bg: '#dcfce7', color: '#16a34a', icon: <CheckCircleIcon sx={{ fontSize: 12 }} /> },
    in_progress: { label: 'IN PROGRESS', bg: '#fef9c3', color: '#ca8a04', icon: <PendingIcon sx={{ fontSize: 12 }} /> },
    pending: { label: 'PENDING', bg: '#fef2f2', color: '#dc2626', icon: <PendingIcon sx={{ fontSize: 12 }} /> },
    locked: { label: 'LOCKED', bg: '#f1f5f9', color: '#94a3b8', icon: <LockIcon sx={{ fontSize: 12 }} /> },
  };
  const s = map[statusKey] || map.locked;
  return (
    <Chip icon={s.icon} label={s.label} size="small"
      sx={{
        bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10,
        border: `1px solid ${s.color}30`, height: 22,
        '& .MuiChip-icon': { color: s.color, ml: 0.5 }
      }} />
  );
}

// ── Stage stepper — rollback-safe ─────────────────────────────────────────────
function CycleStageStepper({ currentStageId, completedStageIds }) {
  if (!currentStageId) return null;
  const states = getStageStates(currentStageId, completedStageIds);

  return (
    <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, px: 3, py: 2, mb: 3 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
        Current Cycle Stage
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {states.map((stage, i) => {
          const isLast = i === states.length - 1;
          return (
            <React.Fragment key={stage.id}>
              <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 80 }}>
                <Box sx={{
                  width: 34, height: 34, borderRadius: '50%',
                  bgcolor: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#e2e8f0',
                  border: stage.isCurrent
                    ? `3px solid ${ACCENT}`
                    : stage.isDone ? '3px solid #22c55e' : '3px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: stage.isCurrent ? `0 0 0 3px rgba(59,130,246,0.2)` : 'none',
                  transition: 'all 0.2s',
                }}>
                  {stage.isDone
                    ? <CheckCircleIcon sx={{ fontSize: 18, color: '#fff' }} />
                    : <Typography sx={{ fontSize: 11, fontWeight: 800, color: stage.isCurrent ? '#fff' : '#94a3b8' }}>
                      {stage.id}
                    </Typography>
                  }
                </Box>
                <Typography sx={{
                  fontSize: 10, fontWeight: stage.isCurrent ? 700 : 500,
                  textAlign: 'center', lineHeight: 1.3, maxWidth: 76,
                  color: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {stage.name}
                </Typography>
              </Stack>
              {!isLast && (
                <Box sx={{
                  flex: 1, height: 2, mt: '16px',
                  bgcolor: stage.isDone ? '#22c55e' : '#e2e8f0',
                  transition: 'background-color 0.3s',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </Paper>
  );
}

// ── KRA review card ───────────────────────────────────────────────────────────
function KRAReviewRow({ row, ratings, editable, lockReason, onSave, saving, savedId }) {
  const [leadRatingId, setLeadRatingId] = useState(row.lead_rating_id ?? '');
  const [leadComment, setLeadComment] = useState(row.lead_comment ?? '');
  const [leadProgressNotes, setLeadProgressNotes] = useState(row.lead_progress_notes ?? '');
  const [dirty, setDirty] = useState(false);
  const isSaving = saving && savedId === row.employee_kra_level_id;

  // Reset dirty if editable changes (stage rolled back mid-session)
  React.useEffect(() => { setDirty(false); }, [editable]);

  function change(setter) {
    return v => { setter(v); setDirty(true); };
  }

  function handleSave() {
    onSave(row.employee_kra_level_id, {
      lead_rating_id: leadRatingId || null,
      lead_comment: leadComment || null,
      lead_progress_notes: leadProgressNotes || null,
    });
    setDirty(false);
  }

  return (
    <Paper elevation={0} sx={{
      border: row.lead_rating_id ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
      borderRadius: 2.5, overflow: 'hidden', mb: 2,
    }}>
      {/* KRA name bar */}
      <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#fafbff', borderBottom: '1px solid #f1f5f9' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            {row.lead_rating_id
              ? <CheckCircleIcon sx={{ fontSize: 17, color: '#22c55e' }} />
              : <PendingIcon sx={{ fontSize: 17, color: '#f59e0b' }} />
            }
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{row.kra_name}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {row.category_name && (
              <Chip label={row.category_name} size="small"
                sx={{ bgcolor: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 600, height: 20 }} />
            )}
            {row.weightage && (
              <Chip label={`${row.weightage}%`} size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontSize: 11, fontWeight: 600, height: 20 }} />
            )}
          </Stack>
        </Stack>
        {row.description_by_lead && (
          <Typography sx={{ mt: 0.5, fontSize: 12, color: '#64748b' }}>{row.description_by_lead}</Typography>
        )}
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} divider={<Divider orientation="vertical" flexItem />}>
        {/* Employee self-assessment (read-only) */}
        <Box sx={{ flex: 1, p: 2.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
            Employee Self-Assessment
          </Typography>
          {row.self_rating_id ? (
            <Stack spacing={1.5}>
              <Chip
                label={`${row.self_rating ?? '?'} – ${ratings.find(r => r.id === row.self_rating_id)?.description ?? ''}`}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: BLUE, fontWeight: 700, fontSize: 12, alignSelf: 'flex-start' }}
              />
              {row.self_comment && (
                <Box sx={{ bgcolor: '#f8fafc', borderRadius: 1.5, p: 1.5 }}>
                  <Typography sx={{ fontSize: 13, color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "{row.self_comment}"
                  </Typography>
                </Box>
              )}
              {row.progress_notes && (
                <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                  <b>Progress:</b> {row.progress_notes}
                </Typography>
              )}
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' }}>
              Not yet submitted
            </Typography>
          )}
        </Box>

        {/* Lead evaluation */}
        <Box sx={{ flex: 1, p: 2.5, bgcolor: editable ? '#fff' : '#fafbff' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            Lead Evaluation
          </Typography>

          {!editable ? (
            // Clear, contextual message — not just a lock icon
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <LockIcon sx={{ fontSize: 15, color: '#cbd5e1', mt: 0.2 }} />
              <Typography sx={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
                {lockReason || 'Not available at this stage.'}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Select value={leadRatingId} onChange={e => change(setLeadRatingId)(e.target.value)}
                displayEmpty size="small" fullWidth
                sx={{
                  fontSize: 13, borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: leadRatingId ? '#22c55e' : '#e2e8f0' }
                }}
              >
                <MenuItem value="" disabled sx={{ fontSize: 13, color: '#94a3b8' }}>Select Rating</MenuItem>
                {ratings.map(r => (
                  <MenuItem key={r.id} value={r.id} sx={{ fontSize: 13 }}>
                    {r.rating} – {r.description}
                  </MenuItem>
                ))}
              </Select>

              <TextField multiline minRows={3} fullWidth size="small"
                placeholder="Enter mandatory evaluation comments..."
                value={leadComment} onChange={e => change(setLeadComment)(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: 13, borderRadius: 2,
                    '&:hover fieldset': { borderColor: ACCENT },
                    '&.Mui-focused fieldset': { borderColor: ACCENT },
                  }
                }}
              />

              <TextField multiline minRows={2} fullWidth size="small"
                placeholder="Optional: notes on progress, coaching points..."
                value={leadProgressNotes} onChange={e => change(setLeadProgressNotes)(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: 13, borderRadius: 2,
                    '&:hover fieldset': { borderColor: ACCENT },
                    '&.Mui-focused fieldset': { borderColor: ACCENT },
                  }
                }}
              />

              <Stack direction="row" justifyContent="flex-end">
                <Box onClick={dirty ? handleSave : undefined} sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.8,
                  px: 2, py: 0.8, borderRadius: 2,
                  cursor: dirty ? 'pointer' : 'default',
                  bgcolor: dirty ? BLUE : '#f1f5f9', color: dirty ? '#fff' : '#94a3b8',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  '&:hover': dirty ? { bgcolor: ACCENT } : {},
                }}>
                  {isSaving ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <SaveIcon sx={{ fontSize: 14 }} />}
                  {isSaving ? 'Saving…' : 'Save Review'}
                </Box>
              </Stack>
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

// ── Employee review panel ─────────────────────────────────────────────────────
function EmployeeReviewPanel({ emp, ratings, currentCycleStageId, completedStageIds, onBack }) {
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [toast, setToast] = useState({ msg: '', severity: 'success' });
  const [localKras, setLocalKras] = useState(emp.kras ?? []);

  async function handleSave(employeeKraLevelId, payload) {
    setSaving(true);
    setSavedId(employeeKraLevelId);
    try {
      await submitLeadReview(employeeKraLevelId, payload);
      setLocalKras(prev =>
        prev.map(k => k.employee_kra_level_id === employeeKraLevelId ? { ...k, ...payload } : k)
      );
      setToast({ msg: 'Review saved', severity: 'success' });
    } catch (err) {
      setToast({ msg: err?.response?.data?.error || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false);
      setSavedId(null);
      setTimeout(() => setToast({ msg: '', severity: 'success' }), 3000);
    }
  }

  const reviewed = localKras.filter(k => k.lead_rating_id).length;
  const pct = localKras.length ? Math.round((reviewed / localKras.length) * 100) : 0;

  // Gate from stageUtils — single source of truth
  const editable = canLeadReview(currentCycleStageId);
  const lockReason = getStageLockReason(currentCycleStageId, 'lead');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 2, flexShrink: 0, bgcolor: '#f5f6fa' }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Avatar sx={{ width: 42, height: 42, bgcolor: BLUE, fontSize: 15, fontWeight: 800 }}>
            {initials(emp.full_name)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>{emp.full_name}</Typography>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>
              {emp.title || emp.status || '—'}
            </Typography>
          </Box>
          <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, px: 2, py: 1, minWidth: 140 }}>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, mb: 0.3 }}>KRAs Reviewed</Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.5}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: BLUE }}>{reviewed}</Typography>
              <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>/ {localKras.length}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct}
              sx={{
                mt: 0.5, height: 4, borderRadius: 2, bgcolor: '#e2e8f0',
                '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#22c55e' : ACCENT }
              }} />
          </Paper>
        </Stack>

        <CycleStageStepper currentStageId={currentCycleStageId} completedStageIds={completedStageIds} />
        <Divider />
      </Box>

      {/* Scrollable KRA list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>

        {/* Stage-lock banner */}
        {!editable && lockReason && (
          <Alert severity="warning" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2, borderRadius: 2 }}>
            {lockReason} KRA data is shown in read-only mode.
          </Alert>
        )}

        {toast.msg && (
          <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>
        )}

        {localKras.length === 0 ? (
          <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 5, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8' }}>No KRAs assigned to this employee.</Typography>
          </Paper>
        ) : (
          localKras.map(row => (
            <KRAReviewRow
              key={row.employee_kra_level_id}
              row={row}
              ratings={ratings}
              editable={editable}
              lockReason={lockReason}
              onSave={handleSave}
              saving={saving}
              savedId={savedId}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPerformancePage() {
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [data, setData] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCycles({ status: 'ACTIVE' }).then(res => {
      const list = res.data?.cycles ?? [];
      setCycles(list);
      if (list.length) setCycleId(list[0].id);
    });
    getReferenceData().then(res => setRatings(res.data?.ratings ?? []));
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true); setError(''); setSelected(null);
    getAssessmentProgress(cycleId)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || 'Failed to load progress'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  function refetchProgress() {
    if (!cycleId) return;
    setLoading(true); setError('');
    getAssessmentProgress(cycleId)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || 'Failed to load progress'))
      .finally(() => setLoading(false));
  }

  const cycle = cycles.find(c => c.id === cycleId);
  const employees = data?.employees ?? [];

  // Stage resolution — prefer API response, fall back to cycle object
  const currentCycleStageId = data?.current_stage_id ?? data?.current_stage?.id ?? cycle?.current_stage_id ?? employees[0]?.current_stage_id ?? null;
  const completedStageIds = data?.completed_stage_ids ?? [];

  const pending = employees.filter(e => leadStatus(e.kras) === 'pending').length;
  const completed = employees.filter(e => leadStatus(e.kras) === 'completed').length;
  const pct = employees.length ? Math.round((completed / employees.length) * 100) : 0;

  const filtered = employees.filter(e =>
    !search || e.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <EmployeeReviewPanel
        emp={selected}
        ratings={ratings}
        currentCycleStageId={currentCycleStageId}
        completedStageIds={completedStageIds}
        onBack={() => {
          setSelected(null);
          refetchProgress(); // this re-triggers the useEffect since loading state resets
        }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 2, flexShrink: 0 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} mb={2}>
          <Box>
            {cycle && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                {cycle.name}
              </Typography>
            )}
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
              Team Performance Review
            </Typography>
          </Box>
          {cycles.length > 1 && (
            <Select value={cycleId} onChange={e => setCycleId(e.target.value)}
              size="small" sx={{ minWidth: 180, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
              {cycles.map(c => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>
              ))}
            </Select>
          )}
        </Stack>

        <CycleStageStepper currentStageId={currentCycleStageId} completedStageIds={completedStageIds} />
        <Divider />
      </Box>

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: BLUE }} />
          </Box>
        ) : (
          <>
            {employees.length > 0 && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
                <Paper elevation={0} sx={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 3, p: 2.5 }}>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                    Average Team Rating
                  </Typography>
                  <Typography sx={{ fontSize: 30, fontWeight: 800, color: BLUE }}>
                    {(() => {
                      const all = employees.flatMap(e => e.kras.map(k => k.lead_rating)).filter(Boolean);
                      return all.length ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) + ' / 5.0' : '—';
                    })()}
                  </Typography>
                </Paper>

                <Paper elevation={0} sx={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 3, p: 2.5 }}>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                    % Reviews Completed
                  </Typography>
                  <Typography sx={{ fontSize: 30, fontWeight: 800, color: BLUE }}>{pct}%</Typography>
                  <LinearProgress variant="determinate" value={pct}
                    sx={{
                      mt: 1, height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#22c55e' : ACCENT }
                    }} />
                </Paper>

                {pending > 0 && (
                  <Paper elevation={0} sx={{ flex: 1, border: '1.5px solid #fed7aa', borderRadius: 3, p: 2.5, bgcolor: '#fff7ed' }}>
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <WarningAmberIcon sx={{ color: '#f59e0b', mt: 0.3 }} />
                      <Box>
                        <Typography sx={{ fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Action Required
                        </Typography>
                        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#92400e', mt: 0.5 }}>
                          {pending} Pending Lead {pending === 1 ? 'Assessment' : 'Assessments'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            )}

            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                Team Members {employees.length > 0 && `(${employees.length})`}
              </Typography>
              <TextField placeholder="Search team..." value={search}
                onChange={e => setSearch(e.target.value)} size="small"
                sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13, bgcolor: '#fff' } }} />
            </Stack>

            <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center' }}>
                  <Typography sx={{ color: '#94a3b8' }}>
                    {employees.length === 0 ? 'No employees enrolled in this cycle.' : 'No results match your search.'}
                  </Typography>
                </Box>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Employee', 'KRAs', 'Self-Assessment', 'Lead Review', 'Action'].map(h => (
                        <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', py: 1.5, borderBottom: '1.5px solid #e2e8f0' }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((emp, idx) => {
                      const ss = selfStatus(emp.kras);
                      const ls = leadStatus(emp.kras);
                      const kraCount = emp.kras?.length ?? 0;
                      return (
                        <TableRow key={emp.employee_id}
                          sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#fafbff', '&:hover': { bgcolor: '#eff6ff' }, cursor: 'pointer' }}
                          onClick={() => setSelected(emp)}
                        >
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Avatar sx={{ width: 34, height: 34, bgcolor: BLUE, fontSize: 12, fontWeight: 800 }}>
                                {initials(emp.full_name)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{emp.full_name}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>Stage {emp.current_stage_id}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Chip label={kraCount} size="small"
                              sx={{ bgcolor: '#f1f5f9', color: BLUE, fontWeight: 700, fontSize: 12, minWidth: 32 }} />
                          </TableCell>
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <StatusBadge statusKey={ss} />
                          </TableCell>
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <StatusBadge statusKey={ls} />
                          </TableCell>
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            {ss === 'locked' ? (
                              <Tooltip title="Waiting for self-assessment">
                                <LockIcon sx={{ fontSize: 16, color: '#cbd5e1' }} />
                              </Tooltip>
                            ) : ls === 'completed' ? (
                              <Box onClick={e => { e.stopPropagation(); setSelected(emp); }}
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.6, borderRadius: 1.5, bgcolor: '#f1f5f9', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: '#e2e8f0' } }}>
                                <VisibilityIcon sx={{ fontSize: 14 }} /> View
                              </Box>
                            ) : (
                              <Box onClick={e => { e.stopPropagation(); setSelected(emp); }}
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.6, borderRadius: 1.5, bgcolor: BLUE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: ACCENT } }}>
                                <RateReviewIcon sx={{ fontSize: 14 }} /> Review
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}