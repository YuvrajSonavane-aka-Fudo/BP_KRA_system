import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Stack, Button, TextField,
  IconButton, CircularProgress, Alert, Tooltip, Dialog, Chip,
  Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { getCycles, cloneCycle } from '../../api/cyclesApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const STAGES = [
  { id: 1, name: 'KRA Assignment By Lead' },
  { id: 2, name: 'Self Assessment' },
  { id: 3, name: 'Lead Assessment' },
  { id: 4, name: 'HR Validation' },
  { id: 5, name: 'Completed' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toDateOnly(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0].split(' ')[0].trim();
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const clean = toDateOnly(dateStr);
  const d = new Date(clean + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/** Standard single-value calendar popup for cycle start/end */
function CalendarPicker({ value, onChange, minDate, maxDate, label, error, blockMin = false }) {
  const [open, setOpen] = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);

  function resolveView(dateStr) {
    const src = toDateOnly(dateStr);
    if (src) { const d = new Date(src + 'T00:00:00'); return { year: d.getFullYear(), month: d.getMonth() }; }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  const [viewYear, setViewYear] = useState(() => resolveView(value).year);
  const [viewMonth, setViewMonth] = useState(() => resolveView(value).month);
  const ref = useRef();

  useEffect(() => {
    if (open) { const v = resolveView(value); setViewYear(v.year); setViewMonth(v.month); setShowYearGrid(false); }
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => {
    if (value) { const d = new Date(toDateOnly(value) + 'T00:00:00'); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = value ? new Date(toDateOnly(value) + 'T00:00:00') : null;
  const minD = minDate ? new Date(toDateOnly(minDate) + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(toDateOnly(maxDate) + 'T00:00:00') : null;
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  function isDisabled(d) {
    if (!d) return true;
    const dt = new Date(viewYear, viewMonth, d);
    if (minD) {
      const m = new Date(minD); m.setHours(0,0,0,0);
      if (blockMin ? dt <= m : dt < m) return true;
    }
    if (maxD) { const mx = new Date(maxD); mx.setHours(0,0,0,0); if (dt > mx) return true; }
    return false;
  }
  function isSelected(d) {
    return !!d && !!selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  }
  function isToday(d) {
    const t = new Date();
    return !!d && t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === d;
  }
  function selectDay(d) {
    onChange(toISO(viewYear, viewMonth, d));
    setOpen(false);
  }
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
  }

  const currentYear = new Date().getFullYear();
  const yearRange = Array.from({ length: 12 }, (_, i) => currentYear - 2 + i);
  const display = selected ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  return (
    <Box ref={ref} sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <Box onClick={() => setOpen(o => !o)} sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75,
        border: `1.5px solid ${error ? '#ef4444' : open ? '#1E3A8A' : '#e2e8f0'}`,
        borderRadius: 1.5, cursor: 'pointer', bgcolor: '#fff', transition: 'border-color 0.15s',
        '&:hover': { borderColor: error ? '#ef4444' : '#1E3A8A' },
        minHeight: 36, userSelect: 'none',
      }}>
        <CalendarMonthIcon sx={{ fontSize: 14, color: error ? '#ef4444' : open ? '#1E3A8A' : '#94a3b8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, flex: 1, color: display ? '#0f172a' : '#94a3b8', fontWeight: display ? 600 : 400 }} noWrap>
          {display || label}
        </Typography>
        {value && (
          <IconButton size="small" onClick={e => { e.stopPropagation(); onChange(''); }} sx={{ p: 0.15, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
            <CloseIcon sx={{ fontSize: 11 }} />
          </IconButton>
        )}
      </Box>
      {error && (
        <Typography sx={{ fontSize: 10, color: '#ef4444', mt: 0.4, display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <ErrorOutlineIcon sx={{ fontSize: 11 }} />{error}
        </Typography>
      )}
      {open && (
        <Box sx={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
          width: 260, borderRadius: 2, border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px -12px rgba(30,58,138,0.25)', overflow: 'hidden', bgcolor: '#fff',
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, background: gradient }}>
            {!showYearGrid && (
              <IconButton size="small" onClick={prevMonth} sx={{ color: '#fff', p: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
                <ChevronLeftIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
            <Stack direction="row" alignItems="center" spacing={0.4} onClick={() => setShowYearGrid(v => !v)}
              sx={{ cursor: 'pointer', flex: 1, justifyContent: 'center', '&:hover': { opacity: 0.85 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>
                {showYearGrid ? 'Select Year' : `${MONTHS[viewMonth]} ${viewYear}`}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{showYearGrid ? '▲' : '▼'}</Typography>
            </Stack>
            {!showYearGrid && (
              <IconButton size="small" onClick={nextMonth} sx={{ color: '#fff', p: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
                <ChevronRightIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Stack>
          {showYearGrid ? (
            <Box sx={{ px: 1.25, py: 1.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                {yearRange.map(yr => (
                  <Box key={yr} onClick={() => { setViewYear(yr); setShowYearGrid(false); }}
                    sx={{ textAlign: 'center', py: 0.6, borderRadius: 1, cursor: 'pointer',
                      bgcolor: yr === viewYear ? '#1E3A8A' : yr === currentYear ? '#eff6ff' : 'transparent',
                      border: yr === currentYear && yr !== viewYear ? '1px solid #bfdbfe' : '1px solid transparent',
                      '&:hover': yr !== viewYear ? { bgcolor: '#dbeafe' } : {} }}>
                    <Typography sx={{ fontSize: 11, fontWeight: yr === viewYear ? 700 : 500,
                      color: yr === viewYear ? '#fff' : yr === currentYear ? '#1E3A8A' : '#374151' }}>
                      {yr}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Box sx={{ px: 1.25, pt: 1, pb: 0.5 }}>
              <Stack direction="row" mb={0.4}>
                {WEEK_DAYS.map(d => (
                  <Box key={d} sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{d}</Typography>
                  </Box>
                ))}
              </Stack>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, ri) => (
                <Stack key={ri} direction="row" sx={{ mb: 0.2 }}>
                  {cells.slice(ri * 7, ri * 7 + 7).map((d, ci) => {
                    const disabled = isDisabled(d);
                    const sel = isSelected(d);
                    const today = isToday(d);
                    return (
                      <Box key={ci} sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        {d ? (
                          <Box onClick={() => !disabled && selectDay(d)} sx={{
                            width: 26, height: 26, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            bgcolor: sel ? '#1E3A8A' : 'transparent',
                            border: today && !sel ? '1.5px solid #1E3A8A' : '1.5px solid transparent',
                            transition: 'all 0.1s',
                            '&:hover': !disabled && !sel ? { bgcolor: '#dbeafe' } : {},
                          }}>
                            <Typography sx={{ fontSize: 11, lineHeight: 1,
                              fontWeight: sel ? 700 : today ? 600 : 400,
                              color: sel ? '#fff' : disabled ? '#cbd5e1' : today ? '#1E3A8A' : '#374151' }}>
                              {d}
                            </Typography>
                          </Box>
                        ) : <Box sx={{ width: 26, height: 26 }} />}
                      </Box>
                    );
                  })}
                </Stack>
              ))}
            </Box>
          )}
          <Stack direction="row" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, borderTop: '1px solid #f1f5f9' }}>
            <Button size="small" onClick={() => { onChange(''); setOpen(false); }} sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, minWidth: 0, p: 0.5 }}>Clear</Button>
            <Button size="small" onClick={() => setOpen(false)} sx={{ fontSize: 10, color: '#1E3A8A', fontWeight: 700, minWidth: 0, p: 0.5 }}>Done</Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

/**
 * InlineRangePicker — same as in CycleCreateModal.
 * Inline calendar expands inside the stage row; no popup.
 * Click start → click end → auto-closes.
 */
function InlineRangePicker({ startDate, endDate, onChange, minDate, maxDate, stageId, openId, setOpenId }) {
  const isOpen = openId === stageId;

  function resolveView() {
    const src = startDate || minDate;
    if (src) { const d = new Date(toDateOnly(src) + 'T00:00:00'); return { year: d.getFullYear(), month: d.getMonth() }; }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  const [viewYear, setViewYear] = useState(() => resolveView().year);
  const [viewMonth, setViewMonth] = useState(() => resolveView().month);
  const [picking, setPicking] = useState('start');
  const [hoverDay, setHoverDay] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const v = resolveView();
      setViewYear(v.year);
      setViewMonth(v.month);
      setPicking(startDate ? 'end' : 'start');
      setHoverDay(null);
    }
    // eslint-disable-next-line
  }, [isOpen]);

  const minD = minDate ? new Date(toDateOnly(minDate) + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(toDateOnly(maxDate) + 'T00:00:00') : null;
  const startD = startDate ? new Date(toDateOnly(startDate) + 'T00:00:00') : null;
  const endD = endDate ? new Date(toDateOnly(endDate) + 'T00:00:00') : null;

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  function isDisabled(d) {
    if (!d) return true;
    const dt = new Date(viewYear, viewMonth, d);
    if (minD) { const m = new Date(minD); m.setHours(0,0,0,0); if (dt < m) return true; }
    if (maxD) { const mx = new Date(maxD); mx.setHours(0,0,0,0); if (dt > mx) return true; }
    if (picking === 'end' && startD) {
      const s = new Date(startD); s.setHours(0,0,0,0);
      if (dt < s) return true;
    }
    return false;
  }

  function getDayState(d) {
    if (!d) return {};
    const dt = new Date(viewYear, viewMonth, d); dt.setHours(0,0,0,0);
    const sTime = startD ? new Date(startD).setHours(0,0,0,0) : null;
    const eTime = endD   ? new Date(endD).setHours(0,0,0,0)   : null;
    const hTime = hoverDay ? new Date(viewYear, viewMonth, hoverDay).setHours(0,0,0,0) : null;
    const dtTime = dt.getTime();

    const isStart = sTime !== null && dtTime === sTime;
    const isEnd   = eTime !== null && dtTime === eTime;
    const rangeEndTime = picking === 'end' && hTime ? hTime : eTime;
    const inRange = sTime !== null && rangeEndTime !== null && dtTime > sTime && dtTime < rangeEndTime;

    return { isStart, isEnd, inRange };
  }

  function isToday(d) {
    const t = new Date();
    return !!d && t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === d;
  }

  function selectDay(d) {
    const iso = toISO(viewYear, viewMonth, d);
    if (picking === 'start') {
      onChange({ start_date: iso, end_date: '' });
      setPicking('end');
    } else {
      onChange({ start_date: startDate, end_date: iso });
      setOpenId(null);
    }
    setHoverDay(null);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
  }

  function openPicker(mode) {
    setPicking(mode);
    setOpenId(stageId);
  }

  const displayStart = startDate ? fmt(startDate) : null;
  const displayEnd   = endDate   ? fmt(endDate)   : null;
  const bothSet      = !!startDate && !!endDate;

  return (
    <Box>
      {/* Trigger */}
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box
          onClick={() => isOpen && picking === 'start' ? setOpenId(null) : openPicker('start')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5,
            border: `1.5px solid ${isOpen && picking === 'start' ? '#1E3A8A' : displayStart ? '#93c5fd' : '#e2e8f0'}`,
            borderRadius: 1.5, cursor: 'pointer', bgcolor: displayStart ? '#eff6ff' : '#fff',
            minWidth: 110, transition: 'all 0.15s',
            '&:hover': { borderColor: '#1E3A8A' },
          }}
        >
          <CalendarMonthIcon sx={{ fontSize: 12, color: displayStart ? '#1E3A8A' : '#94a3b8' }} />
          <Typography sx={{ fontSize: 11, color: displayStart ? '#1E3A8A' : '#94a3b8', fontWeight: displayStart ? 700 : 400 }}>
            {displayStart || 'Start date'}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700 }}>→</Typography>

        <Box
          onClick={() => {
            if (!startDate) return;
            isOpen && picking === 'end' ? setOpenId(null) : openPicker('end');
          }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5,
            border: `1.5px solid ${isOpen && picking === 'end' ? '#1E3A8A' : displayEnd ? '#93c5fd' : '#e2e8f0'}`,
            borderRadius: 1.5, cursor: startDate ? 'pointer' : 'not-allowed',
            bgcolor: displayEnd ? '#eff6ff' : '#fff',
            minWidth: 110, transition: 'all 0.15s', opacity: startDate ? 1 : 0.5,
            '&:hover': startDate ? { borderColor: '#1E3A8A' } : {},
          }}
        >
          <CalendarMonthIcon sx={{ fontSize: 12, color: displayEnd ? '#1E3A8A' : '#94a3b8' }} />
          <Typography sx={{ fontSize: 11, color: displayEnd ? '#1E3A8A' : '#94a3b8', fontWeight: displayEnd ? 700 : 400 }}>
            {displayEnd || 'End date'}
          </Typography>
        </Box>

        {(startDate || endDate) && (
          <IconButton size="small" onClick={() => { onChange({ start_date: '', end_date: '' }); setOpenId(null); }}
            sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
      </Stack>

      {/* Inline calendar */}
      {isOpen && (
        <Box sx={{
          mt: 1, border: '1.5px solid #1E3A8A', borderRadius: 2,
          overflow: 'hidden', bgcolor: '#fff',
          boxShadow: '0 8px 24px -4px rgba(30,58,138,0.18)',
          width: 264,
        }}>
          {/* Mode indicator */}
          <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#f0f9ff', borderBottom: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: picking === 'start' ? '#1E3A8A' : '#e2e8f0' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: picking === 'start' ? '#fff' : '#64748b' }}>
                  {displayStart || '← Pick start'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>→</Typography>
              <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: picking === 'end' ? '#1E3A8A' : '#e2e8f0', opacity: startDate ? 1 : 0.45 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: picking === 'end' ? '#fff' : '#64748b' }}>
                  {displayEnd || 'Pick end →'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Month nav */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, background: gradient }}>
            <IconButton size="small" onClick={prevMonth} sx={{ color: '#fff', p: 0.25 }}>
              <ChevronLeftIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{MONTHS[viewMonth]} {viewYear}</Typography>
            <IconButton size="small" onClick={nextMonth} sx={{ color: '#fff', p: 0.25 }}>
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>

          {/* Grid */}
          <Box sx={{ px: 1.25, pt: 0.75, pb: 0.5 }}>
            <Stack direction="row" mb={0.4}>
              {WEEK_DAYS.map(d => (
                <Box key={d} sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>{d}</Typography>
                </Box>
              ))}
            </Stack>
            {Array.from({ length: Math.ceil(cells.length / 7) }, (_, ri) => (
              <Stack key={ri} direction="row" sx={{ mb: 0.15 }}>
                {cells.slice(ri * 7, ri * 7 + 7).map((d, ci) => {
                  const disabled = isDisabled(d);
                  const { isStart, isEnd, inRange } = getDayState(d);
                  const today = isToday(d);
                  const highlighted = isStart || isEnd;
                  return (
                    <Box key={ci} sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      {d ? (
                        <Box
                          onClick={() => !disabled && selectDay(d)}
                          onMouseEnter={() => !disabled && picking === 'end' && setHoverDay(d)}
                          onMouseLeave={() => setHoverDay(null)}
                          sx={{
                            width: 26, height: 26,
                            borderRadius: inRange ? 0 : '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            bgcolor: highlighted ? '#1E3A8A' : inRange ? '#dbeafe' : 'transparent',
                            border: today && !highlighted ? '1.5px solid #1E3A8A' : '1.5px solid transparent',
                            transition: 'all 0.1s',
                            '&:hover': !disabled && !highlighted ? { bgcolor: inRange ? '#bfdbfe' : '#dbeafe' } : {},
                          }}
                        >
                          <Typography sx={{
                            fontSize: 11, lineHeight: 1,
                            fontWeight: highlighted ? 700 : today ? 600 : 400,
                            color: highlighted ? '#fff' : disabled ? '#cbd5e1' : inRange ? '#1E3A8A' : today ? '#1E3A8A' : '#374151',
                          }}>
                            {d}
                          </Typography>
                        </Box>
                      ) : <Box sx={{ width: 26, height: 26 }} />}
                    </Box>
                  );
                })}
              </Stack>
            ))}
          </Box>

          <Stack direction="row" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, borderTop: '1px solid #f1f5f9' }}>
            <Button size="small" onClick={() => { onChange({ start_date: '', end_date: '' }); setOpenId(null); }}
              sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, minWidth: 0, p: 0.5 }}>
              Clear
            </Button>
            {bothSet && (
              <Button size="small" onClick={() => setOpenId(null)}
                sx={{ fontSize: 10, color: '#1E3A8A', fontWeight: 700, minWidth: 0, p: 0.5 }}>
                Done
              </Button>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default function CycleCloneModal({ open = false, cycleId, onClose, onSuccess }) {
  const navigate = useNavigate();

  const [source, setSource] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState(1);

  const [cycleName, setCycleName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stageDates, setStageDates] = useState(() => {
    const init = {};
    STAGES.forEach(s => { init[s.id] = { start_date: '', end_date: '' }; });
    return init;
  });

  const [openStageId, setOpenStageId] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [cloning, setCloning] = useState(false);
  const [cloneErr, setCloneErr] = useState('');
  const [result, setResult] = useState(null);
  const [newCycleId, setNewCycleId] = useState(null);

  const fetchSource = useCallback(async () => {
    if (!cycleId) return;
    setLoadErr('');
    try {
      const res = await getCycles();
      const cycles = res.data?.cycles ?? res.data ?? [];
      const c = cycles.find(cy => String(cy.id) === String(cycleId));
      if (!c) throw new Error('Not found');
      setSource(c);
      setCycleName(`${c.name} (Copy)`);
    } catch {
      setLoadErr('Failed to load source cycle.');
    }
  }, [cycleId]);

  useEffect(() => {
    if (open && cycleId) {
      setStep(0); setAnimDir(1); setResult(null); setNewCycleId(null);
      setStartDate(''); setEndDate('');
      setStageDates(() => { const i = {}; STAGES.forEach(s => { i[s.id] = { start_date: '', end_date: '' }; }); return i; });
      setFieldErrors({}); setTouched({}); setCloneErr(''); setLoadErr(''); setOpenStageId(null);
      fetchSource();
    }
  }, [open, cycleId, fetchSource]);

  const sourceEndDateOnly = toDateOnly(source?.end_date);

  useEffect(() => {
    if (!source) return;
    const errors = {};
    if (touched.cycleName && !cycleName.trim()) errors.cycleName = 'Required.';
    if (touched.startDate && !startDate) errors.startDate = 'Required.';
    if (touched.startDate && startDate && sourceEndDateOnly && startDate <= sourceEndDateOnly)
      errors.startDate = `Must be after ${fmt(sourceEndDateOnly)}.`;
    if (touched.endDate && !endDate) errors.endDate = 'Required.';
    if (touched.endDate && startDate && endDate && endDate <= startDate) errors.endDate = 'Must be after start.';
    STAGES.forEach(s => {
      const d = stageDates[s.id] ?? {};
      if (touched[`s${s.id}s`] && !d.start_date) errors[`s${s.id}s`] = 'Required.';
      if (touched[`s${s.id}e`] && !d.end_date) errors[`s${s.id}e`] = 'Required.';
      if (d.start_date && d.end_date && d.end_date < d.start_date) errors[`s${s.id}e`] = 'End before start.';
      if (startDate && d.start_date && d.start_date < startDate) errors[`s${s.id}s`] = `Before cycle start (${fmt(startDate)}).`;
      if (endDate && d.end_date && d.end_date > endDate) errors[`s${s.id}e`] = `After cycle end (${fmt(endDate)}).`;
    });
    setFieldErrors(errors);
  }, [cycleName, startDate, endDate, stageDates, touched, source, sourceEndDateOnly]);

  function touch(key) { setTouched(t => ({ ...t, [key]: true })); }

  function updateStageDate(stageId, value) {
    setStageDates(prev => ({ ...prev, [stageId]: value }));
    setTouched(t => ({ ...t, [`s${stageId}s`]: true, [`s${stageId}e`]: true }));
  }

  const step0Valid = !!cycleName.trim() && !!startDate && !!endDate && endDate > startDate
    && (!sourceEndDateOnly || startDate > sourceEndDateOnly);
  const step1Valid = STAGES.every(s => stageDates[s.id]?.start_date && stageDates[s.id]?.end_date);

  function goNext() {
    setTouched(t => ({ ...t, cycleName: true, startDate: true, endDate: true }));
    if (!step0Valid) return;
    setAnimDir(1); setStep(1); setOpenStageId(null);
  }
  function goBack() { setAnimDir(-1); setStep(0); setOpenStageId(null); }

  async function handleClone() {
    const allTouched = { cycleName: true, startDate: true, endDate: true };
    STAGES.forEach(s => { allTouched[`s${s.id}s`] = true; allTouched[`s${s.id}e`] = true; });
    setTouched(allTouched);
    if (!step0Valid || !step1Valid) { setCloneErr('Please fill in all required fields.'); return; }
    setCloning(true); setCloneErr('');
    try {
      const res = await cloneCycle(cycleId, {
        name: cycleName.trim(),
        start_date: startDate,
        end_date: endDate,
        clone_assignments: true,
        stages: STAGES.map(s => ({ stage_id: s.id, start_date: stageDates[s.id]?.start_date, end_date: stageDates[s.id]?.end_date })),
      });
      invalidateCyclesCache();
      onSuccess?.();
      setResult(res.data);
      setNewCycleId(res.data.id);
      setAnimDir(1);
      setStep(2);
    } catch (err) {
      setCloneErr(err?.response?.data?.error || err?.response?.data?.detail || 'Clone failed. Please try again.');
    } finally { setCloning(false); }
  }

  const durationDays = startDate && endDate && endDate > startDate
    ? Math.round((new Date(endDate) - new Date(startDate)) / 86400000) : null;

  const summary = result?.assignments?.summary;
  const enrolled = result?.assignments?.enrolled ?? [];
  const skipped = result?.assignments?.skipped ?? [];
  const needsReview = result?.assignments?.needs_review ?? [];

  const configuredCount = STAGES.filter(s => stageDates[s.id]?.start_date && stageDates[s.id]?.end_date).length;

  const stepTitles = ['Clone Setup', 'Stage Dates', 'Done!'];
  const stepSubs = [
    `Copying: ${source?.name ?? '…'}`,
    'Click a row to set its date range',
    'Cycle cloned successfully',
  ];

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !cloning && onClose()}
      disableRestoreFocus
      maxWidth={step === 2 ? 'md' : 'sm'}
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 32px 80px -12px rgba(30,58,138,0.25)',
          maxHeight: '92vh',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ background: gradient, px: 3, pt: 2.5, pb: 2, color: '#fff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {step < 2 ? `Step ${step + 1} of 2` : 'Complete'}
            </Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, mt: 0.25 }}>{stepTitles[step]}</Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.2 }}>{stepSubs[step]}</Typography>
          </Box>
          <IconButton onClick={() => !cloning && onClose()} size="small" sx={{ color: 'rgba(255,255,255,0.7)', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {step < 2 && (
          <Box sx={{ mt: 2, height: 3, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: 99, bgcolor: '#fff',
              width: step === 0 ? '50%' : '100%',
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </Box>
        )}

        {step === 2 && (
          <Stack direction="row" spacing={1.5} mt={1.5} flexWrap="wrap" gap={0.75}>
            {[
              { label: 'Total', value: summary?.total ?? 0 },
              { label: 'Enrolled', value: summary?.enrolled ?? 0 },
              { label: 'Skipped', value: summary?.skipped ?? 0 },
              { label: 'Needs Review', value: summary?.needs_review ?? 0 },
            ].map(item => (
              <Box key={item.label} sx={{ px: 1.25, py: 0.6, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: 9, opacity: 0.75, fontWeight: 600 }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{item.value}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, overflow: 'auto', flex: 1 }}>
        {loadErr && <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{loadErr}</Alert>}

        {/* STEP 0 */}
        {step === 0 && source && (
          <Box sx={{ animation: 'fadeSlide 0.25s ease' }}>
            <style>{`@keyframes fadeSlide { from { opacity:0; transform:translateX(${animDir * 24}px); } to { opacity:1; transform:translateX(0); } }`}</style>

            <Box sx={{ px: 1.5, py: 1.25, bgcolor: '#f0f9ff', borderRadius: 1.5, border: '1px solid #bae6fd', mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ContentCopyIcon sx={{ fontSize: 14, color: '#0284c7', flexShrink: 0 }} />
                <Box flex={1} minWidth={0}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e' }} noWrap>{source.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#0369a1' }}>{fmt(source.start_date)} — {fmt(source.end_date)}</Typography>
                </Box>
                <Chip label={source.status} size="small" sx={{ fontSize: 9, fontWeight: 700, height: 18, bgcolor: '#dbeafe', color: '#1d4ed8' }} />
              </Stack>
              <Stack direction="row" alignItems="flex-start" spacing={0.75} mt={1}>
                <InfoOutlinedIcon sx={{ fontSize: 13, color: '#0284c7', flexShrink: 0, mt: 0.1 }} />
                <Typography sx={{ fontSize: 11, color: '#0369a1' }}>
                  All employees come along — no manual setup. Past scores won't carry over. New start must be <strong>after {fmt(source.end_date)}</strong>.
                </Typography>
              </Stack>
            </Box>

            <Stack spacing={2}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  New Cycle Name <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                </Typography>
                <TextField
                  fullWidth size="small" value={cycleName}
                  onChange={e => { setCycleName(e.target.value); touch('cycleName'); }}
                  onBlur={() => touch('cycleName')}
                  error={!!fieldErrors.cycleName}
                  helperText={fieldErrors.cycleName || `${cycleName.length}/100`}
                  inputProps={{ maxLength: 100 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                />
              </Box>

              <Stack direction="row" spacing={1.5}>
                <Box flex={1}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Start Date <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                  </Typography>
                  <CalendarPicker
                    label="Pick start date" value={startDate}
                    minDate={sourceEndDateOnly || undefined} maxDate={endDate || undefined}
                    error={fieldErrors.startDate} blockMin={true}
                    onChange={v => { setStartDate(v); touch('startDate'); }}
                  />
                </Box>
                <Box flex={1}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    End Date <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                  </Typography>
                  <CalendarPicker
                    label="Pick end date" value={endDate}
                    minDate={startDate || sourceEndDateOnly || undefined}
                    error={fieldErrors.endDate}
                    onChange={v => { setEndDate(v); touch('endDate'); }}
                  />
                </Box>
              </Stack>

              {durationDays && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.9, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: '#3b82f6', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                    {durationDays} days · {Math.floor(durationDays / 7)} weeks
                  </Typography>
                </Box>
              )}

              {startDate && endDate && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 1.5, py: 0.9, bgcolor: '#fefce8', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: '#d97706', flexShrink: 0, mt: 0.1 }} />
                  <Typography sx={{ fontSize: 11, color: '#92400e' }}>
                    Stage dates must fall within <strong>{fmt(startDate)}</strong> — <strong>{fmt(endDate)}</strong>. Stages can overlap.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* STEP 1 — Inline range pickers */}
        {step === 1 && (
          <Box sx={{ animation: 'fadeSlide 0.25s ease' }}>
            <style>{`@keyframes fadeSlide { from { opacity:0; transform:translateX(${animDir * 24}px); } to { opacity:1; transform:translateX(0); } }`}</style>

            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'visible' }}>
              <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', flex: '0 0 150px' }}>Stage</Typography>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Date Range — click to set start then end
                </Typography>
              </Stack>

              {STAGES.map((stage, idx) => {
                const dates = stageDates[stage.id] ?? { start_date: '', end_date: '' };
                const configured = !!dates.start_date && !!dates.end_date;
                const startErr = fieldErrors[`s${stage.id}s`];
                const endErr = fieldErrors[`s${stage.id}e`];
                const hasErr = !!(startErr || endErr);
                const isLast = idx === STAGES.length - 1;

                return (
                  <Box
                    key={stage.id}
                    sx={{
                      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                      bgcolor: openStageId === stage.id ? '#f8faff' : configured ? '#f0f9ff' : hasErr ? '#fff5f5' : '#fff',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" sx={{ px: 1.5, py: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: '0 0 150px', pt: 0.5 }}>
                        <Box sx={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: configured ? gradient : hasErr ? '#fee2e2' : '#f1f5f9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {configured
                            ? <CheckCircleIcon sx={{ color: '#fff', fontSize: 12 }} />
                            : <Typography sx={{ fontSize: 9, fontWeight: 800, color: hasErr ? '#ef4444' : '#94a3b8' }}>{idx + 1}</Typography>
                          }
                        </Box>
                        <Typography sx={{ fontSize: 11, fontWeight: configured ? 700 : 500, color: configured ? '#1E3A8A' : '#374151', lineHeight: 1.2 }}>
                          {stage.name}
                        </Typography>
                      </Stack>

                      <Box sx={{ flex: 1 }}>
                        <InlineRangePicker
                          stageId={stage.id}
                          startDate={dates.start_date}
                          endDate={dates.end_date}
                          minDate={startDate || undefined}
                          maxDate={endDate || undefined}
                          openId={openStageId}
                          setOpenId={setOpenStageId}
                          onChange={val => updateStageDate(stage.id, val)}
                        />
                        {(startErr || endErr) && (
                          <Typography sx={{ fontSize: 10, color: '#ef4444', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <ErrorOutlineIcon sx={{ fontSize: 11 }} />{startErr || endErr}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Box>

            <Stack direction="row" alignItems="center" spacing={1} mt={1.5}>
              {STAGES.map(s => {
                const done = !!(stageDates[s.id]?.start_date && stageDates[s.id]?.end_date);
                return (
                  <Tooltip key={s.id} title={s.name}>
                    <Box sx={{ height: 4, flex: 1, borderRadius: 99, bgcolor: done ? '#1E3A8A' : '#e2e8f0', transition: 'background-color 0.3s' }} />
                  </Tooltip>
                );
              })}
              <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', ml: 0.5 }}>
                {configuredCount}/5
              </Typography>
            </Stack>

            {cloneErr && (
              <Alert severity="error" sx={{ mt: 1.5, fontSize: 12, borderRadius: 1.5 }} icon={<WarningAmberIcon fontSize="inherit" />}>
                {cloneErr}
              </Alert>
            )}
          </Box>
        )}

        {/* STEP 2 — Results (unchanged from original) */}
        {step === 2 && result && (
          <Box sx={{ animation: 'fadeSlide 0.25s ease' }}>
            <style>{`@keyframes fadeSlide { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }`}</style>

            <Box sx={{ px: 2, py: 1.75, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0', mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#15803d' }}>
                  "{result.name}" created as DRAFT
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12, color: '#166534', ml: 3.5 }}>
                Review assignments below, then open the cycle to activate it.
              </Typography>
            </Box>

            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, mb: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 1.5, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stage Windows Configured
                </Typography>
              </Box>
              {STAGES.map((stage, idx) => {
                const d = stageDates[stage.id];
                const isLast = idx === STAGES.length - 1;
                return (
                  <Stack key={stage.id} direction="row" alignItems="center" spacing={1}
                    sx={{ px: 1.5, py: 0.75, borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{stage.id}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: '#374151', flex: 1 }}>{stage.name}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmt(d?.start_date)} → {fmt(d?.end_date)}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>

            {needsReview.length > 0 && (
              <Accordion defaultExpanded elevation={0}
                sx={{ border: '1px solid #fecaca', borderRadius: '8px !important', mb: 1.5, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}
                  sx={{ bgcolor: '#fef2f2', borderRadius: '8px', minHeight: 40, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}>
                  <WarningAmberIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Needs Manual Review</Typography>
                  <Chip label={needsReview.length} size="small" sx={{ bgcolor: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 10, height: 18 }} />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                          {['Employee', 'Issue', 'Remaining %'].map(c => (
                            <TableCell key={c} sx={{ fontWeight: 700, fontSize: 10, color: '#64748b', textTransform: 'uppercase', py: 0.75 }}>{c}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {needsReview.map((item, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fef2f2' } }}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{item.full_name}</Typography>
                              <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>#{item.employee_id}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontSize: 11, color: '#dc2626' }}>{item.reason}</Typography></TableCell>
                            <TableCell>
                              <Chip label={`${item.remaining_weightage ?? 0}%`} size="small"
                                sx={{ bgcolor: item.remaining_weightage === 100 ? '#dcfce7' : '#fee2e2', color: item.remaining_weightage === 100 ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 10 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}

            {enrolled.length > 0 && (
              <Accordion defaultExpanded={enrolled.length <= 8} elevation={0}
                sx={{ border: '1px solid #bbf7d0', borderRadius: '8px !important', mb: 1.5, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}
                  sx={{ bgcolor: '#f0fdf4', borderRadius: '8px', minHeight: 40, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}>
                  <CheckCircleIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Successfully Enrolled</Typography>
                  <Chip label={enrolled.length} size="small" sx={{ bgcolor: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 10, height: 18 }} />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                          {['Employee', 'KRAs', 'Changes'].map(c => (
                            <TableCell key={c} sx={{ fontWeight: 700, fontSize: 10, color: '#64748b', textTransform: 'uppercase', py: 0.75 }}>{c}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {enrolled.map((item, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#f0fdf4' } }}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{item.full_name}</Typography>
                              <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>#{item.employee_id}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={item.kras_cloned ?? 0} size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 10, height: 18 }} />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                {item.manager_updated && (
                                  <Chip label="Mgr" size="small" icon={<SwapHorizIcon sx={{ fontSize: 10, '&&': { color: '#92400e' } }} />}
                                    sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600, fontSize: 9, height: 16 }} />
                                )}
                                {item.level_updated && (
                                  <Chip label="Lvl" size="small" icon={<SkipNextIcon sx={{ fontSize: 10, '&&': { color: '#1d4ed8' } }} />}
                                    sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600, fontSize: 9, height: 16 }} />
                                )}
                                {!item.manager_updated && !item.level_updated && (
                                  <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>—</Typography>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}

            {skipped.length > 0 && (
              <Accordion elevation={0}
                sx={{ border: '1px solid #fde68a', borderRadius: '8px !important', mb: 1, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}
                  sx={{ bgcolor: '#fefce8', borderRadius: '8px', minHeight: 40, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}>
                  <PersonOffIcon sx={{ fontSize: 16, color: '#d97706' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Skipped</Typography>
                  <Chip label={skipped.length} size="small" sx={{ bgcolor: '#d97706', color: '#fff', fontWeight: 700, fontSize: 10, height: 18 }} />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                          {['Employee', 'Reason'].map(c => (
                            <TableCell key={c} sx={{ fontWeight: 700, fontSize: 10, color: '#64748b', textTransform: 'uppercase', py: 0.75 }}>{c}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {skipped.map((item, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fefce8' } }}>
                            <TableCell>
                              <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{item.full_name ?? `ID: ${item.employee_id}`}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontSize: 11, color: '#92400e' }}>{item.reason}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {step === 0 && <Button onClick={() => !cloning && onClose()} sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>Cancel</Button>}
          {step === 1 && <Button startIcon={<ArrowBackIcon />} onClick={goBack} disabled={cloning} sx={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>Back</Button>}
          {step === 2 && <Button onClick={onClose} sx={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>Close</Button>}

          <Stack direction="row" spacing={1.5} alignItems="center">
            {step === 0 && (
              <Button endIcon={<ArrowForwardIcon />} onClick={goNext} disabled={!step0Valid}
                sx={{
                  background: step0Valid ? gradient : '#e2e8f0',
                  color: step0Valid ? '#fff' : '#94a3b8',
                  fontWeight: 700, borderRadius: 2, px: 3, fontSize: 13, transition: 'all 0.2s',
                  '&:hover': step0Valid ? { background: gradient, opacity: 0.9 } : {},
                }}>
                Next: Stage Dates
              </Button>
            )}
            {step === 1 && (
              <Button
                startIcon={cloning ? <CircularProgress size={14} color="inherit" /> : <ContentCopyIcon />}
                onClick={handleClone} disabled={cloning}
                sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, fontSize: 13, '&:hover': { background: gradient, opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}>
                {cloning ? 'Cloning…' : 'Clone Cycle'}
              </Button>
            )}
            {step === 2 && newCycleId && (
              <Button
                startIcon={<OpenInNewIcon />}
                onClick={() => { onClose(); navigate(ROUTES.CYCLE_DETAIL.replace(':id', newCycleId)); }}
                sx={{ background: gradient, color: '#fff', fontWeight: 700, borderRadius: 2, px: 3, fontSize: 13, '&:hover': { background: gradient, opacity: 0.9 } }}>
                Open New Cycle
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  );
}