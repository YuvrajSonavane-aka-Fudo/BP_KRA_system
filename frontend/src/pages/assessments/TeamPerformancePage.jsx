import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, TextField, MenuItem, Select,
  CircularProgress, Alert, Divider, Avatar, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Tooltip, IconButton,
  InputAdornment,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import LockIcon from '@mui/icons-material/Lock';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RateReviewIcon from '@mui/icons-material/RateReview';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { getCycles, advanceCycleStage, getReferenceData } from '../../api/cyclesApi';
import { getAssessmentProgress, submitLeadReview, saveEmployeeStageDates } from '../../api/assessmentsApi';
import { getStageStates, canLeadReview, getStageLockReason, CYCLE_STAGES } from '../../utils/stageUtils';
import useRoleAccess from '../../hooks/useRoleAccess';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';

/* ─── Shared calendar helpers ─── */
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const gradient  = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

function toDateOnly(s) { return s ? String(s).split('T')[0].split(' ')[0].trim() : ''; }
function toISO(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── RangePicker ─── */
function RangePicker({ startDate, endDate, onChange, onClose }) {
  const init = () => {
    const src = startDate;
    if (src) { const d = new Date(toDateOnly(src) + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() }; }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  };
  const [vy, setVy] = useState(() => init().y);
  const [vm, setVm] = useState(() => init().m);
  const [picking, setPicking] = useState(startDate ? 'end' : 'start');
  const [hover, setHover]     = useState(null);

  const startD = startDate ? new Date(toDateOnly(startDate) + 'T00:00:00') : null;
  const endD   = endDate   ? new Date(toDateOnly(endDate)   + 'T00:00:00') : null;

  const totalDays = new Date(vy, vm+1, 0).getDate();
  const firstDay  = new Date(vy, vm, 1).getDay();
  const cells     = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i+1)];

  function disabled(d) {
    if (!d) return true;
    const dt = new Date(vy, vm, d);
    if (picking === 'end' && startD) { const s = new Date(startD); s.setHours(0,0,0,0); if (dt < s) return true; }
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
  function fmtShort(s) {
    if (!s) return null;
    const d = new Date(toDateOnly(s) + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  return (
    <Box sx={{ width: 248, borderRadius: 2, overflow: 'hidden', bgcolor: '#fff', boxShadow: '0 12px 40px -4px rgba(15,23,42,0.18)', border: '1px solid #e2e8f0' }}>
      <Stack direction="row"   sx={{ px: 1.25, py: 0.75, background: gradient, alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton size="small" onClick={() => vm===0 ? (setVm(11),setVy(y=>y-1)) : setVm(m=>m-1)}
          sx={{ color:'#fff', p:0.2, '&:hover':{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 } }}>
          <ChevronLeftIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{MONTHS[vm].slice(0,3)} {vy}</Typography>
        <IconButton size="small" onClick={() => vm===11 ? (setVm(0),setVy(y=>y+1)) : setVm(m=>m+1)}
          sx={{ color:'#fff', p:0.2, '&:hover':{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 } }}>
          <ChevronRightIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Stack direction="row"  spacing={0.4} sx={{ ml: 0.5, alignItems: 'center' }}>
          {[{ key:'start', val: startDate }, { key:'end', val: endDate }].map(({ key, val }, i) => (
            <React.Fragment key={key}>
              {i === 1 && <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>→</Typography>}
              <Box onClick={() => setPicking(key)}
                sx={{ px: 0.75, py: 0.2, borderRadius: 1, bgcolor: picking === key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', border: picking === key ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent', transition: 'all 0.12s' }}>
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
        <Stack direction="row" sx={{ mb: 0.4 }} >
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
                    <Box onClick={() => !dis && selectDay(d)}
                      onMouseEnter={() => !dis && picking==='end' && setHover(d)}
                      onMouseLeave={() => setHover(null)}
                      sx={{ width: 26, height: 26, borderRadius: hi ? '50%' : inRange ? 0 : '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: dis ? 'not-allowed' : 'pointer', bgcolor: hi ? '#1E3A8A' : inRange ? '#dbeafe' : 'transparent', border: today && !hi ? '1.5px solid #1E3A8A' : '1.5px solid transparent', transition: 'background 0.08s', '&:hover': !dis && !hi ? { bgcolor: inRange ? '#bfdbfe' : '#eff6ff' } : {} }}>
                      <Typography sx={{ fontSize: 11, lineHeight: 1, userSelect: 'none', fontWeight: hi ? 700 : today ? 600 : 400, color: hi ? '#fff' : dis ? '#d1d5db' : inRange ? '#1e40af' : today ? '#1E3A8A' : '#374151' }}>{d}</Typography>
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

/* ─── DateRangeField ─── */
function DateRangeField({ startDate, endDate, onChange, label }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const popupRef   = useRef();

  useEffect(() => {
    if (!open) return;
    function h(e) {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && popupRef.current && !popupRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (!open || !popupRef.current || !triggerRef.current) return;
    const POPUP_W = 248, POPUP_H = 260, GAP = 6;
    const vw = window.innerWidth, vh = window.innerHeight;
    const tr = triggerRef.current.getBoundingClientRect();
    let top  = tr.bottom + GAP;
    let left = tr.left;
    if (top + POPUP_H > vh - 8) top = tr.top - POPUP_H - GAP;
    if (left + POPUP_W > vw - 8) left = vw - POPUP_W - 8;
    if (left < 8) left = 8;
    popupRef.current.style.top  = top  + 'px';
    popupRef.current.style.left = left + 'px';
  }, [open]);

  const bothSet = !!startDate && !!endDate;
  return (
    <Box ref={triggerRef} sx={{ position: 'relative' }}>
      {label && (
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
      )}
      <Box onClick={() => setOpen(v => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.8, border: `1.5px solid ${open ? '#1E3A8A' : bothSet ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 1.5, cursor: 'pointer', bgcolor: bothSet ? '#eff6ff' : '#fafafa', width: '100%', boxSizing: 'border-box', transition: 'all 0.15s', userSelect: 'none', '&:hover': { borderColor: '#1E3A8A', bgcolor: '#f0f7ff' } }}>
        <CalendarMonthIcon sx={{ fontSize: 13, color: bothSet ? '#1E3A8A' : '#94a3b8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, color: bothSet ? '#0f172a' : '#94a3b8', fontWeight: bothSet ? 600 : 400, flex: 1 }}>
          {bothSet ? `${fmtDate(startDate)} → ${fmtDate(endDate)}` : startDate ? `${fmtDate(startDate)} → …` : 'Select date range'}
        </Typography>
        {bothSet && (
          <CloseIcon sx={{ fontSize: 11, color: '#94a3b8', ml: 0.5, '&:hover': { color: '#64748b' } }}
            onClick={e => { e.stopPropagation(); onChange({ start_date: '', end_date: '' }); }} />
        )}
      </Box>
      {open && (
        <Box ref={popupRef} sx={{ position: 'fixed', zIndex: 99999 }}>
          <RangePicker startDate={startDate} endDate={endDate}
            onChange={v => { onChange(v); if (v.start_date && v.end_date) setOpen(false); }}
            onClose={() => setOpen(false)} />
        </Box>
      )}
    </Box>
  );
}

const NAVY = '#0f1b4c';
const BLUE = '#1E3A8A';
const ACCENT = '#3b82f6';

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

// ── Stage stepper ─────────────────────────────────────────────────────────────
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
              <Stack  spacing={0.5} sx={{ minWidth: 80, alignItems: 'center' }}>
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
                  textAlign: 'center', lineHeight: 1.3, maxWidth: 76,
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
    </Paper>
  );
}

// ── KRA review row ────────────────────────────────────────────────────────────
function KRAReviewRow({ row, ratings, editable, lockReason, onSave, saving, savedId, kraRef }) {
  const [leadRatingId, setLeadRatingId] = useState(row.lead_rating_id ?? '');
  const [leadComment, setLeadComment] = useState(row.lead_comment ?? '');
  const [leadProgressNotes, setLeadProgressNotes] = useState(row.lead_progress_notes ?? '');
  const [dirty, setDirty] = useState(false);
  const isSaving = saving && savedId === row.employee_kra_level_id;

  React.useEffect(() => { setDirty(false); }, [editable]);

  function change(setter) { return v => { setter(v); setDirty(true); }; }

  function handleSave() {
    onSave(row.employee_kra_level_id, {
      lead_rating_id: leadRatingId || null,
      lead_comment: leadComment || null,
      lead_progress_notes: leadProgressNotes || null,
    });
    setDirty(false);
  }

  return (
    <Paper ref={kraRef} elevation={0} sx={{
      border: row.lead_rating_id ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
      borderRadius: 2.5, overflow: 'hidden', mb: 2, scrollMarginTop: '16px',
    }}>
      {/* KRA name bar */}
      <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#fafbff', borderBottom: '1px solid #f1f5f9' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}  >
          <Stack direction="row"  spacing={1} sx={{ alignItems: 'center' }}>
            {row.lead_rating_id
              ? <CheckCircleIcon sx={{ fontSize: 17, color: '#22c55e' }} />
              : <PendingIcon sx={{ fontSize: 17, color: '#f59e0b' }} />
            }
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{row.kra_name}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} >
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
            <Typography sx={{ fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' }}>Not yet submitted</Typography>
          )}
        </Box>

        {/* Lead evaluation */}
        <Box sx={{ flex: 1, p: 2.5, bgcolor: editable ? '#fff' : '#fafbff' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            Lead Evaluation
          </Typography>
          {!editable ? (
            <Stack direction="row"  spacing={1} sx={{ alignItems: 'flex-start' }}>
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
                }}>
                <MenuItem value="" disabled sx={{ fontSize: 13, color: '#94a3b8' }}>Select Rating</MenuItem>
                {ratings.map(r => (
                  <MenuItem key={r.id} value={r.id} sx={{ fontSize: 13 }}>{r.rating} – {r.description}</MenuItem>
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
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }} >
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

// ── InlineStageRow — Image 2 style: [stage name col] | [calendar pill col] ──
function InlineStageRow({ stageData, isTarget, onRangeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popupRef = useRef(null);
  const bothSet = !!stageData.start_date && !!stageData.end_date;

  function fmtShort(s) {
    if (!s) return null;
    const d = new Date(toDateOnly(s) + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

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
    <Stack ref={ref} direction="row"  sx={{ borderRadius: 2,
      border: isTarget ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
      bgcolor: isTarget ? '#eff6ff' : '#fff',
      overflow: 'visible',
      position: 'relative',
      transition: 'border-color 0.15s', alignItems: 'center' }}>
      {/* Left: stage name */}
      <Box sx={{ px: 2, py: 1.25, minWidth: 170, flexShrink: 0, borderRight: '1px solid #e2e8f0' }}>
        <Stack direction="row"  spacing={0.75} sx={{ alignItems: 'center' }}>
          {isTarget && (
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#3b82f6', flexShrink: 0 }} />
          )}
          <Typography sx={{ fontSize: 13, fontWeight: isTarget ? 700 : 500, color: isTarget ? BLUE : '#374151' }}   >
            {stageData.name}
          </Typography>
        </Stack>
      </Box>

      {/* Right: calendar pill */}
      <Stack direction="row"  spacing={1} 
        onClick={() => setOpen(o => !o)}
        sx={{ px: 1.5, py: 1.1, cursor: 'pointer',
          borderRadius: '0 8px 8px 0',
          '&:hover': { bgcolor: isTarget ? 'rgba(219,234,254,0.3)' : '#f8fafc' },
          transition: 'background 0.12s', alignItems: 'center', flex: 1 }}>
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

// ── Compact inline stage stepper ──────────────────────────────────────────────
function InlineStageStepper({ currentStageId, cycleId, employeeId, ekcId, cycleStages, isAdmin, onStageChanged }) {
  const [stageChanging, setStageChanging] = useState(false);
  const [dateSaving, setDateSaving]       = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, direction: null, toStage: null });
  const [overrideStages, setOverrideStages] = useState([]);
  const [toast, setToast] = useState('');

  const stages     = CYCLE_STAGES;
  const currentIdx = stages.findIndex(s => s.id === currentStageId);

  function openBackDialog(toStage) {
    const prefilled = CYCLE_STAGES.map(s => ({
      stage_id:   s.id,
      name:       s.name,
      start_date: cycleStages?.find(cs => (cs.stage_id ?? cs.stage?.id) === s.id)?.start_date?.split('T')[0] ?? '',
      end_date:   cycleStages?.find(cs => (cs.stage_id ?? cs.stage?.id) === s.id)?.end_date?.split('T')[0]   ?? '',
    }));
    setOverrideStages(prefilled);
    setConfirmDialog({ open: true, direction: 'back', toStage });
  }

  function openForwardDialog(toStage) {
    setConfirmDialog({ open: true, direction: 'forward', toStage });
  }

  function closeDialog() {
    setConfirmDialog({ open: false, direction: null, toStage: null });
    setOverrideStages([]);
  }

  async function doStageChange() {
    const { direction, toStage } = confirmDialog;
    if (!toStage) return;
    setStageChanging(true);
    try {
      await advanceCycleStage(cycleId, {
        target_stage_id: toStage.id,
        employee_ids: [employeeId],
      });
      onStageChanged(toStage.id);

      if (direction === 'back' && overrideStages.length && ekcId) {
        setDateSaving(true);
        await saveEmployeeStageDates(ekcId, overrideStages.map(s => ({
          stage_id:   s.stage_id,
          start_date: s.start_date || null,
          end_date:   s.end_date   || null,
        })));
      }
    } catch (err) {
      setToast(err?.response?.data?.error || 'Failed to update stage');
      setTimeout(() => setToast(''), 3500);
    } finally {
      setStageChanging(false);
      setDateSaving(false);
      closeDialog();
    }
  }

  const isBack = confirmDialog.direction === 'back';
  const isBusy = stageChanging || dateSaving;

  return (
    <Box sx={{ mt: 1.5 }}>
      {/* Mini stepper */}
      <Stack direction="row"  spacing={0} sx={{ alignItems: 'center' }}>
        {stages.map((stage, i) => {
          const isDone    = stage.id < currentStageId;
          const isCurrent = stage.id === currentStageId;
          const isLast    = i === stages.length - 1;
          return (
            <React.Fragment key={stage.id}>
              <Tooltip title={stage.name}>
                <Stack  spacing={0.3} sx={{ minWidth: 52, alignItems: 'center' }}>
                  <Box sx={{
                    width: isCurrent ? 26 : 20, height: isCurrent ? 26 : 20,
                    borderRadius: '50%',
                    bgcolor: isDone ? '#22c55e' : isCurrent ? BLUE : '#e2e8f0',
                    border: isCurrent ? `2.5px solid ${ACCENT}` : isDone ? '2px solid #22c55e' : '2px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isCurrent ? `0 0 0 3px rgba(59,130,246,0.15)` : 'none',
                    transition: 'all 0.2s', flexShrink: 0,
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

      {/* Admin back/forward controls */}
      {isAdmin && (
        <Stack direction="row"  spacing={1} sx={{ alignItems: 'center', mt: 1 }} >
          <Tooltip title={currentIdx > 0 ? `Move back to: ${stages[currentIdx - 1]?.name}` : 'Already at first stage'}>
            <span>
              <IconButton size="small"
                disabled={currentIdx <= 0 || stageChanging}
                onClick={e => { e.stopPropagation(); openBackDialog(stages[currentIdx - 1]); }}
                sx={{ width: 24, height: 24, bgcolor: currentIdx > 0 ? '#eff6ff' : '#f8fafc', color: currentIdx > 0 ? BLUE : '#cbd5e1', border: `1px solid ${currentIdx > 0 ? '#bfdbfe' : '#e2e8f0'}`, '&:hover': { bgcolor: '#dbeafe' }, '&.Mui-disabled': { opacity: 0.4 } }}>
                <ArrowBackIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Typography sx={{ fontSize: 10, color: '#94a3b8', flex: 1, textAlign: 'center' }}>
            {stageChanging ? 'Updating…' : 'Admin: move stage'}
          </Typography>
          <Tooltip title={currentIdx < stages.length - 1 ? `Advance to: ${stages[currentIdx + 1]?.name}` : 'Already at final stage'}>
            <span>
              <IconButton size="small"
                disabled={currentIdx >= stages.length - 1 || stageChanging}
                onClick={e => { e.stopPropagation(); openForwardDialog(stages[currentIdx + 1]); }}
                sx={{ width: 24, height: 24, bgcolor: currentIdx < stages.length - 1 ? '#eff6ff' : '#f8fafc', color: currentIdx < stages.length - 1 ? BLUE : '#cbd5e1', border: `1px solid ${currentIdx < stages.length - 1 ? '#bfdbfe' : '#e2e8f0'}`, '&:hover': { bgcolor: '#dbeafe' }, '&.Mui-disabled': { opacity: 0.4 } }}>
                <ArrowForwardIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )}

      {toast && <Typography sx={{ fontSize: 10, color: '#64748b', mt: 0.5 }}>{toast}</Typography>}

      {/* ─── Confirm dialog — unified blue theme ─── */}
      <Dialog open={confirmDialog.open} onClose={() => !isBusy && closeDialog()}
         fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px -10px rgba(15,23,42,0.2)' } }} sx={{ maxWidth: 'sm' }}>

        {/* Header — always blue */}
        <Box sx={{
          bgcolor: '#eff6ff',
          px: 3, pt: 2.5, pb: 2,
          borderBottom: '1px solid #bfdbfe',
        }}>
          <Stack direction="row"  spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: '50%',
              bgcolor: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                {isBack ? '←' : '→'}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: BLUE }}   >
                {isBack
                  ? `Move Back to ${confirmDialog.toStage?.name}`
                  : `Move Forward to ${confirmDialog.toStage?.name}`}
              </Typography>
              {isBack && (
                <Typography sx={{ mt: 0.2, fontSize: 12, color: '#64748b' }}   >
                  Set this employee's personal stage dates
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ pt: 2, pb: 1, px: 3, overflow: 'visible' }}>
          {isBack ? (
            <>
              <Typography    sx={{ lineHeight: 1.6, mb: 2, fontSize: 13, color: '#374151' }}>
                Adjust stage dates for this employee. These will override cycle-level dates only for them.
              </Typography>
              <Stack spacing={0.75}>
                {overrideStages.map(s => (
                  <InlineStageRow
                    key={s.stage_id}
                    stageData={s}
                    isTarget={s.stage_id === confirmDialog.toStage?.id}
                    onRangeChange={(stageId, val) =>
                      setOverrideStages(prev => prev.map(x =>
                        x.stage_id === stageId ? { ...x, ...val } : x
                      ))
                    }
                  />
                ))}
              </Stack>
            </>
          ) : (
            <Typography   sx={{ lineHeight: 1.6, fontSize: 13, color: '#374151' }}>
              Move this employee forward to <strong>{confirmDialog.toStage?.name}</strong>? They will advance by one stage.
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
          <Button onClick={closeDialog} disabled={isBusy}
            sx={{
              textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 2, fontSize: 13, px: 2,
              '&:hover': { bgcolor: '#f1f5f9' },
            }}>
            Cancel
          </Button>
          <Button onClick={doStageChange}
            variant="contained"
            disabled={isBusy}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: 13, borderRadius: 2, px: 3,
              bgcolor: BLUE,
              boxShadow: 'none',
              '&:hover': { bgcolor: ACCENT, boxShadow: 'none' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}>
            {isBusy
              ? <><CircularProgress size={13} sx={{ color: 'rgba(255,255,255,0.7)', mr: 1 }} />{dateSaving ? 'Saving dates…' : 'Moving…'}</>
              : (isBack ? 'Confirm & Save Dates' : 'Confirm Move Forward')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Employee review panel ─────────────────────────────────────────────────────
function EmployeeReviewPanel({ cycleId, emp, allEmployees, ratings, currentCycleStageId, completedStageIds, cycleStages, onBack, onSwitchEmployee, onKraUpdated }) {
  const { isAdmin } = useRoleAccess();
  const [empStageId, setEmpStageId] = useState(emp.current_stage_id ?? currentCycleStageId);
  useEffect(() => { setEmpStageId(emp.current_stage_id ?? currentCycleStageId); }, [emp.employee_id]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [toast, setToast] = useState({ msg: '', severity: 'success' });
  const [localKras, setLocalKras] = useState(emp.kras ?? []);
  const [kraSearch, setKraSearch] = useState('');

  const kraRefs = useRef({});

  useEffect(() => {
    setLocalKras(emp.kras ?? []);
    setKraSearch('');
  }, [emp.employee_id]);

  async function handleSave(employeeKraLevelId, payload) {
    setSaving(true); setSavedId(employeeKraLevelId);
    try {
      await submitLeadReview(employeeKraLevelId, payload);
      setLocalKras(prev => prev.map(k => k.employee_kra_level_id === employeeKraLevelId ? { ...k, ...payload } : k));
      onKraUpdated(emp.employee_id, employeeKraLevelId, payload);
      setToast({ msg: 'Review saved', severity: 'success' });
    } catch (err) {
      setToast({ msg: err?.response?.data?.error || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false); setSavedId(null);
      setTimeout(() => setToast({ msg: '', severity: 'success' }), 3000);
    }
  }

  function handleJumpTo(employeeKraLevelId) {
    setKraSearch('');
    setTimeout(() => {
      const el = kraRefs.current[employeeKraLevelId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  const reviewed = localKras.filter(k => k.lead_rating_id).length;
  const pct = localKras.length ? Math.round((reviewed / localKras.length) * 100) : 0;

  const editable = canLeadReview(currentCycleStageId);
  const lockReason = getStageLockReason(currentCycleStageId, 'lead');

  const filteredKras = kraSearch
    ? localKras.filter(k => k.kra_name?.toLowerCase().includes(kraSearch.toLowerCase()))
    : localKras;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 2, flexShrink: 0, bgcolor: '#f5f6fa' }}>
        <Stack direction="row"  spacing={2} sx={{ alignItems: 'center', mb: 2 }} >
          <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
            <ArrowBackIcon sx={{ fontSize: 'small' }}  />
          </IconButton>

          <Avatar sx={{ width: 42, height: 42, bgcolor: BLUE, fontSize: 15, fontWeight: 800 }}>
            {initials(emp.full_name)}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 17, color: '#1e293b' }}>{emp.full_name}</Typography>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>{emp.title || '—'}</Typography>
          </Box>

          <Select
            value={emp.employee_id}
            onChange={e => {
              const next = allEmployees.find(a => a.employee_id === e.target.value);
              if (next) onSwitchEmployee(next);
            }}
            size="small"
            IconComponent={KeyboardArrowDownIcon}
            sx={{
              minWidth: 200, maxWidth: 260, fontSize: 13, borderRadius: 2, bgcolor: '#fff',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
            }}
          >
            {allEmployees.map(e => (
              <MenuItem key={e.employee_id} value={e.employee_id} sx={{ fontSize: 13 }}>
                <Stack direction="row"  spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Avatar sx={{ width: 22, height: 22, bgcolor: BLUE, fontSize: 9, fontWeight: 800 }}>
                    {initials(e.full_name)}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{e.full_name}</Typography>
                    <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>
                      {leadStatus(e.kras) === 'completed' ? '✓ Reviewed' : `${e.kras?.filter(k => k.lead_rating_id).length ?? 0}/${e.kras?.length ?? 0} rated`}
                    </Typography>
                  </Box>
                </Stack>
              </MenuItem>
            ))}
          </Select>

          <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, px: 2, py: 1, minWidth: 130, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, mb: 0.3 }}>KRAs Reviewed</Typography>
            <Stack direction="row"  spacing={0.5} sx={{ alignItems: 'baseline' }}>
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

        <InlineStageStepper
          currentStageId={empStageId}
          cycleId={cycleId}
          employeeId={emp.employee_id}
          ekcId={emp.employee_kra_cycle_id}
          cycleStages={cycleStages}
          isAdmin={isAdmin}
          onStageChanged={newId => setEmpStageId(newId)}
        />
        <Divider />
      </Box>

      {/* Scrollable KRA list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
        {!editable && lockReason && (
          <Alert severity="warning" icon={<LockOutlinedIcon  />} sx={{ mb: 2, borderRadius: 2, fontSize: 'small' }}>
            {lockReason} KRA data is shown in read-only mode.
          </Alert>
        )}
        {toast.msg && <Alert severity={toast.severity} sx={{ mb: 2, borderRadius: 2 }}>{toast.msg}</Alert>}

        {localKras.length > 0 && (
          <TextField size="small" fullWidth
            placeholder={`Search ${localKras.length} KRAs…`}
            value={kraSearch}
            onChange={e => setKraSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment ><SearchIcon sx={{ fontSize: 16, color: '#94a3b8', position: 'start' }} /></InputAdornment> } }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13, bgcolor: '#fff' } }}
          />
        )}

        {localKras.length === 0 ? (
          <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 5, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8' }}>No KRAs assigned to this employee.</Typography>
          </Paper>
        ) : filteredKras.length === 0 ? (
          <Paper elevation={0} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 3, p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>No KRAs match "{kraSearch}"</Typography>
          </Paper>
        ) : filteredKras.map(row => (
          <KRAReviewRow
            key={row.employee_kra_level_id}
            row={row}
            ratings={ratings}
            editable={editable}
            lockReason={lockReason}
            onSave={handleSave}
            saving={saving}
            savedId={savedId}
            kraRef={el => { kraRefs.current[row.employee_kra_level_id] = el; }}
          />
        ))}
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
  const { isAdmin } = useRoleAccess();
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [empStages, setEmpStages] = useState({});

  function handleKraUpdated(employeeId, employeeKraLevelId, payload) {
    setData(prev => ({
      ...prev,
      employees: (prev?.employees ?? []).map(e =>
        e.employee_id !== employeeId ? e : {
          ...e,
          kras: e.kras.map(k =>
            k.employee_kra_level_id === employeeKraLevelId ? { ...k, ...payload } : k
          ),
        }
      ),
    }));
  }

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
        cycleId={cycleId}
        emp={selected}
        allEmployees={employees}
        ratings={ratings}
        currentCycleStageId={currentCycleStageId}
        completedStageIds={completedStageIds}
        cycleStages={data?.cycle_stages ?? []}
        onBack={() => { setSelected(null); refetchProgress(); }}
        onSwitchEmployee={emp => setSelected(emp)}
        onKraUpdated={handleKraUpdated}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#f5f6fa' }}>

      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 2, flexShrink: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}     >
          <Box>
            {cycle && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                {cycle.name}
              </Typography>
            )}
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Team Performance Review</Typography>
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} >
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
                  <Paper elevation={0} sx={{ flex: 1, border: '1.5px solid #bfdbfe', borderRadius: 3, p: 2.5, bgcolor: '#eff6ff' }}>
                    <Stack direction="row"  spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.3, flexShrink: 0 }}>
                        <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>!</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 11, color: BLUE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Action Required
                        </Typography>
                        <Typography sx={{ fontSize: 22, fontWeight: 800, color: BLUE, mt: 0.5 }}>
                          {pending} Pending Lead {pending === 1 ? 'Assessment' : 'Assessments'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            )}

            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}   >
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                Team Members {employees.length > 0 && `(${employees.length})`}
              </Typography>
              <TextField placeholder="Search team..." value={search}
                onChange={e => setSearch(e.target.value)} size="small"
                slotProps={{ input: { startAdornment: <InputAdornment ><SearchIcon sx={{ fontSize: 16, color: '#94a3b8', position: 'start' }} /></InputAdornment> } }}
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
                      {['Employee', 'KRAs', 'Self-Assessment', 'Lead Review', 'Stage', 'Action'].map(h => (
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
                          {/* Employee */}
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Stack direction="row"  spacing={1.5} sx={{ alignItems: 'center' }}>
                              <Avatar sx={{ width: 34, height: 34, bgcolor: BLUE, fontSize: 12, fontWeight: 800 }}>
                                {initials(emp.full_name)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{emp.full_name}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                                  {CYCLE_STAGES.find(s => s.id === (empStages[emp.employee_id] ?? emp.current_stage_id))?.name ?? `Stage ${emp.current_stage_id}`}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>

                          {/* KRAs */}
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Chip label={kraCount} size="small"
                              sx={{ bgcolor: '#f1f5f9', color: BLUE, fontWeight: 700, fontSize: 12, minWidth: 32 }} />
                          </TableCell>

                          {/* Self-Assessment */}
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <StatusBadge statusKey={ss} />
                          </TableCell>

                          {/* Lead Review */}
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                            <StatusBadge statusKey={ls} />
                          </TableCell>

                          {/* Stage */}
                          <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f1f5f9', minWidth: 130 }} onClick={e => e.stopPropagation()}>
                            <Stack spacing={0.5}>
                              <Chip
                                label={`Stage ${empStages[emp.employee_id] ?? emp.current_stage_id ?? '—'}`}
                                size="small"
                                onClick={e => {
                                  e.stopPropagation();
                                  setExpandedEmpId(v => v === emp.employee_id ? null : emp.employee_id);
                                }}
                                sx={{
                                  bgcolor: '#eff6ff', color: BLUE, fontWeight: 700,
                                  fontSize: 11, cursor: 'pointer', height: 22,
                                  '&:hover': { bgcolor: '#dbeafe' },
                                }}
                              />
                              {expandedEmpId === emp.employee_id && (
                                <Box sx={{ minWidth: 320, pt: 0.5 }} onClick={e => e.stopPropagation()}>
                                  <InlineStageStepper
                                    currentStageId={empStages[emp.employee_id] ?? emp.current_stage_id ?? 1}
                                    cycleId={cycleId}
                                    employeeId={emp.employee_id}
                                    ekcId={emp.employee_kra_cycle_id}
                                    cycleStages={data?.cycle_stages ?? []}
                                    isAdmin={isAdmin}
                                    onStageChanged={newId => setEmpStages(prev => ({ ...prev, [emp.employee_id]: newId }))}
                                  />
                                </Box>
                              )}
                            </Stack>
                          </TableCell>

                          {/* Action */}
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