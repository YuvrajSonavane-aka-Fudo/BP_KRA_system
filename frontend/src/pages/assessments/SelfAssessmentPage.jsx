import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField,
  LinearProgress, Alert, CircularProgress, Divider, Collapse,
  InputAdornment,
} from '@mui/material';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SaveIcon                 from '@mui/icons-material/Save';
import HelpOutlineIcon          from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon           from '@mui/icons-material/ExpandMore';
import ExpandLessIcon           from '@mui/icons-material/ExpandLess';
import LockOutlinedIcon         from '@mui/icons-material/LockOutlined';
import SearchIcon               from '@mui/icons-material/Search';
import RateReviewIcon           from '@mui/icons-material/RateReview';
import { getSelfAssessment, saveSelfAssessmentRow } from '../../api/assessmentsApi';
import { getCycles }            from '../../api/cyclesApi';
import { getReferenceData }     from '../../api/referenceDataApi';
import { getStageStates, canSelfAssess, getStageLockReason, STAGE } from '../../utils/stageUtils';

const NAVY   = '#0f1b4c';
const BLUE   = '#1E3A8A';
const ACCENT = '#3b82f6';

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

// ── Stage stepper ─────────────────────────────────────────────────────────────
function CycleStageStepper({ currentStageId, completedStageIds }) {
  if (!currentStageId) return null;
  const states = getStageStates(currentStageId, completedStageIds);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0, mt: 2.5 }}>
      {states.map((stage, i) => {
        const isLast = i === states.length - 1;
        return (
          <React.Fragment key={stage.id}>
            <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 72 }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '50%',
                bgcolor: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#e2e8f0',
                border: stage.isCurrent ? `3px solid ${ACCENT}` : stage.isDone ? '3px solid #22c55e' : '3px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: stage.isCurrent ? `0 0 0 3px rgba(59,130,246,0.2)` : 'none',
                transition: 'all 0.2s',
              }}>
                {stage.isDone
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: '#fff' }} />
                  : <Typography sx={{ fontSize: 11, fontWeight: 800, color: stage.isCurrent ? '#fff' : '#94a3b8' }}>{stage.id}</Typography>
                }
              </Box>
              <Typography sx={{
                fontSize: 10, fontWeight: stage.isCurrent ? 700 : 500,
                textAlign: 'center', lineHeight: 1.3, maxWidth: 68,
                color: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>{stage.name}</Typography>
            </Stack>
            {!isLast && (
              <Box sx={{ flex: 1, height: 2, mt: '16px', bgcolor: stage.isDone ? '#22c55e' : '#e2e8f0', transition: 'background-color 0.3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

// ── Rating chip ───────────────────────────────────────────────────────────────
function RatingChip({ label, selected, onClick, disabled }) {
  return (
    <Box onClick={!disabled ? onClick : undefined} sx={{
      px: 2, py: 0.7, borderRadius: 2, userSelect: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      border: selected ? `2px solid ${ACCENT}` : '1.5px solid #e0e7ef',
      bgcolor: selected ? `${ACCENT}15` : '#fff',
      color: selected ? ACCENT : '#64748b',
      fontWeight: selected ? 700 : 500, fontSize: 13, transition: 'all 0.15s',
      '&:hover': !disabled ? { borderColor: ACCENT, color: ACCENT, bgcolor: `${ACCENT}08` } : {},
    }}>{label}</Box>
  );
}

// ── Lead rating panel (read-only) ─────────────────────────────────────────────
// Visible to employee once cycle reaches Lead Assessment stage
function LeadRatingPanel({ row, ratings }) {
  const ratingLabel = ratings.find(r => r.id === row.lead_rating_id);
  return (
    <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1.5px dashed #e2e8f0' }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <RateReviewIcon sx={{ fontSize: 15, color: BLUE }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Lead Assessment
        </Typography>
      </Stack>
      {!row.lead_rating_id ? (
        <Typography sx={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
          Your lead has not yet rated this KRA.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <Chip
            label={ratingLabel ? `${row.lead_rating} – ${ratingLabel.description}` : `Rating: ${row.lead_rating}`}
            size="small"
            sx={{ bgcolor: '#eff6ff', color: BLUE, fontWeight: 700, fontSize: 12, alignSelf: 'flex-start', border: `1px solid ${BLUE}20` }}
          />
          {row.lead_comment && (
            <Box sx={{ bgcolor: '#f0f7ff', borderRadius: 2, p: 1.5, border: '1px solid #dbeafe' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                Lead Comment
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{row.lead_comment}</Typography>
            </Box>
          )}
          {row.lead_progress_notes && (
            <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                Lead Progress Notes
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{row.lead_progress_notes}</Typography>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

// ── KRA card ──────────────────────────────────────────────────────────────────
function KRACard({ row, ratings, onSave, saving, savedId, editable, showLeadRating, kraRef }) {
  const [selfRatingId,  setSelfRatingId]  = useState(row.self_rating_id ?? '');
  const [selfComment,   setSelfComment]   = useState(row.self_comment   ?? '');
  const [progressNotes, setProgressNotes] = useState(row.progress_notes ?? '');
  const [help,          setHelp]          = useState(row.help_and_assistance_required ?? '');
  const [showHelp,      setShowHelp]      = useState(false);
  const [dirty,         setDirty]         = useState(false);

  const isSaving = saving && savedId === row.employee_kra_level_id;
  const isDone   = !!selfRatingId && !!selfComment;

  useEffect(() => { setDirty(false); }, [editable]);

  function handleChange(setter) { return (val) => { setter(val); setDirty(true); }; }

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
    <Paper ref={kraRef} elevation={0} sx={{
      border: isDone ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
      borderRadius: 3, overflow: 'hidden', transition: 'border-color 0.2s',
      scrollMarginTop: '16px',
    }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f1f5f9', bgcolor: isDone ? '#f0fdf4' : '#fafbff' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isDone
              ? <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />
              : <RadioButtonUncheckedIcon sx={{ color: '#cbd5e1', fontSize: 20 }} />
            }
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{row.kra_name}</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            {row.category_name && (
              <Chip label={row.category_name} size="small"
                sx={{ bgcolor: `${categoryColor(row.category_name)}15`, color: categoryColor(row.category_name), fontWeight: 700, fontSize: 11, border: `1px solid ${categoryColor(row.category_name)}30` }} />
            )}
            {row.weightage && (
              <Chip label={`Weight: ${row.weightage}%`} size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 11 }} />
            )}
          </Stack>
        </Stack>
        {row.description_by_lead && (
          <Typography sx={{ mt: 1, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{row.description_by_lead}</Typography>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, bgcolor: editable ? '#fff' : '#fafbff' }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Self Rating
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {ratings.map(r => (
                <RatingChip key={r.id}
                  label={`${r.rating} – ${r.description}`}
                  selected={selfRatingId === r.id}
                  onClick={() => handleChange(setSelfRatingId)(r.id)}
                  disabled={!editable}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Comments & Evidence
            </Typography>
            <TextField multiline minRows={3} fullWidth disabled={!editable}
              placeholder="Describe key achievements, evidence, or context..."
              value={selfComment} onChange={e => handleChange(setSelfComment)(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: 14, borderRadius: 2,
                '&:hover fieldset': { borderColor: editable ? ACCENT : undefined },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              }}}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Progress Notes
            </Typography>
            <TextField multiline minRows={2} fullWidth disabled={!editable}
              placeholder="Optional: note specific milestones or blockers..."
              value={progressNotes} onChange={e => handleChange(setProgressNotes)(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: 14, borderRadius: 2,
                '&:hover fieldset': { borderColor: editable ? ACCENT : undefined },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              }}}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'pointer', mb: showHelp ? 1 : 0 }} onClick={() => setShowHelp(v => !v)}>
              <HelpOutlineIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Help & Assistance Required
              </Typography>
              {showHelp ? <ExpandLessIcon sx={{ fontSize: 15, color: '#94a3b8' }} /> : <ExpandMoreIcon sx={{ fontSize: 15, color: '#94a3b8' }} />}
            </Stack>
            <Collapse in={showHelp}>
              <TextField multiline minRows={2} fullWidth disabled={!editable}
                placeholder="Describe any support or resources you need..."
                value={help} onChange={e => handleChange(setHelp)(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: 14, borderRadius: 2,
                  '&:hover fieldset': { borderColor: editable ? ACCENT : undefined },
                  '&.Mui-focused fieldset': { borderColor: ACCENT },
                }}}
              />
            </Collapse>
          </Box>

          {editable && (
            <Stack direction="row" justifyContent="flex-end">
              <Box onClick={dirty ? handleSave : undefined} sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.8,
                px: 2.5, py: 0.9, borderRadius: 2,
                cursor: dirty ? 'pointer' : 'default',
                bgcolor: dirty ? BLUE : '#f1f5f9', color: dirty ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                '&:hover': dirty ? { bgcolor: ACCENT } : {},
              }}>
                {isSaving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <SaveIcon sx={{ fontSize: 16 }} />}
                {isSaving ? 'Saving…' : 'Save'}
              </Box>
            </Stack>
          )}

          {/* Lead rating section — visible in Lead Assessment stage and beyond */}
          {showLeadRating && <LeadRatingPanel row={row} ratings={ratings} />}
        </Stack>
      </Box>
    </Paper>
  );
}

// ── Progress sidebar with jump-to search ─────────────────────────────────────
function ProgressSidebar({ kras, onJumpTo }) {
  const [sidebarSearch, setSidebarSearch] = useState('');

  const rated = kras.filter(k => k.self_rating_id).length;
  const total = kras.length;
  const pct   = total ? Math.round((rated / total) * 100) : 0;

  const avgRatings = kras.filter(k => k.self_rating).map(k => k.self_rating);
  const avgDisplay = avgRatings.length
    ? (avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length).toFixed(1)
    : '—';

  const filteredKras = sidebarSearch
    ? kras.filter(k => k.kra_name?.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : kras;

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
          <LinearProgress variant="determinate" value={pct}
            sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#22c55e' : ACCENT, borderRadius: 4 } }} />
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

      {/* Jump-to KRA with search */}
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
        <Box sx={{ px: 2.5, pt: 1.5, pb: 1, borderBottom: '1px solid #f1f5f9' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b', mb: 1 }}>Jump to KRA</Typography>
          <TextField size="small" fullWidth
            placeholder="Search KRAs…"
            value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#94a3b8' }} /></InputAdornment> }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 12, borderRadius: 1.5 } }}
          />
        </Box>
        <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {filteredKras.length === 0 ? (
            <Typography sx={{ px: 2.5, py: 2, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No KRAs match</Typography>
          ) : filteredKras.map(k => (
            <Stack key={k.employee_kra_level_id}
              direction="row" alignItems="center" spacing={1}
              onClick={() => onJumpTo(k.employee_kra_level_id)}
              sx={{ px: 2.5, py: 1, cursor: 'pointer', borderBottom: '1px solid #f8fafc', '&:hover': { bgcolor: '#f1f5f9' } }}
            >
              {k.self_rating_id
                ? <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e', flexShrink: 0 }} />
                : <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: '#cbd5e1', flexShrink: 0 }} />
              }
              <Typography sx={{ fontSize: 12, color: k.self_rating_id ? '#1e293b' : '#94a3b8', fontWeight: k.self_rating_id ? 600 : 400, flex: 1 }} noWrap>
                {k.kra_name}
              </Typography>
            </Stack>
          ))}
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
  const [cycles,    setCycles]    = useState([]);
  const [cycleId,   setCycleId]   = useState('');
  const [data,      setData]      = useState(null);
  const [ratings,   setRatings]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [savedId,   setSavedId]   = useState(null);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState({ msg: '', severity: 'success' });
  const [kraSearch, setKraSearch] = useState('');

  // Ref map: employee_kra_level_id → DOM element for scroll-jump
  const kraRefs = useRef({});

  useEffect(() => {
    getCycles({ status: 'ACTIVE' }).then(res => {
      const list = res.data?.cycles ?? [];
      setCycles(list);
      if (list.length > 0) setCycleId(list[0].id);
    });
    getReferenceData().then(res => setRatings(res.data?.ratings ?? []));
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true); setError('');
    getSelfAssessment(cycleId)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || 'Failed to load assessment'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  const handleSave = useCallback(async (employeeKraLevelId, payload) => {
    setSaving(true); setSavedId(employeeKraLevelId);
    try {
      await saveSelfAssessmentRow(employeeKraLevelId, payload);
      setData(prev => ({
        ...prev,
        kras: prev.kras.map(k => k.employee_kra_level_id === employeeKraLevelId ? { ...k, ...payload } : k),
      }));
      setToast({ msg: 'Saved successfully', severity: 'success' });
    } catch (err) {
      setToast({ msg: err?.response?.data?.error || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false); setSavedId(null);
      setTimeout(() => setToast({ msg: '', severity: 'success' }), 3000);
    }
  }, []);

  function handleJumpTo(employeeKraLevelId) {
    // Clear search filter first so the card is visible, then scroll
    setKraSearch('');
    setTimeout(() => {
      const el = kraRefs.current[employeeKraLevelId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  const kras  = data?.kras ?? [];
  const cycle = cycles.find(c => c.id === cycleId);

  const currentStageId    = data?.current_stage?.id ?? cycle?.current_stage_id ?? null;
  const completedStageIds = data?.completed_stage_ids ?? [];

  const editable       = canSelfAssess(currentStageId);
  const lockReason     = !editable && currentStageId ? getStageLockReason(currentStageId, 'employee') : null;
  // Show lead's rating to employee from Lead Assessment stage onwards
  const showLeadRating = currentStageId >= STAGE.LEAD_ASSESSMENT;

  const filteredKras = kraSearch
    ? kras.filter(k => k.kra_name?.toLowerCase().includes(kraSearch.toLowerCase()))
    : kras;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* Fixed header */}
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
        <CycleStageStepper currentStageId={currentStageId} completedStageIds={completedStageIds} />
        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {!loading && lockReason && (
          <Alert severity="warning" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2, borderRadius: 2 }}>
            {lockReason} Your responses are shown in read-only mode.
          </Alert>
        )}
        {toast.msg && <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>}
        {error     && <Alert severity="error"           sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: BLUE }} />
          </Box>
        )}

        {!loading && !error && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Inline KRA search above cards */}
              {kras.length > 0 && (
                <TextField size="small" fullWidth
                  placeholder={`Search ${kras.length} KRAs…`}
                  value={kraSearch}
                  onChange={e => setKraSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} /></InputAdornment> }}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13, bgcolor: '#fff' } }}
                />
              )}

              {kras.length === 0 ? (
                <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 15 }}>No KRAs have been assigned to you for this cycle yet.</Typography>
                </Paper>
              ) : filteredKras.length === 0 ? (
                <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>No KRAs match "{kraSearch}"</Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {filteredKras.map(row => (
                    <KRACard
                      key={row.employee_kra_level_id}
                      row={row}
                      ratings={ratings}
                      onSave={handleSave}
                      saving={saving}
                      savedId={savedId}
                      editable={editable}
                      showLeadRating={showLeadRating}
                      kraRef={el => { kraRefs.current[row.employee_kra_level_id] = el; }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Sidebar */}
            <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
              <ProgressSidebar kras={kras} onJumpTo={handleJumpTo} />
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}