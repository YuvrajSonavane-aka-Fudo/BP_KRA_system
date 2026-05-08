import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, IconButton, TextField,
  InputAdornment, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Collapse, Snackbar,
  Dialog, DialogContent, DialogActions,
  Checkbox,
} from '@mui/material';
import SearchIcon        from '@mui/icons-material/Search';
import AddIcon           from '@mui/icons-material/Add';
import EditIcon          from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore';
import ExpandLessIcon    from '@mui/icons-material/ExpandLess';
import LibraryBooksIcon  from '@mui/icons-material/LibraryBooks';
import CloseIcon         from '@mui/icons-material/Close';
import ContentCopyIcon   from '@mui/icons-material/ContentCopy';
import StarIcon          from '@mui/icons-material/Star';
import TuneIcon          from '@mui/icons-material/Tune';
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

import {
  getKRALibrary,
  createKRA, updateKRA, deleteKRA, cloneKRA,
  createCategory, updateCategory, deleteCategory, getCategories,
  getLevels,
} from '../../api/kraLibraryApi';
import useRoleAccess from '../../hooks/useRoleAccess';
import AddKRAModal      from './AddKRAModal';
import AddCategoryModal from './AddCategoryModal';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const CAT_PALETTE = [
  { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  { bg: '#fdf2f8', color: '#9d174d', border: '#fbcfe8' },
  { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
  { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  { bg: '#f0f9ff', color: '#075985', border: '#bae6fd' },
];

const GREEN_STYLE = { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
const BLUE_STYLE  = { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };

const SIDEBAR_MAX_VISIBLE = 7;
const ITEM_HEIGHT = 34;

// ─── Module-level cache ───────────────────────────────────────────────────────
const _cache = { data: null, promise: null };

async function _fetchLibraryData() {
  if (_cache.promise) return _cache.promise;
  _cache.promise = Promise.all([
    getKRALibrary(), getLevels(), getCategories(),
  ]).then(([kraRes, levelRes, catRes]) => {
    _cache.data = {
      kras:       kraRes.data?.kras       ?? [],
      levels:     levelRes.data?.levels   ?? [],
      categories: catRes.data?.categories ?? [],
    };
    return _cache.data;
  }).finally(() => { _cache.promise = null; });
  return _cache.promise;
}

function _invalidateCache() {
  _cache.data = null; _cache.promise = null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useKRALibraryData() {
  const [kras,       setKras]       = useState(_cache.data?.kras       ?? []);
  const [categories, setCategories] = useState(_cache.data?.categories ?? []);
  const [levels,     setLevels]     = useState(_cache.data?.levels     ?? []);
  const [loading,    setLoading]    = useState(!_cache.data);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (_cache.data) {
      setKras(_cache.data.kras); setCategories(_cache.data.categories);
      setLevels(_cache.data.levels); setLoading(false); return;
    }
    let cancelled = false;
    setLoading(true); setError(null);
    _fetchLibraryData()
      .then(data => { if (cancelled) return; setKras(data.kras); setCategories(data.categories); setLevels(data.levels); })
      .catch(err  => { if (cancelled) return; setError(err?.response?.data?.error || 'Failed to load KRA library.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(() => {
    _invalidateCache(); setLoading(true); setError(null);
    _fetchLibraryData()
      .then(data => { setKras(data.kras); setCategories(data.categories); setLevels(data.levels); })
      .catch(err  => { setError(err?.response?.data?.error || 'Failed to load KRA library.'); })
      .finally(() => setLoading(false));
  }, []);

  return { kras, categories, levels, loading, error, refresh };
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ open, message, severity = 'success', onClose }) {
  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Alert severity={severity} onClose={onClose} variant="filled"
        sx={{ minWidth: 240, fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>
        {message}
      </Alert>
    </Snackbar>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirmDialog({ open, title, message, onClose, onConfirm, deleting }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: '#fef2f2', px: 2.5, pt: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <DeleteOutlineIcon sx={{ color: '#dc2626', fontSize: 17 }} />
          <Typography fontWeight={700} fontSize={14} color="#991b1b">{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        <Typography fontSize={13} color="#374151">{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} disabled={deleting}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>Cancel</Button>
        <Button onClick={onConfirm} disabled={deleting} variant="contained" color="error"
          startIcon={deleting ? <CircularProgress size={12} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2, fontSize: 13 }}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Sort Toggle Button ───────────────────────────────────────────────────────
function SortToggle({ sortDir, onToggle }) {
  return (
    <Tooltip title={`Sort ${sortDir === 'asc' ? 'Z→A' : 'A→Z'}`}>
      <Button size="small" variant="outlined" onClick={onToggle}
        startIcon={sortDir === 'asc'
          ? <ArrowUpwardIcon sx={{ fontSize: '11px !important' }} />
          : <ArrowDownwardIcon sx={{ fontSize: '11px !important' }} />}
        sx={{
          textTransform: 'none', fontSize: 10.5, fontWeight: 700,
          height: 24, px: 1, py: 0, borderRadius: 1.25,
          borderColor: '#e2e8f0', color: '#64748b', minWidth: 0,
          '&:hover': { borderColor: '#1d4ed8', color: '#1d4ed8', bgcolor: '#eff6ff' },
        }}>
        {sortDir === 'asc' ? 'A–Z' : 'Z–A'}
      </Button>
    </Tooltip>
  );
}

// ─── Global Search Dropdown ──────────────────────────────────────────────────
function GlobalSearchBar({ kras, categories, onSelectKRA, onSelectCategory }) {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return { cats: [], kras: [] };
    const q = query.toLowerCase();
    const matchedCats = categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5);
    const matchedKRAs = kras.filter(k =>
      k.name.toLowerCase().includes(q) || (k.description || '').toLowerCase().includes(q)
    ).slice(0, 8);
    return { cats: matchedCats, kras: matchedKRAs };
  }, [query, kras, categories]);

  const hasResults = results.cats.length > 0 || results.kras.length > 0;

  return (
    <Box ref={ref} sx={{ position: 'relative', width: 340 }}>
      <TextField size="small" placeholder="Search categories & KRAs…" value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 16 }} />
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => { setQuery(''); setOpen(false); }} sx={{ p: 0.2 }}>
                <CloseIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          width: '100%',
          '& .MuiOutlinedInput-root': {
            borderRadius: 2, fontSize: 12.5, height: 34,
            bgcolor: 'rgba(255,255,255,0.13)', color: '#fff',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.45)' },
            '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.7)' },
          },
          '& input': { color: '#fff', '&::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 } },
        }}
      />

      {open && query.trim() && (
        <Paper elevation={8} sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          borderRadius: 2, overflow: 'hidden', zIndex: 1400,
          border: '1px solid #e2e8f0', maxHeight: 360, overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
        }}>
          {!hasResults ? (
            <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
              <Typography fontSize={12} color="#94a3b8">No results for "{query}"</Typography>
            </Box>
          ) : (
            <>
              {results.cats.length > 0 && (
                <Box>
                  <Box sx={{ px: 2, py: 0.75, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <Typography fontSize={9.5} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.07em">Categories</Typography>
                  </Box>
                  {results.cats.map((cat) => {
                    const style = cat.is_standard ? GREEN_STYLE : BLUE_STYLE;
                    return (
                      <Box key={cat.id}
                        onClick={() => { onSelectCategory(cat); setOpen(false); setQuery(''); }}
                        sx={{ px: 2, py: 0.9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25,
                          '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f8fafc' }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: style.color, flexShrink: 0 }} />
                        <Typography fontSize={12.5} fontWeight={600} color="#1e293b" flex={1}>{cat.name}</Typography>
                        <Chip label={cat.is_standard ? 'Standard' : 'Custom'} size="small"
                          sx={{ fontSize: 9, height: 16, fontWeight: 700,
                            bgcolor: cat.is_standard ? '#dcfce7' : '#dbeafe',
                            color:   cat.is_standard ? '#166534' : '#1d4ed8' }} />
                      </Box>
                    );
                  })}
                </Box>
              )}
              {results.kras.length > 0 && (
                <Box>
                  <Box sx={{ px: 2, py: 0.75, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9',
                    borderTop: results.cats.length ? '1px solid #e2e8f0' : undefined }}>
                    <Typography fontSize={9.5} fontWeight={700} color="#94a3b8" textTransform="uppercase" letterSpacing="0.07em">KRAs</Typography>
                  </Box>
                  {results.kras.map(kra => {
                    const cat = categories.find(c => c.id === kra.category_id);
                    const style = cat?.is_standard ? GREEN_STYLE : BLUE_STYLE;
                    return (
                      <Box key={kra.id}
                        onClick={() => { onSelectKRA(kra); setOpen(false); setQuery(''); }}
                        sx={{ px: 2, py: 0.9, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f8fafc' }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: style.color, flexShrink: 0, mt: 0.25 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography fontSize={12.5} fontWeight={600} color="#1e293b" noWrap>{kra.name}</Typography>
                            {cat && <Typography fontSize={10.5} color="#94a3b8" noWrap>in {cat.name}</Typography>}
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}

// ─── Level Chip ───────────────────────────────────────────────────────────────
function LevelChip({ lv, idx, levelMap = {}, showExp = false }) {
  const s = CAT_PALETTE[idx % CAT_PALETTE.length];
  const parentLevel = levelMap[lv.level_id] ?? {};
  const minExp = lv.min_experience ?? parentLevel.min_experience;
  const maxExp = lv.max_experience ?? parentLevel.max_experience;
  const expLabel = showExp && (minExp != null || maxExp != null)
    ? `${minExp ?? 0}–${maxExp ?? '∞'} yrs`
    : null;

  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.25, borderRadius: 1,
      bgcolor: s.bg, border: `1px solid ${s.border}`, height: 22,
    }}>
      <Typography fontSize={10.5} fontWeight={700} color={s.color} lineHeight={1}>{lv.level_name}</Typography>
      {expLabel && (
        <>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: s.color, opacity: 0.5 }} />
          <Typography fontSize={10} color="#64748b" lineHeight={1}>{expLabel}</Typography>
        </>
      )}
    </Box>
  );
}

// ─── KRA Row ──────────────────────────────────────────────────────────────────
function KRARow({ kra, catIdx, levelMap = {}, canManage, onEdit, onClone, onDelete,
  selectedKRAIds, setSelectedKRAIds }) {
  const [expanded, setExpanded] = useState(false);
  const isChecked = selectedKRAIds.has(kra.id);

  return (
    <>
      <TableRow hover
        sx={{
          cursor: 'pointer',
          bgcolor: isChecked ? '#eff6ff' : undefined,
          '&:hover': { bgcolor: isChecked ? '#dbeafe' : '#f8fafc' },
          '&:hover .kra-actions': { opacity: 1 },
        }}
        onClick={() => setExpanded(v => !v)}>

        {/* Checkbox cell */}
        <TableCell sx={{ py: 1.1, pl: 1.5, pr: 0, borderBottom: expanded ? 'none' : undefined, width: 36 }}
          onClick={e => e.stopPropagation()}>
          {canManage && (
            <Checkbox size="small"
              checked={isChecked}
              onChange={() => setSelectedKRAIds(prev => {
                const next = new Set(prev);
                next.has(kra.id) ? next.delete(kra.id) : next.add(kra.id);
                return next;
              })}
              sx={{ p: 0.25, color: '#cbd5e1', '&.Mui-checked': { color: '#1d4ed8' } }}
            />
          )}
        </TableCell>

        <TableCell sx={{ py: 1.1, pl: 1, pr: 1, borderBottom: expanded ? 'none' : undefined, width: '48%' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ color: '#cbd5e1', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
            </Box>
            <Box minWidth={0}>
              <Typography fontWeight={650} fontSize={13} color="#1e293b" noWrap>{kra.name}</Typography>
              {kra.description && !expanded && (
                <Typography fontSize={11.5} color="#94a3b8" noWrap sx={{ maxWidth: 340 }}>{kra.description}</Typography>
              )}
            </Box>
          </Stack>
        </TableCell>

        {/* Collapsed → level name only, no exp range */}
        <TableCell sx={{ py: 1.1, borderBottom: expanded ? 'none' : undefined }}>
          <Stack direction="row" flexWrap="wrap" gap={0.4}>
            {kra.levels?.length
              ? kra.levels.map((lv, i) => (
                  <LevelChip key={lv.id ?? i} lv={lv} idx={i} levelMap={levelMap} showExp={false} />
                ))
              : <Typography fontSize={11} color="#cbd5e1" fontStyle="italic">—</Typography>}
          </Stack>
        </TableCell>

        <TableCell align="right" sx={{ py: 1.1, pr: 1.5, borderBottom: expanded ? 'none' : undefined, width: 80 }}
          onClick={e => e.stopPropagation()}>
          {canManage && (
            <Stack direction="row" spacing={0} justifyContent="flex-end"
              className="kra-actions" sx={{ opacity: 0, transition: 'opacity 0.12s' }}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => onEdit(kra)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#1d4ed8' }, p: 0.4, borderRadius: 1 }}>
                  <EditIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clone">
                <IconButton size="small" onClick={() => onClone(kra)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#6d28d9' }, p: 0.4, borderRadius: 1 }}>
                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={() => onDelete(kra)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626' }, p: 0.4, borderRadius: 1 }}>
                  <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={4} sx={{ p: 0, border: 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 8, pr: 3, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              {kra.description && (
                <Typography fontSize={12.5} color="#475569" lineHeight={1.55} mb={kra.levels?.length ? 1 : 0}>
                  {kra.description}
                </Typography>
              )}
              {/* Expanded → level name + exp range */}
              {kra.levels?.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {kra.levels.map((lv, i) => {
                    const s = CAT_PALETTE[i % CAT_PALETTE.length];
                    const parentLevel = levelMap[lv.level_id] ?? {};
                    const minExp = lv.min_experience ?? parentLevel.min_experience;
                    const maxExp = lv.max_experience ?? parentLevel.max_experience;
                    const expLabel = (minExp != null || maxExp != null)
                      ? `${minExp ?? 0}–${maxExp ?? '∞'} yrs`
                      : null;
                    return (
                      <Box key={lv.id ?? i} sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.75,
                        px: 1.25, py: 0.4, borderRadius: 1,
                        bgcolor: s.bg, border: `1px solid ${s.border}` }}>
                        <Typography fontSize={11.5} fontWeight={700} color={s.color}>{lv.level_name}</Typography>
                        {expLabel && (
                          <>
                            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: s.color, opacity: 0.4 }} />
                            <Typography fontSize={11} color="#64748b">{expLabel}</Typography>
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Main Categories Panel ────────────────────────────────────────────────────
function CategoriesPanel({
  kras, categories, levels, canManage,
  selectedCatId, onSelectCat,
  onEditKRA, onCloneKRA, onDeleteKRA,
  onAddCategory, onEditCategory, onDeleteCategory,
  onAddKRAForCategory,
  highlightKRAId,
  catSortDir, setCatSortDir,
  kraSortDir, setKraSortDir,
  // Bulk selection
  selectedKRAIds, setSelectedKRAIds,
  selectedCatIds, setSelectedCatIds,
  bulkDeleting, onBulkDelete,
}) {
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  useEffect(() => { setPage(0); }, [selectedCatId]);

  const kraCountMap = useMemo(() => {
    const m = {};
    kras.forEach(k => { m[k.category_id] = (m[k.category_id] || 0) + 1; });
    return m;
  }, [kras]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return catSortDir === 'asc' ? cmp : -cmp;
    });
  }, [categories, catSortDir]);

  const standardCats = sortedCategories.filter(c => c.is_standard);
  const customCats   = sortedCategories.filter(c => !c.is_standard);

  const filtered = useMemo(() => {
    if (selectedCatId == null) return [];
    const base = kras.filter(k => k.category_id === selectedCatId);
    return [...base].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return kraSortDir === 'asc' ? cmp : -cmp;
    });
  }, [kras, selectedCatId, kraSortDir]);

  const paginated      = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages     = Math.ceil(filtered.length / PER_PAGE);
  const selectedCatIdx = sortedCategories.findIndex(c => c.id === selectedCatId);
  const selectedCat    = sortedCategories.find(c => c.id === selectedCatId);

  const levelMap = useMemo(() =>
    Object.fromEntries((levels ?? []).map(l => [l.id, l])),
  [levels]);

  const totalSelected = selectedKRAIds.size + selectedCatIds.size;

  // Select-all state for current page
  const allPageChecked = paginated.length > 0 && paginated.every(k => selectedKRAIds.has(k.id));
  const somePageChecked = paginated.some(k => selectedKRAIds.has(k.id)) && !allPageChecked;

  function renderCatItem(cat, colorStyle) {
    const active    = selectedCatId === cat.id;
    const count     = kraCountMap[cat.id] || 0;
    const isCatChecked = selectedCatIds.has(cat.id);

    return (
      <Box key={cat.id} onClick={() => onSelectCat(cat.id)}
        sx={{
          px: 1, py: 0.6, mx: 0.5, mb: 0.25, borderRadius: 1.5, cursor: 'pointer',
          bgcolor: isCatChecked ? colorStyle.bg : active ? colorStyle.bg : 'transparent',
          borderLeft: `3px solid ${active ? colorStyle.color : 'transparent'}`,
          '&:hover': { bgcolor: active ? colorStyle.bg : '#f8fafc' },
          transition: 'all 0.12s',
        }}>
        <Stack direction="row" alignItems="center" spacing={0.25}>
          {/* Category checkbox */}
          {canManage && (
            <Checkbox
              size="small"
              checked={isCatChecked}
              onClick={e => {
                e.stopPropagation();
                setSelectedCatIds(prev => {
                  const next = new Set(prev);
                  next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                  return next;
                });
              }}
              sx={{
                p: 0.25, flexShrink: 0,
                color: '#cbd5e1',
                '&.Mui-checked': { color: colorStyle.color },
              }}
            />
          )}
          <Typography
            fontSize={13.5}
            fontWeight={active ? 700 : 600}
            color={active ? colorStyle.color : '#334155'}
            noWrap flex={1} lineHeight={1.4}>
            {cat.name}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.35} flexShrink={0}>
            {canManage && active ? (
              <>
                <Chip label="+ KRA" size="small"
                  onClick={e => { e.stopPropagation(); onAddKRAForCategory(cat); }}
                  sx={{
                    height: 18, fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
                    bgcolor: colorStyle.bg, color: colorStyle.color,
                    border: `1px solid ${colorStyle.border}`, borderRadius: 1,
                    '&:hover': { filter: 'brightness(0.93)' },
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
                <IconButton size="small"
                  onClick={e => { e.stopPropagation(); onEditCategory(cat); }}
                  sx={{ color: '#94a3b8', p: 0.2, borderRadius: 0.75, '&:hover': { color: '#475569' } }}>
                  <EditIcon sx={{ fontSize: 10 }} />
                </IconButton>
                <IconButton size="small"
                  onClick={e => { e.stopPropagation(); onDeleteCategory(cat); }}
                  sx={{ color: '#fca5a5', p: 0.2, borderRadius: 0.75, '&:hover': { color: '#dc2626' } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 10 }} />
                </IconButton>
              </>
            ) : (
              <Chip label={count} size="small"
                sx={{
                  height: 18, fontSize: 10, fontWeight: 700, minWidth: 22,
                  bgcolor: active ? colorStyle.bg : '#f1f5f9',
                  color:   active ? colorStyle.color : '#64748b',
                  border:  active ? `1px solid ${colorStyle.border}` : '1px solid transparent',
                }} />
            )}
          </Stack>
        </Stack>
      </Box>
    );
  }

  const maxScrollHeight = SIDEBAR_MAX_VISIBLE * ITEM_HEIGHT;

  return (
    <Stack direction="row" sx={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT SIDEBAR ── */}
      <Box sx={{ width: '30%', minWidth: 210, maxWidth: 290, flexShrink: 0, borderRight: '1px solid #f1f5f9',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', pt: 0.5,
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
        }}>
          {standardCats.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.75, pt: 1, pb: 0.5 }}>
                <StarIcon sx={{ fontSize: 10, color: '#16a34a' }} />
                <Typography fontSize={9.5} fontWeight={700} color="#16a34a" textTransform="uppercase" letterSpacing="0.07em" flex={1}>
                  Standard <Box component="span" sx={{ opacity: 0.65 }}>({standardCats.length})</Box>
                </Typography>
              </Stack>
              <Box sx={{
                maxHeight: maxScrollHeight,
                overflowY: standardCats.length > SIDEBAR_MAX_VISIBLE ? 'auto' : 'visible',
                '&::-webkit-scrollbar': { width: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#bbf7d0', borderRadius: 2 },
              }}>
                {standardCats.map(cat => renderCatItem(cat, GREEN_STYLE))}
              </Box>
            </Box>
          )}

          {customCats.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.75, pt: 1.5, pb: 0.5 }}>
                <TuneIcon sx={{ fontSize: 10, color: '#1d4ed8' }} />
                <Typography fontSize={9.5} fontWeight={700} color="#1d4ed8" textTransform="uppercase" letterSpacing="0.07em" flex={1}>
                  Project <Box component="span" sx={{ opacity: 0.65 }}>({customCats.length})</Box>
                </Typography>
              </Stack>
              <Box sx={{
                maxHeight: maxScrollHeight,
                overflowY: customCats.length > SIDEBAR_MAX_VISIBLE ? 'auto' : 'visible',
                '&::-webkit-scrollbar': { width: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#bfdbfe', borderRadius: 2 },
              }}>
                {customCats.map(cat => renderCatItem(cat, BLUE_STYLE))}
              </Box>
            </Box>
          )}

          {categories.length === 0 && (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography fontSize={12} color="#94a3b8">No categories yet</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── RIGHT PANEL ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 3, py: 1, borderBottom: '1px solid #f1f5f9', flexShrink: 0, minHeight: 44 }}>
          {selectedCat ? (
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%',
                bgcolor: selectedCat.is_standard ? '#16a34a' : '#1d4ed8', flexShrink: 0 }} />
              <Typography fontSize={14} fontWeight={700} color="#1e293b">{selectedCat.name}</Typography>
              <Chip label={selectedCat.is_standard ? 'Standard' : 'Custom'} size="small"
                sx={{ fontSize: 9.5, height: 17, fontWeight: 700,
                  bgcolor: selectedCat.is_standard ? '#dcfce7' : '#dbeafe',
                  color:   selectedCat.is_standard ? '#166634' : '#1d4ed8' }} />
            </Stack>
          ) : (
            <Typography fontSize={13} fontWeight={700} color="#94a3b8">Select a category</Typography>
          )}
          <Stack direction="row" alignItems="center" spacing={1}>
            {selectedCat && filtered.length > 0 && (
              <>
                <Typography fontSize={11} color="#94a3b8">Sort KRAs:</Typography>
                <SortToggle sortDir={kraSortDir} onToggle={() => setKraSortDir(d => d === 'asc' ? 'desc' : 'asc')} />
              </>
            )}
            <Typography fontSize={11.5} color="#94a3b8" sx={{ ml: 1 }}>
              {filtered.length} KRA{filtered.length !== 1 ? 's' : ''}
            </Typography>
          </Stack>
        </Stack>

        {!selectedCat ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 1.5 }}>
            <LibraryBooksIcon sx={{ fontSize: 40, color: '#e2e8f0' }} />
            <Typography color="#94a3b8" fontSize={13} fontWeight={600}>Select a category to view its KRAs</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 1.5 }}>
            <LibraryBooksIcon sx={{ fontSize: 36, color: '#e2e8f0' }} />
            <Typography color="#94a3b8" fontSize={12.5} fontWeight={600}>No KRAs in this category yet</Typography>
            {canManage && (
              <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                onClick={() => onAddKRAForCategory(selectedCat)}
                sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, fontWeight: 600 }}>
                Add KRA
              </Button>
            )}
          </Box>
        ) : (
          <>
            <TableContainer sx={{ flex: 1, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
            }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {/* Select-all checkbox header */}
                    <TableCell sx={{ pl: 1.5, py: 0.9, bgcolor: '#fafbfc', width: 36 }}>
                      {canManage && (
                        <Checkbox size="small"
                          checked={allPageChecked}
                          indeterminate={somePageChecked}
                          onChange={e => setSelectedKRAIds(prev => {
                            const next = new Set(prev);
                            paginated.forEach(k => e.target.checked ? next.add(k.id) : next.delete(k.id));
                            return next;
                          })}
                          sx={{ p: 0.25, color: '#cbd5e1', '&.Mui-checked': { color: '#1d4ed8' }, '&.MuiCheckbox-indeterminate': { color: '#1d4ed8' } }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ pl: 1, py: 0.9, fontSize: 9.5, fontWeight: 700, color: '#b0bac4',
                      textTransform: 'uppercase', letterSpacing: '0.06em', bgcolor: '#fafbfc', width: '48%' }}>KRA</TableCell>
                    <TableCell sx={{ py: 0.9, fontSize: 9.5, fontWeight: 700, color: '#b0bac4',
                      textTransform: 'uppercase', letterSpacing: '0.06em', bgcolor: '#fafbfc' }}>Levels</TableCell>
                    <TableCell sx={{ py: 0.9, pr: 1.5, bgcolor: '#fafbfc', width: 80 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginated.map(kra => (
                    <KRARow key={kra.id} kra={kra}
                      catIdx={selectedCatIdx} levelMap={levelMap} canManage={canManage}
                      onEdit={onEditKRA} onClone={onCloneKRA} onDelete={onDeleteKRA}
                      selectedKRAIds={selectedKRAIds} setSelectedKRAIds={setSelectedKRAIds} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ px: 3, py: 1, borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
              {totalPages > 1 ? (
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography fontSize={11.5} color="#94a3b8">
                    {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}
                  </Typography>
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      sx={{ minWidth: 24, px: 0.5, fontSize: 12, color: '#475569', textTransform: 'none' }}>‹</Button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Box key={i} onClick={() => setPage(i)}
                        sx={{ width: 22, height: 22, borderRadius: 1, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', fontSize: 11.5,
                          fontWeight: page === i ? 700 : 400,
                          bgcolor: page === i ? '#1d4ed8' : 'transparent',
                          color:   page === i ? '#fff' : '#64748b',
                          '&:hover': { bgcolor: page === i ? '#1d4ed8' : '#f1f5f9' } }}>
                        {i + 1}
                      </Box>
                    ))}
                    <Button size="small" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}
                      sx={{ minWidth: 24, px: 0.5, fontSize: 12, color: '#475569', textTransform: 'none' }}>›</Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography fontSize={11.5} color="#b0bac4">
                  {filtered.length} KRA{filtered.length !== 1 ? 's' : ''}{selectedCat ? ` in ${selectedCat.name}` : ''}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* ── Bulk Delete Floating Bar ── */}
      {totalSelected > 0 && (
        <Box sx={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100,
          bgcolor: 'background.paper',
          borderRadius: 99,
          px: 1.5, py: 0.75,
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
          display: 'flex', alignItems: 'center', gap: 1,
          border: '0.5px solid', borderColor: 'divider',
          minWidth: 'max-content',
        }}>
          <Typography fontSize={12.5} fontWeight={600} color="text.primary" sx={{ px: 0.5 }}>
            {totalSelected} selected
          </Typography>

          <Box sx={{ width: '0.5px', height: 16, bgcolor: 'divider' }} />

          <Button size="small" disabled={bulkDeleting}
            onClick={() => { setSelectedKRAIds(new Set()); setSelectedCatIds(new Set()); }}
            sx={{
              textTransform: 'none', fontSize: 12, fontWeight: 400,
              color: 'text.secondary', minWidth: 0, px: 1.25, borderRadius: 99,
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}>
            Clear
          </Button>

          <Button size="small" disabled={bulkDeleting}
            startIcon={bulkDeleting
              ? <CircularProgress size={11} color="inherit" />
              : <DeleteOutlineIcon sx={{ fontSize: 13 }} />}
            onClick={onBulkDelete}
            sx={{
              textTransform: 'none', fontWeight: 500, fontSize: 12,
              borderRadius: 99, px: 1.5,
              bgcolor: '#FEF2F2', color: '#B91C1C',
              border: '0.5px solid #FECACA',
              '&:hover': { bgcolor: '#FEE2E2', borderColor: '#FCA5A5' },
              '&.Mui-disabled': { bgcolor: '#FEF2F2', color: '#FCA5A5', borderColor: '#FECACA' },
            }}>
            {bulkDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KRALibraryPage() {
  const { isHR } = useRoleAccess();
  const canManage = isHR;

  const { kras, categories, levels, loading, error, refresh } = useKRALibraryData();

  const [selectedCatId, setSelectedCatId] = useState(null);
  useEffect(() => {
    if (categories.length && selectedCatId === null) {
      setSelectedCatId(categories[0]?.id ?? null);
    }
  }, [categories]);

  const [catSortDir, setCatSortDir] = useState('asc');
  const [kraSortDir, setKraSortDir] = useState('asc');

  const [kraModal,     setKraModal]     = useState({ open: false, kra: null, mode: 'add', prefillCatId: null });
  const [catModal,     setCatModal]     = useState({ open: false, cat: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, item: null });
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState({ open: false, message: '', severity: 'success' });
  const [highlightKRAId, setHighlightKRAId] = useState(null);

  // Bulk selection state
  const [selectedKRAIds, setSelectedKRAIds] = useState(new Set());
  const [selectedCatIds, setSelectedCatIds] = useState(new Set());
  const [bulkDeleting,   setBulkDeleting]   = useState(false);

  const showToast = (msg, severity = 'success') => setToast({ open: true, message: msg, severity });

  function handleSelectCategory(cat) { setSelectedCatId(cat.id); }
  function handleSelectKRA(kra) {
    setSelectedCatId(kra.category_id);
    setHighlightKRAId(kra.id);
    setTimeout(() => setHighlightKRAId(null), 2000);
  }
  function handleAddKRAForCategory(cat) {
    setKraModal({ open: true, kra: { category_id: cat.id }, mode: 'add', prefillCatId: cat.id });
  }

  async function handleKRASave(payload, id, mode) {
    try {
      if (mode === 'edit')       await updateKRA(id, payload);
      else if (mode === 'clone') await cloneKRA(id, { name: payload.name, category_id: payload.category_id });
      else                       await createKRA(payload);
      setKraModal({ open: false, kra: null, mode: 'add', prefillCatId: null });
      showToast(mode === 'edit' ? 'KRA updated' : mode === 'clone' ? 'KRA cloned' : 'KRA added');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save KRA', 'error');
    }
  }

  async function handleKRADelete() {
    setDeleting(true);
    try {
      await deleteKRA(deleteDialog.item.id);
      setDeleteDialog({ open: false, type: null, item: null });
      showToast('KRA removed');
      refresh();
    } catch (err) {
      const raw = err?.response?.data?.error ?? '';
      const friendly = raw.toLowerCase().includes('assigned') || raw.toLowerCase().includes('active cycle')
        ? 'This KRA is currently in use by employees and can\'t be deleted.'
        : 'Failed to delete KRA. Please try again.';
      showToast(friendly, 'error');
    } finally { setDeleting(false); }
  }

  async function handleCatSave(payload, id) {
    try {
      if (id) await updateCategory(id, payload); else await createCategory(payload);
      setCatModal({ open: false, cat: null });
      showToast(id ? 'Category updated' : 'Category added');
      refresh();
    } catch (err) { showToast(err?.response?.data?.error || 'Failed to save category', 'error'); }
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

  function handleDelete() {
    if (deleteDialog.type === 'kra')      return handleKRADelete();
    if (deleteDialog.type === 'category') return handleCatDelete();
  }

  // Bulk delete handler
  async function handleBulkDelete() {
    if (!selectedKRAIds.size && !selectedCatIds.size) return;
    setBulkDeleting(true);
    const total = selectedKRAIds.size + selectedCatIds.size;
    try {
      await Promise.all([
        ...[...selectedKRAIds].map(id => deleteKRA(id)),
        ...[...selectedCatIds].map(id => deleteCategory(id)),
      ]);
      setSelectedKRAIds(new Set());
      setSelectedCatIds(new Set());
      showToast(`Deleted ${total} item${total !== 1 ? 's' : ''} successfully`);
      refresh();
    } catch (err) {
      const raw = err?.response?.data?.error ?? '';
      const friendly = raw.toLowerCase().includes('assigned') || raw.toLowerCase().includes('active cycle')
        ? 'Some KRAs are currently in use by employees and couldn\'t be deleted.'
        : 'Some items couldn\'t be deleted. Please try again.';
      showToast(friendly, 'error');
    } finally {
      setBulkDeleting(false);
    }
  }

  const deleteMessages = {
    kra:      `Remove "${deleteDialog.item?.name}" from the library? This cannot be undone.`,
    category: `Delete "${deleteDialog.item?.name}"? KRAs will become uncategorised.`,
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc', overflow: 'hidden' }}>

      <Paper elevation={0} sx={{
        background: gradient, px: { xs: 2.5, md: 3.5 }, py: 1.5,
        borderRadius: 0, flexShrink: 0, position: 'relative', overflow: 'visible',
      }}>
        <Box sx={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />

        {/* Left: title */}
        <Box sx={{ position: 'absolute', left: { xs: 20, md: 28 }, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.13)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LibraryBooksIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={800} fontSize={17} color="#fff" lineHeight={1.15}>KRA Library</Typography>
              <Typography fontSize={11} color="rgba(255,255,255,0.6)">Master repository for Key Result Areas</Typography>
            </Box>
          </Stack>
        </Box>

        {/* Center: search — true center of the bar */}
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5, position: 'relative', zIndex: 1300 }}>
          {!loading && (
            <GlobalSearchBar kras={kras} categories={categories}
              onSelectKRA={handleSelectKRA} onSelectCategory={handleSelectCategory} />
          )}
        </Box>
      </Paper>

      <Box sx={{ px: 0, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" sx={{ px: 2.5, minHeight: 40, gap: 1 }}>
          <Typography fontSize={12} fontWeight={700} color="#1e293b">
            Categories
            <Box component="sup" sx={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8', ml: 0.25, verticalAlign: 'super' }}>
              {categories.length}
            </Box>
          </Typography>
          <SortToggle sortDir={catSortDir} onToggle={() => setCatSortDir(d => d === 'asc' ? 'desc' : 'asc')} />
          {canManage && (
            <Chip label="+ Category" size="small"
              onClick={() => setCatModal({ open: true, cat: null })}
              sx={{
                height: 22, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px dashed #bfdbfe', borderRadius: 1.25,
                '&:hover': { bgcolor: '#dbeafe', borderColor: '#1d4ed8' },
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Stack alignItems="center" spacing={1}>
              <CircularProgress size={28} sx={{ color: '#1E3A8A' }} />
              <Typography fontSize={12.5} color="#94a3b8">Loading KRA library…</Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Box sx={{ p: 2.5 }}>
            <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: 13 }}
              action={<Button size="small" onClick={refresh} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Retry</Button>}>
              {error}
            </Alert>
          </Box>
        ) : (
          <CategoriesPanel
            kras={kras} categories={categories} levels={levels} canManage={canManage}
            selectedCatId={selectedCatId} onSelectCat={setSelectedCatId}
            onEditKRA={kra  => setKraModal({ open: true, kra, mode: 'edit',  prefillCatId: kra.category_id })}
            onCloneKRA={kra => setKraModal({ open: true, kra, mode: 'clone', prefillCatId: kra.category_id })}
            onDeleteKRA={kra => setDeleteDialog({ open: true, type: 'kra', item: kra })}
            onAddCategory={() => setCatModal({ open: true, cat: null })}
            onEditCategory={cat => setCatModal({ open: true, cat })}
            onDeleteCategory={cat => setDeleteDialog({ open: true, type: 'category', item: cat })}
            onAddKRAForCategory={handleAddKRAForCategory}
            highlightKRAId={highlightKRAId}
            catSortDir={catSortDir} setCatSortDir={setCatSortDir}
            kraSortDir={kraSortDir} setKraSortDir={setKraSortDir}
            selectedKRAIds={selectedKRAIds} setSelectedKRAIds={setSelectedKRAIds}
            selectedCatIds={selectedCatIds} setSelectedCatIds={setSelectedCatIds}
            bulkDeleting={bulkDeleting} onBulkDelete={handleBulkDelete}
          />
        )}
      </Box>

      <AddKRAModal open={kraModal.open} kra={kraModal.kra} mode={kraModal.mode}
        categories={categories} levels={levels} prefillCategoryId={kraModal.prefillCatId}
        kraNames={kras.map(k => k.name)}
        onClose={() => setKraModal({ open: false, kra: null, mode: 'add', prefillCatId: null })}
        onSaved={handleKRASave} />

      <AddCategoryModal open={catModal.open} category={catModal.cat}
        onClose={() => setCatModal({ open: false, cat: null })}
        onSaved={handleCatSave} />

      <DeleteConfirmDialog open={deleteDialog.open}
        title={`Delete ${deleteDialog.type ? deleteDialog.type.charAt(0).toUpperCase() + deleteDialog.type.slice(1) : ''}`}
        message={deleteDialog.type ? deleteMessages[deleteDialog.type] : ''}
        deleting={deleting}
        onClose={() => setDeleteDialog({ open: false, type: null, item: null })}
        onConfirm={handleDelete} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity}
        onClose={() => setToast(t => ({ ...t, open: false }))} />
    </Box>
  );
}