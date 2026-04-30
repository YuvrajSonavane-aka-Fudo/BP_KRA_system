import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, IconButton, TextField,
  InputAdornment, Tooltip, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Collapse, Snackbar, Tab, Tabs,
  Dialog, DialogContent, DialogActions,
} from '@mui/material';
import SearchIcon        from '@mui/icons-material/Search';
import AddIcon           from '@mui/icons-material/Add';
import EditIcon          from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon       from '@mui/icons-material/Refresh';
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore';
import ExpandLessIcon    from '@mui/icons-material/ExpandLess';
import LibraryBooksIcon  from '@mui/icons-material/LibraryBooks';
import CategoryIcon      from '@mui/icons-material/Category';
import LayersIcon        from '@mui/icons-material/Layers';
import CloseIcon         from '@mui/icons-material/Close';
import ContentCopyIcon   from '@mui/icons-material/ContentCopy';
import StarIcon          from '@mui/icons-material/Star';
import TuneIcon          from '@mui/icons-material/Tune';

import {
  getKRALibrary,
  createKRA, updateKRA, deleteKRA, cloneKRA,
  createCategory, updateCategory, deleteCategory, getCategories,
  createLevel, updateLevel, deleteLevel, getLevels,
} from '../../api/kraLibraryApi';
import useRoleAccess from '../../hooks/useRoleAccess';
import AddKRAModal      from './AddKRAModal';
import AddCategoryModal from './AddCategoryModal';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const CAT_PALETTE = [
  { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
  { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
  { bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
  { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
  { bg: '#e0f2fe', color: '#075985', border: '#bae6fd' },
];
const catStyle = (i) => CAT_PALETTE[Math.max(0, i) % CAT_PALETTE.length];

// ─── Module-level cache ───────────────────────────────────────────────────────
// Lives OUTSIDE React. Survives StrictMode's unmount-remount cycle completely.
// StrictMode destroys component state/refs on the first unmount, but it cannot
// touch plain JS variables at module scope — so the second mount finds the
// cache already populated and skips the network entirely.
const _cache = {
  data:        null,          // { kras, categories, levels } once fetched
  promise:     null,          // in-flight Promise (deduplicates parallel calls)
  abortCtrl:   null,          // current AbortController
};

async function _fetchLibraryData() {
  // If a fetch is already in-flight, return the same promise (no duplicate calls)
  if (_cache.promise) return _cache.promise;

  // Abort any previous stale controller (safety net)
  if (_cache.abortCtrl) _cache.abortCtrl.abort();
  _cache.abortCtrl = new AbortController();

  _cache.promise = Promise.all([
    getKRALibrary(),
    getLevels(),
    getCategories(),
  ]).then(([kraRes, levelRes, catRes]) => {
    _cache.data = {
      kras:       kraRes.data?.kras       ?? [],
      levels:     levelRes.data?.levels   ?? [],
      categories: catRes.data?.categories ?? [],
    };
    return _cache.data;
  }).finally(() => {
    _cache.promise = null; // allow future refreshes to re-fetch
  });

  return _cache.promise;
}

function _invalidateCache() {
  _cache.data    = null;
  _cache.promise = null;
  if (_cache.abortCtrl) {
    _cache.abortCtrl.abort();
    _cache.abortCtrl = null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useKRALibraryData() {
  const [kras,       setKras]       = useState(_cache.data?.kras       ?? []);
  const [categories, setCategories] = useState(_cache.data?.categories ?? []);
  const [levels,     setLevels]     = useState(_cache.data?.levels     ?? []);
  // If cache already has data (StrictMode second mount), start as not-loading
  const [loading,    setLoading]    = useState(!_cache.data);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    // Cache hit — data already loaded (StrictMode second mount or navigation back)
    // No network call needed at all.
    if (_cache.data) {
      setKras(_cache.data.kras);
      setCategories(_cache.data.categories);
      setLevels(_cache.data.levels);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    _fetchLibraryData()
      .then(data => {
        if (cancelled) return;
        setKras(data.kras);
        setCategories(data.categories);
        setLevels(data.levels);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.response?.data?.error || 'Failed to load KRA library.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []); // runs once per true mount; StrictMode second mount hits cache-hit path

  const refresh = useCallback(() => {
    _invalidateCache();
    setLoading(true);
    setError(null);

    _fetchLibraryData()
      .then(data => {
        setKras(data.kras);
        setCategories(data.categories);
        setLevels(data.levels);
      })
      .catch(err => {
        setError(err?.response?.data?.error || 'Failed to load KRA library.');
      })
      .finally(() => setLoading(false));
  }, []);

  return { kras, categories, levels, loading, error, refresh };
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ open, message, severity = 'success', onClose }) {
  return (
    <Snackbar open={open} autoHideDuration={3500} onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Alert severity={severity} onClose={onClose} variant="filled"
        sx={{ minWidth: 280, fontWeight: 600, borderRadius: 2 }}>
        {message}
      </Alert>
    </Snackbar>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirmDialog({ open, title, message, onClose, onConfirm, deleting }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: '#fef2f2', px: 3, pt: 2.5, pb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DeleteOutlineIcon sx={{ color: '#dc2626', fontSize: 18 }} />
          </Box>
          <Typography fontWeight={800} fontSize={15} color="#991b1b">{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Typography fontSize={14} color="#374151">{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={deleting}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={deleting} variant="contained" color="error"
          startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5 }}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Level Modal ──────────────────────────────────────────────────────────────
function LevelModal({ open, onClose, onSaved, level }) {
  const isEdit = Boolean(level);
  const [name,   setName]   = useState('');
  const [minExp, setMinExp] = useState('');
  const [maxExp, setMaxExp] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setName(level?.name ?? '');
      setMinExp(level?.min_experience != null ? String(level.min_experience) : '');
      setMaxExp(level?.max_experience != null ? String(level.max_experience) : '');
      setErrors({});
      setSaving(false);
    }
  }, [open, level]);

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Level name is required';
    if (minExp !== '' && isNaN(Number(minExp))) e.minExp = 'Must be a number';
    if (maxExp !== '' && isNaN(Number(maxExp))) e.maxExp = 'Must be a number';
    if (minExp !== '' && maxExp !== '' && Number(minExp) > Number(maxExp)) e.maxExp = 'Max must be ≥ Min';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        min_experience: minExp !== '' ? Number(minExp) : null,
        max_experience: maxExp !== '' ? Number(maxExp) : null,
      };
      await onSaved(payload, isEdit ? level.id : null);
    } catch (err) {
      setErrors({ submit: err?.response?.data?.error || 'Something went wrong.' });
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ background: gradient, px: 3, pt: 3, pb: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayersIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={15} color="#fff">{isEdit ? 'Edit Level' : 'Add New Level'}</Typography>
              <Typography fontSize={11} color="rgba(255,255,255,0.65)">Define employee level details</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stack spacing={2}>
          {errors.submit && <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 13 }}>{errors.submit}</Alert>}
          <TextField label="Level Name" value={name} fullWidth size="small"
            placeholder="e.g., Dev1, QA2, Senior"
            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: undefined })); }}
            error={Boolean(errors.name)} helperText={errors.name}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
          <Stack direction="row" spacing={1.5}>
            <TextField label="Min Experience (yrs)" value={minExp} fullWidth size="small" type="number"
              onChange={e => { setMinExp(e.target.value); setErrors(v => ({ ...v, minExp: undefined })); }}
              error={Boolean(errors.minExp)} helperText={errors.minExp}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            <TextField label="Max Experience (yrs)" value={maxExp} fullWidth size="small" type="number"
              onChange={e => { setMaxExp(e.target.value); setErrors(v => ({ ...v, maxExp: undefined })); }}
              error={Boolean(errors.maxExp)} helperText={errors.maxExp}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={saving}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, background: gradient, borderRadius: 1.5, px: 3,
            boxShadow: '0 4px 12px rgba(30,58,138,0.3)', '&:hover': { background: gradient, opacity: 0.9 } }}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Level'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── KRA Row ──────────────────────────────────────────────────────────────────
