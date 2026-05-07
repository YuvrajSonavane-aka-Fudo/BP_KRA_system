import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField,
  FormControl, LinearProgress, Alert, CircularProgress, Divider,
  Tooltip, Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getSelfAssessment, saveSelfAssessmentRow } from '../../api/assessmentsApi';
import { getCycles } from '../../api/cyclesApi';
import { getReferenceData } from '../../api/referenceDataApi';

const NAVY   = '#0f1b4c';
const BLUE   = '#1E3A8A';
const ACCENT = '#3b82f6';

// ── Canonical 5-stage cycle definition (matches DashboardPage / backend) ───────
const CYCLE_STAGES = [
  { id: 1, name: 'KRA Assignment' },
  { id: 2, name: 'Self Assessment' },
  { id: 3, name: 'Lead Assessment' },
  { id: 4, name: 'HR Validation' },
  { id: 5, name: 'Completed' },
];

const CATEGORY_COLORS = {
  'Core Development': '#3b82f6',
  'Behavioural':      '#8b5cf6',
  'Leadership':       '#f59e0b',
  'Strategic':        '#10b981',
  'Technical':        '#ef4444',
  'default':          '#6366f1',
};

function categoryColor(name) {
  return CATEGORY_COLORS[name] || CATEGORY_COLORS.default;
}

