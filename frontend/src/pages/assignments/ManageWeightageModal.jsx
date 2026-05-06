import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Stack, Button, Chip, TextField,
  Alert, Divider, CircularProgress, Switch,
  LinearProgress, Avatar, IconButton, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BusinessIcon from '@mui/icons-material/Business';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

function getInitials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// is_standard: true=Org (green), false=Project (blue)
function KRATypeBadge({ isStandard }) {
  return (
    <Chip
      icon={isStandard
        ? <BusinessIcon sx={{ fontSize: '10px !important', color: '#166534 !important' }} />
        : <FolderSpecialIcon sx={{ fontSize: '10px !important', color: '#1d4ed8 !important' }} />
      }
      label={isStandard ? 'Org' : 'Project'}
      size="small"
      sx={{
        fontSize: 8.5, height: 16, fontWeight: 700,
        bgcolor: isStandard ? '#dcfce7' : '#dbeafe',
        color: isStandard ? '#166534' : '#1d4ed8',
        '& .MuiChip-icon': { ml: 0.5 },
      }}
    />
  );
}

export default function ManageWeightageModal({
  open, mode, employee, prefill,
  enrolMode, onEnrolModeChange,
  kraLibrary, categories,
  selectedEmployeeIds, employees,
  activeCycleId,
  onConfirm, onClose,
}) {
  const [categoryWeightages, setCategoryWeightages] = useState([]);
  const [isDateBased, setIsDateBased] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = mode === 'edit';

  // ── Selected KRA info ──────────────────────────────────────────────────────
  const selectedKraLevelIds = prefill?.kra_level_ids ?? [];

  const selectedKras = useMemo(
    () => kraLibrary.filter((k) => k.levels.some((l) => selectedKraLevelIds.includes(l.kra_level_id ?? l.id))),
    [kraLibrary, selectedKraLevelIds]
  );

  const uniqueCategoryIds = useMemo(
    () => [...new Set(selectedKras.map((k) => k.category_id))],
    [selectedKras]
  );

  // ── Init weightage state on open ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const prefillCats = prefill?.categories ?? [];

    if (uniqueCategoryIds.length > 0) {
      const init = uniqueCategoryIds.map((cid) => {
      const existing = prefillCats.find((c) => c.category_id === cid);
      const cat = categories.find((c) => c.id === cid);
      const sampleKRA = selectedKras.find((k) => k.category_id === cid);

      // Build names WITH level suffix so "test L1" and "test Senior" show separately
      const kraNames = [];
      kraLibrary.forEach(kra => {
        if (kra.category_id !== cid) return;
        (kra.levels ?? []).forEach(level => {
          const compositeKey = `${kra.id}_${level.kra_level_id ?? level.id}`;
          if (selectedKraLevelIds.includes(compositeKey)) {
            kraNames.push(`${kra.name} (${level.level_name})`);
          }
        });
      });

      return {
        category_id: cid,
        category_name: cat?.name ?? sampleKRA?.category_name ?? `Category ${cid}`,
        is_standard: sampleKRA?.is_standard ?? true,
        weightage: existing?.weightage ? String(existing.weightage) : '',
        kra_names: kraNames,
      };
    });
      setCategoryWeightages(init);
    } else if (prefillCats.length > 0) {
      setCategoryWeightages(
        prefillCats.map((c) => {
          const cat = categories.find((cat) => cat.id === c.category_id);
          const sampleKRA = kraLibrary.find((k) => k.category_id === c.category_id);
          return {
            category_id: c.category_id,
            category_name: c.category_name ?? cat?.name ?? `Category ${c.category_id}`,
            is_standard: sampleKRA?.is_standard ?? true,
            weightage: String(c.weightage ?? ''),
            kra_names: [],
          };
        })
      );
    } else {
      setCategoryWeightages([]);
    }

    setIsDateBased(false);
    setFieldErrors({});
    setGlobalError('');
  }, [open, prefill]);

  // ── Weightage maths ────────────────────────────────────────────────────────
  const totalWeightage = categoryWeightages.reduce((sum, c) => {
    const v = parseFloat(c.weightage);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const isValid = Math.abs(totalWeightage - 100) < 0.001;
  const remainingWeight = parseFloat((100 - totalWeightage).toFixed(1));

  // ── Field change ───────────────────────────────────────────────────────────
  const handleWeightageChange = (categoryId, raw) => {
    const value = raw.replace(/[^0-9.]/g, '');
    setGlobalError('');
    setFieldErrors((prev) => ({ ...prev, [categoryId]: '' }));
    setCategoryWeightages((prev) =>
      prev.map((c) => (c.category_id === categoryId ? { ...c, weightage: value } : c))
    );
  };

  // ── Distribute evenly ──────────────────────────────────────────────────────
  const distributeEvenly = () => {
    const count = categoryWeightages.length;
    if (count === 0) return;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * (count - 1);
    setCategoryWeightages((prev) =>
      prev.map((c, i) => ({
        ...c,
        weightage: String(i === prev.length - 1 ? remainder : base),
      }))
    );
    setFieldErrors({});
    setGlobalError('');
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  // ─── FIX Bug 3: Validate only checks per-field errors (empty / negative / >100)
  // The 100% total is now a WARNING shown in the UI, not a hard block.
  // Submit is always allowed as long as individual fields are valid numbers.
  const validate = () => {
    const errors = {};
    let valid = true;

    categoryWeightages.forEach((c) => {
      const v = parseFloat(c.weightage);
      if (c.weightage === '' || isNaN(v)) {
        errors[c.category_id] = 'Please enter a weightage value';
        valid = false;
      } else if (v <= 0) {
        errors[c.category_id] = 'Weightage must be greater than 0';
        valid = false;
      } else if (v > 100) {
        errors[c.category_id] = 'Weightage cannot exceed 100%';
        valid = false;
      }
    });

    setFieldErrors(errors);

    // ─── FIX Bug 3: Show warning for non-100% total but DO NOT block submit ──
    if (valid && !isValid) {
      setGlobalError(
        totalWeightage > 100
          ? `Total is ${totalWeightage.toFixed(1)}% — consider reducing by ${(totalWeightage - 100).toFixed(1)}% to reach exactly 100%.`
          : `Total is ${totalWeightage.toFixed(1)}% — ${remainingWeight}% unallocated. You can still save.`
      );
      // NOTE: We intentionally do NOT return false here — submit proceeds
    }

    return valid;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onConfirm({
        categories: categoryWeightages.map((c) => ({
          category_id: c.category_id,
          weightage: String(parseFloat(c.weightage)),
        })),
        kra_level_ids: selectedKraLevelIds,
        kra_selections: prefill?.kra_selections ?? [],
        kra_level_to_kra_id: prefill?.kra_level_to_kra_id ?? {},
        is_date_based: isDateBased,
        enrol_mode: enrolMode ?? 'skip',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Target employees ───────────────────────────────────────────────────────
  const targetEmployees = isEdit
    ? [employee].filter(Boolean)
    : employees.filter((e) => selectedEmployeeIds.includes(e.employee_id));

  const hasNoCategories = categoryWeightages.length === 0;

  const alreadyEnrolledCount = isEdit ? 0 : targetEmployees.filter((e) => e.assigned_to_cycle).length;
  const showEnrolModePicker = !isEdit && alreadyEnrolledCount > 0;

  // ── Progress bar color ─────────────────────────────────────────────────────
  const progressColor = isValid ? '#16a34a' : totalWeightage > 100 ? '#dc2626' : '#f59e0b';

  return (
    <Dialog
      open={open}
      onClose={!submitting ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ background: gradient, px: 3, py: 2.5, color: '#fff', borderRadius: '12px 12px 0 0' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1} minWidth={0}>
              <Typography fontWeight={800} fontSize="1rem" lineHeight={1.3}>
                {isEdit ? `Edit KRA Assignment` : 'Set Category Weightage'}
              </Typography>
              <Typography fontSize={11} sx={{ opacity: 0.75, mt: 0.25 }}>
                {isEdit
                  ? `Updating assignment for ${employee?.full_name ?? ''}`
                  : `Assigning ${selectedKraLevelIds.length} KRA${selectedKraLevelIds.length !== 1 ? 's' : ''} to ${targetEmployees.length} employee${targetEmployees.length !== 1 ? 's' : ''}`
                }
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} disabled={submitting} sx={{ color: 'rgba(255,255,255,0.7)', mt: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {/* Target employee avatars */}
          {targetEmployees.length > 0 && (
            <Stack direction="row" alignItems="center" spacing={1} mt={1.5}>
              <Stack direction="row" sx={{ '& > *': { ml: '-6px !important' }, '& > *:first-of-type': { ml: '0 !important' } }}>
                {targetEmployees.slice(0, 5).map((e) => (
                  <Tooltip key={e.employee_id} title={e.full_name}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                      {getInitials(e.full_name)}
                    </Avatar>
                  </Tooltip>
                ))}
                {targetEmployees.length > 5 && (
                  <Avatar sx={{ width: 24, height: 24, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}>
                    +{targetEmployees.length - 5}
                  </Avatar>
                )}
              </Stack>
              <Typography fontSize={11} sx={{ opacity: 0.8 }} noWrap>
                {targetEmployees.slice(0, 2).map((e) => e.full_name).join(', ')}
                {targetEmployees.length > 2 ? ` +${targetEmployees.length - 2} more` : ''}
              </Typography>
            </Stack>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>

        {/* ── Enrol mode picker ── */}
        {showEnrolModePicker && (
          <Box sx={{ mb: 2.5, p: 1.75, borderRadius: 2, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}>
            <Stack direction="row" alignItems="center" gap={0.75} mb={1.25}>
              <InfoOutlinedIcon sx={{ fontSize: 14, color: '#b45309' }} />
              <Typography fontSize={12} fontWeight={700} color="#92400e">
                {alreadyEnrolledCount} of {targetEmployees.length} employee{targetEmployees.length !== 1 ? 's' : ''} already {alreadyEnrolledCount === 1 ? 'has' : 'have'} KRAs assigned
              </Typography>
            </Stack>
            <Typography fontSize={11} color="#78350f" mb={1.25}>
              Choose how to handle their existing assignments:
            </Typography>
            <Stack spacing={0.75}>
              {[
                { value: 'skip', label: 'Skip', desc: 'Leave existing assignments untouched. Only new employees will be assigned.' },
                { value: 'append', label: 'Append', desc: 'Add these KRAs to existing assignments. Already-present KRAs are preserved with their ratings.' },
                { value: 'overwrite', label: 'Overwrite', desc: 'Replace all existing KRAs and categories. Existing ratings and progress will be lost.' },
              ].map((opt) => {
                const isSelected = enrolMode === opt.value;
                const borderColor = isSelected
                  ? opt.value === 'overwrite' ? '#fca5a5' : '#93c5fd'
                  : '#e2e8f0';
                const bgColor = isSelected
                  ? opt.value === 'overwrite' ? '#fff1f2' : '#eff6ff'
                  : '#fafafa';
                return (
                  <Box
                    key={opt.value}
                    onClick={() => onEnrolModeChange(opt.value)}
                    sx={{
                      px: 1.5, py: 1, borderRadius: 1.75, cursor: 'pointer',
                      border: `1.5px solid ${borderColor}`,
                      bgcolor: bgColor,
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: opt.value === 'overwrite' ? '#fca5a5' : '#93c5fd', bgcolor: opt.value === 'overwrite' ? '#fff1f2' : '#eff6ff' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={1.25}>
                      <Box sx={{
                        width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${isSelected ? (opt.value === 'overwrite' ? '#ef4444' : '#2563eb') : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: opt.value === 'overwrite' ? '#ef4444' : '#2563eb' }} />
                        )}
                      </Box>
                      <Box>
                        <Typography fontSize={12} fontWeight={700} color={isSelected ? (opt.value === 'overwrite' ? '#dc2626' : '#1d4ed8') : '#374151'}>
                          {opt.label}
                        </Typography>
                        <Typography fontSize={10.5} color="#6b7280">{opt.desc}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* No categories warning */}
        {hasNoCategories && (
          <Alert severity="warning" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ borderRadius: 2, fontSize: 12, mb: 2 }}>
            {isEdit
              ? 'No category data found for this assignment. Please use the assign flow to re-assign KRAs.'
              : 'The selected KRAs have no categories assigned. Please contact your administrator.'
            }
          </Alert>
        )}

        {/* Selected KRA chips */}
        {selectedKraLevelIds.length > 0 && (
          <Box sx={{ mb: 2.5, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
              <Typography fontSize={11} fontWeight={700} color="#64748b" textTransform="uppercase" letterSpacing="0.04em">
                Selected KRAs ({selectedKraLevelIds.length})
              </Typography>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {kraLibrary.flatMap(kra =>
                (kra.levels ?? [])
                  .filter(level => selectedKraLevelIds.includes(level.kra_level_id ?? level.id))
                  .map(level => (
                    <Stack key={`${kra.id}_${level.kra_level_id ?? level.id}`} direction="row" alignItems="center" spacing={0.4}
                      sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1.5, px: 0.75, py: 0.35 }}>
                      <Typography fontSize={10.5} fontWeight={600} color="#1e293b">
                        {kra.name} <Box component="span" sx={{ color: '#94a3b8', fontWeight: 400 }}>({level.level_name})</Box>
                      </Typography>
                      <KRATypeBadge isStandard={kra.is_standard} />
                    </Stack>
                  ))
              )}
            </Stack>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Weightage header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Box>
            <Typography fontSize={13} fontWeight={700} color="#1e293b">Category Weightage</Typography>
            {/* ─── FIX Bug 3: Changed "must add up to exactly 100%" to advisory text ── */}
            <Typography fontSize={11} color="#64748b">Ideally all categories should add up to 100%</Typography>
          </Box>
          {categoryWeightages.length > 1 && (
            <Button
              size="small" onClick={distributeEvenly}
              sx={{ fontSize: 11, fontWeight: 600, color: '#1E3A8A', border: '1px solid #bfdbfe', borderRadius: 2, height: 28, px: 1.5 }}
            >
              Split Evenly
            </Button>
          )}
        </Stack>

        {/* Progress bar */}
        {categoryWeightages.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography fontSize={11} color="#64748b">Total allocated</Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography fontSize={11} fontWeight={700} sx={{ color: progressColor }}>
                  {totalWeightage.toFixed(1)}%
                </Typography>
                {isValid && <CheckCircleIcon sx={{ fontSize: 14, color: '#16a34a' }} />}
              </Stack>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(totalWeightage, 100)}
              sx={{
                height: 7, borderRadius: 3, bgcolor: '#f1f5f9',
                '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 3, transition: 'background-color 0.2s' },
              }}
            />
            {!isValid && totalWeightage > 0 && (
              <Typography fontSize={10.5} sx={{ color: progressColor, mt: 0.5 }}>
                {totalWeightage > 100
                  ? `${(totalWeightage - 100).toFixed(1)}% over — you may still save`
                  : `${remainingWeight}% unallocated — you may still save`
                }
              </Typography>
            )}
            {isValid && (
              <Typography fontSize={10.5} color="#16a34a" fontWeight={600} mt={0.5}>
                ✓ Weightage is balanced at 100%
              </Typography>
            )}
          </Box>
        )}

        {/* Category inputs */}
        <Stack spacing={1.5} mb={2}>
          {categoryWeightages.map((cat) => {
            const val = parseFloat(cat.weightage);
            const hasError = fieldErrors[cat.category_id];
            const pct = isNaN(val) ? 0 : Math.min(val, 100);

            return (
              <Box
                key={cat.category_id}
                sx={{
                  p: 1.5, borderRadius: 2,
                  border: `1px solid ${hasError ? '#fecaca' : '#e2e8f0'}`,
                  bgcolor: hasError ? '#fff5f5' : '#fafafa',
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={0.75} mb={0.4}>
                      <Typography fontSize={12.5} fontWeight={700} color="#1e293b">
                        {cat.category_name}
                      </Typography>
                      <KRATypeBadge isStandard={cat.is_standard} />
                    </Stack>

                    {cat.kra_names?.length > 0 && (
                      <Typography fontSize={10.5} color="#94a3b8">
                        {cat.kra_names.slice(0, 2).join(', ')}
                        {cat.kra_names.length > 2 ? ` +${cat.kra_names.length - 2} more KRA${cat.kra_names.length - 2 > 1 ? 's' : ''}` : ''}
                      </Typography>
                    )}

                    {cat.weightage !== '' && !isNaN(val) && val > 0 && (
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          mt: 0.75, height: 3, borderRadius: 2, bgcolor: '#e2e8f0',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: cat.is_standard ? '#16a34a' : '#1d4ed8',
                            borderRadius: 2,
                          },
                        }}
                      />
                    )}

                    {hasError && (
                      <Typography fontSize={10.5} color="#dc2626" mt={0.4}>
                        {hasError}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" alignItems="center" spacing={0.75} flexShrink={0} mt={0.25}>
                    <TextField
                      size="small"
                      type="number"
                      value={cat.weightage}
                      onChange={(e) => handleWeightageChange(cat.category_id, e.target.value)}
                      error={!!hasError}
                      placeholder="0"
                      inputProps={{ min: 1, max: 100, step: 5 }}
                      sx={{
                        width: 80,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1.5, fontSize: 14, fontWeight: 700,
                          borderColor: hasError ? '#fca5a5' : undefined,
                        },
                        '& input': { textAlign: 'center', py: 0.75 },
                        '& input::-webkit-inner-spin-button': { opacity: 0 },
                      }}
                    />
                    <Typography fontSize={14} fontWeight={700} color="#64748b">%</Typography>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>

        {/* Date-based toggle */}
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fafafa', mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography fontSize={12.5} fontWeight={600} color="#1e293b">Date-based Assessment</Typography>
              <Typography fontSize={11} color="#94a3b8">Link KRA completion to specific dates in the cycle</Typography>
            </Box>
            <Switch
              checked={isDateBased}
              onChange={(e) => setIsDateBased(e.target.checked)}
              size="small"
            />
          </Stack>
        </Box>

        {/* ─── FIX Bug 3: globalError is now a WARNING (amber), not a hard error ── */}
        {globalError && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon fontSize="small" />}
            sx={{ borderRadius: 2, fontSize: 12, py: 0.5 }}
          >
            {globalError}
          </Alert>
        )}

        {/* Success hint — only show when exactly 100% and no other errors */}
        {isValid && !globalError && Object.keys(fieldErrors).length === 0 && (
          <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ borderRadius: 2, fontSize: 12, py: 0.5 }}>
            All set! Weightage totals 100%. Ready to assign.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1, borderTop: '1px solid #f1f5f9' }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          sx={{ color: '#64748b', fontWeight: 600, borderRadius: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          // ─── FIX Bug 3: Remove isValid from disabled condition — allow non-100% submit ──
          disabled={submitting || hasNoCategories}
          sx={{
            background: gradient,
            color: '#ffffff',
            fontWeight: 700,
            borderRadius: 2,
            px: 3,
            '&:hover': { background: gradient, opacity: 0.9, color: '#ffffff' },
            '&:disabled': { opacity: 0.45, background: gradient, color: '#ffffff' },
          }}
        >
          {submitting ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={13} sx={{ color: '#fff' }} />
              <span>{isEdit ? 'Saving…' : 'Assigning…'}</span>
            </Stack>
          ) : isEdit
            ? 'Save Changes'
            : enrolMode === 'overwrite'
              ? `Overwrite ${targetEmployees.length} Employee${targetEmployees.length !== 1 ? 's' : ''}`
              : enrolMode === 'append'
                ? `Append to ${targetEmployees.length} Employee${targetEmployees.length !== 1 ? 's' : ''}`
                : `Assign to ${targetEmployees.length} Employee${targetEmployees.length !== 1 ? 's' : ''}`
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
}