function KRARow({ kra, catIdx, canManage, onEdit, onClone, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
        onClick={() => setExpanded(v => !v)}>
        <TableCell sx={{ py: 1.75, pl: 2.5, borderBottom: expanded ? 'none' : undefined }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <IconButton size="small" sx={{ color: '#94a3b8', p: 0.25, mt: 0.1, flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
            <Box>
              <Typography fontWeight={700} fontSize={13.5} color="#1e293b" lineHeight={1.3}>
                {kra.name}
              </Typography>
              {kra.description && (
                <Typography fontSize={12} color="#64748b" mt={0.3} lineHeight={1.4}
                  sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {kra.description}
                </Typography>
              )}
            </Box>
          </Stack>
        </TableCell>

        <TableCell sx={{ py: 1.75, borderBottom: expanded ? 'none' : undefined }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {kra.levels?.length
              ? kra.levels.map((lv, i) => (
                  <Chip key={lv.id ?? i} label={lv.level_name} size="small"
                    sx={{ fontSize: 11, height: 22, fontWeight: 600,
                      bgcolor: CAT_PALETTE[i % CAT_PALETTE.length].bg,
                      color:   CAT_PALETTE[i % CAT_PALETTE.length].color,
                      border: `1px solid ${CAT_PALETTE[i % CAT_PALETTE.length].border}` }} />
                ))
              : <Typography fontSize={12} color="#94a3b8" fontStyle="italic">No levels assigned</Typography>}
          </Stack>
        </TableCell>

        <TableCell align="right" sx={{ py: 1.75, pr: 2, borderBottom: expanded ? 'none' : undefined }}
          onClick={e => e.stopPropagation()}>
          {canManage && (
            <Stack direction="row" spacing={0.25} justifyContent="flex-end">
              <Tooltip title="Edit KRA">
                <IconButton size="small" onClick={() => onEdit(kra)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#1d4ed8', bgcolor: '#eff6ff' }, borderRadius: 1.5 }}>
                  <EditIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clone KRA">
                <IconButton size="small" onClick={() => onClone(kra)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#6d28d9', bgcolor: '#f5f3ff' }, borderRadius: 1.5 }}>
                  <ContentCopyIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete KRA">
                <IconButton size="small" onClick={() => onDelete(kra)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' }, borderRadius: 1.5 }}>
                  <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={3} sx={{ p: 0, border: 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 7, pr: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <Typography fontSize={13} color="#475569" mb={kra.levels?.length ? 1.5 : 0} lineHeight={1.6}>
                {kra.description || <em style={{ color: '#94a3b8' }}>No description provided.</em>}
              </Typography>
              {kra.levels?.length > 0 && (
                <Box>
                  <Typography fontSize={10} fontWeight={700} color="#94a3b8" mb={1}
                    textTransform="uppercase" letterSpacing="0.07em">Level Breakdown</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {kra.levels.map((lv, i) => (
                      <Box key={lv.id ?? i} sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, bgcolor: '#fff',
                        border: `1px solid ${CAT_PALETTE[i % CAT_PALETTE.length].border}` }}>
                        <Typography fontSize={12} fontWeight={700} color={CAT_PALETTE[i % CAT_PALETTE.length].color}>
                          {lv.level_name}
                        </Typography>
                        {lv.name && lv.name !== lv.level_name && (
                          <Typography fontSize={11} color="#64748b" mt={0.2}>{lv.name}</Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({
  kras, categories, canManage, search,
  onEditKRA, onCloneKRA, onDeleteKRA,
  onAddCategory, onEditCategory, onDeleteCategory,
}) {
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 8;

  useEffect(() => {
    if (categories.length && selectedCatId === null) {
      setSelectedCatId(categories[0]?.id ?? null);
    }
  }, [categories]);

  // Reset page on search or category change
  useEffect(() => { setPage(0); }, [search, selectedCatId]);

  const kraCountMap = useMemo(() => {
    const m = {};
    kras.forEach(k => { m[k.category_id] = (m[k.category_id] || 0) + 1; });
    return m;
  }, [kras]);

  const filtered = useMemo(() => {
    let list = selectedCatId != null ? kras.filter(k => k.category_id === selectedCatId) : kras;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(k =>
        k.name.toLowerCase().includes(q) ||
        (k.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [kras, selectedCatId, search]);

  const paginated  = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const selectedCatIdx = categories.findIndex(c => c.id === selectedCatId);
  const selectedCat    = categories.find(c => c.id === selectedCatId);

  const standardCats = categories.filter(c => c.is_standard);
  const customCats   = categories.filter(c => !c.is_standard);

  function handleCatSelect(id) { setSelectedCatId(id); setPage(0); }

  function renderCatItem(cat) {
    const active = selectedCatId === cat.id;
    const style  = catStyle(categories.findIndex(c => c.id === cat.id));
    const count  = kraCountMap[cat.id] || 0;
    return (
      <Box key={cat.id} onClick={() => handleCatSelect(cat.id)}
        sx={{
          px: 1.5, py: 1, mx: 0.5, borderRadius: 1.5, cursor: 'pointer',
          bgcolor: active ? style.bg : 'transparent',
          borderLeft: `3px solid ${active ? style.color : 'transparent'}`,
          '&:hover': { bgcolor: active ? style.bg : '#f8fafc' },
          transition: 'all 0.12s', mb: 0.25,
        }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box flex={1} minWidth={0}>
            <Typography fontSize={12.5} fontWeight={active ? 700 : 500}
              color={active ? style.color : '#475569'} noWrap>
              {cat.name}
            </Typography>
            <Typography fontSize={10.5} color="#94a3b8">{count} KRA{count !== 1 ? 's' : ''}</Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.25}>
            <Chip label={count} size="small"
              sx={{ height: 16, fontSize: 9, fontWeight: 700, minWidth: 20,
                bgcolor: active ? `${style.color}20` : '#f1f5f9',
                color:   active ? style.color : '#64748b' }} />
            {canManage && active && (
              <>
                <Tooltip title="Edit">
                  <IconButton size="small"
                    onClick={e => { e.stopPropagation(); onEditCategory(cat); }}
                    sx={{ color: style.color, p: 0.25, '&:hover': { bgcolor: `${style.color}15` }, borderRadius: 1 }}>
                    <EditIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small"
                    onClick={e => { e.stopPropagation(); onDeleteCategory(cat); }}
                    sx={{ color: '#dc2626', p: 0.25, '&:hover': { bgcolor: '#fef2f2' }, borderRadius: 1 }}>
                    <DeleteOutlineIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack direction="row" sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ── Left Panel ── */}
      <Box sx={{ width: 220, flexShrink: 0, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <Typography fontSize={10} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.07em">
            Categories
          </Typography>
          {canManage && (
            <Tooltip title="Add category">
              <IconButton size="small" onClick={onAddCategory}
                sx={{ color: '#1d4ed8', bgcolor: '#eff6ff', borderRadius: 1, p: 0.4, '&:hover': { bgcolor: '#dbeafe' } }}>
                <AddIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <Box sx={{ flex: 1, overflowY: 'auto', py: 0.75,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
        }}>
          {/* All KRAs */}
          <Box onClick={() => handleCatSelect(null)}
            sx={{
              px: 1.5, py: 1, mx: 0.5, borderRadius: 1.5, cursor: 'pointer', mb: 0.5,
              bgcolor: selectedCatId === null ? '#eff6ff' : 'transparent',
              borderLeft: `3px solid ${selectedCatId === null ? '#1d4ed8' : 'transparent'}`,
              '&:hover': { bgcolor: selectedCatId === null ? '#eff6ff' : '#f8fafc' },
              transition: 'all 0.12s',
            }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontSize={12.5} fontWeight={selectedCatId === null ? 700 : 500}
                color={selectedCatId === null ? '#1d4ed8' : '#475569'}>
                All KRAs
              </Typography>
              <Chip label={kras.length} size="small"
                sx={{ height: 16, fontSize: 9, fontWeight: 700, minWidth: 20,
                  bgcolor: selectedCatId === null ? '#dbeafe' : '#f1f5f9',
                  color:   selectedCatId === null ? '#1d4ed8' : '#64748b' }} />
            </Stack>
          </Box>

          {standardCats.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
                <StarIcon sx={{ fontSize: 10, color: '#f59e0b' }} />
                <Typography fontSize={9.5} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.06em">
                  Standard
                </Typography>
              </Stack>
              {standardCats.map(cat => renderCatItem(cat))}
            </Box>
          )}

          {customCats.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
                <TuneIcon sx={{ fontSize: 10, color: '#6b7280' }} />
                <Typography fontSize={9.5} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.06em">
                  Custom / Project
                </Typography>
              </Stack>
              {customCats.map(cat => renderCatItem(cat))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Right Panel ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 3, py: 1.25, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {selectedCat ? (
              <>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: catStyle(selectedCatIdx).color }} />
                <Typography fontSize={14} fontWeight={800} color="#1e293b">{selectedCat.name}</Typography>
                <Chip
                  label={selectedCat.is_standard ? 'Standard' : 'Custom'}
                  size="small"
                  icon={selectedCat.is_standard
                    ? <StarIcon sx={{ fontSize: '10px !important', color: '#f59e0b !important' }} />
                    : <TuneIcon sx={{ fontSize: '10px !important', color: '#6b7280 !important' }} />}
                  sx={{ fontSize: 10, height: 18, fontWeight: 700,
                    bgcolor: selectedCat.is_standard ? '#fef3c7' : '#f1f5f9',
                    color:   selectedCat.is_standard ? '#92400e' : '#475569' }} />
              </>
            ) : (
              <Typography fontSize={14} fontWeight={800} color="#1e293b">All KRAs</Typography>
            )}
          </Stack>
          <Typography fontSize={12} color="#94a3b8">
            {filtered.length} KRA{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>

        {filtered.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 1 }}>
            <LibraryBooksIcon sx={{ fontSize: 40, color: '#e2e8f0' }} />
            <Typography color="#94a3b8" fontSize={13} fontWeight={600}>
              {search ? 'No KRAs match your search' : 'No KRAs in this category yet'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ flex: 1, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
            }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pl: 2.5, py: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', bgcolor: '#f8fafc', width: '50%' }}>
                      KRA Title & Description
                    </TableCell>
                    <TableCell sx={{ py: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', bgcolor: '#f8fafc' }}>
                      Applicable Levels
                    </TableCell>
                    <TableCell sx={{ py: 1, pr: 2, bgcolor: '#f8fafc', width: 100 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginated.map(kra => (
                    <KRARow key={kra.id} kra={kra}
                      catIdx={selectedCatIdx >= 0 ? selectedCatIdx : categories.findIndex(c => c.id === kra.category_id)}
                      canManage={canManage}
                      onEdit={onEditKRA} onClone={onCloneKRA} onDelete={onDeleteKRA} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ px: 3, py: 1.25, borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
              {totalPages > 1 ? (
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography fontSize={12} color="#64748b">
                    {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length} KRAs
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      sx={{ minWidth: 28, px: 0.75, fontSize: 12, color: '#475569', textTransform: 'none' }}>‹</Button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Box key={i} onClick={() => setPage(i)}
                        sx={{ width: 26, height: 26, borderRadius: 1.5, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', fontSize: 12,
                          fontWeight: page === i ? 700 : 400,
                          bgcolor: page === i ? '#1d4ed8' : 'transparent',
                          color:   page === i ? '#fff' : '#64748b',
                          '&:hover': { bgcolor: page === i ? '#1d4ed8' : '#f1f5f9' } }}>
                        {i + 1}
                      </Box>
                    ))}
                    <Button size="small" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}
                      sx={{ minWidth: 28, px: 0.75, fontSize: 12, color: '#475569', textTransform: 'none' }}>›</Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography fontSize={12} color="#94a3b8">
                  Displaying all {filtered.length} KRA{filtered.length !== 1 ? 's' : ''}{selectedCat ? ` in ${selectedCat.name}` : ''}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Stack>
  );
}

// ─── Levels Tab ───────────────────────────────────────────────────────────────
function LevelsTab({ levels, canManage, onAdd, onEdit, onDelete }) {
  return (
    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 3, py: 1.5, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <Box>
          <Typography fontSize={14} fontWeight={800} color="#1e293b">Employee Levels</Typography>
          <Typography fontSize={12} color="#64748b" mt={0.2}>
            Define levels and experience ranges for KRA applicability
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onAdd}
            sx={{ textTransform: 'none', fontWeight: 700, background: gradient, borderRadius: 1.5, px: 2.5,
              boxShadow: '0 4px 12px rgba(30,58,138,0.25)', '&:hover': { background: gradient, opacity: 0.9 } }}>
            Add Level
          </Button>
        )}
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 3,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
      }}>
        {levels.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LayersIcon sx={{ fontSize: 48, color: '#e2e8f0', mb: 2 }} />
            <Typography color="#94a3b8" fontSize={13} fontWeight={600}>No levels defined yet</Typography>
            {canManage && (
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={onAdd}
                sx={{ mt: 2, textTransform: 'none', borderRadius: 1.5 }}>
                Add First Level
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
            {levels.map((lv, i) => {
              const style = catStyle(i);
              return (
                <Paper key={lv.id} variant="outlined" sx={{
                  px: 2, py: 1.75, borderRadius: 2,
                  borderColor: style.border, bgcolor: style.bg,
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: `0 4px 16px ${style.color}25` },
                }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box>
                      <Typography fontSize={14} fontWeight={800} color={style.color}>{lv.name}</Typography>
                      {(lv.min_experience != null || lv.max_experience != null) && (
                        <Typography fontSize={11} color="#64748b" mt={0.4}>
                          {lv.min_experience ?? 0} – {lv.max_experience ?? '∞'} yrs exp
                        </Typography>
                      )}
                    </Box>
                    {canManage && (
                      <Stack direction="row" spacing={0.25}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => onEdit(lv)}
                            sx={{ color: style.color, p: 0.4, '&:hover': { bgcolor: `${style.color}15` }, borderRadius: 1 }}>
                            <EditIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => onDelete(lv)}
                            sx={{ color: '#dc2626', p: 0.4, '&:hover': { bgcolor: '#fef2f2' }, borderRadius: 1 }}>
                            <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KRALibraryPage() {
  const { isHR } = useRoleAccess();
  const canManage = isHR;

  // ── All data + smart fetch (no double calls) ──────────────────────────────
  const {
    kras, categories, levels,
    loading, error,
    refresh,
  } = useKRALibraryData();

  const [tab,    setTab]    = useState(0);
  const [search, setSearch] = useState('');

  const [kraModal,     setKraModal]     = useState({ open: false, kra: null, mode: 'add' });
  const [catModal,     setCatModal]     = useState({ open: false, cat: null });
  const [levelModal,   setLevelModal]   = useState({ open: false, level: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, item: null });
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState({ open: false, message: '', severity: 'success' });

  function showToast(msg, severity = 'success') { setToast({ open: true, message: msg, severity }); }

  // ── KRA handlers ──────────────────────────────────────────────────────────
  async function handleKRASave(payload, id, mode) {
    try {
      if (mode === 'edit')       await updateKRA(id, payload);
      else if (mode === 'clone') await cloneKRA(id, payload);
      else                       await createKRA(payload);

      setKraModal({ open: false, kra: null, mode: 'add' });
      showToast(
        mode === 'edit'  ? 'KRA updated successfully' :
        mode === 'clone' ? 'KRA cloned successfully'  :
                           'KRA added to library'
      );
      refresh(); // single coordinated re-fetch of all 3 endpoints
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save KRA', 'error');
    }
  }

  async function handleKRADelete() {
    setDeleting(true);
    try {
      await deleteKRA(deleteDialog.item.id);
      setDeleteDialog({ open: false, type: null, item: null });
      showToast('KRA removed from library');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to delete KRA', 'error');
    } finally { setDeleting(false); }
  }

  // ── Category handlers ─────────────────────────────────────────────────────
  async function handleCatSave(payload, id) {
    try {
      if (id) await updateCategory(id, payload);
      else    await createCategory(payload);
      setCatModal({ open: false, cat: null });
      showToast(id ? 'Category updated' : 'Category added');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save category', 'error');
    }
  }

  async function handleCatDelete() {
    setDeleting(true);
    try {
      await deleteCategory(deleteDialog.item.id);
      setDeleteDialog({ open: false, type: null, item: null });
      showToast('Category deleted');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to delete category', 'error');
    } finally { setDeleting(false); }
  }

  // ── Level handlers ────────────────────────────────────────────────────────
  async function handleLevelSave(payload, id) {
    try {
      if (id) await updateLevel(id, payload);
      else    await createLevel(payload);
      setLevelModal({ open: false, level: null });
      showToast(id ? 'Level updated' : 'Level added');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save level', 'error');
    }
  }

  async function handleLevelDelete() {
    setDeleting(true);
    try {
      await deleteLevel(deleteDialog.item.id);
      setDeleteDialog({ open: false, type: null, item: null });
      showToast('Level deleted');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to delete level', 'error');
    } finally { setDeleting(false); }
  }

  function handleDelete() {
    if (deleteDialog.type === 'kra')      return handleKRADelete();
    if (deleteDialog.type === 'category') return handleCatDelete();
    if (deleteDialog.type === 'level')    return handleLevelDelete();
  }

  const deleteMessages = {
    kra:      `Remove "${deleteDialog.item?.name}" from the library? This cannot be undone.`,
    category: `Delete category "${deleteDialog.item?.name}"? All KRAs in this category will become uncategorised.`,
    level:    `Delete level "${deleteDialog.item?.name}"?`,
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', overflow: 'hidden' }}>

      {/* ── Banner ── */}
      <Paper elevation={0} sx={{
        background: gradient, px: { xs: 2.5, md: 4 }, py: 2,
        borderRadius: 0, flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: -25, right: -25, width: 110, height: 110, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ position: 'absolute', bottom: -20, right: 100, width: 70, height: 70, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }}
          justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LibraryBooksIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} color="#fff" lineHeight={1.1}>KRA Library</Typography>
              <Typography fontSize={11.5} color="rgba(255,255,255,0.65)" mt={0.2}>
                Master repository for Key Result Areas across the organization
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2} flexShrink={0}>
            {!loading && (
              <Stack direction="row" spacing={1.5}>
                {[
                  { label: 'KRAs',       value: kras.length,       icon: <LibraryBooksIcon sx={{ fontSize: 13 }} /> },
                  { label: 'Categories', value: categories.length, icon: <CategoryIcon     sx={{ fontSize: 13 }} /> },
                  { label: 'Levels',     value: levels.length,     icon: <LayersIcon       sx={{ fontSize: 13 }} /> },
                ].map(s => (
                  <Stack key={s.label} alignItems="center"
                    sx={{ px: 1.25, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.1)' }}>
                    <Stack direction="row" alignItems="center" spacing={0.4} sx={{ color: 'rgba(255,255,255,0.65)' }}>
                      {s.icon}
                      <Typography fontSize={9} color="rgba(255,255,255,0.65)" fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">
                        {s.label}
                      </Typography>
                    </Stack>
                    <Typography fontSize={17} fontWeight={900} color="#fff" lineHeight={1}>{s.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}

            {canManage && (
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" startIcon={<AddIcon />}
                  onClick={() => setCatModal({ open: true, cat: null })}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: 12,
                    color: '#fff', borderColor: 'rgba(255,255,255,0.4)',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                  Add Category
                </Button>
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => setKraModal({ open: true, kra: null, mode: 'add' })}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: 12,
                    bgcolor: '#fff', color: '#1E3A8A',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', '&:hover': { bgcolor: '#f1f5f9' } }}>
                  Add KRA
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* ── Toolbar ── */}
      <Box sx={{ px: 3, py: 1.25, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 34,
              '& .MuiTab-root': { fontSize: 12.5, fontWeight: 600, textTransform: 'none', minHeight: 34, py: 0, px: 1.75 },
              '& .Mui-selected': { color: '#1E3A8A' },
              '& .MuiTabs-indicator': { bgcolor: '#1E3A8A', height: 2.5, borderRadius: 2 } }}>
            <Tab label={
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <CategoryIcon sx={{ fontSize: 14 }} />
                <span>Categories</span>
                <Chip label={categories.length} size="small"
                  sx={{ height: 15, fontSize: 9, fontWeight: 700,
                    bgcolor: tab === 0 ? '#dbeafe' : '#f1f5f9',
                    color:   tab === 0 ? '#1d4ed8' : '#94a3b8' }} />
              </Stack>
            } />
            <Tab label={
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <LayersIcon sx={{ fontSize: 14 }} />
                <span>Levels</span>
                <Chip label={levels.length} size="small"
                  sx={{ height: 15, fontSize: 9, fontWeight: 700,
                    bgcolor: tab === 1 ? '#dbeafe' : '#f1f5f9',
                    color:   tab === 1 ? '#1d4ed8' : '#94a3b8' }} />
              </Stack>
            } />
          </Tabs>

          <Box flex={1} />

          {tab === 0 && (
            <TextField size="small" placeholder="Search KRAs..." value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8', fontSize: 17 }} /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ width: 260, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12.5 } }} />
          )}

          <Tooltip title="Refresh">
            <IconButton onClick={refresh} disabled={loading}
              sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, color: '#64748b', p: 0.65 }}>
              <RefreshIcon fontSize="small" sx={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
              }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Stack alignItems="center" spacing={1.5}>
              <CircularProgress sx={{ color: '#1E3A8A' }} />
              <Typography fontSize={13} color="#64748b">Loading KRA library...</Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ borderRadius: 2 }}
              action={<Button size="small" onClick={refresh} sx={{ textTransform: 'none', fontWeight: 700 }}>Retry</Button>}>
              {error}
            </Alert>
          </Box>
        ) : tab === 0 ? (
          <CategoriesTab
            kras={kras} categories={categories} canManage={canManage} search={search}
            onEditKRA={kra  => setKraModal({ open: true, kra, mode: 'edit' })}
            onCloneKRA={kra => setKraModal({ open: true, kra, mode: 'clone' })}
            onDeleteKRA={kra => setDeleteDialog({ open: true, type: 'kra', item: kra })}
            onAddCategory={() => setCatModal({ open: true, cat: null })}
            onEditCategory={cat => setCatModal({ open: true, cat })}
            onDeleteCategory={cat => setDeleteDialog({ open: true, type: 'category', item: cat })}
          />
        ) : (
          <LevelsTab levels={levels} canManage={canManage}
            onAdd={() => setLevelModal({ open: true, level: null })}
            onEdit={lv => setLevelModal({ open: true, level: lv })}
            onDelete={lv => setDeleteDialog({ open: true, type: 'level', item: lv })} />
        )}
      </Box>

      {/* ── Modals ── */}
      <AddKRAModal
        open={kraModal.open}
        kra={kraModal.kra}
        mode={kraModal.mode}
        categories={categories}
        levels={levels}
        onClose={() => setKraModal({ open: false, kra: null, mode: 'add' })}
        onSaved={handleKRASave}
      />

      <AddCategoryModal
        open={catModal.open}
        category={catModal.cat}
        onClose={() => setCatModal({ open: false, cat: null })}
        onSaved={handleCatSave}
      />

      <LevelModal
        open={levelModal.open}
        level={levelModal.level}
        onClose={() => setLevelModal({ open: false, level: null })}
        onSaved={handleLevelSave}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        title={`Delete ${deleteDialog.type ? deleteDialog.type.charAt(0).toUpperCase() + deleteDialog.type.slice(1) : ''}`}
        message={deleteDialog.type ? deleteMessages[deleteDialog.type] : ''}
        deleting={deleting}
        onClose={() => setDeleteDialog({ open: false, type: null, item: null })}
        onConfirm={handleDelete}
      />

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </Box>
  );
}