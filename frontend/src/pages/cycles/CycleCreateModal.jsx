import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Stack, Button, TextField,
  IconButton, CircularProgress, Alert, Tooltip, Dialog,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { createCycle } from '../../api/cyclesApi';
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

function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/** Single-month calendar used for cycle start/end (Step 0) */
function CalendarPicker({ value, onChange, minDate, maxDate, label, error, defaultViewDate }) {
  const [open, setOpen] = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);

  function resolveView(dateStr) {
    const src = dateStr || defaultViewDate;
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
    if (value) { const d = new Date(value + 'T00:00:00'); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = value ? new Date(value + 'T00:00:00') : null;
  const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  function isDisabled(d) {
    if (!d) return true;
    const dt = new Date(viewYear, viewMonth, d);
    if (minD) { const m = new Date(minD); m.setHours(0,0,0,0); if (dt < m) return true; }
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
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.25, py: 0.75,
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
 * InlineRangePicker — renders INSIDE the stage row (no popup).
 * Click "Start" trigger → inline calendar expands below the row.
 * First click = start date, second click = end date, then collapses.
 * If open, shows a single-month calendar with range highlight.
 */
function InlineRangePicker({ startDate, endDate, onChange, minDate, maxDate, stageId, openId, setOpenId }) {
  const isOpen = openId === stageId;

  function resolveView() {
    const src = startDate || minDate;
    if (src) { const d = new Date(src + 'T00:00:00'); return { year: d.getFullYear(), month: d.getMonth() }; }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  const [viewYear, setViewYear] = useState(() => resolveView().year);
  const [viewMonth, setViewMonth] = useState(() => resolveView().month);
  // picking = 'start' | 'end'
  const [picking, setPicking] = useState('start');
  // hover for range preview
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

  const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;
  const startD = startDate ? new Date(startDate + 'T00:00:00') : null;
  const endD = endDate ? new Date(endDate + 'T00:00:00') : null;

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
    const dt = new Date(viewYear, viewMonth, d);
    dt.setHours(0,0,0,0);
    const s = startD ? new Date(startD.setHours(0,0,0,0), startD) : null;
    const e = endD   ? new Date(endD.setHours(0,0,0,0), endD)   : null;
    const h = hoverDay ? new Date(viewYear, viewMonth, hoverDay) : null;

    const isStart  = s && dt.getTime() === s.getTime();
    const isEnd    = e && dt.getTime() === e.getTime();
    const isHover  = h && dt.getTime() === h.getTime();
    const rangeEnd = picking === 'end' && h ? h : e;
    const inRange  = s && rangeEnd && dt > s && dt < rangeEnd;

    return { isStart, isEnd, isHover, inRange };
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
      setOpenId(null); // close after range complete
    }
    setHoverDay(null);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
  }

  function open(pickingMode) {
    setPicking(pickingMode);
    setOpenId(stageId);
  }

  const displayStart = startDate ? fmt(startDate) : null;
  const displayEnd   = endDate   ? fmt(endDate)   : null;
  const bothSet      = !!startDate && !!endDate;

  return (
    <Box>
      {/* Trigger row */}
      <Stack direction="row" alignItems="center" spacing={0.75}>
        {/* Start trigger */}
        <Box
          onClick={() => isOpen && picking === 'start' ? setOpenId(null) : open('start')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.5,
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

        {/* End trigger */}
        <Box
          onClick={() => {
            if (!startDate) return; // must pick start first
            isOpen && picking === 'end' ? setOpenId(null) : open('end');
          }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.5,
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

        {/* Clear button */}
        {(startDate || endDate) && (
          <IconButton size="small" onClick={() => { onChange({ start_date: '', end_date: '' }); setOpenId(null); }}
            sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
      </Stack>

      {/* Inline calendar — expands below the trigger */}
      {isOpen && (
        <Box sx={{
          mt: 1, border: '1.5px solid #1E3A8A', borderRadius: 2,
          overflow: 'hidden', bgcolor: '#fff',
          boxShadow: '0 8px 24px -4px rgba(30,58,138,0.18)',
          width: 264,
        }}>
          {/* Picking mode indicator */}
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

          {/* Calendar grid */}
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
                  const { isStart, isEnd, isHover, inRange } = getDayState(d);
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

export default function CycleCreateModal({ open = false, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState(1);

  const [cycleName, setCycleName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [stageDates, setStageDates] = useState(() => {
    const init = {};
    STAGES.forEach(s => { init[s.id] = { start_date: '', end_date: '' }; });
    return init;
  });

  // which stage's inline calendar is open (only one at a time)
  const [openStageId, setOpenStageId] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setStep(0); setAnimDir(1);
      setCycleName(''); setDescription(''); setStartDate(''); setEndDate('');
      setStageDates(() => { const i = {}; STAGES.forEach(s => { i[s.id] = { start_date: '', end_date: '' }; }); return i; });
      setFieldErrors({}); setTouched({}); setSubmitError(''); setOpenStageId(null);
    }
  }, [open]);

  useEffect(() => {
    const errors = {};
    if (touched.cycleName && !cycleName.trim()) errors.cycleName = 'Required.';
    if (touched.cycleName && cycleName.trim().length > 100) errors.cycleName = 'Max 100 chars.';
    if (touched.startDate && !startDate) errors.startDate = 'Required.';
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
  }, [cycleName, startDate, endDate, stageDates, touched]);

  function touch(key) { setTouched(t => ({ ...t, [key]: true })); }

  function updateStageDate(stageId, value) {
    setStageDates(prev => ({ ...prev, [stageId]: value }));
    setTouched(t => ({ ...t, [`s${stageId}s`]: true, [`s${stageId}e`]: true }));
  }

  const step0Valid = !!cycleName.trim() && !!startDate && !!endDate && endDate > startDate;
  const step1Valid = STAGES.every(s => stageDates[s.id]?.start_date && stageDates[s.id]?.end_date);

  function goNext() {
    setTouched(t => ({ ...t, cycleName: true, startDate: true, endDate: true }));
    if (!step0Valid) return;
    setAnimDir(1); setStep(1); setOpenStageId(null);
  }

  function goBack() {
    setAnimDir(-1); setStep(0); setOpenStageId(null);
  }

  async function handleSubmit() {
    const allTouched = { cycleName: true, startDate: true, endDate: true };
    STAGES.forEach(s => { allTouched[`s${s.id}s`] = true; allTouched[`s${s.id}e`] = true; });
    setTouched(allTouched);
    if (!step0Valid || !step1Valid) { setSubmitError('Please fill in all required fields.'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      await createCycle({
        name: cycleName.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        stages: STAGES.map(s => ({ stage_id: s.id, start_date: stageDates[s.id]?.start_date, end_date: stageDates[s.id]?.end_date })),
      });
      invalidateCyclesCache();
      onSuccess?.();
      onClose();
    } catch (err) {
      setSubmitError(err?.response?.data?.error || err?.response?.data?.detail || 'Something went wrong.');
    } finally { setSubmitting(false); }
  }

  const durationDays = startDate && endDate && endDate > startDate
    ? Math.round((new Date(endDate) - new Date(startDate)) / 86400000) : null;

  const configuredCount = STAGES.filter(s => stageDates[s.id]?.start_date && stageDates[s.id]?.end_date).length;

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => !submitting && onClose()}
      disableRestoreFocus
      maxWidth="sm"
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
              {step === 0 ? 'Step 1 of 2' : 'Step 2 of 2'}
            </Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, mt: 0.25 }}>
              {step === 0 ? 'New KRA Cycle' : 'Stage Date Windows'}
            </Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.2 }}>
              {step === 0 ? 'Set name and cycle dates' : 'Click a row to set its date range'}
            </Typography>
          </Box>
          <IconButton onClick={() => !submitting && onClose()} size="small" sx={{ color: 'rgba(255,255,255,0.7)', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ mt: 2, height: 3, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
          <Box sx={{
            height: '100%', borderRadius: 99, bgcolor: '#fff',
            width: step === 0 ? '50%' : '100%',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ px: 3, py: 2.5, overflow: 'auto', flex: 1 }}>

        {/* STEP 0 */}
        {step === 0 && (
          <Box sx={{ animation: 'slideIn 0.25s ease' }}>
            <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(${animDir * 24}px); } to { opacity:1; transform:translateX(0); } }`}</style>
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cycle Name <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                </Typography>
                <TextField
                  fullWidth size="small"
                  placeholder="e.g., FY25 Q3 Performance Review"
                  value={cycleName}
                  onChange={e => { setCycleName(e.target.value); touch('cycleName'); }}
                  onBlur={() => touch('cycleName')}
                  error={!!fieldErrors.cycleName}
                  helperText={fieldErrors.cycleName || `${cycleName.length}/100`}
                  inputProps={{ maxLength: 100 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Description
                </Typography>
                <TextField
                  fullWidth size="small" multiline rows={2}
                  placeholder="Optional — describe goals of this cycle"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
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
                    maxDate={endDate || undefined} error={fieldErrors.startDate}
                    onChange={v => { setStartDate(v); touch('startDate'); }}
                  />
                </Box>
                <Box flex={1}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    End Date <Box component="span" sx={{ color: '#ef4444' }}>*</Box>
                  </Typography>
                  <CalendarPicker
                    label="Pick end date" value={endDate}
                    minDate={startDate || undefined} error={fieldErrors.endDate}
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

        {/* STEP 1 — Inline range pickers per stage */}
        {step === 1 && (
          <Box sx={{ animation: 'slideIn 0.25s ease' }}>
            <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(${animDir * 24}px); } to { opacity:1; transform:translateX(0); } }`}</style>

            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'visible' }}>
              {/* Header */}
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
                const isOpen = openStageId === stage.id;

                return (
                  <Box
                    key={stage.id}
                    sx={{
                      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                      bgcolor: isOpen ? '#f8faff' : configured ? '#f0f9ff' : hasErr ? '#fff5f5' : '#fff',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" sx={{ px: 1.5, py: 1 }}>
                      {/* Stage name */}
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

                      {/* Inline range picker */}
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
                        {/* Errors */}
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

            {/* Progress bar */}
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

            {submitError && (
              <Alert severity="error" sx={{ mt: 1.5, fontSize: 12, borderRadius: 1.5 }} icon={<WarningAmberIcon fontSize="inherit" />}>
                {submitError}
              </Alert>
            )}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {step === 0 ? (
            <Button onClick={() => !submitting && onClose()} sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>Cancel</Button>
          ) : (
            <Button startIcon={<ArrowBackIcon />} onClick={goBack} disabled={submitting} sx={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>Back</Button>
          )}
          {step === 0 ? (
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={goNext}
              disabled={!step0Valid}
              sx={{
                background: step0Valid ? gradient : '#e2e8f0',
                color: step0Valid ? '#fff' : '#94a3b8',
                fontWeight: 700, borderRadius: 2, px: 3, fontSize: 13, transition: 'all 0.2s',
                '&:hover': step0Valid ? { background: gradient, opacity: 0.9 } : {},
              }}>
              Next: Stage Dates
            </Button>
          ) : (
            <Button
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <EditCalendarIcon />}
              onClick={handleSubmit}
              disabled={submitting}
              sx={{
                background: gradient, color: '#fff', fontWeight: 700,
                borderRadius: 2, px: 3, fontSize: 13,
                '&:hover': { background: gradient, opacity: 0.9 },
                '&:disabled': { opacity: 0.6 },
              }}>
              {submitting ? 'Creating…' : 'Create Cycle'}
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}