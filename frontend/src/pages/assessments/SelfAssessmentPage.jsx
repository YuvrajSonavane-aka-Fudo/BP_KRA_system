import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField, Select, MenuItem,
  LinearProgress, Alert, CircularProgress, Divider, Collapse,
  InputAdornment, Avatar, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SaveIcon                 from '@mui/icons-material/Save';
import HelpOutlineIcon          from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon           from '@mui/icons-material/ExpandMore';
import ExpandLessIcon           from '@mui/icons-material/ExpandLess';
import LockOutlinedIcon         from '@mui/icons-material/LockOutlined';
import RateReviewIcon           from '@mui/icons-material/RateReview';
import PendingIcon              from '@mui/icons-material/Pending';
import { getSelfAssessment, saveSelfAssessmentRow, getAssessmentProgress, submitLeadReview } from '../../api/assessmentsApi';
import { getCycles }            from '../../api/cyclesApi';
import { getReferenceData }     from '../../api/referenceDataApi';
import { getStageStates, canSelfAssess, canLeadReview, getStageLockReason, STAGE } from '../../utils/stageUtils';
import useAuth                  from '../../auth/useAuth';

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
function categoryColor(name) { return CATEGORY_COLORS[name] || CATEGORY_COLORS.default; }
function initials(name = '') { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'; }

//  Role helpers 
const HR_ROLES   = ['Admin', 'HR', 'Vertical Lead'];
const LEAD_ROLES = ['Manager', 'Team Lead'];

function resolveRole(user) {
  const roles = user?.roles ?? [];
  const isHR   = roles.some(r => HR_ROLES.includes(r));
  const isLead = roles.some(r => LEAD_ROLES.includes(r));
  // HR supersedes lead; lead supersedes employee
  if (isHR)   return 'hr';
  if (isLead) return 'lead';
  return 'employee';
}

// Shared: Stage stepper 
function CycleStageStepper({ currentStageId, completedStageIds }) {
  if (!currentStageId) return null;
  const states = getStageStates(currentStageId, completedStageIds);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0, mt: 2 }}>
      {states.map((stage, i) => {
        const isLast = i === states.length - 1;
        return (
          <React.Fragment key={stage.id}>
            <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 72 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%',
                bgcolor: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#e2e8f0',
                border: stage.isCurrent ? `3px solid ${ACCENT}` : stage.isDone ? '3px solid #22c55e' : '3px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: stage.isCurrent ? `0 0 0 3px rgba(59,130,246,0.2)` : 'none',
                transition: 'all 0.2s',
              }}>
                {stage.isDone
                  ? <CheckCircleIcon sx={{ fontSize: 16, color: '#fff' }} />
                  : <Typography sx={{ fontSize: 10, fontWeight: 800, color: stage.isCurrent ? '#fff' : '#94a3b8' }}>{stage.id}</Typography>
                }
              </Box>
              <Typography sx={{
                fontSize: 9, fontWeight: stage.isCurrent ? 700 : 500,
                textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
                color: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>{stage.name}</Typography>
            </Stack>
            {!isLast && (
              <Box sx={{ flex: 1, height: 2, mt: '15px', bgcolor: stage.isDone ? '#22c55e' : '#e2e8f0', transition: 'background-color 0.3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}


// EMPLOYEE VIEW


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
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>Lead Comment</Typography>
              <Typography sx={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{row.lead_comment}</Typography>
            </Box>
          )}
          {row.lead_progress_notes && (
            <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>Lead Progress Notes</Typography>
              <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{row.lead_progress_notes}</Typography>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

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
      borderRadius: 3, overflow: 'hidden', transition: 'border-color 0.2s', scrollMarginTop: '16px',
    }}>
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f1f5f9', bgcolor: isDone ? '#f0fdf4' : '#fafbff' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isDone ? <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} /> : <RadioButtonUncheckedIcon sx={{ color: '#cbd5e1', fontSize: 20 }} />}
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{row.kra_name}</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            {row.category_name && (
              <Chip label={row.category_name} size="small"
                sx={{ bgcolor: `${categoryColor(row.category_name)}15`, color: categoryColor(row.category_name), fontWeight: 700, fontSize: 11, border: `1px solid ${categoryColor(row.category_name)}30` }} />
            )}
            {row.weightage && (
              <Chip label={`Weight: ${row.weightage}%`} size="small" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 11 }} />
            )}
          </Stack>
        </Stack>
        {row.description_by_lead && (
          <Typography sx={{ mt: 1, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{row.description_by_lead}</Typography>
        )}
      </Box>

      <Box sx={{ px: 3, py: 2.5, bgcolor: editable ? '#fff' : '#fafbff' }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Self Rating</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {ratings.map(r => (
                <RatingChip key={r.id} label={`${r.rating} – ${r.description}`}
                  selected={selfRatingId === r.id}
                  onClick={() => handleChange(setSelfRatingId)(r.id)}
                  disabled={!editable}
                />
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comments & Evidence</Typography>
            <TextField multiline minRows={3} fullWidth disabled={!editable}
              placeholder="Describe key achievements, evidence, or context..."
              value={selfComment} onChange={e => handleChange(setSelfComment)(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: 14, borderRadius: 2, '&:hover fieldset': { borderColor: editable ? ACCENT : undefined }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progress Notes</Typography>
            <TextField multiline minRows={2} fullWidth disabled={!editable}
              placeholder="Optional: note specific milestones or blockers..."
              value={progressNotes} onChange={e => handleChange(setProgressNotes)(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: 14, borderRadius: 2, '&:hover fieldset': { borderColor: editable ? ACCENT : undefined }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
            />
          </Box>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'pointer', mb: showHelp ? 1 : 0 }} onClick={() => setShowHelp(v => !v)}>
              <HelpOutlineIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Help & Assistance Required</Typography>
              {showHelp ? <ExpandLessIcon sx={{ fontSize: 15, color: '#94a3b8' }} /> : <ExpandMoreIcon sx={{ fontSize: 15, color: '#94a3b8' }} />}
            </Stack>
            <Collapse in={showHelp}>
              <TextField multiline minRows={2} fullWidth disabled={!editable}
                placeholder="Describe any support or resources you need..."
                value={help} onChange={e => handleChange(setHelp)(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: 14, borderRadius: 2, '&:hover fieldset': { borderColor: editable ? ACCENT : undefined }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
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
          {showLeadRating && <LeadRatingPanel row={row} ratings={ratings} />}
        </Stack>
      </Box>
    </Paper>
  );
}

function ProgressSidebar({ kras, onJumpTo }) {
  const rated = kras.filter(k => k.self_rating_id).length;
  const total = kras.length;
  const pct   = total ? Math.round((rated / total) * 100) : 0;
  const avgRatings = kras.filter(k => k.self_rating).map(k => k.self_rating);
  const avgDisplay = avgRatings.length ? (avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length).toFixed(1) : '—';

  return (
    <Box sx={{ position: 'sticky', top: 24 }}>
      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
        <Box sx={{ px: 2.5, py: 2, bgcolor: NAVY }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Assessment Progress</Typography>
        </Box>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Rated KRAs</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{rated} of {total}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={pct}
            sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#22c55e' : ACCENT, borderRadius: 4 } }} />
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
          {pct === 100 && total > 0 && (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ mt: 2, fontSize: 12, borderRadius: 2, py: 0.5 }}>
              All KRAs rated. You may submit for lead review.
            </Alert>
          )}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Jump to KRA</Typography>
        </Box>
        <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
          {kras.map(k => (
            <Stack key={k.employee_kra_level_id} direction="row" alignItems="center" spacing={1}
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

function EmployeeView({ cycleId, cycles, onCycleChange, ratings, hideCycleHeader = false }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [savedId,   setSavedId]   = useState(null);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState({ msg: '', severity: 'success' });
  const kraRefs = useRef({});

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
      setData(prev => ({ ...prev, kras: prev.kras.map(k => k.employee_kra_level_id === employeeKraLevelId ? { ...k, ...payload } : k) }));
      setToast({ msg: 'Saved successfully', severity: 'success' });
    } catch (err) {
      setToast({ msg: err?.response?.data?.error || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false); setSavedId(null);
      setTimeout(() => setToast({ msg: '', severity: 'success' }), 3000);
    }
  }, []);

  function handleJumpTo(id) {
    setTimeout(() => {
      const el = kraRefs.current[id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  const kras              = data?.kras ?? [];
  const cycle             = cycles.find(c => c.id === cycleId);
  const currentStageId    = data?.current_stage?.id ?? cycle?.current_stage_id ?? null;
  const completedStageIds = data?.completed_stage_ids ?? [];
  const editable          = canSelfAssess(currentStageId);
  const lockReason        = !editable && currentStageId ? getStageLockReason(currentStageId, 'employee') : null;
  const showLeadRating    = currentStageId >= STAGE.LEAD_ASSESSMENT;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: '#f5f6fa' }}>
      {!hideCycleHeader && (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 0, flexShrink: 0 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box>
              {cycle && (
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                  Assessment Period: {cycle.name}
                </Typography>
              )}
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>KRA Assessment</Typography>
            </Box>
            {cycles.length > 1 && (
              <Select value={cycleId} onChange={e => onCycleChange(e.target.value)}
                size="small" sx={{ minWidth: 180, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
                {cycles.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
              </Select>
            )}
          </Stack>
          <CycleStageStepper currentStageId={currentStageId} completedStageIds={completedStageIds} />
          <Divider sx={{ mt: 2 }} />
        </Box>
      )}
      {hideCycleHeader && (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 0, flexShrink: 0 }}>
          <CycleStageStepper currentStageId={currentStageId} completedStageIds={completedStageIds} />
          <Divider sx={{ mt: 1 }} />
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {!loading && lockReason && (
          <Alert severity="warning" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2, borderRadius: 2 }}>
            {lockReason} Your responses are shown in read-only mode.
          </Alert>
        )}
        {toast.msg && <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>}
        {error     && <Alert severity="error"           sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: BLUE }} /></Box>}

        {!loading && !error && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {kras.length === 0 ? (
                <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 15 }}>No KRAs have been assigned to you for this cycle yet.</Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {kras.map(row => (
                    <KRACard key={row.employee_kra_level_id} row={row} ratings={ratings}
                      onSave={handleSave} saving={saving} savedId={savedId}
                      editable={editable} showLeadRating={showLeadRating}
                      kraRef={el => { kraRefs.current[row.employee_kra_level_id] = el; }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
            <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
              <ProgressSidebar kras={kras} onJumpTo={handleJumpTo} />
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}


// LEAD / ADMIN VIEW — grid


// dirty state shape: { [employee_kra_level_id]: { lead_rating_id, lead_comment, lead_progress_notes } }

function EmployeeSection({ emp, ratings, currentStageId, dirtyMap, onFieldChange, sectionRef }) {
  const [collapsed, setCollapsed] = useState(false);

  const kras        = emp.kras ?? [];
  const reviewed    = kras.filter(k => k.lead_rating_id || dirtyMap[k.employee_kra_level_id]?.lead_rating_id).length;
  const pct         = kras.length ? Math.round((reviewed / kras.length) * 100) : 0;
  const ratingEditable  = canLeadReview(currentStageId);   // rating only in lead stage
  // comments always editable regardless of stage
  const commentEditable = true;

  return (
    <Box ref={sectionRef} sx={{ mb: 3, scrollMarginTop: '80px' }}>
      {/* Employee header row */}
      <Box
        onClick={() => setCollapsed(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 2,
          px: 2.5, py: 1.5, cursor: 'pointer',
          bgcolor: NAVY, borderRadius: collapsed ? 2 : '8px 8px 0 0',
          transition: 'border-radius 0.2s',
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: ACCENT, fontSize: 13, fontWeight: 800 }}>
          {initials(emp.full_name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{emp.full_name}</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            Manager: {emp.manager_name || '—'} &nbsp;·&nbsp; {emp.department || '—'} &nbsp;·&nbsp; {emp.level || '—'}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>Lead Reviewed</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#4ade80' : '#fff' }}>
              {reviewed}/{kras.length}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct}
            sx={{ width: 80, height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.15)',
              '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#4ade80' : ACCENT } }} />
          {collapsed ? <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }} /> : <ExpandLessIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }} />}
        </Stack>
      </Box>

      {/* KRA grid table */}
      <Collapse in={!collapsed}>
        <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {kras.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>No KRAs assigned.</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1100 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {['Category', 'KRA', 'Description by Lead', 'Self Rating', 'Self Comment', 'Progress Notes', 'Lead Rating', 'Lead Comment'].map(h => (
                      <TableCell key={h} sx={{
                        fontSize: 10, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        py: 1, borderBottom: '1.5px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kras.map((kra, idx) => {
                    const dirty      = dirtyMap[kra.employee_kra_level_id] ?? {};
                    const leadRating = dirty.lead_rating_id  ?? kra.lead_rating_id  ?? '';
                    const leadComment= dirty.lead_comment    ?? kra.lead_comment    ?? '';
                    const selfRatingLabel = ratings.find(r => r.id === kra.self_rating_id);
                    const isDirty    = !!dirtyMap[kra.employee_kra_level_id];

                    return (
                      <TableRow key={kra.employee_kra_level_id}
                        sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#fafbff', verticalAlign: 'top' }}>

                        {/* Category */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 110 }}>
                          {kra.category_name ? (
                            <Chip label={kra.category_name} size="small"
                              sx={{ bgcolor: `${categoryColor(kra.category_name)}15`, color: categoryColor(kra.category_name), fontWeight: 700, fontSize: 10, border: `1px solid ${categoryColor(kra.category_name)}30` }} />
                          ) : '—'}
                        </TableCell>

                        {/* KRA name + weightage */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 160 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>{kra.kra_name}</Typography>
                          {kra.weightage && <Typography sx={{ fontSize: 10, color: '#94a3b8', mt: 0.3 }}>{kra.weightage}%</Typography>}
                        </TableCell>

                        {/* Description by lead */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 180 }}>
                          <Typography sx={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{kra.description_by_lead || '—'}</Typography>
                        </TableCell>

                        {/* Self rating (read-only) */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 100 }}>
                          {kra.self_rating_id ? (
                            <Chip label={selfRatingLabel ? `${kra.self_rating} – ${selfRatingLabel.description}` : kra.self_rating}
                              size="small" sx={{ bgcolor: '#eff6ff', color: BLUE, fontWeight: 700, fontSize: 10 }} />
                          ) : (
                            <Typography sx={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>Pending</Typography>
                          )}
                        </TableCell>

                        {/* Self comment (read-only) */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 200 }}>
                          <Typography sx={{ fontSize: 12, lineHeight: 1.5, fontStyle: kra.self_comment ? 'normal' : 'italic', color: kra.self_comment ? '#475569' : '#cbd5e1' }}>
                            {kra.self_comment || 'No comment'}
                          </Typography>
                        </TableCell>

                        {/* Progress notes (read-only) */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 160 }}>
                          <Typography sx={{ fontSize: 12, lineHeight: 1.5, fontStyle: kra.progress_notes ? 'normal' : 'italic', color: kra.progress_notes ? '#64748b' : '#cbd5e1' }}>
                            {kra.progress_notes || '—'}
                          </Typography>
                        </TableCell>

                        {/* Lead rating — editable only in lead assessment stage */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 150 }}>
                          {ratingEditable ? (
                            <Select value={leadRating}
                              onChange={e => onFieldChange(emp.employee_id, kra.employee_kra_level_id, 'lead_rating_id', e.target.value)}
                              displayEmpty size="small" fullWidth
                              sx={{ fontSize: 12, borderRadius: 1.5,
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: leadRating ? '#22c55e' : '#e2e8f0' } }}>
                              <MenuItem value="" sx={{ fontSize: 12, color: '#94a3b8' }}>Select…</MenuItem>
                              {ratings.map(r => (
                                <MenuItem key={r.id} value={r.id} sx={{ fontSize: 12 }}>{r.rating} – {r.description}</MenuItem>
                              ))}
                            </Select>
                          ) : (
                            kra.lead_rating_id ? (
                              <Chip label={`${kra.lead_rating} – ${ratings.find(r => r.id === kra.lead_rating_id)?.description ?? ''}`}
                                size="small" sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: 10 }} />
                            ) : (
                              <Typography sx={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>Not rated</Typography>
                            )
                          )}
                        </TableCell>

                        {/* Lead comment — always editable */}
                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 220 }}>
                          <TextField multiline minRows={2} fullWidth size="small"
                            placeholder="Add comment…"
                            value={leadComment}
                            onChange={e => onFieldChange(emp.employee_id, kra.employee_kra_level_id, 'lead_comment', e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { fontSize: 12, borderRadius: 1.5,
                              '&:hover fieldset': { borderColor: ACCENT },
                              '&.Mui-focused fieldset': { borderColor: ACCENT },
                              ...(isDirty ? { '& fieldset': { borderColor: '#f59e0b' } } : {}),
                            } }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      </Collapse>
    </Box>
  );
}

function LeadView({ cycleId, cycles, onCycleChange, ratings }) {
  const [tab,      setTab]      = useState('self'); // 'self' | 'team'
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [toast,    setToast]    = useState({ msg: '', severity: 'success' });
  // dirtyMap: { [employeeId]: { [kraLevelId]: { lead_rating_id?, lead_comment? } } }
  const [dirtyMap, setDirtyMap] = useState({});
  const [selectedEmpId, setSelectedEmpId] = useState('');

  const sectionRefs = useRef({});

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true); setError(''); setDirtyMap({});
    getAssessmentProgress(cycleId)
      .then(res => {
        setData(res.data);
        const emps = res.data?.employees ?? [];
        if (emps.length > 0) setSelectedEmpId(emps[0].employee_id);
      })
      .catch(err => setError(err?.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  function handleFieldChange(employeeId, kraLevelId, field, value) {
    setDirtyMap(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] ?? {}),
        [kraLevelId]: {
          ...(prev[employeeId]?.[kraLevelId] ?? {}),
          [field]: value,
        },
      },
    }));
  }

  async function handleSaveAll() {
    setSaving(true);
    const promises = [];
    for (const [empId, kraMap] of Object.entries(dirtyMap)) {
      for (const [kraLevelId, payload] of Object.entries(kraMap)) {
        if (Object.keys(payload).length > 0) {
          promises.push(submitLeadReview(kraLevelId, payload));
        }
      }
    }
    try {
      await Promise.all(promises);
      // Merge dirty into data so UI reflects saved state
      setData(prev => ({
        ...prev,
        employees: prev.employees.map(emp => ({
          ...emp,
          kras: emp.kras.map(k => {
            const patch = dirtyMap[emp.employee_id]?.[k.employee_kra_level_id];
            return patch ? { ...k, ...patch } : k;
          }),
        })),
      }));
      setDirtyMap({});
      setToast({ msg: `Saved successfully`, severity: 'success' });
    } catch (err) {
      setToast({ msg: err?.response?.data?.error || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast({ msg: '', severity: 'success' }), 4000);
    }
  }

  function handleJumpToEmployee(empId) {
    setSelectedEmpId(empId);
    setTimeout(() => {
      const el = sectionRefs.current[empId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  const employees         = data?.employees ?? [];
  const cycle             = cycles.find(c => c.id === cycleId);
  const currentStageId    = data?.current_stage_id ?? data?.current_stage?.id ?? cycle?.current_stage_id ?? null;
  const completedStageIds = data?.completed_stage_ids ?? [];

  const totalDirty = Object.values(dirtyMap).reduce((acc, kraMap) => acc + Object.keys(kraMap).length, 0);

  const totalReviewed = employees.reduce((acc, emp) => acc + (emp.kras?.filter(k => k.lead_rating_id).length ?? 0), 0);
  const totalKras     = employees.reduce((acc, emp) => acc + (emp.kras?.length ?? 0), 0);
  const overallPct    = totalKras ? Math.round((totalReviewed / totalKras) * 100) : 0;

  // If tab is 'self', render the employee self-assessment view for the lead themselves
  if (tab === 'self') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>
        {/* Tab switcher header */}
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 0, flexShrink: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            {[{ key: 'self', label: 'My Assessment' }, { key: 'team', label: 'Team Review' }].map(t => (
              <Box key={t.key} onClick={() => setTab(t.key)} sx={{
                px: 2.5, py: 0.8, borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                bgcolor: tab === t.key ? BLUE : '#fff',
                color: tab === t.key ? '#fff' : '#64748b',
                border: `1.5px solid ${tab === t.key ? BLUE : '#e2e8f0'}`,
                transition: 'all 0.15s',
                '&:hover': { borderColor: BLUE, color: tab === t.key ? '#fff' : BLUE },
              }}>{t.label}</Box>
            ))}
          </Stack>
          <Divider />
        </Box>
        {/* Reuse EmployeeView for lead's own self-assessment */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <EmployeeView cycleId={cycleId} cycles={cycles} onCycleChange={onCycleChange} ratings={ratings} hideCycleHeader />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 0, flexShrink: 0 }}>

        {/* Tab switcher */}
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          {[{ key: 'self', label: 'My Assessment' }, { key: 'team', label: 'Team Review' }].map(t => (
            <Box key={t.key} onClick={() => setTab(t.key)} sx={{
              px: 2.5, py: 0.8, borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              bgcolor: tab === t.key ? BLUE : '#fff',
              color: tab === t.key ? '#fff' : '#64748b',
              border: `1.5px solid ${tab === t.key ? BLUE : '#e2e8f0'}`,
              transition: 'all 0.15s',
              '&:hover': { borderColor: BLUE, color: tab === t.key ? '#fff' : BLUE },
            }}>{t.label}</Box>
          ))}
        </Stack>

        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            {cycle && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                {cycle.name}
              </Typography>
            )}
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>KRA Assessment</Typography>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
            {/* Cycle dropdown */}
            {cycles.length > 1 && (
              <Select value={cycleId} onChange={e => onCycleChange(e.target.value)}
                size="small" sx={{ minWidth: 180, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
                {cycles.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
              </Select>
            )}

            {/* Employee jump dropdown */}
            {employees.length > 0 && (
              <Select value={selectedEmpId}
                onChange={e => handleJumpToEmployee(e.target.value)}
                size="small"
                sx={{ minWidth: 200, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
                {employees.map(e => (
                  <MenuItem key={e.employee_id} value={e.employee_id} sx={{ fontSize: 13 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 20, height: 20, bgcolor: BLUE, fontSize: 9, fontWeight: 800 }}>{initials(e.full_name)}</Avatar>
                      <Typography sx={{ fontSize: 13 }}>{e.full_name}</Typography>
                      {e.kras?.filter(k => k.lead_rating_id).length === e.kras?.length && e.kras?.length > 0 && (
                        <CheckCircleIcon sx={{ fontSize: 13, color: '#22c55e' }} />
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            )}

            {/* Save All */}
            <Box onClick={totalDirty > 0 && !saving ? handleSaveAll : undefined} sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.8,
              px: 2.5, py: 1, borderRadius: 2,
              cursor: totalDirty > 0 ? 'pointer' : 'default',
              bgcolor: totalDirty > 0 ? BLUE : '#e2e8f0',
              color: totalDirty > 0 ? '#fff' : '#94a3b8',
              fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              '&:hover': totalDirty > 0 ? { bgcolor: ACCENT } : {},
            }}>
              {saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <SaveIcon sx={{ fontSize: 16 }} />}
              {saving ? 'Saving…' : `Save All${totalDirty > 0 ? ` (${totalDirty})` : ''}`}
            </Box>
          </Stack>
        </Stack>

        <CycleStageStepper currentStageId={currentStageId} completedStageIds={completedStageIds} />

        {/* Overall progress bar */}
        {employees.length > 0 && (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Overall lead review progress — {employees.length} employees · {totalKras} KRAs
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{overallPct}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={overallPct}
              sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
                '& .MuiLinearProgress-bar': { bgcolor: overallPct === 100 ? '#22c55e' : ACCENT } }} />
          </Box>
        )}
        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* Scrollable grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {toast.msg && <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>}
        {error     && <Alert severity="error"           sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {!canLeadReview(currentStageId) && currentStageId && (
          <Alert severity="info" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2, borderRadius: 2 }}>
            Lead ratings are locked at this stage. You can still add or edit comments on any KRA.
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: BLUE }} /></Box>
        ) : employees.length === 0 ? (
          <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 15 }}>No employees enrolled in this cycle.</Typography>
          </Paper>
        ) : (
          employees.map(emp => (
            <EmployeeSection
              key={emp.employee_id}
              emp={emp}
              ratings={ratings}
              currentStageId={currentStageId}
              dirtyMap={dirtyMap[emp.employee_id] ?? {}}
              onFieldChange={handleFieldChange}
              sectionRef={el => { sectionRefs.current[emp.employee_id] = el; }}
            />
          ))
        )}
      </Box>
    </Box>
  );
}


// ROOT — role-based entry point
export default function KRAAssessmentPage() {
  const { user } = useAuth();
  const [cycles,  setCycles]  = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [ratings, setRatings] = useState([]);

  const role = resolveRole(user); // 'employee' | 'lead' | 'hr'

  useEffect(() => {
    getCycles({ status: 'ACTIVE' }).then(res => {
      const list = res.data?.cycles ?? [];
      setCycles(list);
      if (list.length > 0) setCycleId(list[0].id);
    });
    getReferenceData().then(res => setRatings(res.data?.ratings ?? []));
  }, []);

  if (!cycleId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress sx={{ color: BLUE }} />
      </Box>
    );
  }

  if (role === 'employee') {
    return <EmployeeView cycleId={cycleId} cycles={cycles} onCycleChange={setCycleId} ratings={ratings} />;
  }

  // lead or hr → grid view
  return <LeadView cycleId={cycleId} cycles={cycles} onCycleChange={setCycleId} ratings={ratings} />;
}