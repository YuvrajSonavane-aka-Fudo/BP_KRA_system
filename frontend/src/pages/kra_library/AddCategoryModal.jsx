import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  TextField, Button, IconButton, Typography, Stack, Box,
  CircularProgress, Alert,
} from '@mui/material';
import CloseIcon    from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import StarIcon     from '@mui/icons-material/Star';
import TuneIcon     from '@mui/icons-material/Tune';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

export default function AddCategoryModal({ open, onClose, onSaved, category }) {
  const isEdit = Boolean(category);

  const [name,       setName]     = useState('');
  const [isStandard, setStandard] = useState(true);
  const [saving,     setSaving]   = useState(false);
  const [errors,     setErrors]   = useState({});

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setStandard(category?.is_standard ?? true);
      setErrors({});
      setSaving(false);
    }
  }, [open, category]);

  function validate() {
    const e = {};
    if (!name.trim())              e.name = 'Category name is required';
    if (name.trim().length > 80)   e.name = 'Max 80 characters';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSaved({ name: name.trim(), is_standard: isStandard }, isEdit ? category.id : null);
    } catch (err) {
      setErrors({ submit: err?.response?.data?.error || 'Something went wrong. Please try again.' });
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' } }}>

      {/* Gradient header */}
      <Box sx={{ background: gradient, px: 3, pt: 3, pb: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CategoryIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={15} color="#fff">
                {isEdit ? 'Edit Category' : 'Add New Category'}
              </Typography>
              <Typography fontSize={11} color="rgba(255,255,255,0.65)">
                {isEdit ? 'Update category details' : 'Create a KRA category'}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stack spacing={2.5}>
          {errors.submit && <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 13 }}>{errors.submit}</Alert>}

          <TextField
            label="Category Name" value={name} fullWidth size="small"
            placeholder="e.g., Technical Excellence"
            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            error={Boolean(errors.name)} helperText={errors.name}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />

          {/* Type toggle */}
          <Box>
            <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1}>Category Type</Typography>
            <Stack direction="row" spacing={1.5}>
              {[
                { value: true,  label: 'Standard', icon: <StarIcon sx={{ fontSize: 14 }} />, desc: 'Core org-wide KRA category' },
                { value: false, label: 'Project',   icon: <TuneIcon sx={{ fontSize: 14 }} />, desc: 'Project or team specific' },
              ].map(opt => (
                <Box key={String(opt.value)} onClick={() => setStandard(opt.value)}
                  sx={{
                    flex: 1, px: 2, py: 1.5, borderRadius: 2, cursor: 'pointer',
                    border: `2px solid ${isStandard === opt.value ? '#1d4ed8' : '#e2e8f0'}`,
                    bgcolor: isStandard === opt.value ? '#eff6ff' : '#fafafa',
                    transition: 'all 0.15s',
                  }}>
                  <Stack direction="row" alignItems="center" spacing={0.75} mb={0.4}>
                    <Box sx={{ color: isStandard === opt.value ? '#1d4ed8' : '#94a3b8' }}>{opt.icon}</Box>
                    <Typography fontSize={13} fontWeight={700} color={isStandard === opt.value ? '#1d4ed8' : '#475569'}>
                      {opt.label}
                    </Typography>
                  </Stack>
                  <Typography fontSize={11} color="#94a3b8">{opt.desc}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={saving}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, background: gradient, borderRadius: 1.5, px: 3, minWidth: 130,
            boxShadow: '0 4px 12px rgba(30,58,138,0.3)', '&:hover': { background: gradient, opacity: 0.9 } }}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Category'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}