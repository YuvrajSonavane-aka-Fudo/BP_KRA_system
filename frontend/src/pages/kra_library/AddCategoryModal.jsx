import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  TextField, Button, IconButton, Typography, Stack, Box,
  CircularProgress, Alert,
} from '@mui/material';
import CloseIcon       from '@mui/icons-material/Close';
import CategoryIcon    from '@mui/icons-material/Category';
import StarIcon        from '@mui/icons-material/Star';
import TuneIcon        from '@mui/icons-material/Tune';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

export default function AddCategoryModal({ open, onClose, onSaved, category }) {
  const isEdit = Boolean(category);
  // Stay-open behaviour only in "add" mode
  const stayOpen = !isEdit;

  const [name,       setName]     = useState('');
  const [isStandard, setStandard] = useState(true);
  const [saving,     setSaving]   = useState(false);
  const [errors,     setErrors]   = useState({});
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setStandard(category?.is_standard ?? true);
      setErrors({});
      setSaving(false);
      setSavedCount(0);
    }
  }, [open, category]);

  function resetForNext() {
    setName('');
    // keep isStandard so user can batch-add same type
    setErrors({});
    setSaving(false);
  }

  function validate() {
    const e = {};
    if (!name.trim())            e.name = 'Category name is required';
    if (name.trim().length > 80) e.name = 'Max 80 characters';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSaved({ name: name.trim(), is_standard: isStandard }, isEdit ? category.id : null);
      if (stayOpen) {
        setSavedCount(c => c + 1);
        resetForNext();
      }
      // In edit mode the parent closes the modal
    } catch (err) {
      setErrors({ submit: err?.response?.data?.error || 'Something went wrong. Please try again.' });
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        // Prevent accidental close via backdrop click or Escape key
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        onClose();
      }}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' } }}
    >
      {/* Gradient header */}
      <Box sx={{ background: gradient, px: 3, pt: 3, pb: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.5,
              bgcolor: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CategoryIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={15} color="#fff">
                {isEdit ? 'Edit Category' : 'Add New Category'}
              </Typography>
              <Typography fontSize={11} color="rgba(255,255,255,0.65)">
                {isEdit
                  ? 'Update category details'
                  : 'Fill in details and keep adding — close when done'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            {/* Saved count badge */}
            {stayOpen && savedCount > 0 && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.25 , py: 0.35, borderRadius: 99,
                bgcolor: 'rgba(255,255,255,0.18)',
              }}>
                <CheckCircleIcon sx={{ fontSize: 12, color: '#86efac' }} />
                <Typography fontSize={11} fontWeight={700} color="#86efac" sx={{ whiteSpace: 'nowrap', lineHeight: 1 }}>
                  {savedCount} added
                </Typography>
              </Box>
            )}
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stack spacing={2.5}>
          {errors.submit && (
            <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 13 }}>{errors.submit}</Alert>
          )}

          {/* Category Type — FIRST */}
          <Box>
            <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1}>
              Category Type
            </Typography>
            <Stack direction="row" spacing={2.5}>
              {[
                { value: true,  label: 'Org Level',     icon: <StarIcon sx={{ fontSize: 13 }} />, color: '#16a34a' },
                { value: false, label: 'Project Level', icon: <TuneIcon sx={{ fontSize: 13 }} />, color: '#1d4ed8' },
              ].map(opt => {
                const isSelected = isStandard === opt.value;
                return (
                  <Stack key={String(opt.value)} direction="row" alignItems="center" spacing={0.75}
                    onClick={() => setStandard(opt.value)}
                    sx={{ cursor: 'pointer', userSelect: 'none' }}>
                    {/* Radio */}
                    <Box sx={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSelected ? opt.color : '#cbd5e1'}`,
                      bgcolor: isSelected ? opt.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {isSelected && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#fff' }} />}
                    </Box>
                    <Box sx={{ color: isSelected ? opt.color : '#94a3b8', display: 'flex' }}>{opt.icon}</Box>
                    <Typography fontSize={13} fontWeight={isSelected ? 700 : 500}
                      color={isSelected ? opt.color : '#64748b'}>
                      {opt.label}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Box>

          {/* Category Name — SECOND */}
          <TextField
            label={<>Category Name <Box component="span" sx={{ color: '#ef4444' }}>*</Box></>}
            value={name}
            fullWidth
            size="small"
            placeholder="e.g., Technical Excellence"
            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            error={Boolean(errors.name)}
            helperText={errors.name}
            autoFocus
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            textTransform: 'none', fontWeight: 700, background: gradient,
            borderRadius: 1.5, px: 3, minWidth: 130,
            boxShadow: '0 4px 12px rgba(30,58,138,0.3)',
            '&:hover': { background: gradient, opacity: 0.9 },
          }}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}