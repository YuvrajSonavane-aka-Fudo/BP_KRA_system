import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, IconButton, Tooltip,
  Dialog, DialogContent, DialogActions, TextField,
} from '@mui/material';
import ArrowBackIcon        from '@mui/icons-material/ArrowBack';
import ContentCopyIcon      from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import SaveIcon             from '@mui/icons-material/Save';
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon      from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import CloseIcon            from '@mui/icons-material/Close';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InfoOutlinedIcon     from '@mui/icons-material/InfoOutlined';
import EditIcon             from '@mui/icons-material/Edit';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { getCycles, createCycle, updateCycle, cloneCycle, advanceCycleStage } from '../../api/cyclesApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';
import useRoleAccess from '../../hooks/useRoleAccess';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const STAGES = [
  { id: 1, name: 'KRA Assignment By Lead' },
  { id: 2, name: 'Self Assessment' },
  { id: 3, name: 'Lead Assessment' },
  { id: 4, name: 'HR Validation' },
  { id: 5, name: 'Closure' },
];
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const STATUS_STYLES = {
  ACTIVE:    { bgcolor: '#dbeafe', color: '#1d4ed8' },
  DRAFT:     { bgcolor: '#f1f5f9', color: '#64748b' },
  CLOSED:    { bgcolor: '#dcfce7', color: '#166534' },
  ON_HOLD:   { bgcolor: '#fef3c7', color: '#92400e' },
  INACTIVE:  { bgcolor: '#fef3c7', color: '#92400e' },
  CANCELLED: { bgcolor: '#fee2e2', color: '#991b1b' },
};
const STATUS_ACTIONS = {
  DRAFT:     ['ACTIVE'],
  ACTIVE:    ['ON_HOLD', 'CLOSED', 'CANCELLED'],
  ON_HOLD:   ['ACTIVE', 'CANCELLED'],
  INACTIVE:  ['ACTIVE', 'CANCELLED'],
  CLOSED:    [],
  CANCELLED: [],
};
const ACTION_CONFIG = {
  ACTIVE:    { label: 'Activate',    confirmColor: '#1E3A8A' },
  ON_HOLD:   { label: 'Put On Hold', confirmColor: '#9a3412' },
  CLOSED:    { label: 'Close Cycle',       confirmColor: '#15803d' },
  CANCELLED: { label: 'Cancel Cycle',      confirmColor: '#dc2626' },
};

