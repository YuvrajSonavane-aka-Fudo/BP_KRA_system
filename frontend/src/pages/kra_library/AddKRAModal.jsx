import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  TextField, Button, IconButton, Typography, Stack, Box,
  CircularProgress, Alert, Chip,
  Select, MenuItem, FormControl, InputLabel, FormHelperText,
  OutlinedInput, Checkbox,
} from '@mui/material';
import CloseIcon       from '@mui/icons-material/Close';
import AddIcon         from '@mui/icons-material/Add';
import EditIcon        from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CategoryIcon    from '@mui/icons-material/Category';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const LEVEL_COLORS = [
  { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
  { bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
];
const lvlStyle = (i) => LEVEL_COLORS[i % LEVEL_COLORS.length];

export default function AddKRAModal({
  open, onClose, onSaved,
  kra, categories = [], levels = [],
  mode = 'add',
  prefillCategoryId = null,
  kraNames = [],
}) {
  const isEdit  = mode === 'edit';
  const isClone = mode === 'clone';
  // In add/clone mode the modal stays open; in edit mode it closes after save
  const stayOpen = !isEdit;

  const [name,           setName]           = useState('');
  const [description,    setDesc]           = useState('');
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [categoryId,     setCategoryId]     = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [errors,         setErrors]         = useState({});
  const [savedCount,     setSavedCount]     = useState(0); // shows "X added" feedback

  // Resolve the initial category from the prefill or the kra prop
  const initialCatId = prefillCategoryId
    ? Number(prefillCategoryId)
    : kra?.category_id
    ? Number(kra.category_id)
    : null;

  // Reset form whenever the modal opens
  useEffect(() => {
    if (open) {
      if (isClone) {
        const baseName = (kra?.name ?? '').replace(/\s*\(\d+\)$/, '').trim();
        let n = 1;
        while (kraNames.includes(`${baseName} (${n})`)) n++;
        setName(`${baseName} (${n})`);
      } else {
        setName(kra?.name ?? '');
      }
      setDesc(kra?.description ?? '');
      setSelectedLevels(kra?.levels?.map(l => l.level_id).filter(Boolean) ?? []);
      setCategoryId(initialCatId);
      setErrors({});
      setSaving(false);
      setSavedCount(0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForNext() {
    setName('');
    setDesc('');
    setSelectedLevels([]);
    // keep the same categoryId so the user can keep adding to same category
    setErrors({});
    setSaving(false);
  }

  const selectedCategory = categories.find(
    c => c.id === categoryId || String(c.id) === String(categoryId)
  );

  function validate() {
    const e = {};
    if (!name.trim())             e.name   = 'KRA name is required';
    if (name.trim().length > 120) e.name   = 'Max 120 characters';
    if (!categoryId)              e.cat    = 'Select a category';
    if (!selectedLevels.length)   e.levels = 'Select at least one level';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const isStandard = selectedCategory ? selectedCategory.is_standard : true;
      const payload = {
        name:        name.trim(),
        description: description.trim(),
        category_id: Number(categoryId),
        is_standard: isStandard,
        levels: selectedLevels.map(id => ({ level_id: id })),
      };
      await onSaved(payload, isEdit ? kra.id : (isClone ? kra.id : null), mode);

      if (stayOpen) {
        setSavedCount(c => c + 1);
        resetForNext();
      }
      // If isEdit, the parent closes the modal via onSaved
    } catch (err) {
      setErrors({ submit: err?.response?.data?.error || 'Something went wrong. Please try again.' });
      setSaving(false);
    }
  }

  const levelMap = Object.fromEntries(levels.map((l, i) => [l.id, { ...l, idx: i }]));

  const headerIcon  = isClone ? <ContentCopyIcon sx={{ color: '#fff', fontSize: 18 }} />
                    : isEdit  ? <EditIcon        sx={{ color: '#fff', fontSize: 18 }} />
                    :           <AddIcon          sx={{ color: '#fff', fontSize: 20 }} />;
  const headerTitle = isClone ? 'Clone KRA' : isEdit ? 'Edit KRA' : 'Add New KRA';
  const headerSub   = isClone ? 'Duplicate this KRA — customise name & levels before saving'
                    : isEdit  ? 'Update KRA details'
                    : 'Fill in details and keep adding — close when done';
  const btnLabel    = saving
    ? 'Saving…'
    : isClone ? 'Save Clone'
    : isEdit  ? 'Save Changes'
    : 'Add KRA';

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        // Only allow explicit close (X button / Cancel), not backdrop or Escape
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        onClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' } }}
    >
      {/* Gradient header */}
      <Box sx={{ background: gradient, px: 3, pt: 3, pb: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {headerIcon}
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={15} color="#fff">{headerTitle}</Typography>
              <Typography fontSize={11} color="rgba(255,255,255,0.65)">{headerSub}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            {/* "N added" badge — visible after at least one save in stay-open mode */}
            {stayOpen && savedCount > 0 && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1, py: 0.35, borderRadius: 99,
                bgcolor: 'rgba(255,255,255,0.18)',
              }}>
                <CheckCircleIcon sx={{ fontSize: 12, color: '#86efac' }} />
                <Typography fontSize={11} fontWeight={700} color="#86efac">
                  {savedCount} added
                </Typography>
              </Box>
            )}
            <IconButton size="small" onClick={onClose}
              sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* Clone source badge */}
        {isClone && kra && (
          <Box sx={{ mt: 1.5, px: 1.5, py: 0.75, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.1)',
            display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <ContentCopyIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }} />
            <Typography fontSize={11} color="rgba(255,255,255,0.8)">
              Cloning from: <strong style={{ color: '#fff' }}>{kra.name}</strong>
            </Typography>
          </Box>
        )}
      </Box>

      <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stack spacing={2.5}>
          {errors.submit && (
            <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 13 }}>{errors.submit}</Alert>
          )}

          {/* ── Category dropdown (always visible, pre-selected) ── */}
          <FormControl fullWidth size="small" error={Boolean(errors.cat)}>
            <InputLabel>Category *</InputLabel>
            <Select
              value={categoryId ?? ''}
              label="Category *"
              onChange={e => {
                setCategoryId(Number(e.target.value));
                setErrors(v => ({ ...v, cat: undefined }));
              }}
              disabled={isEdit} // lock category in edit mode
              sx={{ borderRadius: 1.5 }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 260, borderRadius: 2 } } }}
            >
              {categories.length === 0 ? (
                <MenuItem disabled>
                  <Typography fontSize={13} color="#94a3b8">No categories available</Typography>
                </MenuItem>
              ) : (
                categories.map(cat => {
                  const isStd = cat.is_standard;
                  return (
                    <MenuItem key={cat.id} value={cat.id}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          bgcolor: isStd ? '#16a34a' : '#1d4ed8',
                        }} />
                        <Typography fontSize={13} fontWeight={600} color="#1e293b">{cat.name}</Typography>
                        <Chip
                          label={isStd ? 'Org Level' : 'Project Level'}
                          size="small"
                          sx={{
                            fontSize: 9, height: 16, fontWeight: 700,
                            bgcolor: isStd ? '#dcfce7' : '#dbeafe',
                            color:   isStd ? '#166534' : '#1d4ed8',
                          }}
                        />
                      </Stack>
                    </MenuItem>
                  );
                })
              )}
            </Select>
            {errors.cat && <FormHelperText>{errors.cat}</FormHelperText>}
          </FormControl>

          {/* KRA Name */}
          <TextField
            label="KRA Name" value={name} fullWidth size="small"
            placeholder="e.g., Code Review Efficiency"
            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            error={Boolean(errors.name)} helperText={errors.name}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            autoFocus
          />

          {/* Description */}
          <TextField
            label="Description (optional)" value={description} fullWidth multiline rows={3} size="small"
            placeholder="Brief description of what this KRA measures..."
            onChange={e => setDesc(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />

          {/* Applicable Levels multi-select */}
          <FormControl fullWidth size="small" error={Boolean(errors.levels)}>
            <InputLabel>Applicable Levels *</InputLabel>
            <Select
              multiple
              value={selectedLevels}
              label="Applicable Levels *"
              onChange={e => {
                setSelectedLevels(e.target.value);
                setErrors(v => ({ ...v, levels: undefined }));
              }}
              input={<OutlinedInput label="Applicable Levels *" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map(id => {
                    const lv = levelMap[id];
                    if (!lv) return null;
                    const s = lvlStyle(lv.idx);
                    return (
                      <Box key={id} sx={{
                        display: 'inline-flex', alignItems: 'center',
                        px: 0.75, py: 0.2, borderRadius: 0.75,
                        bgcolor: s.bg, border: `1px solid ${s.border}`, height: 22,
                      }}>
                        <Typography fontSize={10.5} fontWeight={700} color={s.color}>{lv.name}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
              sx={{ borderRadius: 1.5 }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 280, borderRadius: 2 } } }}
            >
              {levels.length === 0 ? (
                <MenuItem disabled>
                  <Typography fontSize={13} color="#94a3b8">No levels available — add levels first</Typography>
                </MenuItem>
              ) : (
                levels.map((lv, i) => {
                  const s = lvlStyle(i);
                  const hasExp = lv.min_experience != null || lv.max_experience != null;
                  const expLabel = hasExp ? `${lv.min_experience ?? 0}–${lv.max_experience ?? '∞'} yrs` : null;
                  return (
                    <MenuItem key={lv.id} value={lv.id}>
                      <Checkbox
                        checked={selectedLevels.includes(lv.id)} size="small"
                        sx={{ p: 0.5, mr: 1, color: s.color, '&.Mui-checked': { color: s.color } }}
                      />
                      <Stack direction="row" alignItems="center" spacing={1} flex={1}>
                        <Box sx={{
                          display: 'inline-flex', alignItems: 'center', gap: 0.5,
                          px: 0.75, py: 0.25, borderRadius: 0.75,
                          bgcolor: s.bg, border: `1px solid ${s.border}`,
                        }}>
                          <Typography fontSize={11} fontWeight={700} color={s.color}>{lv.name}</Typography>
                        </Box>
                        {expLabel && (
                          <Typography fontSize={11} color="#94a3b8">{expLabel}</Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  );
                })
              )}
            </Select>
            {errors.levels
              ? <FormHelperText>{errors.levels}</FormHelperText>
              : selectedLevels.length > 0 && (
                  <FormHelperText sx={{ color: isClone ? '#6d28d9' : '#1d4ed8' }}>
                    {selectedLevels.length} level{selectedLevels.length > 1 ? 's' : ''} selected
                    {isClone && ' · pre-filled from original'}
                  </FormHelperText>
                )
            }
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            textTransform: 'none', fontWeight: 700, background: gradient, borderRadius: 1.5,
            px: 3, minWidth: 130, boxShadow: '0 4px 12px rgba(30,58,138,0.3)',
            '&:hover': { background: gradient, opacity: 0.9 },
          }}>
          {btnLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}