// ── Stage stepper (synced with active cycle) ──────────────────────────────────
function CycleStageStepper({ currentStageId }) {
  if (!currentStageId) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0, mt: 2.5 }}>
      {CYCLE_STAGES.map((stage, i) => {
        const isDone    = stage.id < currentStageId;
        const isCurrent = stage.id === currentStageId;
        const isLast    = i === CYCLE_STAGES.length - 1;
        return (
          <React.Fragment key={stage.id}>
            <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 72 }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '50%',
                bgcolor: isCurrent ? BLUE : isDone ? '#22c55e' : '#e2e8f0',
                border: isCurrent ? `3px solid ${ACCENT}` : isDone ? '3px solid #22c55e' : '3px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isCurrent ? `0 0 0 3px rgba(59,130,246,0.2)` : 'none',
                transition: 'all 0.2s',
              }}>
                {isDone
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: '#fff' }} />
                  : <Typography sx={{ fontSize: 11, fontWeight: 800, color: isCurrent ? '#fff' : '#94a3b8' }}>
                      {stage.id}
                    </Typography>
                }
              </Box>
              <Typography sx={{
                fontSize: 10, fontWeight: isCurrent ? 700 : 500, textAlign: 'center', lineHeight: 1.3,
                color: isCurrent ? BLUE : isDone ? '#22c55e' : '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: 68,
              }}>
                {stage.name}
              </Typography>
            </Stack>
            {!isLast && (
              <Box sx={{
                flex: 1, height: 2, mt: '16px',
                bgcolor: isDone ? '#22c55e' : '#e2e8f0',
                transition: 'background-color 0.3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

// ── Rating chip ───────────────────────────────────────────────────────────────
function RatingChip({ label, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 2, py: 0.7, borderRadius: 2, cursor: 'pointer', userSelect: 'none',
        border: selected ? `2px solid ${ACCENT}` : '1.5px solid #e0e7ef',
        bgcolor: selected ? `${ACCENT}15` : '#fff',
        color: selected ? ACCENT : '#64748b',
        fontWeight: selected ? 700 : 500,
        fontSize: 13,
        transition: 'all 0.15s',
        '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: `${ACCENT}08` },
      }}
    >
      {label}
    </Box>
  );
}

// ── Single KRA card ───────────────────────────────────────────────────────────
function KRACard({ row, ratings, onSave, saving, savedId }) {
  const [selfRatingId,  setSelfRatingId]  = useState(row.self_rating_id ?? '');
  const [selfComment,   setSelfComment]   = useState(row.self_comment   ?? '');
  const [progressNotes, setProgressNotes] = useState(row.progress_notes ?? '');
  const [help,          setHelp]          = useState(row.help_and_assistance_required ?? '');
  const [showHelp,      setShowHelp]      = useState(false);
  const [dirty,         setDirty]         = useState(false);

  const catColor = categoryColor(row.category_name);
  const isSaving = saving && savedId === row.employee_kra_level_id;
  const isDone   = !!selfRatingId && !!selfComment;

  function handleChange(setter) {
    return (val) => { setter(val); setDirty(true); };
  }

  function handleSave() {
    onSave(row.employee_kra_level_id, {
      self_rating_id:               selfRatingId  || null,
      self_comment:                 selfComment   || null,
      progress_notes:               progressNotes || null,
      help_and_assistance_required: help          || null,
    });
    setDirty(false);
  }

  return (
    <Paper
      elevation={0}
      sx={{
        border: isDone ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f1f5f9', bgcolor: isDone ? '#f0fdf4' : '#fafbff' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isDone
              ? <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />
              : <RadioButtonUncheckedIcon sx={{ color: '#cbd5e1', fontSize: 20 }} />
            }
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>
              {row.kra_name}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label={row.category_name}
              size="small"
              sx={{ bgcolor: `${catColor}15`, color: catColor, fontWeight: 700, fontSize: 11, border: `1px solid ${catColor}30` }}
            />
            {row.weightage && (
              <Chip
                label={`Weight: ${row.weightage}%`}
                size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 11 }}
              />
            )}
          </Stack>
        </Stack>

        {row.description_by_lead && (
          <Typography sx={{ mt: 1, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            {row.description_by_lead}
          </Typography>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Stack spacing={2.5}>

          {/* Self Rating */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Self Rating
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {ratings.map(r => (
                <RatingChip
                  key={r.id}
                  label={`${r.rating} – ${r.description}`}
                  selected={selfRatingId === r.id}
                  onClick={() => handleChange(setSelfRatingId)(r.id)}
                />
              ))}
            </Stack>
          </Box>

          {/* Comments & Evidence */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Comments & Evidence
            </Typography>
            <TextField
              multiline minRows={3}
              placeholder="Describe key achievements, evidence, or context..."
              value={selfComment}
              onChange={e => handleChange(setSelfComment)(e.target.value)}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: 14, borderRadius: 2,
                  '&:hover fieldset': { borderColor: ACCENT },
                  '&.Mui-focused fieldset': { borderColor: ACCENT },
                },
              }}
            />
          </Box>

          {/* Progress Notes */}
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Progress Notes
            </Typography>
            <TextField
              multiline minRows={2}
              placeholder="Optional: note specific milestones or blockers..."
              value={progressNotes}
              onChange={e => handleChange(setProgressNotes)(e.target.value)}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: 14, borderRadius: 2,
                  '&:hover fieldset': { borderColor: ACCENT },
                  '&.Mui-focused fieldset': { borderColor: ACCENT },
                },
              }}
            />
          </Box>

          {/* Help & Assistance — collapsible */}
          <Box>
            <Stack
              direction="row" alignItems="center" spacing={0.5}
              sx={{ cursor: 'pointer', mb: showHelp ? 1 : 0 }}
              onClick={() => setShowHelp(v => !v)}
            >
              <HelpOutlineIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Help & Assistance Required
              </Typography>
              {showHelp
                ? <ExpandLessIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
                : <ExpandMoreIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
              }
            </Stack>
            <Collapse in={showHelp}>
              <TextField
                multiline minRows={2}
                placeholder="Describe any support or resources you need..."
                value={help}
                onChange={e => handleChange(setHelp)(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: 14, borderRadius: 2,
                    '&:hover fieldset': { borderColor: ACCENT },
                    '&.Mui-focused fieldset': { borderColor: ACCENT },
                  },
                }}
              />
            </Collapse>
          </Box>

          {/* Save button */}
          <Stack direction="row" justifyContent="flex-end">
            <Box
              onClick={dirty ? handleSave : undefined}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.8,
                px: 2.5, py: 0.9, borderRadius: 2, cursor: dirty ? 'pointer' : 'default',
                bgcolor: dirty ? BLUE : '#f1f5f9',
                color: dirty ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s',
                '&:hover': dirty ? { bgcolor: ACCENT } : {},
              }}
            >
              {isSaving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <SaveIcon sx={{ fontSize: 16 }} />}
              {isSaving ? 'Saving…' : 'Save'}
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

