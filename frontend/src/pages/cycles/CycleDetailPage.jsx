import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, IconButton, Tooltip,
  Dialog, DialogContent, DialogActions, TextField,
  Stepper, Step, StepLabel, Menu, MenuItem, ListItemIcon,
} from '@mui/material';
import ArrowBackIcon        from '@mui/icons-material/ArrowBack';
import ContentCopyIcon      from '@mui/icons-material/ContentCopy';
import AssignmentIndIcon    from '@mui/icons-material/AssignmentInd';
import RateReviewIcon       from '@mui/icons-material/RateReview';
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import SaveIcon             from '@mui/icons-material/Save';
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon      from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon     from '@mui/icons-material/ChevronRight';
import CloseIcon            from '@mui/icons-material/Close';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon     from '@mui/icons-material/InfoOutlined';
import EditIcon             from '@mui/icons-material/Edit';
import MoreVertIcon         from '@mui/icons-material/MoreVert';
import PlayArrowIcon        from '@mui/icons-material/PlayArrow';
import PauseIcon            from '@mui/icons-material/Pause';
import BlockIcon            from '@mui/icons-material/Block';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { getCycles, createCycle, updateCycle, cloneCycle, advanceCycleStage, getReferenceData } from '../../api/cyclesApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';
import useRoleAccess from '../../hooks/useRoleAccess';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

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
  ACTIVE:    { label: 'Activate',    icon: <PlayArrowIcon fontSize="small" />,   confirmColor: '#15803d' },
  ON_HOLD:   { label: 'Put On Hold', icon: <PauseIcon fontSize="small" />,       confirmColor: '#9a3412' },
  CLOSED:    { label: 'Close Cycle', icon: <CheckCircleIcon fontSize="small" />, confirmColor: '#1E3A8A' },
  CANCELLED: { label: 'Cancel Cycle',icon: <BlockIcon fontSize="small" />,       confirmColor: '#dc2626' },
};
const ACTION_DIALOG_CONFIG = {
  ACTIVE: { title: 'Activate Cycle', confirmLabel: 'Activate Cycle', cancelLabel: 'Not Now',},
  CLOSED: { title: 'Close Cycle', confirmLabel: 'Close Cycle', cancelLabel: 'Keep Open', },
  CANCELLED: { title: 'Cancel Cycle', confirmLabel: 'Cancel Cycle', cancelLabel: 'Keep Cycle', },
  ON_HOLD: { title: 'Put Cycle On Hold', confirmLabel: 'Put On Hold', cancelLabel: 'Keep Active', },
};

