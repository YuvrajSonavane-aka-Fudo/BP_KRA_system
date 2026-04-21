import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Stack, Paper, Button, TextField,
  IconButton, Chip, CircularProgress, Alert, Tooltip,
  Select, MenuItem,
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
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { createCycle } from '../../api/cyclesApi';
import { invalidateCyclesCache } from '../../hooks/useCycles';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

// Fixed 5 stages — hardcoded, not from API/Excel
const STAGES = [
  { id: 1, name: 'KRA Assignment By Lead' },
  { id: 2, name: 'Self Assessment' },
  { id: 3, name: 'Lead Assessment' },
  { id: 4, name: 'HR Validation' },
  { id: 5, name: 'Completed' },
];

// ─── Calendar Picker ──────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/**
 * defaultViewDate: ISO date string (YYYY-MM-DD) to use as the initial
 * month/year when the picker has no value yet. Falls back to today.
 */
function CalendarPicker({ value, onChange, minDate, maxDate, label, error, defaultViewDate }) {
  const [open, setOpen]           = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);

  // Resolve the initial view month/year from: value → defaultViewDate → today
  function resolveView(dateStr) {
    const src = dateStr || defaultViewDate;
    if (src) {
      const d = new Date(src + 'T00:00:00');
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }

  const [viewYear, setViewYear]   = useState(() => resolveView(value).year);
  const [viewMonth, setViewMonth] = useState(() => resolveView(value).month);
  const ref = useRef();

  // When picker opens, re-sync view to value (or defaultViewDate if no value)
  useEffect(() => {
    if (open) {
      const v = resolveView(value);
      setViewYear(v.year);
      setViewMonth(v.month);
      setShowYearGrid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Also sync if value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = value ? new Date(value + 'T00:00:00') : null;
  const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  function isDisabled(d) {
    if (!d) return true;
    const dt = new Date(viewYear, viewMonth, d);
    if (minD) { const m = new Date(minD.getTime()); m.setHours(0,0,0,0); if (dt < m) return true; }
    if (maxD) { const mx = new Date(maxD.getTime()); mx.setHours(0,0,0,0); if (dt > mx) return true; }
    return false;
  }
  function isSelected(d) {
    return !!d && !!selected &&
      selected.getFullYear() === viewYear &&
      selected.getMonth() === viewMonth &&
      selected.getDate() === d;
  }
  function isToday(d) {
    const t = new Date();
    return !!d && t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === d;
  }
  function selectDay(d) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Year grid: show a range of years around the current viewYear
  const currentYear = new Date().getFullYear();
  const yearRange = Array.from({ length: 12 }, (_, i) => currentYear - 2 + i); // currentYear-2 to currentYear+9

  const display = selected
    ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <Box ref={ref} sx={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1,
          border: `1.5px solid ${error ? '#ef4444' : open ? '#1E3A8A' : '#e2e8f0'}`,
          borderRadius: 2, cursor: 'pointer', bgcolor: '#fff',
          transition: 'border-color 0.15s',
          '&:hover': { borderColor: error ? '#ef4444' : '#1E3A8A' },
          minHeight: 40, userSelect: 'none',
        }}
      >
        <CalendarMonthIcon sx={{ fontSize: 16, color: error ? '#ef4444' : open ? '#1E3A8A' : '#94a3b8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, flex: 1, color: display ? '#0f172a' : '#94a3b8', fontWeight: display ? 600 : 400 }}>
          {display || `Select ${label}`}
        </Typography>
        {value && (
          <IconButton size="small" onClick={e => { e.stopPropagation(); onChange(''); }}
            sx={{ p: 0.2, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        )}
      </Box>

      {error && (
        <Typography sx={{ fontSize: 11, color: '#ef4444', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ErrorOutlineIcon sx={{ fontSize: 12 }} />{error}
        </Typography>
      )}

      {open && (
        <Paper elevation={0} sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          zIndex: 1400,
          width: 276, borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px -12px rgba(30,58,138,0.22)',
          overflow: 'hidden',
        }}>
          {/* ── Header: month/year nav ── */}
          <Stack direction="row" alignItems="center" justifyContent="space-between"
            sx={{ px: 2, py: 1.25, background: gradient }}>
            {!showYearGrid && (
              <IconButton size="small" onClick={prevMonth}
                sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            )}

            {/* Clickable month + year — toggles year picker */}
            <Stack
              direction="row" alignItems="center" spacing={0.5}
              onClick={() => setShowYearGrid(v => !v)}
              sx={{ cursor: 'pointer', flex: 1, justifyContent: 'center', '&:hover': { opacity: 0.85 } }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                {showYearGrid ? 'Select Year' : `${MONTHS[viewMonth]} ${viewYear}`}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', mt: 0.15 }}>
                {showYearGrid ? '▲' : '▼'}
              </Typography>
            </Stack>

            {!showYearGrid && (
              <IconButton size="small" onClick={nextMonth}
                sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>

          {/* ── Year grid ── */}
          {showYearGrid ? (
            <Box sx={{ px: 1.5, py: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
                {yearRange.map(yr => (
                  <Box
                    key={yr}
                    onClick={() => { setViewYear(yr); setShowYearGrid(false); }}
                    sx={{
                      textAlign: 'center', py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                      bgcolor: yr === viewYear ? '#1E3A8A' : yr === currentYear ? '#eff6ff' : 'transparent',
                      border: yr === currentYear && yr !== viewYear ? '1.5px solid #bfdbfe' : '1.5px solid transparent',
                      '&:hover': yr !== viewYear ? { bgcolor: '#dbeafe' } : {},
                    }}
                  >
                    <Typography sx={{
                      fontSize: 12, fontWeight: yr === viewYear ? 700 : 500,
                      color: yr === viewYear ? '#fff' : yr === currentYear ? '#1E3A8A' : '#374151',
                    }}>
                      {yr}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            /* ── Month grid ── */
            <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
              <Stack direction="row" mb={0.5}>
                {WEEK_DAYS.map(d => (
                  <Box key={d} sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{d}</Typography>
                  </Box>
                ))}
              </Stack>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, ri) => (
                <Stack key={ri} direction="row" sx={{ mb: 0.25 }}>
                  {cells.slice(ri * 7, ri * 7 + 7).map((d, ci) => {
                    const disabled = isDisabled(d);
                    const sel   = isSelected(d);
                    const today = isToday(d);
                    return (
                      <Box key={ci} sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        {d ? (
                          <Box
                            onClick={() => !disabled && selectDay(d)}
                            sx={{
                              width: 30, height: 30, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              bgcolor: sel ? '#1E3A8A' : 'transparent',
                              border: today && !sel ? '1.5px solid #1E3A8A' : '1.5px solid transparent',
                              transition: 'all 0.1s',
                              '&:hover': !disabled && !sel ? { bgcolor: '#dbeafe' } : {},
                            }}
                          >
                            <Typography sx={{
                              fontSize: 12, lineHeight: 1,
                              fontWeight: sel ? 700 : today ? 600 : 400,
                              color: sel ? '#fff' : disabled ? '#cbd5e1' : today ? '#1E3A8A' : '#374151',
                            }}>
                              {d}
                            </Typography>
                          </Box>
                        ) : <Box sx={{ width: 30, height: 30 }} />}
                      </Box>
                    );
                  })}
                </Stack>
              ))}
            </Box>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center"
            sx={{ px: 2, py: 1, borderTop: '1px solid #f1f5f9' }}>
            <Button size="small" onClick={() => { onChange(''); setOpen(false); }}
              sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, minWidth: 0 }}>Clear</Button>
            <Button size="small" onClick={() => setOpen(false)}
              sx={{ fontSize: 11, color: '#1E3A8A', fontWeight: 700, minWidth: 0 }}>Done</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ num, title, subtitle }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
      <Box sx={{ px: 1.5, py: 0.4, background: gradient, borderRadius: 1, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>
          SECTION {String(num).padStart(2, '0')}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>{subtitle}</Typography>}
    </Stack>
  );
}

// ─── Field Label ──────────────────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}
      {required && <Box component="span" sx={{ color: '#ef4444', ml: 0.3 }}>*</Box>}
    </Typography>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CycleCreatePage() {
  const navigate = useNavigate();

  const [cycleName, setCycleName]     = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');

  const stagesRef = STAGES;
  const [stageDates, setStageDates] = useState(() => {
    const init = {};
    STAGES.forEach(s => { init[s.id] = { start_date: '', end_date: '' }; });
    return init;
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched]         = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Live validation ───────────────────────────────────────────────────────
  useEffect(() => {
    const errors = {};

    if (touched.cycleName && !cycleName.trim())
      errors.cycleName = 'Please enter a cycle name.';
    if (touched.cycleName && cycleName.trim().length > 100)
      errors.cycleName = 'Cycle name must be 100 characters or fewer.';

    if (touched.startDate && !startDate)
      errors.startDate = 'Please select a start date.';
    if (touched.endDate && !endDate)
      errors.endDate = 'Please select an end date.';
    if (touched.endDate && startDate && endDate && endDate <= startDate)
      errors.endDate = 'End date must be after the start date.';

    stagesRef.forEach(s => {
      const d = stageDates[s.id] ?? {};

      if (touched[`stage_${s.id}_start`] && !d.start_date)
        errors[`stage_${s.id}_start`] = 'Please select a start date for this stage.';
      if (touched[`stage_${s.id}_end`] && !d.end_date)
        errors[`stage_${s.id}_end`] = 'Please select an end date for this stage.';

      if (d.start_date && d.end_date && d.end_date < d.start_date)
        errors[`stage_${s.id}_end`] = 'Stage end date must be after the stage start date.';

      if (startDate && d.start_date && d.start_date < startDate)
        errors[`stage_${s.id}_start`] = `This stage starts before the cycle start date (${formatDateDisplay(startDate)}). Please adjust.`;
      if (endDate && d.end_date && d.end_date > endDate)
        errors[`stage_${s.id}_end`] = `This stage ends after the cycle end date (${formatDateDisplay(endDate)}). Please adjust.`;
      if (startDate && d.end_date && d.end_date < startDate)
        errors[`stage_${s.id}_end`] = `This stage ends before the cycle start date (${formatDateDisplay(startDate)}). Please adjust.`;
    });

    setFieldErrors(errors);
  }, [cycleName, startDate, endDate, stageDates, touched, stagesRef]);

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function touch(key) { setTouched(t => ({ ...t, [key]: true })); }

  function touchAll() {
    const all = { cycleName: true, startDate: true, endDate: true };
    stagesRef.forEach(s => {
      all[`stage_${s.id}_start`] = true;
      all[`stage_${s.id}_end`]   = true;
    });
    setTouched(all);
  }

  function updateStageDate(stageId, field, value) {
    setStageDates(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }));
    touch(`stage_${stageId}_${field === 'start_date' ? 'start' : 'end'}`);
  }

  function fullValidate() {
    touchAll();
    if (!cycleName.trim() || !startDate || !endDate || endDate <= startDate) return false;
    for (const s of stagesRef) {
      const d = stageDates[s.id];
      if (!d?.start_date || !d?.end_date) return false;
      if (d.end_date < d.start_date) return false;
      if (startDate && d.start_date < startDate) return false;
      if (endDate && d.end_date > endDate) return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!fullValidate()) {
      setSubmitError('Some fields need your attention. Please review the highlighted errors below before continuing.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const payload = {
      name: cycleName.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      stages: stagesRef.map(s => ({
        stage_id: s.id,
        start_date: stageDates[s.id]?.start_date,
        end_date: stageDates[s.id]?.end_date,
      })),
    };
    try {
      const res = await createCycle(payload);
      invalidateCyclesCache();
      navigate(ROUTES.CYCLE_DETAIL.replace(':id', res.data.id));
    } catch (err) {
      setSubmitError(err?.response?.data?.error || err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const sectionDone = [
    !!cycleName.trim() && !!startDate && !!endDate && endDate > startDate,
    stagesRef.every(s => stageDates[s.id]?.start_date && stageDates[s.id]?.end_date),
  ];
  const completedCount = sectionDone.filter(Boolean).length;

  const durationDays = startDate && endDate && endDate > startDate
    ? Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
    : null;

  return (
    <Box sx={{
      height: '100vh', overflow: 'auto', bgcolor: '#f8fafc', p: { xs: 2, md: 3 },
      '&::-webkit-scrollbar': { width: 5 },
      '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
      '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 99 },
    }}>
      <Box sx={{ maxWidth: 820, mx: 'auto' }}>

        {/* ── Page Header ── */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5} flexWrap="wrap" gap={0.5}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                New KRA Cycle
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {sectionDone.map((done, i) => (
                  <Tooltip key={i} title={['Timeline', 'Stages'][i]} placement="top">
                    <Box sx={{
                      width: 32, height: 6, borderRadius: 99,
                      bgcolor: done ? '#1E3A8A' : '#e2e8f0',
                      transition: 'background-color 0.3s', cursor: 'default',
                    }} />
                  </Tooltip>
                ))}
              </Stack>
              <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                {completedCount}/2 complete
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 13, color: '#64748b' }}>
              Define the timeline and date windows for each stage
            </Typography>
          </Box>
          <IconButton onClick={() => navigate(ROUTES.DASHBOARD)}
            sx={{ color: '#64748b', '&:hover': { bgcolor: '#fee2e2', color: '#ef4444' } }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {submitError && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setSubmitError('')}
            icon={<WarningAmberIcon fontSize="inherit" />}>
            {submitError}
          </Alert>
        )}

        {/* ── SECTION 01 — Timeline ── */}
        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', mb: 2, overflow: 'visible' }}>
          <Box sx={{ p: 3 }}>
            <SectionHeader num={1} title="Timeline Configuration" />
            <Stack spacing={2.5}>

              <Box>
                <FieldLabel required>Cycle Name</FieldLabel>
                <TextField
                  fullWidth placeholder="e.g., FY25 Q1 – Strategic Expansion"
                  value={cycleName}
                  onChange={e => { setCycleName(e.target.value); touch('cycleName'); }}
                  onBlur={() => touch('cycleName')}
                  size="small"
                  error={!!fieldErrors.cycleName}
                  helperText={fieldErrors.cycleName || `${cycleName.length}/100`}
                  inputProps={{ maxLength: 100 }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
                />
              </Box>

              <Box>
                <FieldLabel>Description</FieldLabel>
                <TextField
                  fullWidth placeholder="Optional — describe the focus or goals of this cycle"
                  value={description} onChange={e => setDescription(e.target.value)}
                  size="small" multiline rows={2}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 } }}
                />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Box flex={1}>
                  <FieldLabel required>Start Date</FieldLabel>
                  <CalendarPicker
                    label="start date" value={startDate}
                    maxDate={endDate || undefined}
                    error={fieldErrors.startDate}
                    onChange={v => { setStartDate(v); touch('startDate'); }}
                  />
                </Box>
                <Box flex={1}>
                  <FieldLabel required>End Date</FieldLabel>
                  <CalendarPicker
                    label="end date" value={endDate}
                    minDate={startDate || undefined}
                    error={fieldErrors.endDate}
                    onChange={v => { setEndDate(v); touch('endDate'); }}
                  />
                </Box>
              </Stack>

              {durationDays && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 15, color: '#3b82f6', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                    Duration: {durationDays} days · {Math.floor(durationDays / 7)} weeks
                  </Typography>
                </Box>
              )}

              {startDate && endDate && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 1.5, py: 1, bgcolor: '#fefce8', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 15, color: '#d97706', flexShrink: 0, mt: 0.1 }} />
                  <Typography sx={{ fontSize: 12, color: '#92400e' }}>
                    All stage dates below must fall within <strong>{formatDateDisplay(startDate)}</strong> and <strong>{formatDateDisplay(endDate)}</strong>. Stages can overlap each other.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Paper>

        {/* ── SECTION 02 — Stages ── */}
        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', mb: 2, overflow: 'visible' }}>
          <Box sx={{ p: 3 }}>
            <SectionHeader num={2} title="Workflow Stages" subtitle="Set date windows for each stage" />

            <Stack spacing={0}>
              {stagesRef.map((stage, idx) => {
                const dates      = stageDates[stage.id] ?? { start_date: '', end_date: '' };
                const configured = !!dates.start_date && !!dates.end_date;
                const isLast     = idx === stagesRef.length - 1;
                const startErr   = fieldErrors[`stage_${stage.id}_start`];
                const endErr     = fieldErrors[`stage_${stage.id}_end`];
                const hasErr     = !!(startErr || endErr);

                // Smart default: open stage pickers at cycle start month
                // Falls back to today if cycle start not set
                const stageDefaultView = startDate || undefined;

                return (
                  <Stack key={stage.id} direction="row" alignItems="flex-start">

                    {/* Timeline dot + connector */}
                    <Stack alignItems="center" sx={{ mr: 2, mt: 1.5, flexShrink: 0 }}>
                      <Box sx={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: configured ? gradient : '#f1f5f9',
                        border: configured ? 'none' : `2px solid ${hasErr ? '#fca5a5' : '#e2e8f0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}>
                        {configured
                          ? <CheckCircleIcon sx={{ color: '#fff', fontSize: 18 }} />
                          : <Typography sx={{ fontSize: 12, fontWeight: 800, color: hasErr ? '#ef4444' : '#94a3b8' }}>
                              {idx + 1}
                            </Typography>
                        }
                      </Box>
                      {!isLast && (
                        <Box sx={{ width: 2, height: 24, bgcolor: configured ? '#bfdbfe' : '#e2e8f0', my: 0.5, transition: 'background 0.2s' }} />
                      )}
                    </Stack>

                    {/* Stage card */}
                    <Paper elevation={0} sx={{
                      flex: 1, mb: isLast ? 0 : 2, p: 2, borderRadius: 2,
                      border: `1.5px solid ${hasErr ? '#fca5a5' : configured ? '#bfdbfe' : '#e2e8f0'}`,
                      bgcolor: configured ? '#eff6ff' : hasErr ? '#fff5f5' : '#fafafa',
                      transition: 'all 0.2s', overflow: 'visible',
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5}>

                        <Box minWidth={0}>
                          <Stack direction="row" alignItems="center" spacing={1} mb={0.25} flexWrap="wrap">
                            <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: configured ? '#1E3A8A' : '#1a1a2e' }}>
                              {stage.name}
                            </Typography>
                          </Stack>
                          {configured && (
                            <Typography sx={{ fontSize: 11, color: '#3b82f6' }}>
                              {new Date(dates.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' → '}
                              {new Date(dates.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </Typography>
                          )}
                        </Box>

                        <Stack direction="row" spacing={1.5} flexShrink={0}>
                          <Box>
                            <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#64748b', mb: 0.5 }}>Start</Typography>
                            <CalendarPicker
                              label="start"
                              value={dates.start_date}
                              minDate={startDate || undefined}
                              maxDate={dates.end_date || endDate || undefined}
                              error={startErr}
                              // ← Smart default: open at cycle start month
                              defaultViewDate={stageDefaultView}
                              onChange={v => updateStageDate(stage.id, 'start_date', v)}
                            />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#64748b', mb: 0.5 }}>End</Typography>
                            <CalendarPicker
                              label="end"
                              value={dates.end_date}
                              minDate={dates.start_date || startDate || undefined}
                              maxDate={endDate || undefined}
                              error={endErr}
                              // ← Smart default: open at stage start or cycle start month
                              defaultViewDate={dates.start_date || stageDefaultView}
                              onChange={v => updateStageDate(stage.id, 'end_date', v)}
                            />
                          </Box>
                        </Stack>

                      </Stack>
                    </Paper>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        </Paper>

        {/* ── Footer ── */}
        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', px: 3, py: 2, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button onClick={() => navigate(ROUTES.DASHBOARD)} disabled={submitting}
              sx={{ color: '#64748b', fontWeight: 600, '&:hover': { color: '#ef4444' } }}>
              Discard
            </Button>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {completedCount < 2 && (
                <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>
                  {2 - completedCount} section{2 - completedCount > 1 ? 's' : ''} remaining
                </Typography>
              )}
              <Button
                variant="contained" onClick={handleSubmit} disabled={submitting}
                startIcon={submitting ? <CircularProgress size={15} color="inherit" /> : <EditCalendarIcon />}
                sx={{
                  background: gradient, color: '#fff', fontWeight: 700,
                  borderRadius: 2, px: 3, fontSize: 13,
                  '&:hover': { background: gradient, opacity: 0.9 },
                  '&:disabled': { opacity: 0.6 },
                }}
              >
                {submitting ? 'Creating…' : 'Create Cycle'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

      </Box>
    </Box>
  );

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}