/* ─────────────── helpers ─────────────── */
function toDateOnly(s) { return s ? String(s).split('T')[0].split(' ')[0].trim() : ''; }
function fmt(s) {
  if (!s) return '—';
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function toISO(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

/* ─────────────── RangePicker — compact, single-row header ─────────────── */
function RangePicker({ startDate, endDate, onChange, minDate, onClose }) {
  const init = () => {
    const src = startDate || minDate;
    if (src) { const d = new Date(toDateOnly(src) + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() }; }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  };
  const [vy, setVy] = useState(() => init().y);
  const [vm, setVm] = useState(() => init().m);
  const [picking, setPicking] = useState(startDate ? 'end' : 'start');
  const [hover, setHover]     = useState(null);

  const minD   = minDate   ? new Date(toDateOnly(minDate)   + 'T00:00:00') : null;
  const startD = startDate ? new Date(toDateOnly(startDate) + 'T00:00:00') : null;
  const endD   = endDate   ? new Date(toDateOnly(endDate)   + 'T00:00:00') : null;

  const totalDays = new Date(vy, vm+1, 0).getDate();
  const firstDay  = new Date(vy, vm, 1).getDay();
  const cells     = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i+1)];

  function disabled(d) {
    if (!d) return true;
    const dt = new Date(vy, vm, d);
    if (minD) { const m2 = new Date(minD); m2.setHours(0,0,0,0); if (dt < m2) return true; }
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

  // compact date display
  function fmtShort(s) {
    if (!s) return null;
    const d = new Date(toDateOnly(s) + 'T00:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  return (
    <Box sx={{
      width: 248,
      borderRadius: 2, overflow: 'hidden', bgcolor: '#fff',
      boxShadow: '0 12px 40px -4px rgba(15,23,42,0.18), 0 2px 8px -2px rgba(15,23,42,0.08)',
      border: '1px solid #e2e8f0',
    }}>
      {/* Single-row header: ← Month Year → | from→to pill */}
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
        {/* from/to inline pill */}
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

      {/* Calendar grid */}
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
                        border: today && !hi ? '1.5px solid #1E3A8A' : '1.5px solid transparent',
                        transition: 'background 0.08s',
                        '&:hover': !dis && !hi ? { bgcolor: inRange ? '#bfdbfe' : '#eff6ff' } : {},
                      }}>
                      <Typography sx={{
                        fontSize: 11, lineHeight: 1, userSelect: 'none',
                        fontWeight: hi ? 700 : today ? 600 : 400,
                        color: hi ? '#fff' : dis ? '#d1d5db' : inRange ? '#1e40af' : today ? '#1E3A8A' : '#374151',
                      }}>{d}</Typography>
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

/* ─────────────── DateRangeField — smart viewport-aware popup ─────────────── */
function DateRangeField({ startDate, endDate, onChange, minDate, disabled: dis, label, required, error: fieldError }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const popupRef   = useRef();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function h(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popupRef.current   && !popupRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Reposition on open
  useEffect(() => {
    if (!open || !popupRef.current || !triggerRef.current) return;
    const POPUP_W = 248, POPUP_H = 260, GAP = 6;
    const vw = window.innerWidth, vh = window.innerHeight;
    const tr = triggerRef.current.getBoundingClientRect();
    let top  = tr.bottom + GAP;
    let left = tr.left;
    // flip up if not enough space below
    if (top + POPUP_H > vh - 8) top = tr.top - POPUP_H - GAP;
    // clamp horizontally
    if (left + POPUP_W > vw - 8) left = vw - POPUP_W - 8;
    if (left < 8) left = 8;
    popupRef.current.style.top  = top  + 'px';
    popupRef.current.style.left = left + 'px';
  }, [open]);

  const bothSet = !!startDate && !!endDate;
  return (
    <Box ref={triggerRef} sx={{ position: 'relative' }}>
      {label && (
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label} {required && <Box component="span" sx={{ color: '#ef4444' }}>*</Box>}
        </Typography>
      )}
      <Box
        onClick={() => !dis && setOpen(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.8,
          border: `1.5px solid ${fieldError ? '#fca5a5' : open ? '#1E3A8A' : bothSet ? '#93c5fd' : '#e2e8f0'}`,
          borderRadius: 1.5, cursor: dis ? 'default' : 'pointer',
          bgcolor: fieldError ? '#fef2f2' : bothSet ? '#eff6ff' : '#fafafa',
          width: '100%', boxSizing: 'border-box',
          transition: 'all 0.15s', userSelect: 'none',
          '&:hover': !dis ? { borderColor: '#1E3A8A', bgcolor: '#f0f7ff' } : {},
        }}>
        <CalendarMonthIcon sx={{ fontSize: 13, color: bothSet ? '#1E3A8A' : '#94a3b8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, color: bothSet ? '#0f172a' : '#94a3b8', fontWeight: bothSet ? 600 : 400, flex: 1 }}>
          {bothSet ? `${fmt(startDate)} → ${fmt(endDate)}` : startDate ? `${fmt(startDate)} → …` : 'Select date range'}
        </Typography>
        {bothSet && !dis && (
          <CloseIcon
            sx={{ fontSize: 11, color: '#94a3b8', ml: 0.5, '&:hover': { color: '#ef4444' } }}
            onClick={e => { e.stopPropagation(); onChange({ start_date: '', end_date: '' }); }} />
        )}
      </Box>
      {fieldError && <Typography sx={{ fontSize: 11, color: '#ef4444', mt: 0.4 }}>{fieldError}</Typography>}
      {open && (
        <Box ref={popupRef} sx={{ position: 'fixed', zIndex: 99999 }}>
          <RangePicker
            startDate={startDate} endDate={endDate}
            onChange={v => { onChange(v); if (v.start_date && v.end_date) setOpen(false); }}
            minDate={minDate}
            onClose={() => setOpen(false)}
          />
        </Box>
      )}
    </Box>
  );
}

/* ─────────────── ConfirmDialog ─────────────── */
function ConfirmDialog({ open, title, message, warning, confirmLabel, confirmColor, onClose, onConfirm, loading, error }) {
  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #fde68a' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
          <Typography fontWeight={700} fontSize={14} color="#92400e">{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Typography fontSize={13} color="#374151" mb={warning ? 1.5 : 0}>{message}</Typography>
        {warning && (
          <Box sx={{ px: 1.5, py: 1, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
            <Typography fontSize={12} color="#991b1b">{warning}</Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5, fontSize: 12, borderRadius: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={loading} variant="contained"
          startIcon={loading ? <CircularProgress size={12} color="inherit" /> : null}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13,
            bgcolor: confirmColor, '&:hover': { bgcolor: confirmColor, opacity: 0.88 },
            '&:disabled': { opacity: 0.6 },
          }}>
          {loading ? 'Processing…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Stage Stepper
   
   FIX 1: Accept rollbackTargetId prop so stepper correctly
           highlights the rollback target stage (not the current
           stage) and shows it as the "selected" one.
   FIX 2: Stepper no longer shows stage 1 as "completed" (green)
           when it IS the rollback target — it shows it as active.
   ───────────────────────────────────────────────────────────── */
function StageStepper({ currentStageId, canAdvance, onAdvanceClick, rollbackTargetId }) {
  return (
    <Box sx={{ px: 2.5, pb: 2 }}>
      {rollbackTargetId && (
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', mb: 1 }}>
          Rolling back to "{STAGES.find(s => s.id === rollbackTargetId)?.name}" — update dates below and save
        </Typography>
      )}
      {!rollbackTargetId && canAdvance && (
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.65)', mb: 1 }}>
          Click the next stage to continue
        </Typography>
      )}
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 14, left: '4%', right: '4%', height: 2, bgcolor: 'rgba(255,255,255,0.15)', zIndex: 0 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
          {STAGES.map((stage) => {
            // FIX: In rollback mode, the rollbackTarget stage is "active/selected",
            // stages BEFORE it are "done", stages AFTER are "future".
            // Without rollback: normal current/done/future logic.
            const isRollbackTarget = !!rollbackTargetId && stage.id === rollbackTargetId;

            const done = rollbackTargetId
              ? stage.id < rollbackTargetId   // stages before rollback target = done
              : (currentStageId && stage.id < currentStageId);

            // Active = rollback target (when rolling back) OR current stage (normal mode)
            const active = rollbackTargetId
              ? isRollbackTarget
              : (currentStageId === stage.id);

            const isNext = !rollbackTargetId && canAdvance && stage.id === (currentStageId ?? 0) + 1;

            return (
              <Tooltip key={stage.id} title={isNext ? `Advance to "${stage.name}"` : stage.name}>
                <Stack alignItems="center" spacing={0.5} sx={{
                  width: '18%', cursor: isNext ? 'pointer' : 'default',
                  '&:hover .sdot': isNext ? { bgcolor: 'rgba(255,255,255,0.3) !important', transform: 'scale(1.1)' } : {},
                }}
                  onClick={isNext ? () => onAdvanceClick(stage) : undefined}>
                  <Box className="sdot" sx={{
                    width: active ? 32 : 24, height: active ? 32 : 24, borderRadius: '50%', flexShrink: 0,
                    bgcolor: done ? '#10b981' : active ? '#fff' : 'rgba(255,255,255,0.15)',
                    border: `2px solid ${isRollbackTarget ? '#60a5fa' : active ? 'rgba(255,255,255,0.5)' : done ? 'rgba(255,255,255,0.6)' : isNext ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    outline: isRollbackTarget ? '5px solid rgba(96,165,250,0.35)' : active ? '5px solid rgba(255,255,255,0.1)' : 'none',
                    transition: 'all 0.18s',
                    animation: isRollbackTarget ? 'rbPulse 1.8s ease-in-out infinite' : undefined,
                    '@keyframes rbPulse': {
                      '0%,100%': { outline: '5px solid rgba(96,165,250,0.25)' },
                      '50%': { outline: '5px solid rgba(96,165,250,0.5)' },
                    },
                  }}>
                    {done   && <CheckCircleIcon sx={{ color: '#fff', fontSize: 14 }} />}
                    {active && <Typography sx={{ fontSize: 11, color: '#1E3A8A', fontWeight: 800 }}>{stage.id}</Typography>}
                    {!done && !active && <Typography sx={{ fontSize: 10, color: isNext ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{stage.id}</Typography>}
                  </Box>
                  <Typography sx={{
                    fontSize: 9, fontWeight: active ? 700 : 500, textAlign: 'center', lineHeight: 1.2, maxWidth: 70,
                    color: isRollbackTarget ? '#93c5fd' : active ? '#fff' : done ? '#86efac' : isNext ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)',
                  }}>
                    {stage.name}
                  </Typography>
                  {isNext && <Typography sx={{ fontSize: 8, color: 'rgba(147,197,253,0.9)', fontWeight: 700 }}>advance →</Typography>}
                  {isRollbackTarget && <Typography sx={{ fontSize: 8, color: '#93c5fd', fontWeight: 700 }}>← target</Typography>}
                </Stack>
              </Tooltip>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}

/* ══════════════ MAIN COMPONENT ══════════════ */
export default function CycleDetailPage() {
  const { id }  = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { canManageCycles } = useRoleAccess();

  const isNew    = id === 'new';
  const cloneId  = searchParams.get('clone');
  const isClone  = isNew && !!cloneId;
  const isCreate = isNew && !cloneId;
  const rollbackTargetId = searchParams.get('rollback') ? parseInt(searchParams.get('rollback'), 10) : null;
  const stageDateRef = useRef(null);

  const [cycle, setCycle]     = useState(null);
  const [source, setSource]   = useState(null);
  const [allCycles, setAll]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [successMsg, setMsg]  = useState('');

  /* ── Editable fields — used for ALL modes ── */
  const [editName, setEditName]         = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [editStart, setEditStart]       = useState('');
  const [editEnd, setEditEnd]           = useState('');
  const [editStageDates, setEditStages] = useState(() => {
    const i = {}; STAGES.forEach(s => { i[s.id] = { start_date: '', end_date: '' }; }); return i;
  });

  /* ── Dirty tracking (for existing cycles) ── */
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  /* ── Create/clone form validation ── */
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched]         = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  /* ── Advance stage confirm ── */
  const [advanceConfirm, setAdvanceConfirm] = useState({ open: false, toStage: null });
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError]     = useState('');

  /* ── Status confirm ── */
  const [statusConfirm, setStatusConfirm] = useState({ open: false, action: null });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError]     = useState('');

  /* ── Delete ── */
  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  function flash(msg) { setMsg(msg); setTimeout(() => setMsg(''), 4000); }
  function touch(...keys) { setTouched(t => { const n = { ...t }; keys.forEach(k => n[k] = true); return n; }); }
  function markDirty() { if (!isNew) setIsDirty(true); }

  /* ── Validation for create/clone ── */
  useEffect(() => {
    if (!isNew) return;
    const errors = {};
    if (touched.name  && !editName.trim()) errors.name = 'Required.';
    if (touched.name  && editName.trim().length > 100) errors.name = 'Max 100 chars.';
    if (touched.start && !editStart) errors.cycleDates = 'Start date required.';
    if (touched.end   && !editEnd)   errors.cycleDates = 'End date required.';
    if (touched.end && editStart && editEnd && editEnd <= editStart) errors.cycleDates = 'End must be after start.';
    STAGES.forEach(s => {
      const d = editStageDates[s.id] ?? {};
      if (touched[`s${s.id}s`] && !d.start_date) errors[`s${s.id}`] = 'Required.';
      if (touched[`s${s.id}e`] && !d.end_date)   errors[`s${s.id}`] = 'Required.';
      if (d.start_date && d.end_date && d.end_date < d.start_date) errors[`s${s.id}`] = 'End before start.';
      if (editStart && d.start_date && d.start_date < editStart) errors[`s${s.id}`] = `Before cycle start (${fmt(editStart)}).`;
      if (editEnd   && d.end_date   && d.end_date > editEnd)     errors[`s${s.id}`] = `Please select a date on or before (${fmt(editEnd)}).`;
    });
    setFieldErrors(errors);
  }, [editName, editStart, editEnd, editStageDates, touched, isNew]);

  /* ── Data loading ── */
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const listRes = await getCycles();
      const cycles  = listRes.data?.cycles ?? listRes.data ?? [];
      setAll(cycles);

      if (isCreate) {
        // nothing

      } else if (isClone) {
        const src = cycles.find(c => String(c.id) === String(cloneId));
        if (!src) throw new Error('Source cycle not found');
        setSource(src);
        const baseName = src.name.replace(/\s*\(\d+\)$/, '');
        const usedNumbers = cycles
          .map(c => {
            const match = c.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)$`));
            return match ? parseInt(match[1], 10) : null;
          })
          .filter(n => n !== null);
        const nextNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
        setEditName(`${baseName} (${nextNum})`);
        setEditDesc(src.description || '');
        setEditStart(''); setEditEnd('');
        const sd = {};
        STAGES.forEach(s => { sd[s.id] = { start_date: '', end_date: '' }; });
        (src.cycle_stages ?? []).forEach(w => {
          const sid = w.stage_id ?? w.stage?.id;
          if (sid) sd[sid] = { start_date: toDateOnly(w.start_date), end_date: toDateOnly(w.end_date) };
        });
        setEditStages(sd);

      } else {
        const found = cycles.find(c => String(c.id) === String(id));
        if (!found) throw new Error('Cycle not found');
        setCycle(found);
        setEditName(found.name);
        setEditDesc(found.description || '');
        setEditStart(toDateOnly(found.start_date));
        setEditEnd(toDateOnly(found.end_date));
        const sd = {};
        STAGES.forEach(s => { sd[s.id] = { start_date: '', end_date: '' }; });
        (found.cycle_stages ?? []).forEach(w => {
          const sid = w.stage_id ?? w.stage?.id;
          if (sid) sd[sid] = { start_date: toDateOnly(w.start_date), end_date: toDateOnly(w.end_date) };
        });
        setEditStages(sd);
        setIsDirty(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load data.');
    } finally { setLoading(false); }
  }, [id, isNew, isCreate, isClone, cloneId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived ── */
  const currentStatus    = cycle?.status ?? null;
  const currentStageId   = cycle?.current_stage?.id ?? null;
  const availableActions = STATUS_ACTIONS[currentStatus] ?? [];
  const isFrozen   = currentStatus === 'CLOSED' || currentStatus === 'CANCELLED';
  const canDelete  = currentStatus === 'DRAFT';
  const canAdvance = !isNew && currentStatus === 'ACTIVE' && canManageCycles && currentStageId && currentStageId < 5;
  const otherActive    = allCycles.find(c => c.status === 'ACTIVE' && String(c.id) !== String(id));
  const stageWindows   = cycle?.cycle_stages ?? [];

  const step0Valid = !!editName.trim() && !!editStart && !!editEnd && editEnd > editStart;
  const step1Valid = STAGES.every(s => editStageDates[s.id]?.start_date && editStageDates[s.id]?.end_date);
  const configuredCount = STAGES.filter(s => editStageDates[s.id]?.start_date && editStageDates[s.id]?.end_date).length;
  const durationDays = editStart && editEnd && editEnd > editStart
    ? Math.round((new Date(editEnd) - new Date(editStart)) / 86400000) : null;

  /* ── On rollback landing: immediately mark dirty + scroll to target stage.
     Deps: rollbackTargetId only — NOT loading.
     Including `loading` caused the effect to re-fire when fetchData()
     toggled loading true→false after save, setting isDirty=true again
     and requiring a second Save click to dismiss the button. */
  useEffect(() => {
    if (!rollbackTargetId) return;
    setIsDirty(true);
    const timer = setTimeout(() => {
      if (stageDateRef.current) {
        stageDateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [rollbackTargetId]);

  function handleCycleDates({ start_date, end_date }) {
    if (start_date !== undefined) { setEditStart(start_date); touch('start'); markDirty(); }
    if (end_date   !== undefined) { setEditEnd(end_date);     touch('end');   markDirty(); }
  }
  function updateStageDraft(stageId, val) {
    setEditStages(prev => ({ ...prev, [stageId]: { ...prev[stageId], ...val } }));
    touch(`s${stageId}s`, `s${stageId}e`);
    markDirty();
  }

  /* ── CREATE / CLONE submit ── */
  async function handleSubmit() {
    const allT = { name: true, start: true, end: true };
    STAGES.forEach(s => { allT[`s${s.id}s`] = true; allT[`s${s.id}e`] = true; });
    setTouched(allT);
    if (!step0Valid || !step1Valid) { setSubmitError('Please fill in all required fields.'); return; }
    const stageOutOfRange = STAGES.find(s => {
      const d = editStageDates[s.id] ?? {};
      if (!d.start_date || !d.end_date) return false;
      if (editStart && d.start_date < editStart) return true;
      if (editEnd   && d.end_date   > editEnd)   return true;
      return false;
    });
    if (stageOutOfRange) {
      setSubmitError(`Please update the "${stageOutOfRange.name}" stage dates so they fall within the cycle period (${fmt(editStart)} — ${fmt(editEnd)}).`);
      return;
    }
    setSubmitting(true); setSubmitError('');
    try {
      const payload = {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        start_date: editStart,
        end_date: editEnd,
        stages: STAGES.map(s => ({ stage_id: s.id, start_date: editStageDates[s.id]?.start_date, end_date: editStageDates[s.id]?.end_date })),
      };
      let newCycle;
      if (isClone) {
        newCycle = await cloneCycle(cloneId, payload);
      } else {
        newCycle = await createCycle(payload);
      }
      invalidateCyclesCache();
      const newId = newCycle?.data?.id ?? newCycle?.data?.cycle?.id;
      navigate(newId ? ROUTES.CYCLE_DETAIL.replace(':id', newId) : ROUTES.DASHBOARD);
    } catch (err) {
      setSubmitError(err?.response?.data?.error || err?.response?.data?.detail || 'Something went wrong.');
    } finally { setSubmitting(false); }
  }

  /* ──────────────────────────────────────────────────────────────
     handleSave — two-step when rolling back:
       Step 1: PATCH cycle to update stage date windows (always)
       Step 2: POST advance-stage with target_stage_id to actually
               move cycle.current_stage + all employees back
               (only when ?rollback=N is in the URL)

     Without Step 2 the dates are saved but the cycle's
     current_stage never changes, so the UI still shows the old
     stage after the reload.
     ────────────────────────────────────────────────────────────── */
  async function handleSave() {
    if (!editName.trim()) { setSaveError('Cycle name is required.'); return; }
    setIsSaving(true); setSaveError('');
    try {
      // Step 1 — always: persist name / dates / stage windows
      await updateCycle(id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        start_date: editStart,
        end_date: editEnd,
        stages: STAGES.map(s => ({
          stage_id: s.id,
          start_date: editStageDates[s.id]?.start_date || null,
          end_date: editStageDates[s.id]?.end_date || null,
        })),
      });

      // Step 2 — only when rolling back: move cycle + all employees
      // to the target stage via the advance-stage endpoint (Mode 2).
      // The backend's _override_employee_stages() handles backward
      // movement correctly and updates both cycle.stage and all
      // EmployeeKRACycle.stage_id rows atomically.
      if (rollbackTargetId) {
        await advanceCycleStage(id, { target_stage_id: rollbackTargetId });
      }

      invalidateCyclesCache();

      // Clear ?rollback= BEFORE fetchData() so that when fetchData
      // sets loading=false, rollbackTargetId is already null and the
      // "mark dirty on landing" useEffect does NOT re-fire.
      // If we clear it after fetchData the loading flip triggers the
      // effect one extra time → isDirty becomes true again → Save
      // button re-appears and requires a second click to dismiss.
      if (rollbackTargetId) {
        setSearchParams({}, { replace: true });
      }

      await fetchData();
      setIsDirty(false);

      flash(rollbackTargetId
        ? `Rolled back to "${STAGES.find(s => s.id === rollbackTargetId)?.name}" and saved.`
        : 'Changes saved.'
      );
    } catch (err) {
      setSaveError(err?.response?.data?.error || 'Save failed.');
    } finally { setIsSaving(false); }
  }

  function handleDiscard() {
    if (cycle) {
      setEditName(cycle.name);
      setEditDesc(cycle.description || '');
      setEditStart(toDateOnly(cycle.start_date));
      setEditEnd(toDateOnly(cycle.end_date));
      const sd = {};
      STAGES.forEach(s => { sd[s.id] = { start_date: '', end_date: '' }; });
      (cycle.cycle_stages ?? []).forEach(w => {
        const sid = w.stage_id ?? w.stage?.id;
        if (sid) sd[sid] = { start_date: toDateOnly(w.start_date), end_date: toDateOnly(w.end_date) };
      });
      setEditStages(sd);
      setIsDirty(false);
      setSaveError('');
      // Also clear rollback param on discard
      if (rollbackTargetId) {
        setSearchParams({}, { replace: true });
      }
    }
  }

  /* ── ADVANCE STAGE ── */
  async function handleAdvanceStage() {
    setAdvanceLoading(true); setAdvanceError('');
    try {
      await advanceCycleStage(id, {});
      invalidateCyclesCache(); await fetchData();
      setAdvanceConfirm({ open: false, toStage: null });
      flash('Stage advanced successfully.');
    } catch (err) {
      setAdvanceError(err?.response?.data?.error || 'Failed to advance stage.');
    } finally { setAdvanceLoading(false); }
  }

  /* ── STATUS CHANGE ── */
  async function handleStatusChange() {
    const { action } = statusConfirm;
    if (!action) return;
    if (action === 'ACTIVE') {
      const other = allCycles.find(c => c.status === 'ACTIVE' && String(c.id) !== String(id));
      if (other) { setStatusError(`"${other.name}" is already active. Close or put it on hold first.`); return; }
    }
    setStatusLoading(true); setStatusError('');
    try {
      await updateCycle(id, { status: action });
      invalidateCyclesCache(); await fetchData();
      setStatusConfirm({ open: false, action: null });
      const labels = { ACTIVE: 'activated', ON_HOLD: 'put on hold', CLOSED: 'closed', CANCELLED: 'cancelled' };
      flash(`Cycle ${labels[action] ?? 'updated'} successfully.`);
    } catch (err) {
      setStatusError(err?.response?.data?.error || 'Action failed. Please try again.');
    } finally { setStatusLoading(false); }
  }

  /* ── DELETE ── */
  async function handleDelete() {
    setDeleteLoading(true); setDeleteError('');
    try {
      await updateCycle(id, { is_deleted: true });
      invalidateCyclesCache();
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Delete failed.');
      setDeleteLoading(false);
    }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress sx={{ color: '#1E3A8A' }} />
    </Box>
  );
  if (error) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error" action={<Button size="small" onClick={fetchData}>Retry</Button>}>{error}</Alert>
    </Box>
  );

  /* ══════════════ RENDER ══════════════ */
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8fafc' }}>

      {/* ────────────── TOP BAR ────────────── */}
      <Box sx={{ flexShrink: 0, background: gradient, color: '#fff' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.5 }}>

          {/* Left */}
          <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0} flex={1}>
            <IconButton onClick={() => navigate(ROUTES.DASHBOARD)} size="small"
              sx={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1.5, p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>

            <Box minWidth={0} flex={1}>
              <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.65)', mb: 0.25 }}>
                {isCreate ? 'Create New Cycle' : isClone ? `Cloned from ${source?.name ?? '...'}` : 'Cycle Details'}
              </Typography>

              {/* Always-editable name field */}
              {(isNew || (canManageCycles && !isFrozen)) ? (
                <TextField
                  variant="standard"
                  placeholder={isClone ? 'Clone name…' : isCreate ? 'Cycle name…' : ''}
                  value={editName}
                  onChange={e => { setEditName(e.target.value); touch('name'); markDirty(); }}
                  onBlur={() => touch('name')}
                  inputProps={{ maxLength: 100, style: { fontSize: '1.05rem', fontWeight: 800, color: '#fff', padding: 0 } }}
                  sx={{
                    '& .MuiInput-root': { color: '#fff', '&:before': { borderBottomColor: 'rgba(255,255,255,0.2)' }, '&:after': { borderBottomColor: '#fff' } },
                    '& .MuiInput-input::placeholder': { color: 'rgba(255,255,255,0.35)', opacity: 1 },
                    minWidth: 200, maxWidth: 420,
                  }}
                  error={!!fieldErrors.name && !!touched.name}
                  helperText={touched.name && fieldErrors.name ? fieldErrors.name : ''}
                  FormHelperTextProps={{ sx: { color: '#fca5a5', mt: 0.25 } }}
                />
              ) : (
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Typography fontWeight={800} fontSize="1.05rem" noWrap>{cycle?.name}</Typography>
                  {currentStatus && (
                    <Chip label={currentStatus.replace('_', ' ')} size="small"
                      sx={{ fontWeight: 700, fontSize: 10, height: 20, borderRadius: 99, ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
                  )}
                </Stack>
              )}

              {/* Period (shown in view mode without editing) */}
              {!isNew && isFrozen && (
                <Stack direction="row" alignItems="center" spacing={1} mt={0.2}>
                  <Typography fontSize={12} sx={{ opacity: 0.65 }}>
                    {fmt(cycle?.start_date)} — {fmt(cycle?.end_date)}
                  </Typography>
                  {currentStatus && (
                    <Chip label={currentStatus.replace('_', ' ')} size="small"
                      sx={{ fontWeight: 700, fontSize: 10, height: 20, borderRadius: 99, ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
                  )}
                </Stack>
              )}
              {!isNew && !isFrozen && canManageCycles && (
                currentStatus && (
                  <Chip label={currentStatus.replace('_', ' ')} size="small" sx={{ mt: 0.5, fontWeight: 700, fontSize: 10, height: 20, borderRadius: 99, ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
                )
              )}
            </Box>
          </Stack>

          {/* Right: action buttons */}
          <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0} ml={1.5}>
            {isNew ? (
              <>
                <Button onClick={() => navigate(ROUTES.DASHBOARD)}
                  sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, textTransform: 'none', borderRadius: 1.5, px: 1.5, border: '1px solid rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  Cancel
                </Button>
                <Button
                  disabled={submitting || !step0Valid || !step1Valid}
                  onClick={handleSubmit}
                  startIcon={submitting
                    ? <CircularProgress size={13} color="inherit" />
                    : isClone ? <ContentCopyIcon sx={{ fontSize: 14 }} /> : null}
                  sx={{ bgcolor: '#fff', color: '#1E3A8A', fontWeight: 700, borderRadius: 1.5, px: 2, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: '#e0f2fe' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)' } }}>
                  {submitting ? (isClone ? 'Cloning…' : 'Creating…') : (isClone ? 'Clone Cycle' : 'Create Cycle')}
                </Button>
              </>
            ) : (
              <>
                {/* Save/Discard when dirty */}
                {isDirty && canManageCycles && !isFrozen && (
                  <>
                    {saveError && <Typography sx={{ fontSize: 11, color: '#fca5a5', alignSelf: 'center' }}>{saveError}</Typography>}
                    <Button size="small" onClick={handleDiscard} disabled={isSaving}
                      sx={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600, fontSize: 12, textTransform: 'none', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.2)', px: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                      Discard
                    </Button>
                    <Button size="small" onClick={handleSave} disabled={isSaving}
                      startIcon={isSaving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 13 }} />}
                      sx={{ bgcolor: '#fff', color: '#1E3A8A', fontWeight: 700, borderRadius: 1.5, px: 1.75, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: '#e0f2fe' }, '&.Mui-disabled': { opacity: 0.6 } }}>
                      {isSaving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </>
                )}

                {/* Clone */}
                {canManageCycles && (
                  <Tooltip title="Clone this cycle">
                    <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                      onClick={() => navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', 'new')}?clone=${id}`)}
                      sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 600, borderRadius: 1.5, px: 1.5, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                      Clone
                    </Button>
                  </Tooltip>
                )}

                {/* Status actions */}
                {canManageCycles && availableActions.map(action => {
                  const cfg = ACTION_CONFIG[action];
                  const isDisabled = action === 'ACTIVE' && !!otherActive;
                  const isPrimary  = action === 'ACTIVE';
                  return (
                    <Tooltip
                      key={action}
                      title={isDisabled ? `"${otherActive.name}" is already active. Close or put it on hold first.` : ''}
                    >
                      <span>
                        <Button size="small" disabled={isDisabled}
                          onClick={() => {
                            setStatusError('');
                            setStatusConfirm({ open: true, action });
                          }}
                          sx={isPrimary && !isDisabled
                            ? { bgcolor: '#fff', color: '#1E3A8A', fontWeight: 700, borderRadius: 1.5, px: 1.75, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: '#e0f2fe' },'&.Mui-disabled': {
   opacity: 1,
  bgcolor: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.45)',
  border: '1px solid rgba(255,255,255,0.12)',
} }
                            : { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 600, borderRadius: 1.5, px: 1.75, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }, '&.Mui-disabled': {
   opacity: 1,
  bgcolor: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.45)',
  border: '1px solid rgba(255,255,255,0.12)',
} }}>
                          {cfg.label}
                        </Button>
                      </span>
                    </Tooltip>
                  );
                })}

                {/* Delete */}
                {canManageCycles && (
                  <Tooltip title={canDelete ? 'Delete cycle' : 'Only draft cycles can be deleted'}>
                    <span>
                      <Button size="small" startIcon={<DeleteOutlineIcon sx={{ fontSize: 13 }} />}
                        disabled={!canDelete}
                        onClick={() => { setDeleteError(''); setDeleteOpen(true); }}
                        sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600, borderRadius: 1.5, px: 1.5, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: 'rgba(239,68,68,0.25)' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.08)' } }}>
                        Delete
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </>
            )}
          </Stack>
        </Stack>

        {/* ── Stage stepper — only for existing cycles ──
            FIX 5: Pass rollbackTargetId so stepper highlights
            the correct stage when navigating from dashboard. */}
        {!isNew && (
          <StageStepper
            currentStageId={currentStageId}
            canAdvance={canAdvance}
            rollbackTargetId={rollbackTargetId}
            onAdvanceClick={(stage) => { setAdvanceError(''); setAdvanceConfirm({ open: true, toStage: stage }); }}
          />
        )}
      </Box>

      {/* ────────────── BODY ────────────── */}
      <Box sx={{
        flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5,
        '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 99 },
      }}>
        {successMsg && (
          <Alert severity="success" onClose={() => setMsg('')} sx={{ borderRadius: 1.5, flexShrink: 0 }}>{successMsg}</Alert>
        )}
        {submitError && (
          <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 12, flexShrink: 0 }}>{submitError}</Alert>
        )}

        {/* Create/clone hint */}
        {isNew && (
          <Box sx={{ px: 1.5, py: 1, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe', flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <InfoOutlinedIcon sx={{ fontSize: 14, color: '#3b82f6' }} />
              <Typography fontSize={12} color="#1d4ed8" fontWeight={500}>
                {isClone
                  ? `Cloning from "${source?.name}". Set new dates for this cycle and each stage.`
                  : 'Fill in the cycle name, overall period, then set date for all 5 stages.'}
              </Typography>
            </Stack>
          </Box>
        )}

        {/* ── Two-column layout ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, alignItems: 'start' }}>

          {/* ── Left: Cycle Info ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                <Typography fontWeight={700} fontSize={13} color="#1e293b">
                  {isNew ? (isClone ? 'Clone Settings' : 'Cycle Information') : 'Cycle Details'}
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Stack spacing={2}>
                  {/* Name */}
                  {(isNew || (canManageCycles && !isFrozen)) && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Cycle Name <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                      </Typography>
                      <TextField fullWidth size="small"
                        placeholder="e.g., FY25 Q3 Performance Review"
                        value={editName}
                        onChange={e => { setEditName(e.target.value); touch('name'); markDirty(); }}
                        onBlur={() => touch('name')}
                        error={!!fieldErrors.name && !!touched.name}
                        helperText={touched.name && fieldErrors.name ? fieldErrors.name : `${editName.length}/100`}
                        inputProps={{ maxLength: 100 }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                      />
                    </Box>
                  )}

                  {/* Description */}
                  {(isNew || (canManageCycles && !isFrozen)) ? (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Description
                      </Typography>
                      <TextField fullWidth size="small" multiline rows={2}
                        placeholder="Optional — describe the goals of this cycle"
                        value={editDesc}
                        onChange={e => { setEditDesc(e.target.value); markDirty(); }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                      />
                    </Box>
                  ) : cycle?.description ? (
                    <Box>
                      <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.05em" mb={0.4}>Description</Typography>
                      <Typography fontSize={13} color="#374151">{cycle.description}</Typography>
                    </Box>
                  ) : null}

                  {/* Cycle period */}
                  <Box>
                    <DateRangeField
                      label="Cycle Period"
                      required
                      startDate={editStart}
                      endDate={editEnd}
                      onChange={handleCycleDates}
                      disabled={isFrozen || (!canManageCycles && !isNew)}
                      error={touched.start && touched.end ? fieldErrors.cycleDates : undefined}
                    />
                    {durationDays && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe', mt: 1 }}>
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: '#3b82f6', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                          {durationDays} days · {Math.floor(durationDays / 7)} weeks
                        </Typography>
                      </Box>
                    )}
                    {editStart && editEnd && isNew && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, px: 1.25, py: 0.75, bgcolor: '#fefce8', borderRadius: 1.5, border: '1px solid #fde68a', mt: 1 }}>
                        <InfoOutlinedIcon sx={{ fontSize: 13, color: '#d97706', flexShrink: 0, mt: 0.1 }} />
                        <Typography sx={{ fontSize: 11, color: '#92400e' }}>
                          Stage dates must fall within <strong>{fmt(editStart)}</strong> — <strong>{fmt(editEnd)}</strong>
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Status/stage info */}
                  {!isNew && (
                    <Stack direction="row" spacing={3}>
                      <Box flex={1}>
                        <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.05em" mb={0.4}>Status</Typography>
                        <Chip label={currentStatus?.replace('_', ' ')} size="small"
                          sx={{ fontWeight: 700, borderRadius: 99, ...(STATUS_STYLES[currentStatus] ?? STATUS_STYLES.DRAFT) }} />
                      </Box>
                      <Box flex={1}>
                        <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.05em" mb={0.4}>Current Stage</Typography>
                        {cycle?.current_stage ? (
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{cycle.current_stage.id}</Typography>
                            </Box>
                            <Typography fontSize={13} color="#374151">
                              {STAGES.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name}
                            </Typography>
                          </Stack>
                        ) : <Typography fontSize={13} color="#94a3b8">—</Typography>}
                      </Box>
                    </Stack>
                  )}
                </Stack>
              </Box>

              {!isNew && isFrozen && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Box sx={{ px: 1.5, py: 1, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography fontSize={12} color="#94a3b8">
                      This cycle is <strong>{currentStatus?.toLowerCase().replace('_', ' ')}</strong>. No further changes allowed.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Clone source info */}
            {isClone && source && (
              <Paper elevation={0} sx={{ borderRadius: 2, border: '1.5px solid #bfdbfe', overflow: 'hidden', bgcolor: '#eff6ff' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25 }}>
                  <ContentCopyIcon sx={{ color: '#3b82f6', fontSize: 16 }} />
                  <Box>
                    <Typography fontSize={12} fontWeight={700} color="#1d4ed8">Cloning from: {source.name}</Typography>
                    <Typography fontSize={11} color="#3b82f6">
                      {fmt(source.start_date)} — {fmt(source.end_date)} · Status: {source.status}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* Unsaved changes notice */}
            {isDirty && !isSaving && (
              <Box sx={{ px: 1.5, py: 1, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                    <Typography fontSize={12} color="#92400e" fontWeight={500}>You have unsaved changes</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75}>
                    <Button size="small" onClick={handleDiscard}
                      sx={{ fontSize: 11, textTransform: 'none', color: '#64748b', p: 0.5, minWidth: 0 }}>Discard</Button>
                    <Button size="small" onClick={handleSave} disabled={isSaving}
                      startIcon={<SaveIcon sx={{ fontSize: 12 }} />}
                      sx={{ fontSize: 11, textTransform: 'none', color: '#1E3A8A', fontWeight: 700, p: 0.5, minWidth: 0 }}>
                      Save
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Box>

          {/* ── Right: Stage Date Windows ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
              <Typography fontWeight={700} fontSize={13} color="#1e293b">Stage Date</Typography>
              <Typography fontSize={11} color="#94a3b8">
                {isNew ? `${configuredCount}/5 configured` : canManageCycles && !isFrozen ? 'Edit inline' : ''}
              </Typography>
            </Stack>

            {/* Rollback hint banner */}
            {rollbackTargetId && !isNew && (
              <Box sx={{ px: 2, py: 1, bgcolor: '#fff7ed', borderBottom: '1px solid #fde68a' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ fontSize: 14 }}>⬅</Box>
                  <Box>
                    <Typography fontSize={12} fontWeight={700} color="#92400e">
                      Rolling back to "{STAGES.find(s => s.id === rollbackTargetId)?.name}"
                    </Typography>
                    <Typography fontSize={11} color="#b45309">
                      Update the highlighted stage dates below, then click Save.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {STAGES.map((stage, idx) => {
              const isLast = idx === STAGES.length - 1;
              const win    = !isNew ? stageWindows.find(w => w.stage_id === stage.id || w.stage?.id === stage.id) : null;
              const done   = !isNew && currentStageId && stage.id < currentStageId;
              const active = !isNew && currentStageId === stage.id;
              const isRollbackTarget = rollbackTargetId === stage.id;

              const stageStart = !isNew
                ? (editStageDates[stage.id]?.start_date || toDateOnly(win?.start_date))
                : editStageDates[stage.id]?.start_date;
              const stageEnd = !isNew
                ? (editStageDates[stage.id]?.end_date || toDateOnly(win?.end_date))
                : editStageDates[stage.id]?.end_date;
              const hasErr     = isNew && !!fieldErrors[`s${stage.id}`] && !!touched[`s${stage.id}s`];
              const configured = !!stageStart && !!stageEnd;

              // FIX 6: Date picker must be enabled for ALL stages when in rollback mode,
              // not just the target stage. Admin needs to adjust surrounding dates too.
              const datePickerDisabled = isFrozen || (
                !rollbackTargetId && !canManageCycles && !isNew
              );

              return (
                <Box key={stage.id}
                  ref={isRollbackTarget ? stageDateRef : undefined}
                  sx={{
                  borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                  bgcolor: isRollbackTarget ? '#eff6ff' : active ? '#f0f7ff' : configured && !isNew ? '#fafffe' : configured ? '#f0f7ff' : '#fff',
                  border: isRollbackTarget ? '2px solid #3b82f6' : undefined,
                  borderRadius: isRollbackTarget ? 1 : undefined,
                  transition: 'background-color 0.15s',
                  animation: isRollbackTarget ? 'rollbackPulse 1.5s ease-in-out 2' : undefined,
                  '@keyframes rollbackPulse': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
                    '50%': { boxShadow: '0 0 0 4px rgba(59,130,246,0.25)' },
                  },
                }}>
                  <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25 }} spacing={1.5}>

                    {/* Stage circle */}
                    <Box sx={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: done ? '#10b981' : isRollbackTarget ? '#3b82f6' : active ? gradient : (configured && isNew) ? gradient : hasErr ? '#fee2e2' : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                      boxShadow: isRollbackTarget ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none',
                    }}>
                      {done
                        ? <CheckCircleIcon sx={{ fontSize: 13, color: '#fff' }} />
                        : <Typography sx={{ fontSize: 10, fontWeight: 800, color: (isRollbackTarget || active || (configured && isNew)) ? '#fff' : hasErr ? '#ef4444' : '#94a3b8' }}>
                            {stage.id}
                          </Typography>}
                    </Box>

                    {/* Stage name */}
                    <Typography
                      fontWeight={isRollbackTarget ? 700 : active ? 700 : configured ? 600 : 500}
                      fontSize={13}
                      color={isRollbackTarget ? '#1E3A8A' : active ? '#1E3A8A' : hasErr ? '#dc2626' : '#374151'}
                      sx={{ width: 180, flexShrink: 0 }}
                    >
                      {isRollbackTarget && <span style={{ marginRight: 4 }}>📍</span>}
                      {stage.name}
                    </Typography>

                    {/* Date inline to the right */}
                    <Box flex={1} minWidth={0}>
                      {(!isNew && isFrozen) ? (
                        <Typography fontSize={12} color="#64748b">
                          {configured
                            ? `${fmt(stageStart)} → ${fmt(stageEnd)}`
                            : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Not configured</span>}
                        </Typography>
                      ) : (
                        <DateRangeField
                          startDate={stageStart}
                          endDate={stageEnd}
                          onChange={val => updateStageDraft(stage.id, val)}
                          minDate={rollbackTargetId ? undefined : (editStart || undefined)}
                          disabled={datePickerDisabled}
                          error={hasErr ? fieldErrors[`s${stage.id}`] : undefined}
                        />
                      )}
                    </Box>

                  </Stack>
                </Box>
              );
            })}
          </Paper>
        </Box>
      </Box>

      {/* ────────────── DIALOGS ────────────── */}
      <ConfirmDialog
        open={advanceConfirm.open}
        title="Advance Stage"
        message={`Move to Stage ${(currentStageId ?? 0) + 1}: "${advanceConfirm.toStage?.name}"?`}
        warning="All enrolled employees will be moved to the new stage. This cannot be undone."
        confirmLabel="Advance"
        confirmColor="#1E3A8A"
        loading={advanceLoading}
        error={advanceError}
        onClose={() => setAdvanceConfirm({ open: false, toStage: null })}
        onConfirm={handleAdvanceStage}
      />
      {statusConfirm.open && statusConfirm.action && (
        <ConfirmDialog
          open={statusConfirm.open}
          title={`${ACTION_CONFIG[statusConfirm.action]?.label} Cycle`}
          message={`Are you sure you want to ${ACTION_CONFIG[statusConfirm.action]?.label?.toLowerCase()} "${cycle?.name}"?`}
          warning={
            statusConfirm.action === 'CANCELLED' ? 'This cannot be undone. The cycle and all assignments will be permanently cancelled.'
              : statusConfirm.action === 'CLOSED' ? 'Closing will lock all assessments and cannot be reversed.'
              : statusConfirm.action === 'ACTIVE' ? 'Activating will send email notifications to all VLs and HRs.'
              : null
          }
          confirmLabel={ACTION_CONFIG[statusConfirm.action]?.label}
          confirmColor={ACTION_CONFIG[statusConfirm.action]?.confirmColor}
          loading={statusLoading}
          error={statusError}
          onClose={() => { setStatusConfirm({ open: false, action: null }); setStatusError(''); }}
          onConfirm={handleStatusChange}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Cycle"
        message={`Delete "${cycle?.name}"?`}
        warning="This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="#dc2626"
        loading={deleteLoading}
        error={deleteError}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}