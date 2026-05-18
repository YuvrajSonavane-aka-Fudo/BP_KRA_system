import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField, Select, MenuItem,
  LinearProgress, Alert, CircularProgress, Divider, Collapse,
  InputAdornment, Avatar, Table, TableBody, TableCell, TableHead, TableRow,
  Autocomplete, IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { getSelfAssessment, saveSelfAssessmentRow, getAssessmentProgress, submitLeadReview, saveLeadDescription, saveEmployeeStageDates } from '../../api/assessmentsApi';
import { getCycles, getReferenceData, advanceCycleStage } from '../../api/cyclesApi';
import { getStageStates, canSelfAssess, canLeadReview, getStageLockReason, STAGE, CYCLE_STAGES } from '../../utils/stageUtils';
import useAuth from '../../auth/useAuth';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

/* ─── RangePicker (same as CycleDetailPage) ─── */
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const gradient  = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

function toDateOnly(s) { return s ? String(s).split('T')[0].split(' ')[0].trim() : ''; }
function toISO(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmtShort(s) {
  if (!s) return null;
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function fmtFull(s) {
  if (!s) return '—';
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RangePicker({ startDate, endDate, onChange, onClose }) {
  const init = () => {
    const src = startDate;
    if (src) { const d = new Date(toDateOnly(src) + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() }; }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  };
  const [vy, setVy] = useState(() => init().y);
  const [vm, setVm] = useState(() => init().m);
  const [picking, setPicking] = useState(startDate ? 'end' : 'start');
  const [hover, setHover] = useState(null);

  const startD = startDate ? new Date(toDateOnly(startDate) + 'T00:00:00') : null;
  const endD   = endDate   ? new Date(toDateOnly(endDate)   + 'T00:00:00') : null;

  const totalDays = new Date(vy, vm+1, 0).getDate();
  const firstDay  = new Date(vy, vm, 1).getDay();
  const cells     = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i+1)];

  function disabled(d) {
    if (!d) return true;
    if (picking === 'end' && startD) {
      const s = new Date(startD); s.setHours(0,0,0,0);
      if (new Date(vy, vm, d) < s) return true;
    }
    return false;
  }
  function dayState(d) {
    if (!d) return {};
    const dt = new Date(vy, vm, d); dt.setHours(0,0,0,0);
    const st = startD ? new Date(startD).setHours(0,0,0,0) : null;
    const et = endD   ? new Date(endD).setHours(0,0,0,0)   : null;
    const ht = hover  ? new Date(vy, vm, hover).setHours(0,0,0,0) : null;
    const dtt = dt.getTime();
    const isStart = st !== null && dtt === st;
    const isEnd   = et !== null && dtt === et;
    const re = picking === 'end' && ht ? ht : et;
    const inRange = st !== null && re !== null && dtt > st && dtt < re;
    return { isStart, isEnd, inRange };
  }
  function isToday(d) { const t = new Date(); return !!d && t.getFullYear()===vy && t.getMonth()===vm && t.getDate()===d; }
  function selectDay(d) {
    const iso = toISO(vy, vm, d);
    if (picking === 'start') { onChange({ start_date: iso, end_date: '' }); setPicking('end'); }
    else { onChange({ start_date: startDate, end_date: iso }); onClose && onClose(); }
    setHover(null);
  }

  return (
    <Box sx={{
      width: 248, borderRadius: 2, overflow: 'hidden', bgcolor: '#fff',
      boxShadow: '0 12px 40px -4px rgba(15,23,42,0.18), 0 2px 8px -2px rgba(15,23,42,0.08)',
      border: '1px solid #e2e8f0',
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 1.25, py: 0.75, background: gradient }}>
        <IconButton size="small" onClick={() => vm===0 ? (setVm(11),setVy(y=>y-1)) : setVm(m=>m-1)}
          sx={{ color:'#fff', p:0.2, '&:hover':{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 } }}>
          <ChevronLeftIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{MONTHS[vm].slice(0,3)} {vy}</Typography>
        <IconButton size="small" onClick={() => vm===11 ? (setVm(0),setVy(y=>y+1)) : setVm(m=>m+1)}
          sx={{ color:'#fff', p:0.2, '&:hover':{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 } }}>
          <ChevronRightIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Stack direction="row" alignItems="center" spacing={0.4} sx={{ ml: 0.5 }}>
          {[{ key:'start', val: startDate }, { key:'end', val: endDate }].map(({ key, val }, i) => (
            <React.Fragment key={key}>
              {i === 1 && <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>→</Typography>}
              <Box onClick={() => key === 'end' && !startDate ? null : setPicking(key)}
                sx={{
                  px: 0.75, py: 0.2, borderRadius: 1,
                  bgcolor: picking === key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  cursor: key === 'end' && !startDate ? 'default' : 'pointer',
                  border: picking === key ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                  opacity: key === 'end' && !startDate ? 0.45 : 1,
                  transition: 'all 0.12s',
                }}>
                <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                  {val ? fmtShort(val) : (key === 'start' ? 'From' : 'To')}
                </Typography>
              </Box>
            </React.Fragment>
          ))}
          {(startDate || endDate) && (
            <IconButton size="small" onClick={() => onChange({ start_date: '', end_date: '' })}
              sx={{ color: 'rgba(255,255,255,0.5)', p: 0.15, ml: 0.25, '&:hover': { color: '#fff' } }}>
              <CloseIcon sx={{ fontSize: 11 }} />
            </IconButton>
          )}
        </Stack>
      </Stack>

      <Box sx={{ px: 1.25, pt: 0.75, pb: 0.75 }}>
        <Stack direction="row" mb={0.4}>
          {WEEK_DAYS.map(d => (
            <Box key={d} sx={{ flex:1, textAlign:'center' }}>
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.02em' }}>{d}</Typography>
            </Box>
          ))}
        </Stack>
        {Array.from({ length: Math.ceil(cells.length/7) }, (_,ri) => (
          <Stack key={ri} direction="row" sx={{ mb: 0.1 }}>
            {cells.slice(ri*7, ri*7+7).map((d,ci) => {
              const dis = disabled(d);
              const { isStart, isEnd, inRange } = dayState(d);
              const today = isToday(d);
              const hi = isStart || isEnd;
              return (
                <Box key={ci} sx={{ flex:1, display:'flex', justifyContent:'center' }}>
                  {d ? (
                    <Box
                      onClick={() => !dis && selectDay(d)}
                      onMouseEnter={() => !dis && picking==='end' && setHover(d)}
                      onMouseLeave={() => setHover(null)}
                      sx={{
                        width: 26, height: 26,
                        borderRadius: hi ? '50%' : inRange ? 0 : '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: dis ? 'not-allowed' : 'pointer',
                        bgcolor: hi ? '#1E3A8A' : inRange ? '#dbeafe' : 'transparent',
                        color: hi ? '#fff' : dis ? '#cbd5e1' : today ? '#1E3A8A' : '#374151',
                        fontWeight: hi ? 700 : today ? 700 : 400,
                        fontSize: 11,
                        outline: today && !hi ? '1.5px solid #93c5fd' : 'none',
                        outlineOffset: '-1px',
                        transition: 'background 0.1s',
                        '&:hover': !dis ? { bgcolor: hi ? '#1E3A8A' : '#eff6ff', color: hi ? '#fff' : '#1E3A8A', fontWeight: 600 } : {},
                      }}
                    >
                      {d}
                    </Box>
                  ) : <Box sx={{ width: 26, height: 26 }} />}
                </Box>
              );
            })}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

/* ─── InlineStageRow — Image 2 style: [stage name col] | [calendar pill col] ─── */
function InlineStageRow({ stageData, isTarget, onRangeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popupRef = useRef(null);
  const bothSet = !!stageData.start_date && !!stageData.end_date;

  useEffect(() => {
    if (!open) return;
    function h(e) {
      if (ref.current && !ref.current.contains(e.target) &&
          popupRef.current && !popupRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (!open || !popupRef.current || !ref.current) return;
    const POPUP_W = 248, POPUP_H = 270, GAP = 6;
    const vw = window.innerWidth, vh = window.innerHeight;
    const tr = ref.current.getBoundingClientRect();
    let top = tr.bottom + GAP, left = tr.left;
    if (top + POPUP_H > vh - 8) top = tr.top - POPUP_H - GAP;
    if (left + POPUP_W > vw - 8) left = vw - POPUP_W - 8;
    if (left < 8) left = 8;
    popupRef.current.style.top = top + 'px';
    popupRef.current.style.left = left + 'px';
  }, [open]);

  return (
    <Stack ref={ref} direction="row" alignItems="center" sx={{
      borderRadius: 2,
      border: isTarget ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
      bgcolor: isTarget ? '#eff6ff' : '#fff',
      overflow: 'visible',
      position: 'relative',
      transition: 'border-color 0.15s',
    }}>
      {/* Left: stage name */}
      <Box sx={{ px: 2, py: 1.25, minWidth: 170, flexShrink: 0, borderRight: '1px solid #e2e8f0' }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          {isTarget && (
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#3b82f6', flexShrink: 0 }} />
          )}
          <Typography fontSize={13} fontWeight={isTarget ? 700 : 500} color={isTarget ? BLUE : '#374151'}>
            {stageData.name}
          </Typography>
        </Stack>
      </Box>

      {/* Right: calendar pill */}
      <Stack direction="row" alignItems="center" spacing={1} flex={1}
        onClick={() => setOpen(o => !o)}
        sx={{
          px: 1.5, py: 1.1, cursor: 'pointer',
          borderRadius: '0 8px 8px 0',
          '&:hover': { bgcolor: isTarget ? 'rgba(219,234,254,0.3)' : '#f8fafc' },
          transition: 'background 0.12s',
        }}>
        <CalendarMonthIcon sx={{ fontSize: 14, color: bothSet ? BLUE : '#94a3b8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, color: bothSet ? '#1e293b' : '#94a3b8', flex: 1, userSelect: 'none' }}>
          {bothSet ? (
            <><span style={{ fontWeight: 600 }}>{fmtShort(stageData.start_date)}</span>
            {' '}<span style={{ color: '#94a3b8' }}>→</span>{' '}
            <span style={{ fontWeight: 600 }}>{fmtShort(stageData.end_date)}</span></>
          ) : 'Set date range…'}
        </Typography>
        {bothSet && (
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); onRangeChange(stageData.stage_id, { start_date: '', end_date: '' }); }}
            sx={{ p: 0.25, color: '#cbd5e1', '&:hover': { color: '#64748b' } }}>
            <CloseIcon sx={{ fontSize: 11 }} />
          </IconButton>
        )}
      </Stack>

      {/* Floating calendar popup */}
      {open && (
        <Box ref={popupRef} sx={{ position: 'fixed', zIndex: 99999 }}>
          <RangePicker
            startDate={stageData.start_date}
            endDate={stageData.end_date}
            onChange={({ start_date, end_date }) => {
              onRangeChange(stageData.stage_id, { start_date, end_date });
              if (start_date && end_date) setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </Box>
      )}
    </Stack>
  );
}

const NAVY = '#0f1b4c';
const BLUE = '#1E3A8A';
const ACCENT = '#3b82f6';

const CATEGORY_COLORS = {
  'Core Development': '#3b82f6',
  'Behavioural': '#8b5cf6',
  'Leadership': '#f59e0b',
  'Strategic': '#10b981',
  'Technical': '#ef4444',
  'default': '#6366f1',
};
function categoryColor(name) { return CATEGORY_COLORS[name] || CATEGORY_COLORS.default; }
function initials(name = '') { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'; }

// ── Role helpers ──────────────────────────────────────────────────────────────
const HR_ROLES = ['Admin', 'HR', 'Vertical Lead'];
const LEAD_ROLES = ['Manager', 'Team Lead'];

function resolveRole(user) {
  const roles = user?.roles ?? [];
  const isHR = roles.some(r => HR_ROLES.includes(r));
  const isLead = roles.some(r => LEAD_ROLES.includes(r));
  if (isHR) return 'hr';
  if (isLead) return 'lead';
  return 'employee';
}

// ── Shared: Stage stepper ─────────────────────────────────────────────────────
function CycleStageStepper({ currentStageId, completedStageIds, dbStages, isAdmin, onStageClick }) {
  const stages = (dbStages && dbStages.length > 0) ? dbStages : CYCLE_STAGES;
  if (!currentStageId) return null;
  const states = stages.map(stage => {
    const isCurrent = stage.id === currentStageId;
    const isDone = completedStageIds?.length
      ? completedStageIds.includes(stage.id)
      : stage.id < currentStageId;
    return { ...stage, isDone, isCurrent, isFuture: !isDone && !isCurrent };
  });

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0, mt: 2 }}>
      {states.map((stage, i) => {
        const isLast = i === states.length - 1;
        const clickable = isAdmin && onStageClick && !stage.isCurrent;
        return (
          <React.Fragment key={stage.id}>
            <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 72 }}>
              <Tooltip title={clickable ? (stage.id < currentStageId ? `Move back to ${stage.name}` : `Advance to ${stage.name}`) : stage.name}>
                <Box onClick={clickable ? () => onStageClick(stage) : undefined} sx={{
                  width: 32, height: 32, borderRadius: '50%',
                  bgcolor: stage.isCurrent ? BLUE : stage.isDone ? '#22c55e' : '#e2e8f0',
                  border: stage.isCurrent ? `3px solid ${ACCENT}` : stage.isDone ? '3px solid #22c55e' : '3px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: stage.isCurrent ? `0 0 0 3px rgba(59,130,246,0.2)` : 'none',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  '&:hover': clickable ? { opacity: 0.8, transform: 'scale(1.08)' } : {},
                }}>
                  {stage.isDone
                    ? <CheckCircleIcon sx={{ fontSize: 16, color: '#fff' }} />
                    : <Typography sx={{ fontSize: 10, fontWeight: 800, color: stage.isCurrent ? '#fff' : '#94a3b8' }}>{stage.id}</Typography>
                  }
                </Box>
              </Tooltip>
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

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE VIEW
// ══════════════════════════════════════════════════════════════════════════════

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
  const [selfRatingId, setSelfRatingId] = useState(row.self_rating_id ?? '');
  const [selfComment, setSelfComment] = useState(row.self_comment ?? '');
  const [progressNotes, setProgressNotes] = useState(row.progress_notes ?? '');
  const [help, setHelp] = useState(row.help_and_assistance_required ?? '');
  const [showHelp, setShowHelp] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isSaving = saving && savedId === row.employee_kra_level_id;
  const isDone = !!selfRatingId && !!selfComment;

  useEffect(() => { setDirty(false); }, [editable]);
  function handleChange(setter) { return (val) => { setter(val); setDirty(true); }; }

  function handleSave() {
    onSave(row.employee_kra_level_id, {
      self_rating_id: selfRatingId || null,
      self_comment: selfComment || null,
      progress_notes: progressNotes || null,
      help_and_assistance_required: help || null,
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
  const pct = total ? Math.round((rated / total) * 100) : 0;
  const avgRatings = kras.filter(k => k.self_rating).map(k => k.self_rating);
  const avgDisplay = avgRatings.length ? (avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length).toFixed(1) : '—';

  return (
    <Box>
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
                : <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: '#141414', flexShrink: 0 }} />
              }
              <Typography sx={{ fontSize: 12, color: k.self_rating_id ? '#1e293b' : '#010101', fontWeight: k.self_rating_id ? 600 : 400, flex: 1 }} noWrap>
                {k.kra_name}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

function EmployeeView({ cycleId, cycles, onCycleChange, ratings, dbStages, hideCycleHeader = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ msg: '', severity: 'success' });
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

  const kras = data?.kras ?? [];
  const cycle = cycles.find(c => c.id === cycleId);
  const currentStageId = data?.employee_stage_id ?? data?.current_stage?.id ?? null;
  const completedStageIds = data?.completed_stage_ids ?? [];
  const editable = canSelfAssess(currentStageId);
  const lockReason = !editable && currentStageId ? getStageLockReason(currentStageId, 'employee') : null;
  const showLeadRating = currentStageId >= STAGE.LEAD_ASSESSMENT;

  const stageDeadline = data?.stage_end_date ?? null;
  const stageName = (dbStages?.find(s => s.id === currentStageId) ?? CYCLE_STAGES.find(s => s.id === currentStageId))?.name;

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
            {cycles.length > 0 && (
              <Select value={cycleId} onChange={e => onCycleChange(e.target.value)}
                size="small" sx={{ minWidth: 180, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
                {cycles.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
              </Select>
            )}
          </Stack>
          <CycleStageStepper
            currentStageId={currentStageId}
            completedStageIds={completedStageIds}
            dbStages={dbStages}
          />
          {editable && stageDeadline && (
            <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2, fontSize: 13 }}>
              <strong>{stageName} is open.</strong> Your personal deadline: {new Date(stageDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
            </Alert>
          )}
          <Divider sx={{ mt: 2 }} />
        </Box>
      )}
      {hideCycleHeader && (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 0, flexShrink: 0 }}>
          {cycles.length > 0 && (
            <Stack direction="row" justifyContent="flex-end" mb={1}>
              <Select value={cycleId} onChange={e => onCycleChange(e.target.value)}
                size="small" sx={{ minWidth: 180, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
                {cycles.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
              </Select>
            </Stack>
          )}
          <CycleStageStepper
            currentStageId={currentStageId}
            completedStageIds={completedStageIds}
            dbStages={dbStages}
          />
          {editable && stageDeadline && (
            <Alert severity="info" sx={{ mt: 1, borderRadius: 2, fontSize: 13 }}>
              <strong>{stageName} is open.</strong> Your personal deadline: {new Date(stageDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
            </Alert>
          )}
          <Divider sx={{ mt: 1 }} />
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2, minWidth: 0 }}>
          {!loading && lockReason && (
            <Alert severity="warning" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 2, borderRadius: 2 }}>
              {lockReason} Your responses are shown in read-only mode.
            </Alert>
          )}
          {toast.msg && <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: BLUE }} /></Box>}

          {!loading && !error && (
            kras.length === 0 ? (
              <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 6, textAlign: 'center' }}>
                <Typography sx={{ color: '#94a3b8', fontSize: 15 }}>No KRAs have been assigned to you for this cycle yet.</Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {kras.map(row => (
                  <KRACard key={row.employee_kra_level_id} row={row} ratings={ratings}
                    onSave={handleSave} saving={saving} savedId={savedId}
                    editable={editable} showLeadRating={false}
                    kraRef={el => { kraRefs.current[row.employee_kra_level_id] = el; }}
                  />
                ))}
              </Stack>
            )
          )}
        </Box>

        <Box sx={{
          width: 300, flexShrink: 0,
          display: { xs: 'none', lg: 'block' },
          overflowY: 'auto', py: 2, pr: 3,
        }}>
          <ProgressSidebar kras={kras} onJumpTo={handleJumpTo} />
        </Box>
      </Box>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INLINE STAGE STEPPER — used inside Team Review per-employee rows
// ══════════════════════════════════════════════════════════════════════════════
function InlineStageStepper({ currentStageId, cycleId, employeeId, ekcId, cycleStages, isAdmin, dbStages, onStageChanged }) {
  const [stageChanging, setStageChanging] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, direction: null, toStage: null });
  const [toast, setToast] = useState('');
  const [overrideStages, setOverrideStages] = useState([]);
  const [dateSaving, setDateSaving] = useState(false);

  const stages = (dbStages && dbStages.length > 0) ? dbStages : CYCLE_STAGES;
  const currentIdx = stages.findIndex(s => s.id === currentStageId);

  function openStageDialog(toStage) {
    const direction = toStage.id < currentStageId ? 'back' : 'forward';
    if (direction === 'back') {
      const prefilled = stages.map(s => ({
        stage_id: s.id,
        name: s.name,
        start_date: cycleStages?.find(cs => cs.stage_id === s.id)?.start_date?.split('T')[0] ?? '',
        end_date: cycleStages?.find(cs => cs.stage_id === s.id)?.end_date?.split('T')[0] ?? '',
      }));
      setOverrideStages(prefilled);
    }
    setConfirmDialog({ open: true, direction, toStage });
  }

  async function doStageChange(toStageId) {
    setStageChanging(true);
    try {
      await advanceCycleStage(cycleId, {
        target_stage_id: toStageId,
        employee_ids: [employeeId],
      });
      onStageChanged(toStageId);

      if (confirmDialog.direction === 'back' && overrideStages.length && ekcId) {
        setDateSaving(true);
        await saveEmployeeStageDates(ekcId, overrideStages.map(s => ({
          stage_id: s.stage_id,
          start_date: s.start_date,
          end_date: s.end_date,
        })));
      }
    } catch (err) {
      setToast(err?.response?.data?.error || 'Failed');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setStageChanging(false);
      setDateSaving(false);
      setConfirmDialog({ open: false, direction: null, toStage: null });
    }
  }

  function handleDateChange(stageId, { start_date, end_date }) {
    setOverrideStages(prev => prev.map(s =>
      s.stage_id === stageId
        ? { ...s, ...(start_date !== undefined ? { start_date } : {}), ...(end_date !== undefined ? { end_date } : {}) }
        : s
    ));
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      {/* Clickable dots stepper */}
      <Stack direction="row" alignItems="center" spacing={0}>
        {stages.map((stage, i) => {
          const isDone = stage.id < currentStageId;
          const isCurrent = stage.id === currentStageId;
          const isLast = i === stages.length - 1;
          const clickable = isAdmin && !isCurrent;

          return (
            <React.Fragment key={stage.id}>
              <Tooltip title={
                !isAdmin ? stage.name
                  : isCurrent ? `Current: ${stage.name}`
                  : stage.id < currentStageId ? `Move back to: ${stage.name}`
                  : `Advance to: ${stage.name}`
              }>
                <Stack alignItems="center" spacing={0.3} sx={{ minWidth: 52 }}
                  onClick={clickable ? e => { e.stopPropagation(); openStageDialog(stage); } : undefined}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                >
                  <Box sx={{
                    width: isCurrent ? 26 : 20, height: isCurrent ? 26 : 20,
                    borderRadius: '50%',
                    bgcolor: isDone ? '#22c55e' : isCurrent ? BLUE : '#e2e8f0',
                    border: isCurrent ? `2.5px solid ${ACCENT}` : isDone ? '2px solid #22c55e' : '2px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isCurrent ? `0 0 0 3px rgba(59,130,246,0.15)` : 'none',
                    transition: 'all 0.2s', flexShrink: 0,
                    '&:hover': clickable ? { opacity: 0.75, transform: 'scale(1.1)' } : {},
                  }}>
                    {isDone
                      ? <CheckCircleIcon sx={{ fontSize: 12, color: '#fff' }} />
                      : <Typography sx={{ fontSize: 8, fontWeight: 800, color: isCurrent ? '#fff' : '#94a3b8' }}>{stage.id}</Typography>
                    }
                  </Box>
                  <Typography sx={{
                    fontSize: 8, fontWeight: isCurrent ? 700 : 400,
                    color: isCurrent ? BLUE : isDone ? '#22c55e' : '#94a3b8',
                    textAlign: 'center', lineHeight: 1.2, maxWidth: 48,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>{stage.name}</Typography>
                </Stack>
              </Tooltip>
              {!isLast && (
                <Box sx={{ flex: 1, height: 1.5, bgcolor: isDone ? '#22c55e' : '#e2e8f0', mt: '-10px', mx: 0.3, transition: 'background 0.3s', minWidth: 8 }} />
              )}
            </React.Fragment>
          );
        })}
      </Stack>

      {isAdmin && (
        <Typography sx={{ fontSize: 10, color: '#94a3b8', mt: 0.75, textAlign: 'center' }}>
          {stageChanging ? 'Updating…' : 'Click a stage dot to move employee'}
        </Typography>
      )}

      {toast && <Typography sx={{ fontSize: 10, color: '#64748b', mt: 0.5 }}>{toast}</Typography>}

      {/* ─── Stage change dialog — unified blue theme ─── */}
      <Dialog open={confirmDialog.open} onClose={() => !stageChanging && setConfirmDialog({ open: false })}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px -10px rgba(15,23,42,0.2)' } }}>

        {/* Header — always blue */}
        <Box sx={{
          px: 3, pt: 2.5, pb: 2,
          bgcolor: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{
              width: 32, height: 32, borderRadius: '50%',
              bgcolor: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                {confirmDialog.direction === 'back' ? '←' : '→'}
              </Typography>
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={15} color={BLUE}>
                {confirmDialog.direction === 'back'
                  ? `Move Back to ${confirmDialog.toStage?.name}`
                  : `Move Forward to ${confirmDialog.toStage?.name}`}
              </Typography>
              <Typography fontSize={12} color="#64748b" mt={0.2}>
                {confirmDialog.direction === 'back'
                  ? "Set this employee's personal stage dates"
                  : 'This employee will advance to the next stage'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ pt: 2, pb: 1, px: 3, overflow: 'visible' }}>
          {confirmDialog.direction === 'back' ? (
            <>
              <Typography fontSize={13} color="#374151" mb={2} sx={{ lineHeight: 1.6 }}>
                Adjust stage dates for this employee. These will override cycle-level dates only for them.
              </Typography>
              <Stack spacing={0.75}>
                {overrideStages.map((s) => (
                  <InlineStageRow
                    key={s.stage_id}
                    stageData={s}
                    isTarget={s.stage_id === confirmDialog.toStage?.id}
                    onRangeChange={handleDateChange}
                  />
                ))}
              </Stack>
            </>
          ) : (
            <Typography fontSize={13} color="#374151" sx={{ lineHeight: 1.6 }}>
              Move this employee forward to <strong>{confirmDialog.toStage?.name}</strong>? This will advance them by one stage.
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
          <Button
            onClick={() => setConfirmDialog({ open: false })}
            disabled={stageChanging}
            sx={{
              textTransform: 'none', color: '#64748b', fontWeight: 600, fontSize: 13,
              borderRadius: 2, px: 2,
              '&:hover': { bgcolor: '#f1f5f9' },
            }}>
            Cancel
          </Button>
          <Button
            onClick={() => doStageChange(confirmDialog.toStage?.id)}
            variant="contained"
            disabled={stageChanging || dateSaving}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: 13,
              borderRadius: 2, px: 3,
              bgcolor: BLUE,
              boxShadow: 'none',
              '&:hover': { bgcolor: ACCENT, boxShadow: 'none' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}>
            {stageChanging ? <><CircularProgress size={13} sx={{ color: 'rgba(255,255,255,0.7)', mr: 1 }} />Moving…</>
              : dateSaving ? 'Saving dates…'
              : confirmDialog.direction === 'back' ? 'Confirm & Save Dates' : 'Confirm Move Forward'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EmployeeSection({ emp, ratings, currentStageId, cycleId, cycleStages, isAdmin, dbStages, dirtyMap, onFieldChange, sectionRef }) {
  const [collapsed, setCollapsed] = useState(true);
  const [empStageId, setEmpStageId] = useState(emp.current_stage_id ?? currentStageId);

  const kras = emp.kras ?? [];
  const reviewed = kras.filter(k => k.lead_rating_id || dirtyMap[k.employee_kra_level_id]?.lead_rating_id).length;
  const pct = kras.length ? Math.round((reviewed / kras.length) * 100) : 0;

  const ratingEditable = canLeadReview(empStageId);

  return (
    <Box ref={sectionRef} sx={{ mb: 3, scrollMarginTop: '80px' }}>
      {/* Employee header row */}
      <Box
        onClick={() => setCollapsed(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 2,
          px: 2.5, py: 1.5, cursor: 'pointer',
          bgcolor: '#cde7f0', borderRadius: collapsed ? 2 : '8px 8px 0 0',
          transition: 'border-radius 0.2s',
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: ACCENT, fontSize: 13, fontWeight: 800 }}>
          {initials(emp.full_name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1a1818' }}>{emp.full_name}</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.5)' }}>
            Manager: {emp.manager_name || '—'} &nbsp;·&nbsp; {emp.department || '—'} &nbsp;·&nbsp; {emp.level || '—'}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Chip
            label={`Stage ${empStageId}`}
            size="small"
            sx={{
              bgcolor: empStageId !== currentStageId ? '#dbeafe' : 'rgba(255,255,255,0.15)',
              color: empStageId !== currentStageId ? BLUE : '#fff',
              fontWeight: 700, fontSize: 10, border: 'none',
            }}
          />
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.5)', mb: 0.3 }}>Lead Reviewed</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#4ade80' : '#000000' }}>
              {reviewed}/{kras.length}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct}
            sx={{
              width: 80, height: 5, borderRadius: 3, bgcolor: '#ffffff80 ',border: '1.5px solid rgba(0,0,0,0.4)', borderColor : '#000000',
              '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#4ade80' : ACCENT }
            }} />
          {collapsed ? <ExpandMoreIcon sx={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: 20 }} /> : <ExpandLessIcon sx={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: 20 }} />}
        </Stack>
      </Box>

      {/* Inline stage stepper */}
      {!collapsed && (
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <InlineStageStepper
            currentStageId={empStageId}
            cycleId={cycleId}
            employeeId={emp.employee_id}
            ekcId={emp.employee_kra_cycle_id}
            cycleStages={cycleStages}
            isAdmin={isAdmin}
            dbStages={dbStages}
            onStageChanged={newStageId => {
              emp.current_stage_id = newStageId;
              setEmpStageId(newStageId);
            }}
          />
        </Box>
      )}

      {/* KRA grid table */}
      {!collapsed && (
        <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {kras.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ color: '#292a2c', fontSize: 13 }}>No KRAs assigned.</Typography>
            </Box>
          ) : (
            /* Scrollbar-on-top trick: outer box is flipped, inner is flipped back */
            <Box sx={{
              transform: 'rotateX(180deg)',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}>
              <Box sx={{
                transform: 'rotateX(180deg)',
                maxHeight: 420,
                overflowY: 'auto',
                overflowX: 'visible',
              }}>
                <Table size="small" sx={{ minWidth: 1300 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Category', 'KRA', 'Description by Lead', 'Self Rating', 'Self Comment', 'Progress Notes', 'Help & Assistance', 'Lead Rating', 'Lead Comment'].map(h => (
                        <TableCell key={h} sx={{
                          fontSize: 10, fontWeight: 700, color: '#1b1c1c',
                          textTransform: 'uppercase', letterSpacing: '0.07em',
                          py: 1, borderBottom: '1.5px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          top: 0,
                          bgcolor: '#f8fafc',
                          zIndex: 2,
                        }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                <TableBody>
                  {kras.map((kra, idx) => {
                    const dirty = dirtyMap[kra.employee_kra_level_id] ?? {};
                    const leadRating = dirty.lead_rating_id ?? kra.lead_rating_id ?? '';
                    const leadComment = dirty.lead_comment ?? kra.lead_comment ?? '';
                    const selfRatingLabel = ratings.find(r => r.id === kra.self_rating_id);
                    const isDirty = !!dirtyMap[kra.employee_kra_level_id];

                    return (
                      <TableRow key={kra.employee_kra_level_id}
                        sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#fafbff', verticalAlign: 'top' }}>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 110 }}>
                          {kra.category_name ? (
                            <Chip label={kra.category_name} size="small"
                              sx={{ bgcolor: `${categoryColor(kra.category_name)}15`, color: categoryColor(kra.category_name), fontWeight: 700, fontSize: 10, border: `1px solid ${categoryColor(kra.category_name)}30` }} />
                          ) : '—'}
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 160 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>{kra.kra_name}</Typography>
                          {kra.weightage && <Typography sx={{ fontSize: 10, color: '#2b2c2d', mt: 0.3 }}>{kra.weightage}%</Typography>}
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 200 }}>
                          <TextField multiline minRows={2} fullWidth size="small"
                            placeholder="Add description…"
                            defaultValue={kra.description_by_lead ?? ''}
                            onBlur={e => {
                              const val = e.target.value;
                              if (val !== (kra.description_by_lead ?? '')) {
                                onFieldChange(emp.employee_id, kra.employee_kra_level_id, 'description_by_lead', val);
                              }
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { fontSize: 12, borderRadius: 1.5, '&:hover fieldset': { borderColor: ACCENT }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
                          />
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 100 }}>
                          {kra.self_rating_id ? (
                            <Chip label={selfRatingLabel ? `${kra.self_rating} – ${selfRatingLabel.description}` : kra.self_rating}
                              size="small" sx={{ bgcolor: '#eff6ff', color: BLUE, fontWeight: 700, fontSize: 10 }} />
                          ) : (
                            <Typography sx={{ fontSize: 11, color: '#111112', fontStyle: 'italic' }}>Pending</Typography>
                          )}
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 200 }}>
                          <Typography sx={{ fontSize: 12, lineHeight: 1.5, fontStyle: kra.self_comment ? 'normal' : 'italic', color: kra.self_comment ? '#000000' : '#000000' }}>
                            {kra.self_comment || 'No comment'}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 160 }}>
                          <Typography sx={{ fontSize: 12, lineHeight: 1.5, fontStyle: kra.progress_notes ? 'normal' : 'italic', color: kra.progress_notes ? '#000000' : '#000000' }}>
                            {kra.progress_notes || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 160 }}>
                          <Typography sx={{ fontSize: 12, lineHeight: 1.5, fontStyle: kra.help_and_assistance_required ? 'normal' : 'italic', color: kra.help_and_assistance_required ? '#000000' : '#000000' }}>
                            {kra.help_and_assistance_required || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 150 }}>
                          {ratingEditable ? (
                            <Select value={leadRating}
                              onChange={e => onFieldChange(emp.employee_id, kra.employee_kra_level_id, 'lead_rating_id', e.target.value)}
                              displayEmpty size="small" fullWidth
                              sx={{ fontSize: 12, borderRadius: 1.5, '& .MuiOutlinedInput-notchedOutline': { borderColor: leadRating ? '#22c55e' : '#e2e8f0' } }}>
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
                              <Typography sx={{ fontSize: 11, color: '#191a1b', fontStyle: 'italic' }}>Not rated</Typography>
                            )
                          )}
                        </TableCell>

                        <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 220 }}>
                          <TextField multiline minRows={2} fullWidth size="small"
                            placeholder="Add comment…"
                            value={leadComment}
                            onChange={e => onFieldChange(emp.employee_id, kra.employee_kra_level_id, 'lead_comment', e.target.value)}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                fontSize: 12, borderRadius: 1.5,
                                '&:hover fieldset': { borderColor: ACCENT },
                                '&.Mui-focused fieldset': { borderColor: ACCENT },
                                ...(isDirty ? { '& fieldset': { borderColor: '#93c5fd' } } : {}),
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </Box>  
            </Box>  /* outer rotated box */
          )}
        </Paper>
      )}
    </Box>
  );
}

function LeadView({ cycleId, cycles, onCycleChange, ratings, dbStages }) {
  const [tab, setTab] = useState('self');
  const { user } = useAuth();
  const isAdmin = HR_ROLES.some(r => user?.roles?.includes(r));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ msg: '', severity: 'success' });
  const [dirtyMap, setDirtyMap] = useState({});
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [allEmployees, setAllEmployees] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [allEmployeesList, setAllEmployeesList] = useState([]);

  useEffect(() => {
    if (!cycleId) return;
    getAssessmentProgress(cycleId, null, 1, 200)
      .then(res => setAllEmployeesList(res.data?.employees ?? []))
      .catch(() => { });
  }, [cycleId]);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true); setError(''); setDirtyMap({});
    setPage(1); setAllEmployees([]);
    getAssessmentProgress(cycleId, null, 1, 20)
      .then(res => {
        setData(res.data);
        setAllEmployees(res.data?.employees ?? []);
        setHasMore(res.data?.pagination?.has_next ?? false);
        const emps = res.data?.employees ?? [];
        if (emps.length > 0) setSelectedEmpId(emps[0].employee_id);
      })
      .catch(err => setError(err?.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  async function loadMore() {
    const nextPage = page + 1;
    const res = await getAssessmentProgress(cycleId, null, nextPage, 20);
    setAllEmployees(prev => [...prev, ...(res.data?.employees ?? [])]);
    setHasMore(res.data?.pagination?.has_next ?? false);
    setPage(nextPage);
  }

  const sectionRefs = useRef({});

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
        if (Object.keys(payload).length === 0) continue;
        const { description_by_lead, ...reviewPayload } = payload;
        if (description_by_lead !== undefined) {
          promises.push(saveLeadDescription(kraLevelId, { description_by_lead }));
        }
        if (Object.keys(reviewPayload).length > 0) {
          promises.push(submitLeadReview(kraLevelId, reviewPayload));
        }
      }
    }
    try {
      await Promise.all(promises);
      const applyPatches = emps => emps.map(emp => ({
        ...emp,
        kras: emp.kras.map(k => {
          const patch = dirtyMap[emp.employee_id]?.[k.employee_kra_level_id];
          return patch ? { ...k, ...patch } : k;
        }),
      }));
      setData(prev => ({ ...prev, employees: applyPatches(prev?.employees ?? []) }));
      setAllEmployees(prev => applyPatches(prev));
      setDirtyMap({});
      setToast({ msg: 'Saved successfully', severity: 'success' });
    } catch (err) {
      setToast({ msg: err?.response?.data?.error || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast({ msg: '', severity: 'success' }), 4000);
    }
  }

  async function handleJumpToEmployee(empId) {
    setSelectedEmpId(empId);
    const existing = allEmployees.find(e => e.employee_id === empId);
    if (existing) {
      setTimeout(() => {
        const el = sectionRefs.current[empId];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }
    try {
      const res = await getAssessmentProgress(cycleId, empId, 1, 1);
      const fetched = res.data?.employees?.[0];
      if (fetched) {
        setAllEmployees(prev => [...prev, fetched]);
        setTimeout(() => {
          const el = sectionRefs.current[empId];
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (err) { console.error('Failed to load employee', err); }
  }

  const employees = allEmployees;
  const cycle = cycles.find(c => c.id === cycleId);
  const currentStageId = data?.current_stage_id ?? data?.current_stage?.id ?? cycle?.current_stage_id ?? null;
  const completedStageIds = data?.completed_stage_ids ?? [];
  const totalDirty = Object.values(dirtyMap).reduce((acc, kraMap) => acc + Object.keys(kraMap).length, 0);
  const totalReviewed = employees.reduce((acc, emp) => acc + (emp.kras?.filter(k => k.lead_rating_id).length ?? 0), 0);
  const totalKras = employees.reduce((acc, emp) => acc + (emp.kras?.length ?? 0), 0);
  const overallPct = totalKras ? Math.round((totalReviewed / totalKras) * 100) : 0;

  const sortedEmployees = [...allEmployees].sort((a, b) => {
    let valA, valB;
    if (sortBy === 'name') {
      valA = (a.full_name ?? '').toLowerCase();
      valB = (b.full_name ?? '').toLowerCase();
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (sortBy === 'lead_progress') {
      const ratedA = a.kras?.filter(k => k.lead_rating_id).length ?? 0;
      const ratedB = b.kras?.filter(k => k.lead_rating_id).length ?? 0;
      valA = a.kras?.length ? ratedA / a.kras.length : 0;
      valB = b.kras?.length ? ratedB / b.kras.length : 0;
    }
    if (sortBy === 'self_progress') {
      const ratedA = a.kras?.filter(k => k.self_rating_id).length ?? 0;
      const ratedB = b.kras?.filter(k => k.self_rating_id).length ?? 0;
      valA = a.kras?.length ? ratedA / a.kras.length : 0;
      valB = b.kras?.length ? ratedB / b.kras.length : 0;
    }
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  if (tab === 'self') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>
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
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <EmployeeView cycleId={cycleId} cycles={cycles} onCycleChange={onCycleChange} ratings={ratings} dbStages={dbStages} hideCycleHeader />
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
            {cycles.length > 0 && (
              <Select value={cycleId} onChange={e => onCycleChange(e.target.value)}
                size="small" sx={{ minWidth: 180, fontSize: 13, borderRadius: 2, bgcolor: '#fff' }}>
                {cycles.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
              </Select>
            )}

            {employees.length > 0 && (
              <Autocomplete
                value={allEmployeesList.find(e => e.employee_id === selectedEmpId) ?? null}
                onChange={(_, newVal) => { if (newVal) handleJumpToEmployee(newVal.employee_id); }}
                options={allEmployeesList}
                getOptionLabel={e => e.full_name ?? ''}
                isOptionEqualToValue={(opt, val) => opt.employee_id === val.employee_id}
                size="small"
                disableClearable
                sx={{ minWidth: 220 }}
                renderInput={params => (
                  <TextField {...params} placeholder="Jump to employee…"
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: 13, borderRadius: 2, bgcolor: '#fff' } }}
                  />
                )}
                renderOption={(props, e) => (
                  <Box component="li" {...props} key={e.employee_id}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 22, height: 22, bgcolor: BLUE, fontSize: 9, fontWeight: 800 }}>
                        {initials(e.full_name)}
                      </Avatar>
                      <Typography sx={{ fontSize: 13 }}>{e.full_name}</Typography>
                      {e.kras?.filter(k => k.lead_rating_id).length === e.kras?.length && e.kras?.length > 0 && (
                        <CheckCircleIcon sx={{ fontSize: 13, color: '#22c55e', ml: 'auto !important' }} />
                      )}
                    </Stack>
                  </Box>
                )}
              />
            )}

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

        <CycleStageStepper
          currentStageId={currentStageId}
          completedStageIds={completedStageIds}
          dbStages={dbStages}
        />

        {employees.length > 0 && (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Overall lead review progress — {employees.length} employees · {totalKras} KRAs
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{overallPct}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={overallPct}
              sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: overallPct === 100 ? '#22c55e' : ACCENT } }} />
          </Box>
        )}
        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* Scrollable grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>

        {allEmployees.length > 1 && !loading && (
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b', flexShrink: 0 }}>Sort by:</Typography>
            {[
              { key: 'name', label: 'Name' },
              { key: 'lead_progress', label: 'Lead Review Progress' },
              { key: 'self_progress', label: 'Self-Assessment Progress' },
            ].map(opt => {
              const active = sortBy === opt.key;
              return (
                <Box key={opt.key}
                  onClick={() => {
                    if (active) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
                    else { setSortBy(opt.key); setSortDir(opt.key === 'name' ? 'asc' : 'desc'); }
                  }}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1.5, py: 0.5, borderRadius: 2, cursor: 'pointer',
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    bgcolor: active ? `${BLUE}12` : '#f1f5f9',
                    color: active ? BLUE : '#64748b',
                    border: `1.5px solid ${active ? BLUE : '#e2e8f0'}`,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: BLUE, color: BLUE, bgcolor: `${BLUE}08` },
                  }}>
                  {opt.label}
                  {active && <Box component="span" sx={{ fontSize: 11, ml: 0.3 }}>{sortDir === 'asc' ? '↑' : '↓'}</Box>}
                </Box>
              );
            })}
          </Stack>
        )}

        {toast.msg && <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

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
          <>
            {sortedEmployees.map(emp => (
              <EmployeeSection
                key={emp.employee_id}
                emp={emp}
                ratings={ratings}
                currentStageId={currentStageId}
                cycleId={cycleId}
                cycleStages={data?.cycle_stages ?? []}
                isAdmin={isAdmin}
                dbStages={dbStages}
                dirtyMap={dirtyMap[emp.employee_id] ?? {}}
                onFieldChange={handleFieldChange}
                sectionRef={el => { sectionRefs.current[emp.employee_id] = el; }}
              />
            ))}
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <Box onClick={loadMore} sx={{
                  px: 3, py: 1, borderRadius: 2, cursor: 'pointer',
                  bgcolor: BLUE, color: '#fff', fontSize: 13, fontWeight: 600,
                  '&:hover': { bgcolor: ACCENT },
                }}>
                  Load More Employees
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT — role-based entry point
// ══════════════════════════════════════════════════════════════════════════════
export default function KRAAssessmentPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [ratings, setRatings] = useState([]);
  const [dbStages, setDbStages] = useState([]);

  const role = resolveRole(user);

  useEffect(() => {
    getCycles().then(res => {
      const list = res.data?.cycles ?? [];
      setCycles(list);
      if (list.length > 0) setCycleId(list[0].id);
    });
    getReferenceData().then(res => {
      setRatings(res.data?.ratings ?? []);
      setDbStages(res.data?.stages ?? []);
    });
  }, []);

  if (!cycleId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress sx={{ color: BLUE }} />
      </Box>
    );
  }

  if (role === 'employee') {
    return <EmployeeView cycleId={cycleId} cycles={cycles} onCycleChange={setCycleId} ratings={ratings} dbStages={dbStages} />;
  }

  return <LeadView cycleId={cycleId} cycles={cycles} onCycleChange={setCycleId} ratings={ratings} dbStages={dbStages} />;
}