/* ─────────────── helpers ─────────────── */
function toDateOnly(s) { return s ? String(s).split('T')[0].split(' ')[0].trim() : ''; }
function fmt(s) {
  if (!s) return '—';
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtShort(s) {
  if (!s) return null;
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function toISO(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

/* ─────────────── RangePicker ─────────────── */
function RangePicker({ startDate, endDate, onChange, minDate, maxDate, onClose }) {
  const init = () => {
    const src = minDate || startDate;
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

  

  const maxD = maxDate ? new Date(toDateOnly(maxDate) + 'T00:00:00') : null;
  function disabled(d) {
    if (!d) return true;
    const dt = new Date(vy, vm, d);
    if (minD) { const m2 = new Date(minD); m2.setHours(0,0,0,0); if (dt < m2) return true; }
    if (maxD) { const m3 = new Date(maxD); m3.setHours(0,0,0,0); if (dt > m3) return true; }
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

  return (
    <Box sx={{
      width: 248, borderRadius: 2, overflow: 'hidden', bgcolor: '#fff',
      boxShadow: '0 12px 40px -4px rgba(15,23,42,0.18), 0 2px 8px -2px rgba(15,23,42,0.08)',
      border: '1px solid #e2e8f0',
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 1.25, py: 0.75, background: gradient }}>
        <IconButton size="small"
          disabled={minD && new Date(vy, vm, 1) <= new Date(minD.getFullYear(), minD.getMonth(), 1)}
          onClick={() => vm===0 ? (setVm(11),setVy(y=>y-1)) : setVm(m=>m-1)}
          sx={{ color:'#fff', p:0.2, '&:hover':{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 }, '&.Mui-disabled': { opacity: 0.3 } }}>
          <ChevronLeftIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{MONTHS[vm].slice(0,3)} {vy}</Typography>
        <IconButton size="small"
          disabled={maxD && new Date(vy, vm, 1) >= new Date(maxD.getFullYear(), maxD.getMonth(), 1)}
          onClick={() => vm===11 ? (setVm(0),setVy(y=>y+1)) : setVm(m=>m+1)}
          sx={{ color:'#fff', p:0.2, '&:hover':{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:1 }, '&.Mui-disabled': { opacity: 0.3 } }}>
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

/* ─────────────── DateRangeField ─────────────── */
function DateRangeField({ startDate, endDate, onChange, minDate, maxDate, disabled: dis, label, required, error: fieldError }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef();
  const popupRef   = useRef();

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
            maxDate={maxDate}
            onClose={() => setOpen(false)}
          />
        </Box>
      )}
    </Box>
  );
}

/* ─────────────── ConfirmDialog ─────────────── */
function ConfirmDialog({ open, title, message, warning, confirmLabel,cancelLabel = 'Cancel', confirmColor, onClose, onConfirm, loading, error }) {
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
          {cancelLabel}
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

/* ─────────────── StageStepper ─────────────── */
function StageStepper({
  stages,
  stageWindows, 
  currentStageId,
  canAdvance,
  onAdvanceClick,
  onRollbackClick,
  rollbackTargetId,
  cycleName,
  cycleStart,
  cycleEnd,
  daysRemaining,
}) {
  const activeStep = rollbackTargetId
    ? rollbackTargetId - 1
    : (currentStageId ?? 1) - 1;

  return (
    <Box sx={{ mt: 0, px: 0, pb: 0 }}>

      {/* ── Stepper ── */}
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          '& .MuiStepConnector-line': {
            borderColor: 'rgba(255,255,255,0.14)',
            borderTopWidth: 2,
            borderRadius: 99,
            transition: '0.2s ease',
          },

          '& .MuiStepLabel-label': {
            color: 'rgba(255,255,255,0.48)',
            fontSize: 11,
            fontWeight: 500,
            mt: 0.9,
            transition: 'all 0.2s ease',
            letterSpacing: '0.01em',
          },

          '& .MuiStepLabel-label.Mui-active': {
            color: '#ffffff !important',
            fontWeight: '800 !important',
            opacity: 1,
          },

          '& .MuiStepLabel-label.Mui-completed': {
            color: '#86efac !important',
            fontWeight: '600 !important',
            cursor: canAdvance ? 'pointer' : 'default',
          },

          '& .MuiStepIcon-root': {
            color: 'rgba(255,255,255,0.18)',
            fontSize: 30,
            transition: 'all 0.22s ease',
          },

          '& .MuiStepIcon-text': {
            fill: '#dbeafe',
            fontWeight: 700,
            fontSize: 12,
          },

          '& .Mui-active .MuiStepIcon-root': {
            color: '#ffffff',
            border: '2px solid rgba(255,255,255,0.72)',
            borderRadius: '50%',
            padding: '2px',
            boxSizing: 'content-box',
            filter: 'drop-shadow(0 2px 10px rgba(255,255,255,0.12))',
          },

          '& .Mui-active .MuiStepIcon-text': {
            fill: '#1E3A8A',
            fontWeight: 800,
          },

          '& .Mui-completed .MuiStepIcon-root': {
            color: '#22c55e',
            transition: 'all 0.22s ease',
          },

          '& .Mui-completed .MuiStepIcon-root:hover': {
            color: canAdvance ? '#f59e0b' : '#22c55e',
            transform: canAdvance ? 'scale(1.1)' : 'none',
          },

          '& .Mui-completed .MuiStepIcon-text': {
            fill: '#ffffff',
          },

          '& .MuiStepLabel-root:hover .MuiStepIcon-root': {
            transform: 'scale(1.05)',
          },
        }}
      >
        {stages.map((stage) => {
          const done = rollbackTargetId
            ? stage.id < rollbackTargetId
            : currentStageId && stage.id < currentStageId;

          const isNext =
            !rollbackTargetId &&
            canAdvance &&
            stage.id === (currentStageId ?? 0) + 1;

          const isRollbackable =
            !rollbackTargetId &&
            canAdvance &&
            done;

          const win = (stageWindows ?? []).find(w => w.stage_id === stage.id);

          return (
            <Step key={stage.id} completed={done}>
              <Tooltip
                title={
                  win?.start_date && win?.end_date
                    ? `${fmt(win.start_date)} → ${fmt(win.end_date)}`
                    : 'No dates configured'
                }
                arrow
                placement="top"
              >
                <StepLabel
                  onClick={() => {
                    if (isNext) onAdvanceClick(stage);
                    else if (isRollbackable) onRollbackClick(stage);
                  }}
                  sx={{ cursor: isNext || isRollbackable ? 'pointer' : 'default' }}
                >
                  {stage.name}
                </StepLabel>
              </Tooltip>
            </Step>
          );

        })}
      </Stepper>

      {/* ── Bottom centered hint ── */}
      <Typography
        sx={{
          mt: 2,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        {rollbackTargetId
          ? `Rolling back to "${
              stages.find((s) => s.id === rollbackTargetId)?.name
            }" — update dates & save`
          : canAdvance
            ? 'Click next stage to advance · Click completed stage to roll back'
            : ''}
      </Typography>
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
  const editModeParam = searchParams.get('edit') === 'true';
  const stageDateRef = useRef(null);

  const [cycle, setCycle]     = useState(null);
  const [source, setSource]   = useState(null);
  const [allCycles, setAll]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [stages, setStages]   = useState([]);
  const [error, setError]     = useState('');
  const [successMsg, setMsg]  = useState('');

  /* ── Edit mode: read-only by default for existing cycles ── */
  const [isEditMode, setIsEditMode] = useState(false || editModeParam);

  const [editName, setEditName]         = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [editStart, setEditStart]       = useState('');
  const [editEnd, setEditEnd]           = useState('');
  const [editStageDates, setEditStages] = useState({});

  const [isDirty, setIsDirty]     = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched]         = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [advanceConfirm, setAdvanceConfirm] = useState({ open: false, toStage: null });
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError]     = useState('');

  const [rollbackConfirm, setRollbackConfirm] = useState({ open: false, toStage: null });
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackError, setRollbackError]     = useState('');

  const [statusConfirm, setStatusConfirm] = useState({ open: false, action: null });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError]     = useState('');

  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [unsavedWarningOpen, setUnsavedWarningOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation]   = useState(null);

  function flash(msg) { setMsg(msg); setTimeout(() => setMsg(''), 4000); }
  function touch(...keys) { setTouched(t => { const n = { ...t }; keys.forEach(k => n[k] = true); return n; }); }
  function markDirty() { if (!isNew) setIsDirty(true); }

  useEffect(() => {
    if (!isNew && !isEditMode) return;
    const errors = {};
    if (touched.name  && !editName.trim()) errors.name = 'Required.';
    if (touched.name  && editName.trim().length > 100) errors.name = 'Max 100 chars.';
    if (touched.start && !editStart) errors.cycleDates = 'Start date required.';
    if (touched.end   && !editEnd)   errors.cycleDates = 'End date required.';
    if (touched.end && editStart && editEnd && editEnd <= editStart) errors.cycleDates = 'End must be after start.';

    stages.forEach((s, idx) => {
      const d        = editStageDates[s.id] ?? {};
      const prevS    = idx > 0 ? (editStageDates[stages[idx - 1].id] ?? {}) : null;
      const nextS    = idx < stages.length - 1 ? (editStageDates[stages[idx + 1].id] ?? {}) : null;
      const isTouched = touched[`s${s.id}s`] || touched[`s${s.id}e`];

      if (!isTouched) return;

      if (!d.start_date) { errors[`s${s.id}`] = 'Start date required.'; return; }
      if (!d.end_date)   { errors[`s${s.id}`] = 'End date required.'; return; }

      // end must be after start
      if (d.end_date <= d.start_date) {
        errors[`s${s.id}`] = 'End date must be after start date.'; return;
      }

      // must be within cycle period
      if (editStart && d.start_date < editStart) {
        errors[`s${s.id}`] = `Must start on or after cycle start (${fmt(editStart)}).`; return;
      }
      if (editEnd && d.end_date > editEnd) {
        errors[`s${s.id}`] = `Must end on or before cycle end (${fmt(editEnd)}).`; return;
      }

      // must start the day after previous stage ends (no gap, no overlap)
      if (prevS?.end_date) {
        const expectedStart = (() => {
          const [y, m, d] = prevS.end_date.split('-').map(Number);
          const next = new Date(y, m - 1, d + 1);
          return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
        })();
        if (d.start_date < expectedStart) {
          errors[`s${s.id}`] = `Overlaps with previous stage. Must start on ${fmt(expectedStart)}.`; return;
        }
        if (d.start_date > expectedStart) {
          errors[`s${s.id}`] = `Gap with previous stage. Must start on ${fmt(expectedStart)}.`; return;
        }
      }

      // must end before next stage starts
      if (nextS?.start_date && d.end_date >= nextS.start_date) {
        errors[`s${s.id}`] = `Overlaps with next stage (starts ${fmt(nextS.start_date)}).`; return;
      }
    });

    setFieldErrors(errors);
  }, [editName, editStart, editEnd, editStageDates, touched, isNew, isEditMode, stages]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const refRes = await getReferenceData();
      const fetchedStages = refRes.data.stages ?? [];
      setStages(fetchedStages);
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
        fetchedStages.forEach(s => { sd[s.id] = { start_date: '', end_date: '' }; });
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
        fetchedStages.forEach(s => { sd[s.id] = { start_date: '', end_date: '' }; });
        (found.cycle_stages ?? []).forEach(w => {
          const sid = w.stage_id ?? w.stage?.id;
          if (sid) sd[sid] = { start_date: toDateOnly(w.start_date), end_date: toDateOnly(w.end_date) };
        });
        setEditStages(sd);
        setIsDirty(false);
        setIsEditMode(!!rollbackTargetId || editModeParam); // reset to read-only on data reload
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load data.');
    } finally { setLoading(false); }
  }, [id, isNew, isCreate, isClone, cloneId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentStatus    = cycle?.status ?? null;
  const currentStageId   = cycle?.current_stage?.id ?? null;
  const availableActions = STATUS_ACTIONS[currentStatus] ?? [];
  const isFrozen   = currentStatus === 'CLOSED' || currentStatus === 'CANCELLED';
  const canDelete  = currentStatus === 'DRAFT';
  const canAdvance = !isNew && currentStatus === 'ACTIVE' && canManageCycles && currentStageId && currentStageId < 5;
  const otherActive    = allCycles.find(c => c.status === 'ACTIVE' && String(c.id) !== String(id));
  const stageWindows   = cycle?.cycle_stages ?? [];

  // Compute days remaining
  const daysRemaining = (() => {
    if (currentStatus !== 'ACTIVE' || !currentStageId) return null;
    const currentStageWindow = stageWindows.find(w => w.stage_id === currentStageId);
    if (!currentStageWindow?.end_date) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const end = new Date(toDateOnly(currentStageWindow.end_date) + 'T00:00:00');
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  })();

  const step0Valid = !!editName.trim() && !!editStart && !!editEnd && editEnd > editStart;
  const step1Valid = true;
  const configuredCount = stages.filter(s => editStageDates[s.id]?.start_date && editStageDates[s.id]?.end_date).length;
  const durationDays = editStart && editEnd && editEnd > editStart
    ? Math.round((new Date(editEnd) - new Date(editStart)) / 86400000) : null;

  useEffect(() => {
    if (!rollbackTargetId) return;
    setIsDirty(true);
    setIsEditMode(true); // auto-enter edit mode for rollback
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

  /* ── Enter / exit edit mode ── */
  function handleEnterEdit() {
    setIsEditMode(true);
    setSaveError('');
    // small delay so DOM updates, then focus name
    setTimeout(() => document.querySelector('input[placeholder]')?.focus(), 100);
  }
  function handleCancelEdit() {
    // restore from cycle data
    if (cycle) {
      setEditName(cycle.name);
      setEditDesc(cycle.description || '');
      setEditStart(toDateOnly(cycle.start_date));
      setEditEnd(toDateOnly(cycle.end_date));
      const sd = {};
      stages.forEach(s => { sd[s.id] = { start_date: '', end_date: '' }; });
      (cycle.cycle_stages ?? []).forEach(w => {
        const sid = w.stage_id ?? w.stage?.id;
        if (sid) sd[sid] = { start_date: toDateOnly(w.start_date), end_date: toDateOnly(w.end_date) };
      });
      setEditStages(sd);
      setIsDirty(false);
      setSaveError('');
      if (rollbackTargetId) setSearchParams({}, { replace: true });
    }
    setIsEditMode(false);
  }

  async function handleSubmit() {
    const allT = { name: true, start: true, end: true };
    setTouched(allT);
    if (!step0Valid || !step1Valid) { setSubmitError('Please fill in all required fields.'); return; }
    const anyStageSet = stages.some(s => editStageDates[s.id]?.start_date || editStageDates[s.id]?.end_date);
    if (anyStageSet) {
      const stageOutOfRange = stages.find(s => {
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
      // Check sequential / no-overlap only if stages are partially/fully filled
      for (let i = 1; i < stages.length; i++) {
        const prev = editStageDates[stages[i - 1].id] ?? {};
        const curr = editStageDates[stages[i].id] ?? {};
        if (prev.end_date && curr.start_date) {
          const expectedStart = (() => {
            const [y, mo, dy] = prev.end_date.split('-').map(Number);
            const next = new Date(y, mo - 1, dy + 1);
            return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
          })();
          if (curr.start_date !== expectedStart) {
            setSubmitError(`"${stages[i].name}" must start on ${fmt(expectedStart)} (day after "${stages[i-1].name}" ends).`);
            return;
          }
        }
      }
    }
    setSubmitting(true); setSubmitError('');
    try {
      const configuredStages = stages.filter(s => editStageDates[s.id]?.start_date && editStageDates[s.id]?.end_date);
      const payload = {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        start_date: editStart,
        end_date: editEnd,
        stages: configuredStages.map(s => ({ stage_id: s.id, start_date: editStageDates[s.id].start_date, end_date: editStageDates[s.id].end_date })),
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

  async function handleSave() {
    if (!editName.trim()) { setSaveError('Cycle name is required.'); return; }
    for (let i = 1; i < stages.length; i++) {
      const prev = editStageDates[stages[i - 1].id] ?? {};
      const curr = editStageDates[stages[i].id] ?? {};
      if (prev.end_date && curr.start_date) {
        const expectedStart = (() => {
          const [y, mo, dy] = prev.end_date.split('-').map(Number);
          const next = new Date(y, mo - 1, dy + 1);
          return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
        })();
        if (curr.start_date !== expectedStart) {
          setSaveError(`"${stages[i].name}" must start on ${fmt(expectedStart)} (day after "${stages[i-1].name}" ends).`);
          return;
        }
      }
    }
    setIsSaving(true); setSaveError('');
    try {
      await updateCycle(id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        start_date: editStart,
        end_date: editEnd,
        stages: stages.map(s => ({
          stage_id: s.id,
          start_date: editStageDates[s.id]?.start_date || null,
          end_date: editStageDates[s.id]?.end_date || null,
        })),
      });
      if (rollbackTargetId) {
        await advanceCycleStage(id, { target_stage_id: rollbackTargetId });
      }
      invalidateCyclesCache();
      if (rollbackTargetId) setSearchParams({}, { replace: true });
      await fetchData(); // resets isEditMode to false inside
      setIsDirty(false);
      setIsEditMode(false);
      flash(rollbackTargetId
        ? `Rolled back to "${stages.find(s => s.id === rollbackTargetId)?.name}" and saved.`
        : 'Changes saved.'
      );
    } catch (err) {
      setSaveError(err?.response?.data?.error || 'Save failed.');
    } finally { setIsSaving(false); }
  }

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

  /* ── Rollback: navigate to ?rollback=stageId to trigger edit mode ── */
  function handleRollbackClick(stage) {
    setRollbackConfirm({ open: true, toStage: stage });
  }
  function confirmRollback() {
    const stage = rollbackConfirm.toStage;
    setRollbackConfirm({ open: false, toStage: null });
    setSearchParams({ rollback: String(stage.id) }, { replace: true });
  }

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

  /* ── All status actions go in 3-dot (Activate is primary only if no frozen) ── */
  const primaryAction    = availableActions.find(a => a === 'ACTIVE') ?? null;
  const secondaryActions = availableActions.filter(a => a !== 'ACTIVE');

  /* Is the form editable right now? */
  const formEditable = isNew || (isEditMode && canManageCycles && !isFrozen);

  /* ══════════════ RENDER ══════════════ */
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8fafc' }}>

      {/* ────────────── TOP BAR ────────────── */}
      <Box sx={{ flexShrink: 0, bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', px: 2.5, py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton
            onClick={() => {
              if (isDirty && isEditMode && !isNew) {
                setPendingNavigation(ROUTES.DASHBOARD);
                setUnsavedWarningOpen(true);
              } else {
                navigate(ROUTES.DASHBOARD);
              }
            }}
            size="small"
            sx={{ color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 1.5, p: 0.5, '&:hover': { bgcolor: '#f1f5f9', color: '#1E3A8A' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography fontWeight={800} color="#0f172a" sx={{ fontSize: '1.05rem', lineHeight: 1.2 }}>
            {isCreate ? 'Create New Cycle' : isClone ? 'Clone Cycle' : 'Cycle Details'}
          </Typography>
        </Stack>
      </Box>

      {/* ────────────── CYCLE BANNER ────────────── */}
      {!isNew && cycle && (
        <Box sx={{ px: 2, pt: 1.5, flexShrink: 0 }}>
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 20px rgba(30,58,138,0.18)' }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 2, background: gradient, color: '#fff' }}>

              {/* Top row: LIVE chip + status badge + action buttons (right) */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                {/* Left: LIVE + cycle info */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  {currentStatus === 'ACTIVE' && (
                    <Chip
                      label="LIVE"
                      size="small"
                      sx={{
                        bgcolor: '#10b981',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 800,
                        height: 17,
                      }}
                    />
                  )}

                  <Typography
                    sx={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cycle.name}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: 11,
                      opacity: 0.85,
                      color: 'rgba(255,255,255,0.72)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmt(cycle.start_date)} — {fmt(cycle.end_date)}
                  </Typography>

                  {currentStageId && (() => {
                    const currentStageWindow = stageWindows.find(w => w.stage_id === currentStageId);
                    if (!currentStageWindow?.start_date || !currentStageWindow?.end_date) return null;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const end = new Date(toDateOnly(currentStageWindow.end_date) + 'T00:00:00');
                    const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                    return (
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: days > 7 ? 'rgba(255,255,255,0.68)' : days >= 0 ? '#fcd34d' : '#fca5a5',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {`( Stage Duration: ${fmt(currentStageWindow.start_date)} -> ${fmt(currentStageWindow.end_date)}  ·  ${
                          days > 0 ? `${days} days left )` : days === 0 ? 'Ends today )' : `Overdue by ${Math.abs(days)} days )`
                        }`}
                      </Typography>
                    );
                  })()}
                </Stack>

                {/* Right: Edit (always visible outside), then 3-dot with everything else */}
                <Stack direction="row" spacing={0.75} alignItems="center">

                  {/* Primary status action (Activate) */}
                  {canManageCycles && primaryAction && (
                    <Tooltip title={otherActive ? `"${otherActive.name}" is already active` : ''}>
                      <span>
                        <Button size="small" disabled={!!otherActive}
                          onClick={() => { setStatusError(''); setStatusConfirm({ open: true, action: primaryAction }); }}
                          sx={{ bgcolor: '#fff', color: '#1E3A8A', borderRadius: 99, fontSize: 11, fontWeight: 700, px: 1.25, py: 0.4, textTransform: 'none', '&:hover': { bgcolor: '#f0f6ff' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' } }}>
                          {ACTION_CONFIG[primaryAction].label}
                        </Button>
                      </span>
                    </Tooltip>
                  )}

                  {/* Edit button — always outside, visible when not frozen */}
                  {canManageCycles && !isFrozen && !isEditMode && (
                    <Button
                      size="small"
                      startIcon={<EditIcon sx={{ fontSize: 13 }} />}
                      onClick={handleEnterEdit}
                      sx={{ bgcolor: '#fff', color: '#1E3A8A', borderRadius: 99, fontSize: 11, fontWeight: 700, px: 1.25, py: 0.4, textTransform: 'none', '&:hover': { bgcolor: '#f0f6ff' } }}>
                      Edit
                    </Button>
                  )}

                  {/* 3-dot menu: Clone + secondary status actions + delete */}
                  {canManageCycles && (
                    <>
                      <Tooltip title="More actions">
                        <IconButton size="small" onClick={e => setActionsAnchor(e.currentTarget)}
                          sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, width: 28, height: 28, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                          <MoreVertIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Menu
                        anchorEl={actionsAnchor}
                        open={Boolean(actionsAnchor)}
                        onClose={() => setActionsAnchor(null)}
                        PaperProps={{ sx: { borderRadius: 2, mt: 0.5, minWidth: 170, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '0.5px solid #e2e8f0' } }}>

                        {/* Clone — now inside 3-dot */}
                        <MenuItem
                          onClick={() => { setActionsAnchor(null); navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', 'new')}?clone=${id}`); }}
                          sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}><ContentCopyIcon sx={{ fontSize: 16 }} /></ListItemIcon>
                          Clone Cycle
                        </MenuItem>
                        
                        <MenuItem
                          onClick={() => { setActionsAnchor(null); navigate(`${ROUTES.ASSIGNMENTS}?cycleId=${id}`); }}
                          sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}><AssignmentIndIcon sx={{ fontSize: 16, color: '#0369a1' }} /></ListItemIcon>
                          KRA Assignment
                        </MenuItem>

                        <MenuItem
                          onClick={() => { setActionsAnchor(null); navigate(`${ROUTES.ASSESSMENTS_SELF}?cycleId=${id}`); }}
                          sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}><RateReviewIcon sx={{ fontSize: 16, color: '#7c3aed' }} /></ListItemIcon>
                          KRA Assessment
                        </MenuItem>

                        {/* Secondary status actions */}
                        {secondaryActions.map(action => {
                          const cfg = ACTION_CONFIG[action];
                          return (
                            <MenuItem key={action}
                              onClick={() => { setActionsAnchor(null); setStatusError(''); setStatusConfirm({ open: true, action }); }}
                              sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1 }}>
                              <ListItemIcon sx={{ minWidth: 24 }}>{cfg.icon}</ListItemIcon>
                              {cfg.label}
                            </MenuItem>
                          );
                        })}

                        {/* Delete */}
                        {canDelete && (
                          <MenuItem
                            onClick={() => { setActionsAnchor(null); setDeleteError(''); setDeleteOpen(true); }}
                            sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1, color: '#ef4444' }}>
                            <ListItemIcon sx={{ minWidth: 24 }}><DeleteOutlineIcon sx={{ fontSize: 16, color: '#ef4444' }} /></ListItemIcon>
                            Delete Cycle
                          </MenuItem>
                        )}
                      </Menu>
                    </>
                  )}
                </Stack>
              </Stack>

              {/* Stage stepper — name/dates/hint now rendered inside StageStepper below stepper */}
              <StageStepper
                stages={stages}
                stageWindows={stageWindows}
                currentStageId={currentStageId}
                canAdvance={canAdvance}
                rollbackTargetId={rollbackTargetId}
                cycleName={cycle.name}
                cycleStart={cycle.start_date}
                cycleEnd={cycle.end_date}
                daysRemaining={daysRemaining}
                onAdvanceClick={(stage) => { setAdvanceError(''); setAdvanceConfirm({ open: true, toStage: stage }); }}
                onRollbackClick={handleRollbackClick}
              />
            </Box>
          </Paper>
        </Box>
      )}

      {/* ────────────── BODY ────────────── */}
      <Box sx={{
        flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5,
        pb: (isDirty && !isNew && isEditMode) ? 8 : 2,
        '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 99 },
      }}>
        {successMsg && (
          <Alert severity="success" onClose={() => setMsg('')} sx={{ borderRadius: 1.5, flexShrink: 0 }}>{successMsg}</Alert>
        )}
        {submitError && (
          <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 12, flexShrink: 0 }}>{submitError}</Alert>
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
                  {formEditable ? (
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
                  ) : (
                    <Box>
                      <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.05em" mb={0.4}>Cycle Name</Typography>
                      <Typography fontSize={14} fontWeight={700} color="#0f172a">{editName}</Typography>
                    </Box>
                  )}

                  {/* Description */}
                  {formEditable ? (
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
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Cycle Period {formEditable && <Box component="span" sx={{ color: '#ef4444' }}>*</Box>}
                      </Typography>
                    </Stack>
                    {formEditable ? (
                      <>
                        <DateRangeField
                          label=""
                          required
                          startDate={editStart}
                          endDate={editEnd}
                          onChange={handleCycleDates}
                          disabled={false}
                          error={touched.start && touched.end ? fieldErrors.cycleDates : undefined}
                        />
                        {editStart && editEnd && isNew && (
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, px: 1.25, py: 0.75, bgcolor: '#fefce8', borderRadius: 1.5, border: '1px solid #fde68a', mt: 1 }}>
                            <InfoOutlinedIcon sx={{ fontSize: 13, color: '#d97706', flexShrink: 0, mt: 0.1 }} />
                            <Typography sx={{ fontSize: 11, color: '#92400e' }}>
                              Stage dates must fall within <strong>{fmt(editStart)}</strong> — <strong>{fmt(editEnd)}</strong>
                            </Typography>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Typography fontSize={13} color="#374151" fontWeight={500}>
                        {fmt(editStart)} — {fmt(editEnd)}
                        {durationDays && (
                          <Box component="span" sx={{ ml: 1, fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                            ( Duration: {durationDays} days )
                          </Box>
                        )}
                      </Typography>
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
                              {stages.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name}
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

            {/* Create new cycle actions */}
            {isNew && (
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button onClick={() => navigate(ROUTES.DASHBOARD)}
                  sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, fontSize: 13, borderRadius: 1.5, border: '1px solid #e2e8f0', px: 2 }}>
                  Cancel
                </Button>
                <Button
                  disabled={submitting || !step0Valid}
                  onClick={handleSubmit}
                  variant="contained"
                  startIcon={submitting
                    ? <CircularProgress size={13} color="inherit" />
                    : isClone ? <ContentCopyIcon sx={{ fontSize: 14 }} /> : null}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13, background: gradient, 
                    '&:hover': { background: gradient, opacity: 0.9 }, 
                    '&.Mui-disabled': {
                      opacity: 1,
                      background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      color: 'rgba(255,255,255,0.75)',
                    } }}>
                  {submitting ? (isClone ? 'Cloning…' : 'Creating…') : (isClone ? 'Clone Cycle' : 'Create Cycle')}
                </Button>
              </Stack>
            )}

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
          </Box>

          {/* ── Right: Stage Date Windows ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
              <Typography fontWeight={700} fontSize={13} color="#1e293b">Stage Dates</Typography>
              <Typography fontSize={11} color="#94a3b8">
                {isNew ? `${configuredCount}/5 configured (optional)` : formEditable ? 'Edit inline' : 'Read-only'}
              </Typography>
            </Stack>

            {/* Rollback hint banner */}
            {rollbackTargetId && !isNew && (
              <Box sx={{ px: 2, py: 1, bgcolor: '#fff7ed', borderBottom: '1px solid #fde68a' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ fontSize: 14 }}>⬅</Box>
                  <Box>
                    <Typography fontSize={12} fontWeight={700} color="#92400e">
                      Rolling back to "{stages.find(s => s.id === rollbackTargetId)?.name}"
                    </Typography>
                    <Typography fontSize={11} color="#b45309">
                      Update the highlighted stage dates below, then click Save.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {stages.map((stage, idx) => {
              const isLast = idx === stages.length - 1;
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

              // Date picker editable only in formEditable mode
              const datePickerDisabled = !formEditable || isFrozen;

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
                    <Typography
                      fontWeight={isRollbackTarget ? 700 : active ? 700 : configured ? 600 : 500}
                      fontSize={13}
                      color={isRollbackTarget ? '#1E3A8A' : active ? '#1E3A8A' : hasErr ? '#dc2626' : '#374151'}
                      sx={{ width: 180, flexShrink: 0 }}
                    >
                      {isRollbackTarget && <span style={{ marginRight: 4 }}>📍</span>}
                      {stage.name}
                    </Typography>
                    <Box flex={1} minWidth={0}>
                      {(!formEditable || isFrozen) ? (
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
                          minDate={editStart || undefined}
                          maxDate={editEnd || undefined}
                          disabled={false}
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

      {/* ────────────── FLOATING SAVE / CANCEL BAR ────────────── */}
      {!isNew && isEditMode && canManageCycles && !isFrozen && (
        <Box sx={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2.5,
          px: 2, py: 1.25,
          boxShadow: '0 8px 32px rgba(15,23,42,0.15), 0 2px 8px rgba(15,23,42,0.08)',
        }}>
          {saveError && (
            <Typography sx={{ fontSize: 11, color: '#ef4444', mr: 0.5 }}>{saveError}</Typography>
          )}
          <Button size="small" onClick={handleCancelEdit} disabled={isSaving}
            sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, fontSize: 12, borderRadius: 1.5, border: '1px solid #e2e8f0', px: 1.5, '&:hover': { bgcolor: '#f8fafc' } }}>
            Cancel
          </Button>
          <Button size="small" onClick={handleSave} disabled={isSaving || !isDirty}
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 13 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2, fontSize: 12, background: gradient, '&:hover': { background: gradient, opacity: 0.9 },
             '&.Mui-disabled': { opacity: 1, background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', color: 'rgba(255,255,255,0.75)',}}}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      )}

      {/* ────────────── DIALOGS ────────────── */}
      <ConfirmDialog
        open={advanceConfirm.open}
        title="Advance Stage"
        message={`Move to Stage ${(currentStageId ?? 0) + 1}: "${advanceConfirm.toStage?.name}"?`}
        warning="All enrolled employees will be moved to the new stage."
        confirmLabel="Advance"
        confirmColor="#1E3A8A"
        loading={advanceLoading}
        error={advanceError}
        onClose={() => setAdvanceConfirm({ open: false, toStage: null })}
        onConfirm={handleAdvanceStage}
      />

      
      {/* Rollback confirm */}
      <ConfirmDialog
        open={rollbackConfirm.open}
        title="Roll Back Stage"
        message={`Roll back to Stage ${rollbackConfirm.toStage?.id}: "${rollbackConfirm.toStage?.name}"?`}
        warning="All employees in this cycle will return to this stage. You can review and update the stage dates before saving."
        confirmLabel="Roll Back"
        confirmColor="#d97706"
        loading={false}
        error=""
        onClose={() => setRollbackConfirm({ open: false, toStage: null })}
        onConfirm={confirmRollback}
      />
      
      {statusConfirm.open && statusConfirm.action && (
        <ConfirmDialog
          open={statusConfirm.open}
          title={ACTION_DIALOG_CONFIG[statusConfirm.action]?.title}
          
          message={
            statusConfirm.action === 'ON_HOLD'
              ? `Are you sure you want to put "${cycle?.name}" on hold?`
              : `Are you sure you want to ${ACTION_CONFIG[statusConfirm.action]?.label?.toLowerCase()} "${cycle?.name}"?`
          }

          warning={
            statusConfirm.action === 'CANCELLED'
              ? 'This action cannot be undone. The cycle and all related assignments will be permanently cancelled.'
              : statusConfirm.action === 'CLOSED'
              ? 'Closing this cycle will lock all assessments and cannot be reversed.'
              : statusConfirm.action === 'ON_HOLD'
              ? 'Employees will not be able to access or update assessments while the cycle is on hold.'
              : statusConfirm.action === 'ACTIVE'
              ? 'Activating this cycle will notify all VLs and HRs by email.'
              : null
          }

          confirmLabel={ACTION_DIALOG_CONFIG[statusConfirm.action]?.confirmLabel}
          cancelLabel={ACTION_DIALOG_CONFIG[statusConfirm.action]?.cancelLabel}
          confirmColor={ACTION_CONFIG[statusConfirm.action]?.confirmColor}
          loading={statusLoading}
          error={statusError}

          onClose={() => {
            setStatusConfirm({ open: false, action: null });
            setStatusError('');
          }}

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

      <Dialog
        open={unsavedWarningOpen}
        onClose={() => setUnsavedWarningOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}
      >
        <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #fde68a' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
            <Typography fontWeight={700} fontSize={14} color="#92400e">
              Unsaved Changes
            </Typography>
          </Stack>
        </Box>
        <DialogContent sx={{ pt: 2, pb: 1 }}>
          <Typography fontSize={13} color="#374151">
            You have unsaved changes. What would you like to do?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setUnsavedWarningOpen(false);
              handleCancelEdit();
              navigate(pendingNavigation);
            }}
            sx={{ textTransform: 'none', color: '#ef4444', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}
          >
            Discard & Leave
          </Button>
          <Button
            onClick={() => setUnsavedWarningOpen(false)}
            sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13, border: '1px solid #e2e8f0' }}
          >
            Keep Editing
          </Button>
          <Button
            onClick={async () => {
              setUnsavedWarningOpen(false);
              await handleSave();
              navigate(pendingNavigation);
            }}
            variant="contained"
            startIcon={<SaveIcon sx={{ fontSize: 13 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2, fontSize: 13, background: gradient, '&:hover': { background: gradient, opacity: 0.9 } }}
          >
            Save & Leave
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}