// ── Progress sidebar ──────────────────────────────────────────────────────────
function ProgressSidebar({ kras, cycle, stage }) {
  const rated = kras.filter(k => k.self_rating_id).length;
  const total = kras.length;
  const pct   = total ? Math.round((rated / total) * 100) : 0;

  const avgRatings = kras.filter(k => k.self_rating).map(k => k.self_rating);
  const avgDisplay = avgRatings.length
    ? (avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length).toFixed(1)
    : '—';

  return (
    <Box sx={{ position: 'sticky', top: 24 }}>
      {/* Progress card */}
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
        <Box sx={{ px: 2.5, py: 2, bgcolor: NAVY }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Assessment Progress
          </Typography>
        </Box>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Rated KRAs</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{rated} of {total}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate" value={pct}
            sx={{
              height: 8, borderRadius: 4, bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#22c55e' : ACCENT, borderRadius: 4 },
            }}
          />

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total KRAs</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: BLUE, mt: 0.5 }}>{total}</Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg. Rating</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: BLUE, mt: 0.5 }}>{avgDisplay}</Typography>
            </Box>
          </Stack>

          {pct < 100 && total > 0 && (
            <Alert severity="info" sx={{ mt: 2, fontSize: 12, borderRadius: 2, py: 0.5 }}>
              All KRAs require rating and comments before final submission.
            </Alert>
          )}
          {pct === 100 && total > 0 && (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ mt: 2, fontSize: 12, borderRadius: 2, py: 0.5 }}>
              All KRAs rated. You may submit for lead review.
            </Alert>
          )}
        </Box>
      </Paper>

      {/* KRA checklist — scrollable if many */}
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>KRA Checklist</Typography>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, maxHeight: 260, overflowY: 'auto' }}>
          <Stack spacing={1}>
            {kras.map(k => (
              <Stack key={k.employee_kra_level_id} direction="row" alignItems="center" spacing={1}>
                {k.self_rating_id
                  ? <CheckCircleIcon sx={{ fontSize: 15, color: '#22c55e', flexShrink: 0 }} />
                  : <RadioButtonUncheckedIcon sx={{ fontSize: 15, color: '#cbd5e1', flexShrink: 0 }} />
                }
                <Typography
                  sx={{ fontSize: 12, color: k.self_rating_id ? '#1e293b' : '#94a3b8', fontWeight: k.self_rating_id ? 600 : 400 }}
                  noWrap
                >
                  {k.kra_name}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Paper>

      {/* Rating guidelines */}
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Rating Guidelines</Typography>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5 }}>
          <Stack spacing={1.5}>
            {[
              { label: 'A',  desc: 'Exceptional. Goal exceeded by >20% with major impact.' },
              { label: 'B+', desc: 'Exceeds Expectations. Goal achieved with extra contributions.' },
              { label: 'B',  desc: 'Meets Expectations. All parameters fulfilled.' },
              { label: 'B-', desc: 'Below Expectations. Partial achievement with gaps.' },
            ].map(g => (
              <Stack key={g.label} direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ width: 26, height: 26, borderRadius: 1, bgcolor: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{g.label}</Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{g.desc}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SelfAssessmentPage() {
  const [cycles,  setCycles]  = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [data,    setData]    = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [error,   setError]   = useState('');
  const [toast,   setToast]   = useState('');

  // Load active cycle + reference ratings
  useEffect(() => {
    getCycles({ status: 'ACTIVE' }).then(res => {
      const list = res.data?.cycles ?? [];
      setCycles(list);
      // Auto-select the single active cycle — no dropdown needed for employees
      if (list.length > 0) setCycleId(list[0].id);
    });
    getReferenceData().then(res => {
      setRatings(res.data?.ratings ?? []);
    });
  }, []);

  // Load self assessment when cycle changes
  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    setError('');
    getSelfAssessment(cycleId)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || 'Failed to load assessment'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  const handleSave = useCallback(async (employeeKraLevelId, payload) => {
    setSaving(true);
    setSavedId(employeeKraLevelId);
    try {
      await saveSelfAssessmentRow(employeeKraLevelId, payload);
      setData(prev => ({
        ...prev,
        kras: prev.kras.map(k =>
          k.employee_kra_level_id === employeeKraLevelId ? { ...k, ...payload } : k
        ),
      }));
      setToast('Saved successfully');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setToast(err?.response?.data?.error || 'Save failed');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
      setSavedId(null);
    }
  }, []);

  const kras          = data?.kras ?? [];
  const cycle         = cycles.find(c => c.id === cycleId);
  // current_stage_id comes from the API response (matches the backend cycle stage)
  const currentStageId = data?.current_stage_id ?? cycle?.current_stage_id ?? null;

  return (
    // ── Outer wrapper: full viewport height, internal scroll ──────────────────
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* ── Fixed header ── */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 0, flexShrink: 0 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            {cycle && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                Assessment Period: {cycle.name}
              </Typography>
            )}
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
              My Performance Assessment
            </Typography>
          </Box>
        </Stack>

        {/* Stage stepper — driven by actual active cycle stage */}
        <CycleStageStepper currentStageId={currentStageId} />

        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* ── Scrollable body ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {/* Toasts */}
        {toast && (
          <Alert
            severity={toast.toLowerCase().includes('fail') ? 'error' : 'success'}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {toast}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: BLUE }} />
          </Box>
        )}

        {!loading && !error && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
            {/* KRA Cards — main scrollable column */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {kras.length === 0 ? (
                <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 15 }}>
                    No KRAs have been assigned to you for this cycle yet.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {kras.map(row => (
                    <KRACard
                      key={row.employee_kra_level_id}
                      row={row}
                      ratings={ratings}
                      onSave={handleSave}
                      saving={saving}
                      savedId={savedId}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Sidebar — sticky within the scrollable area */}
            <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
              <ProgressSidebar kras={kras} cycle={cycle} stage={currentStageId} />
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}