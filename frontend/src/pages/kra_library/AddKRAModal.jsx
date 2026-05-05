import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  TextField, Button, IconButton, Typography, Stack, Box,
  CircularProgress, Alert, Chip, FormControl, InputLabel,
  Select, MenuItem, FormHelperText, OutlinedInput, Checkbox,
} from '@mui/material';
import CloseIcon       from '@mui/icons-material/Close';
import AddIcon         from '@mui/icons-material/Add';
import EditIcon        from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

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

// mode: 'add' | 'edit' | 'clone'
export default function AddKRAModal({ open, onClose, onSaved, kra, categories = [], levels = [], mode = 'add' }) {
  const isEdit  = mode === 'edit';
  const isClone = mode === 'clone';

  const [name,           setName]   = useState('');
  const [description,    setDesc]   = useState('');
  const [categoryId,     setCatId]  = useState('');
  // selectedLevels: array of level_id numbers
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [saving,         setSaving] = useState(false);
  const [errors,         setErrors] = useState({});

  // Populate form when modal opens
  useEffect(() => {
    if (open) {
      setName(isClone ? `Copy of ${kra?.name ?? ''}` : (kra?.name ?? ''));
      setDesc(kra?.description ?? '');
      setCatId(kra?.category_id ? String(kra.category_id) : '');
      // kra.levels[] contains objects with level_id — extract just the ids
      setSelectedLevels(kra?.levels?.map(l => l.level_id).filter(Boolean) ?? []);
      setErrors({});
      setSaving(false);
    }
  }, [open, kra, mode]);

  function validate() {
    const e = {};
    if (!name.trim())             e.name     = 'KRA name is required';
    if (name.trim().length > 120) e.name     = 'Max 120 characters';
    if (!categoryId)              e.category = 'Please select a category';
    if (!selectedLevels.length)   e.levels   = 'Select at least one level';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      // Derive is_standard from the selected category
      const selectedCategory = categories.find(c => String(c.id) === String(categoryId));
      const isStandard = selectedCategory ? selectedCategory.is_standard : true;

      const payload = {
        name:        name.trim(),
        description: description.trim(),
        category_id: Number(categoryId),
        is_standard: isStandard, // false if custom category, true if standard
        levels: selectedLevels.map(id => ({
          level_id: id,
          // name defaults to KRA name on the backend if omitted
        })),
      };
      await onSaved(payload, isEdit ? kra.id : null, mode);
    } catch (err) {
      setErrors({ submit: err?.response?.data?.error || 'Something went wrong. Please try again.' });
      setSaving(false);
    }
  }

  // Build a lookup: level_id → { ...level, idx }
  const levelMap = Object.fromEntries(
    levels.map((l, i) => [l.id, { ...l, idx: i }])
  );

  const headerIcon  = isClone ? <ContentCopyIcon sx={{ color: '#fff', fontSize: 18 }} />
                    : isEdit  ? <EditIcon        sx={{ color: '#fff', fontSize: 18 }} />
                    :           <AddIcon          sx={{ color: '#fff', fontSize: 20 }} />;
  const headerTitle = isClone ? 'Clone KRA' : isEdit ? 'Edit KRA' : 'Add New KRA';
  const headerSub   = isClone ? 'Duplicate and customise an existing KRA'
                    : isEdit  ? 'Update KRA details' : 'Add a KRA to the library';
  const btnLabel    = saving  ? 'Saving...' : isClone ? 'Save Clone' : isEdit ? 'Save Changes' : 'Add KRA';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' } }}>

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
          <IconButton size="small" onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Clone badge */}
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

          {/* KRA Name */}
          <TextField
            label="KRA Name" value={name} fullWidth size="small"
            placeholder="e.g., Code Review Efficiency"
            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            error={Boolean(errors.name)} helperText={errors.name}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />

          {/* Category */}
          <FormControl fullWidth size="small" error={Boolean(errors.category)}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryId}
              label="Category"
              onChange={e => { setCatId(e.target.value); setErrors(v => ({ ...v, category: undefined })); }}
              sx={{ borderRadius: 1.5 }}
            >
              {categories.length === 0 ? (
                <MenuItem disabled value="">
                  <Typography fontSize={13} color="#94a3b8">No categories available</Typography>
                </MenuItem>
              ) : (
                categories.map(c => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={c.is_standard ? 'Standard' : 'Custom'} size="small"
                        sx={{ fontSize: 10, height: 18,
                          bgcolor: c.is_standard ? '#dbeafe' : '#fef3c7',
                          color:   c.is_standard ? '#1d4ed8' : '#92400e' }}
                      />
                      <span>{c.name}</span>
                    </Stack>
                  </MenuItem>
                ))
              )}
            </Select>
            {errors.category && <FormHelperText>{errors.category}</FormHelperText>}
          </FormControl>

          {/* Description */}
          <TextField
            label="Description (optional)" value={description} fullWidth multiline rows={3} size="small"
            placeholder="Brief description of what this KRA measures..."
            onChange={e => setDesc(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />

          {/* Applicable Levels — multi-select */}
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
                      <Chip key={id} label={lv.name} size="small"
                        sx={{ height: 20, fontSize: 11, fontWeight: 700,
                          bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}` }} />
                    );
                  })}
                </Box>
              )}
              sx={{ borderRadius: 1.5 }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 240, borderRadius: 2 } } }}
            >
              {levels.length === 0 ? (
                <MenuItem disabled>
                  <Typography fontSize={13} color="#94a3b8">No levels available — add levels first</Typography>
                </MenuItem>
              ) : (
                levels.map((lv, i) => {
                  const s = lvlStyle(i);
                  return (
                    <MenuItem key={lv.id} value={lv.id}>
                      <Checkbox
                        checked={selectedLevels.includes(lv.id)} size="small"
                        sx={{ p: 0.5, mr: 1, color: s.color, '&.Mui-checked': { color: s.color } }}
                      />
                      <Stack direction="row" alignItems="center" spacing={1} flex={1}>
                        <Chip label={lv.name} size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700,
                            bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}` }} />
                        {(lv.min_experience != null || lv.max_experience != null) && (
                          <Typography fontSize={11} color="#94a3b8">
                            {lv.min_experience ?? 0}–{lv.max_experience ?? '∞'} yrs
                          </Typography>
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
                  <FormHelperText sx={{ color: '#1d4ed8' }}>
                    {selectedLevels.length} level{selectedLevels.length > 1 ? 's' : ''} selected
                  </FormHelperText>
                )
            }
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={saving}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, background: gradient, borderRadius: 1.5,
            px: 3, minWidth: 130, boxShadow: '0 4px 12px rgba(30,58,138,0.3)',
            '&:hover': { background: gradient, opacity: 0.9 } }}>
          {btnLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}