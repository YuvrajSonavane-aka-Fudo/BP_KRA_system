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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
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
    _invalidateCache();
    setLoading(true);
    setError(null);
    Promise.all([getKRALibrary(), getLevels(), getCategories()])
      .then(([kraRes, levelRes, catRes]) => {
        const fresh = {
          kras:       kraRes.data?.kras       ?? [],
          levels:     levelRes.data?.levels   ?? [],
          categories: catRes.data?.categories ?? [],
        };
        _cache.data = fresh;
        setKras(fresh.kras);
        setCategories(fresh.categories);
        setLevels(fresh.levels);
      })
      .catch(err => setError(err?.response?.data?.error || 'Failed to load KRA library.'))
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
    <Dialog open={open} onClose={onClose}  fullWidth
      slotProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }} sx={{ maxWidth: 'xs' }}>
      <Box sx={{ bgcolor: '#fef2f2', px: 2.5, pt: 2, pb: 1.5 }}>
        <Stack direction="row"  spacing={1.25} sx={{ alignItems: 'center' }}>
          <DeleteOutlineIcon sx={{ color: '#dc2626', fontSize: 17 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}   >{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        <Typography sx={{ fontSize: 13, color: '#374151' }}  >{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} disabled={deleting}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>Cancel</Button>
        <Button onClick={onConfirm} disabled={deleting} variant="contained" 
          startIcon={deleting ? <CircularProgress size={12}  /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2, fontSize: 13, color: '#fff !important' }}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Blocked Delete Dialog (item is assigned to employees) ───────────────────
function BlockedDeleteDialog({ open, title, message, onClose }) {
  return (
    <Dialog open={open} onClose={onClose}  fullWidth
      slotProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }} sx={{ maxWidth: 'xs' }}>
      <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5 }}>
        <Stack direction="row"  spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Typography sx={{ lineHeight: 1, fontSize: 14 }}  >⚠️</Typography>
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}   >{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Alert severity="warning" sx={{ borderRadius: 1.5, fontSize: 13, mb: 0 }}>
          {message}
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="contained"
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13,
            bgcolor: '#1E3A8A', '&:hover': { bgcolor: '#1d4ed8' },
          }}>
          OK
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
        slotProps={{ input: {
          startAdornment: (
            <InputAdornment >
              <SearchIcon sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, position: 'end' }} />
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment >
              <IconButton size="small" onClick={() => { setQuery(''); setOpen(false); }} sx={{ p: 0.2 }}>
                <CloseIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        } }}
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
              <Typography sx={{ fontSize: 12, color: '#94a3b8' }}  >No results for "{query}"</Typography>
            </Box>
          ) : (
            <>
              {results.cats.length > 0 && (
                <Box>
                  <Box sx={{ px: 2, py: 0.75, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 9.5, fontWeight: 700, color: '#94a3b8' }}     >Categories</Typography>
                  </Box>
                  {results.cats.map((cat) => {
                    const style = cat.is_standard ? GREEN_STYLE : BLUE_STYLE;
                    return (
                      <Box key={cat.id}
                        onClick={() => { onSelectCategory(cat); setOpen(false); setQuery(''); }}
                        sx={{ px: 2, py: 0.9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25,
                          '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f8fafc' }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: style.color, flexShrink: 0 }} />
                        <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}    >{cat.name}</Typography>
                        <Chip label={cat.is_standard ? 'Org Level' : 'Project Level'} size="small"
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
                    <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 9.5, fontWeight: 700, color: '#94a3b8' }}     >KRAs</Typography>
                  </Box>
                  {results.kras.map(kra => {
                    const cat = categories.find(c => c.id === kra.category_id);
                    const style = cat?.is_standard ? GREEN_STYLE : BLUE_STYLE;
                    return (
                      <Box key={kra.id}
                        onClick={() => { onSelectKRA(kra); setOpen(false); setQuery(''); }}
                        sx={{ px: 2, py: 0.9, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f8fafc' }}>
                        <Stack direction="row"  spacing={1} sx={{ alignItems: 'center' }}>
                          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: style.color, flexShrink: 0, mt: 0.25 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}  >
                            <Typography    noWrap sx={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{kra.name}</Typography>
                            {cat && <Typography   noWrap sx={{ fontSize: 10.5, color: '#94a3b8' }}>in {cat.name}</Typography>}
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
      <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, fontSize: 10.5, fontWeight: 700, color: s.color }}>
        {lv.level_name}
      </Typography>
      {expLabel && (
        <>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: s.color, opacity: 0.5, flexShrink: 0 }} />
          <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, fontSize: 10, color: '#64748b' }}>
            {expLabel}
          </Typography>
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
        <TableCell sx={{ py: 1.1, pl: 0.75, pr: 0, borderBottom: expanded ? 'none' : undefined, width: 28 }}
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

        <TableCell sx={{ py: 1.1, pl: 0.25, pr: 1, borderBottom: expanded ? 'none' : undefined, width: '90%' }}>
          <Stack direction="row"  spacing={1} sx={{ alignItems: 'center' }}>
            <Box sx={{ color: '#cbd5e1', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
            </Box>
            <Box  sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography    noWrap
                onClick={e => {
                  e.stopPropagation();
                  // label click is visual only — does not affect checkbox selection
                }}
                sx={{ cursor: 'pointer', '&:hover': { color: '#1d4ed8' }, fontSize: 13, fontWeight: 650, color: '#1e293b' }}>
                {kra.name}
              </Typography>
              {kra.description && !expanded && (
                <Typography
                  
                  
                  noWrap
                  sx={{ maxWidth: 470,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis', fontSize: 11.5, color: '#94a3b8' }}
                >
                  — {kra.description}
                </Typography>
              )}
            </Box>
          </Stack>
        </TableCell>

        {/* Collapsed → level name only, no exp range */}
        <TableCell sx={{ py: 1.1, borderBottom: expanded ? 'none' : undefined, width: 120 }}>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              overflowX: 'auto',
              overflowY: 'hidden',
              whiteSpace: 'nowrap',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {kra.levels?.length ? (
                <>
                  {kra.levels.slice(0, 3).map((lv, i) => (
                    <LevelChip
                      key={lv.id ?? i}
                      lv={lv}
                      idx={i}
                      levelMap={levelMap}
                      showExp={false}
                    />
                  ))}

                  {kra.levels.length > 3 && (
                    <Typography
                      
                      
                      
                      sx={{ alignSelf: 'center', ml: 0.25, fontSize: 9, fontWeight: 500, color: '#94a3b8' }}
                    >
                      +{kra.levels.length - 3} more
                    </Typography>
                  )}
                </>
              ) : (
                <Typography sx={{ fontStyle: 'italic', fontSize: 11, color: '#cbd5e1' }}   >
                  —
                </Typography>
              )}
          </Stack>
        </TableCell>

        <TableCell align="right" sx={{ py: 1.1, pr: 1.5, borderBottom: expanded ? 'none' : undefined, width: 120 }}
          onClick={e => e.stopPropagation()}>
          {canManage && (
            <Stack direction="row" spacing={0} 
              className="kra-actions" sx={{ opacity: 0, transition: 'opacity 0.12s', justifyContent: 'flex-end' }}>
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
                <Typography sx={{ lineHeight: 1.55, mb: kra.levels?.length ? 1 : 0, fontSize: 12.5, color: '#475569' }}    >
                  {kra.description}
                </Typography>
              )}
              {/* Expanded → level name + exp range */}
              {kra.levels?.length > 0 && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}  >
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
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: s.color }}   >{lv.level_name}</Typography>
                        {expLabel && (
                          <>
                            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: s.color, opacity: 0.4 }} />
                            <Typography sx={{ fontSize: 11, color: '#64748b' }}  >{expLabel}</Typography>
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
  kras, categories, levels, canManage, canManageOrg,
  selectedCatId, onSelectCat,
  onEditKRA, onCloneKRA, onDeleteKRA,
  onAddCategory, onEditCategory, onDeleteCategory,
  onAddKRAForCategory,
  highlightKRAId,
  catSortDir, setCatSortDir,
  projSortDir, setProjSortDir,
  kraSortDir, setKraSortDir,
  // Bulk selection
  selectedKRAIds, setSelectedKRAIds,
  selectedCatIds, setSelectedCatIds,
  bulkDeleting, onBulkDelete,
  labelHighlightId, setLabelHighlight, onLabelClickKRA,
}) {
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [expandedKRAIds, setExpandedKRAIds] = useState(new Set());

  useEffect(() => { setPage(0); }, [selectedCatId]);

  const kraCountMap = useMemo(() => {
    const m = {};
    kras.forEach(k => { m[k.category_id] = (m[k.category_id] || 0) + 1; });
    return m;
  }, [kras]);

  const standardCats = useMemo(() =>
    categories
      .filter(c => c.is_standard)
      .sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return catSortDir === 'asc' ? cmp : -cmp;
      }),
  [categories, catSortDir]);

  const customCats = useMemo(() =>
    categories
      .filter(c => !c.is_standard)
      .sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return projSortDir === 'asc' ? cmp : -cmp;
      }),
  [categories, projSortDir]);

  const activeCatIds = useMemo(() => {
    if (selectedCatIds.size > 0) return new Set(selectedCatIds);
    if (selectedCatId != null) return new Set([selectedCatId]);
    return new Set();
  }, [selectedCatIds, selectedCatId]);

  const filtered = useMemo(() => {
    if (activeCatIds.size === 0) return [];
    const base = kras.filter(k => activeCatIds.has(k.category_id));
    return [...base].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return kraSortDir === 'asc' ? cmp : -cmp;
    });
  }, [kras, activeCatIds, kraSortDir]);

  const paginated      = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages     = Math.ceil(filtered.length / PER_PAGE);
  const selectedCatIdx = [...standardCats, ...customCats].findIndex(c => c.id === selectedCatId);
  const selectedCat    = [...standardCats, ...customCats].find(c => c.id === selectedCatId);

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
    const canActOnThis = cat.is_standard ? canManageOrg : canManage;

    return (
      <Box key={cat.id}
        sx={{
          px: 1, py: 0.6, mx: 0.5, mb: 0.25, borderRadius: 1.5, cursor: 'pointer',
          bgcolor: active ? colorStyle.bg : 'transparent',
          borderLeft: `3px solid ${active ? colorStyle.color : 'transparent'}`,
          '&:hover': { bgcolor: active ? colorStyle.bg : '#f8fafc' },
          transition: 'all 0.12s',
        }}>
        <Stack direction="row"  spacing={0.25} sx={{ alignItems: 'center' }}>
          {/* Category checkbox */}
          {canManage && (
            <Checkbox
              size="small"
              checked={isCatChecked}
              disabled={cat.is_standard && !canManageOrg} 
              onClick={e => {
                e.stopPropagation();
                const catKRAIds = kras.filter(k => k.category_id === cat.id).map(k => k.id);
                const willCheck = !selectedCatIds.has(cat.id);
                // Always set selectedCatId so the right panel is visible
                if (willCheck) onSelectCat(cat.id);
                setSelectedCatIds(prev => {
                  const next = new Set(prev);
                  if (next.has(cat.id)) {
                    next.delete(cat.id);
                    setSelectedKRAIds(prev2 => {
                      const next2 = new Set(prev2);
                      catKRAIds.forEach(id => next2.delete(id));
                      return next2;
                    });
                  } else {
                    next.add(cat.id);
                    setSelectedKRAIds(prev2 => {
                      const next2 = new Set(prev2);
                      catKRAIds.forEach(id => next2.add(id));
                      return next2;
                    });
                  }
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
            
            
            
            noWrap  
            onClick={() => {
              onSelectCat(cat.id);
              if (!canManageOrg) return; // is_lead: navigate only, preserve existing selection
              if (selectedCatIds.has(cat.id) && selectedCatIds.size === 1) {
                setSelectedCatIds(new Set());
                setSelectedKRAIds(() => new Set());
              } else {
                setSelectedCatIds(new Set([cat.id]));
                const catKRAIds = kras.filter(k => k.category_id === cat.id).map(k => k.id);
                setSelectedKRAIds(() => new Set(catKRAIds));
              }
            }}
            sx={{ cursor: 'pointer', userSelect: 'none', flex: 1, lineHeight: 1.4, fontSize: 13.5, fontWeight: active ? 700 : 600, color: active ? colorStyle.color : '#334155' }}>
            {cat.name}
          </Typography>
          <Stack direction="row"  spacing={0.35} sx={{ alignItems: 'center', flexShrink: 0 }} >
            {canActOnThis  && active ? (
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
      <Box sx={{ width: '30%', minWidth: 210, maxWidth: 290, flexShrink: 0, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden', pt: 0.5 }}>
        {standardCats.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0,
            flex: standardCats.length / (standardCats.length + customCats.length || 1),
          }}>
            <Stack direction="row"  spacing={0.5} sx={{ px: 1.75, pt: 1, pb: 0.5, flexShrink: 0, alignItems: 'center' }}>
              {canManageOrg  && (() => {
                const allOrgCatIds = standardCats.map(c => c.id);
                const allOrgKRAIds = kras.filter(k => standardCats.some(c => c.id === k.category_id)).map(k => k.id);
                const allChecked  = allOrgCatIds.length > 0 && allOrgCatIds.every(id => selectedCatIds.has(id));
                const someChecked = allOrgCatIds.some(id => selectedCatIds.has(id));
                return (
                  <Checkbox size="small"
                    checked={allChecked}
                    indeterminate={someChecked && !allChecked}
                    onClick={() => {
                      if (allChecked) {
                        setSelectedCatIds(prev => { const n = new Set(prev); allOrgCatIds.forEach(id => n.delete(id)); return n; });
                        setSelectedKRAIds(prev => { const n = new Set(prev); allOrgKRAIds.forEach(id => n.delete(id)); return n; });
                        onSelectCat(null);
                      } else {
                        if (allOrgCatIds.length > 0) onSelectCat(allOrgCatIds[0]);
                        setSelectedCatIds(prev => { const n = new Set(prev); allOrgCatIds.forEach(id => n.add(id)); return n; });
                        setSelectedKRAIds(prev => { const n = new Set(prev); allOrgKRAIds.forEach(id => n.add(id)); return n; });
                      }
                    }}
                    sx={{ p: 0.25, color: '#cbd5e1', '&.Mui-checked': { color: '#16a34a' }, '&.MuiCheckbox-indeterminate': { color: '#16a34a' } }}
                  />
                );
              })()}
              <StarIcon sx={{ fontSize: 10, color: '#16a34a' }} />
              <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 9.5, fontWeight: 700, color: '#16a34a' }}     >
                Org Level <Box component="span" sx={{ opacity: 0.65 }}>({standardCats.length})</Box>
              </Typography>
              <Chip
                label={`↕ ${catSortDir === 'asc' ? 'A–Z' : 'Z–A'}`}
                size="small"
                onClick={() => setCatSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                sx={{ height: 18, fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
                  bgcolor: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 1.25,
                  '&:hover': { bgcolor: '#f0fdf4', borderColor: '#16a34a', color: '#16a34a' } }}
              />
            </Stack>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0,
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#bbf7d0', borderRadius: 2 },
            }}>
              {standardCats.map(cat => renderCatItem(cat, GREEN_STYLE))}
            </Box>
          </Box>
        )}

        {customCats.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0,
            flex: customCats.length / (standardCats.length + customCats.length || 1),
            borderTop: standardCats.length > 0 ? '1px solid #f1f5f9' : undefined,
          }}>
            <Stack direction="row"  spacing={0.5} sx={{ px: 1.75, pt: 1, pb: 0.5, flexShrink: 0, alignItems: 'center' }}>
              {canManage && (() => {
                const allProjCatIds = customCats.map(c => c.id);
                const allProjKRAIds = kras.filter(k => customCats.some(c => c.id === k.category_id)).map(k => k.id);
                const allChecked  = allProjCatIds.length > 0 && allProjCatIds.every(id => selectedCatIds.has(id));
                const someChecked = allProjCatIds.some(id => selectedCatIds.has(id));
                return (
                  <Checkbox size="small"
                    checked={allChecked}
                    indeterminate={someChecked && !allChecked}
                    onClick={() => {
                      if (allChecked) {
                        setSelectedCatIds(prev => { const n = new Set(prev); allProjCatIds.forEach(id => n.delete(id)); return n; });
                        setSelectedKRAIds(prev => { const n = new Set(prev); allProjKRAIds.forEach(id => n.delete(id)); return n; });
                        onSelectCat(null);
                      } else {
                        if (allProjCatIds.length > 0) onSelectCat(allProjCatIds[0]);
                        setSelectedCatIds(prev => { const n = new Set(prev); allProjCatIds.forEach(id => n.add(id)); return n; });
                        setSelectedKRAIds(prev => { const n = new Set(prev); allProjKRAIds.forEach(id => n.add(id)); return n; });
                      }
                    }}
                    sx={{ p: 0.25, color: '#cbd5e1', '&.Mui-checked': { color: '#1d4ed8' }, '&.MuiCheckbox-indeterminate': { color: '#1d4ed8' } }}
                  />
                );
              })()}
              <TuneIcon sx={{ fontSize: 10, color: '#1d4ed8' }} />
              <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 9.5, fontWeight: 700, color: '#1d4ed8' }}     >
                Project Level <Box component="span" sx={{ opacity: 0.65 }}>({customCats.length})</Box>
              </Typography>
              <Chip
                label={`↕ ${projSortDir === 'asc' ? 'A–Z' : 'Z–A'}`}
                size="small"
                onClick={() => setProjSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                sx={{ height: 18, fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
                  bgcolor: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 1.25,
                  '&:hover': { bgcolor: '#eff6ff', borderColor: '#1d4ed8', color: '#1d4ed8' } }}
              />

            </Stack>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0,
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#bfdbfe', borderRadius: 2 },
            }}>
              {customCats.map(cat => renderCatItem(cat, BLUE_STYLE))}
            </Box>
          </Box>
        )}

        {categories.length === 0 && (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}  >No categories yet</Typography>
          </Box>
        )}
      </Box>

      {/* ── RIGHT PANEL ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedCat ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 1.5 }}>
            <LibraryBooksIcon sx={{ fontSize: 40, color: '#e2e8f0' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}   >Select a category to view its KRAs</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 1.5 }}>
            <LibraryBooksIcon sx={{ fontSize: 36, color: '#e2e8f0' }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#94a3b8' }}   >No KRAs in this category yet</Typography>
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
            {/* Sticky header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '28px 18px minmax(0, 1fr) 190px 96px',
              columnGap: 1,
              px: 1.5, py: 0.9,
              bgcolor: '#fafbfc',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
              position: 'sticky', top: 0, zIndex: 2,
              alignItems: 'center',
            }}>
              {/* Checkbox col */}
              <Box sx={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                {canManage && (
                  <Checkbox size="small"
                    checked={allPageChecked} indeterminate={somePageChecked}
                    onChange={e => setSelectedKRAIds(prev => {
                      const next = new Set(prev);
                      filtered
                        .filter(k => {
                          const cat = [...standardCats, ...customCats].find(c => c.id === k.category_id);
                          return cat?.is_standard ? canManageOrg : true;
                        })
                        .forEach(k => e.target.checked ? next.add(k.id) : next.delete(k.id));
                      return next;
                    })}
                    sx={{ p: 0.25, color: '#cbd5e1', '&.Mui-checked': { color: '#1d4ed8' }, '&.MuiCheckbox-indeterminate': { color: '#1d4ed8' } }}
                  />
                )}
              </Box>

              {/* Expand icon placeholder — matches the ExpandMoreIcon box in each row */}
              <Box sx={{ width: 18, flexShrink: 0 }} />

              {/* KRA name col */}
              <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.75, mr: 1 }}>
                <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5, fontWeight: 700, color: '#b0bac4' }}     >KRA</Typography>
                <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#b0bac4' }}   >({filtered.length})</Typography>
                <Chip label={`↕ ${kraSortDir === 'asc' ? 'A–Z' : 'Z–A'}`} size="small"
                  onClick={() => setKraSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  sx={{ height: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                    bgcolor: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 1,
                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' } }}
                />
              </Box>

              {/* LEVELS col — wide enough so chips stay visible */}
              <Box sx={{ width: 190, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5, fontWeight: 700, color: '#b0bac4' }}>LEVELS</Typography>
              </Box>

              {/* ACTIONS col */}
              {canManage && (
                <Box sx={{ width: 96, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <Typography sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5, fontWeight: 700, color: '#b0bac4' }}>ACTIONS</Typography>
                </Box>
              )}
            </Box>

            {/* Grouped KRA list */}
            <Box sx={{ flex: 1, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 2 },
            }}>
              {(() => {
                const groupMap = {};
                filtered.forEach(kra => {
                  const cid = kra.category_id;
                  if (!groupMap[cid]) {
                    const cat = [...standardCats, ...customCats].find(c => c.id === cid);
                    groupMap[cid] = { cat, kras: [] };
                  }
                  groupMap[cid].kras.push(kra);
                });
                return Object.values(groupMap).map(({ cat, kras: groupKras }) => {
                  const isOrg = cat?.is_standard;
                  const tc = isOrg ? GREEN_STYLE : BLUE_STYLE;
                  return (
                    <Box key={cat?.id}>
                      {/* Category heading — only shown when multiple cats selected */}
                      {activeCatIds.size > 1 && (
                        <Stack direction="row"  spacing={0.75}
                          sx={{ px: 2, py: 0.6, bgcolor: tc.bg, borderBottom: `1px solid ${tc.border}`,
                            borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 800, color: tc.color }}   >{cat?.name}</Typography>
                          <Chip label={isOrg ? 'Org' : 'Proj'} size="small"
                            sx={{ height: 14, fontSize: 8, fontWeight: 700,
                              bgcolor: 'rgba(255,255,255,0.6)', color: tc.color, borderRadius: 0.5 }} />
                        </Stack>
                      )}
                      {groupKras.map(kra => {
                        const isChecked = selectedKRAIds.has(kra.id);
                        const canActOnKRA = cat?.is_standard ? canManageOrg : canManage;
                        const isRowExpanded = expandedKRAIds.has(kra.id);
                        return (
                          <React.Fragment key={kra.id}>
                          <Box
                            onClick={() => {
                              // Row/label click always toggles expand — independent of selection
                              setExpandedKRAIds(prev => {
                                const next = new Set(prev);
                                next.has(kra.id) ? next.delete(kra.id) : next.add(kra.id);
                                return next;
                              });
                              // Keep existing auto-select behaviour, controlled separately by canManageOrg
                              if (canManageOrg && !selectedKRAIds.has(kra.id)) {
                                setSelectedKRAIds(prev => {
                                  const next = new Set(prev);
                                  next.add(kra.id);
                                  return next;
                                });
                              }
                            }}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '28px 18px minmax(0, 1fr) 190px 96px',
                              columnGap: 1,
                              px: 1.5, py: 0.85,
                              borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                              bgcolor: isChecked ? '#eff6ff' : labelHighlightId === kra.id ? '#fefce8' : '#fff',
                              alignItems: 'center',
                              '&:hover': { bgcolor: isChecked ? '#dbeafe' : labelHighlightId === kra.id ? '#fef9c3' : '#f8fafc' },
                            }}>
                            {canManage && (
                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <Checkbox size="small"
                                  checked={selectedKRAIds.has(kra.id)}
                                  indeterminate={false}
                                  disabled={cat?.is_standard && !canManageOrg}
                                  onChange={(e) => { e.stopPropagation(); }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedKRAIds(prev => {
                                      const next = new Set(prev);
                                      next.has(kra.id) ? next.delete(kra.id) : next.add(kra.id);
                                      return next;
                                    });
                                  }}
                                  sx={{ p: 0.25, flexShrink: 0, color: '#cbd5e1', '&.Mui-checked': { color: '#1d4ed8' } }}
                                />
                              </Box>
                            )}
                            {!canManage && <Box />}
                            <Box sx={{ color: '#cbd5e1', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isRowExpanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                            </Box>
                            <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, mr: 1 }}>
                              <Typography noWrap
                                sx={{ '&:hover': { color: '#1d4ed8' }, flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                                {kra.name}
                              </Typography>
                              {kra.description && (
                                <Typography noWrap
                                  sx={{
                                    minWidth: 0, fontSize: 11.5, color: '#94a3b8',
                                    display: { xs: 'none', sm: 'block' },
                                  }}>
                                  — {kra.description}
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ width: 190, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'visible' }}>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 0.5, width: '100%', minHeight: 24 }}>
                                {kra.levels?.slice(0, 3).map((lv, i) => (
                                  <LevelChip key={lv.id ?? i} lv={lv} idx={i} levelMap={levelMap} showExp={false} />
                                ))}
                                {kra.levels?.length > 3 && (
                                  <Typography sx={{ alignSelf: 'center', fontSize: 9, color: '#94a3b8' }}>
                                    +{kra.levels.length - 3} more
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            <Box sx={{ width: 96, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                              {canActOnKRA && (
                                <>
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => onEditKRA(kra)}
                                      sx={{ color: '#94a3b8', '&:hover': { color: '#1d4ed8' }, p: 0.4 }}>
                                      <EditIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Clone">
                                    <IconButton size="small" onClick={() => onCloneKRA(kra)}
                                      sx={{ color: '#94a3b8', '&:hover': { color: '#6d28d9' }, p: 0.4 }}>
                                      <ContentCopyIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => onDeleteKRA(kra)}
                                      sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626' }, p: 0.4 }}>
                                      <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                            </Box>
                          </Box>

                          {isRowExpanded && (
                            <Box sx={{ pl: '72px', pr: 3, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                              {kra.description && (
                                <Typography sx={{ fontSize: 12.5, lineHeight: 1.5, color: '#475569', mb: kra.levels?.length ? 1 : 0 }}>
                                  {kra.description}
                                </Typography>
                              )}
                              {kra.levels?.length > 0 && (
                                <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                                  {kra.levels.map((lv, i) => (
                                    <LevelChip key={lv.id ?? i} lv={lv} idx={i} levelMap={levelMap} showExp />
                                  ))}
                                </Stack>
                              )}
                            </Box>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </Box>
                  );
                });
              })()}
            </Box>
          </>
        )}
      </Box>

      {/* ── Bulk Delete Floating Bar ── */}
      {(() => {
        const onlyProjectSelected =
          [...selectedKRAIds].every(id => {
            const kra = kras.find(k => k.id === id);
            const cat = categories.find(c => c.id === kra?.category_id);
            return !cat?.is_standard;
          }) &&
          [...selectedCatIds].every(id => {
            const cat = categories.find(c => c.id === id);
            return !cat?.is_standard;
          });
        const showBulkBar = totalSelected > 0 && canManage && (canManageOrg || onlyProjectSelected);
        return showBulkBar;
      })() && (
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
          <Typography    sx={{ px: 0.5, fontSize: 12.5, fontWeight: 600, color: 'text.primary' }}>
            {selectedCatIds.size > 0 && selectedKRAIds.size > 0
              ? `${selectedCatIds.size} categor${selectedCatIds.size !== 1 ? 'ies' : 'y'} · ${selectedKRAIds.size} KRA${selectedKRAIds.size !== 1 ? 's' : ''} selected`
              : selectedCatIds.size > 0
              ? `${selectedCatIds.size} categor${selectedCatIds.size !== 1 ? 'ies' : 'y'} selected`
              : `${selectedKRAIds.size} KRA${selectedKRAIds.size !== 1 ? 's' : ''} selected`}
          </Typography>

          <Box sx={{ width: '0.5px', height: 16, bgcolor: 'divider' }} />

          <Button size="small" disabled={bulkDeleting}
            onClick={() => {
              setSelectedKRAIds(new Set());
              setSelectedCatIds(new Set());
              setLabelHighlight(null);
              onSelectCat(null);
            }}
            sx={{
              textTransform: 'none', fontSize: 12, fontWeight: 400,
              color: 'text.secondary', minWidth: 0, px: 1.25, borderRadius: 99,
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}>
            Clear
          </Button>

          <Button size="small" disabled={bulkDeleting}
            startIcon={bulkDeleting
              ? <CircularProgress size={11}  />
              : <DeleteOutlineIcon sx={{ fontSize: 13, color: 'inherit' }} />}
            onClick={() => setConfirmDeleteOpen(true)}
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

      <DeleteConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Selected"
        message={`Delete ${totalSelected} selected item${totalSelected !== 1 ? 's' : ''}? This cannot be undone.`}
        deleting={bulkDeleting}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await onBulkDelete();
          setConfirmDeleteOpen(false);
        }}
      />

    </Stack>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KRALibraryPage() {
  const { canManage, canManageOrg } = useRoleAccess();

  const { kras, categories, levels, loading, error, refresh } = useKRALibraryData();

  const [selectedCatId, setSelectedCatId] = useState(null);

const [catSortDir,  setCatSortDir]  = useState('asc');
const [projSortDir, setProjSortDir] = useState('asc');
  const [kraSortDir, setKraSortDir] = useState('asc');

  const [kraModal,     setKraModal]     = useState({ open: false, kra: null, mode: 'add', prefillCatId: null });
  const [catModal,     setCatModal]     = useState({ open: false, cat: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, item: null });
  const [deleting,     setDeleting]     = useState(false);
  const [blockedDialog, setBlockedDialog] = useState({ open: false, title: '', message: '' });
  const [toast,        setToast]        = useState({ open: false, message: '', severity: 'success' });
  const [highlightKRAId, setHighlightKRAId] = useState(null);

  // Bulk selection state
  const [selectedKRAIds, setSelectedKRAIds] = useState(new Set());
  const [selectedCatIds, setSelectedCatIds] = useState(new Set());
  const [bulkDeleting,   setBulkDeleting]   = useState(false);
  const [labelHighlightId, setLabelHighlightId] = useState(null);
  const labelHighlightTimer = useRef(null);

  function setLabelHighlight(id) {
    setLabelHighlightId(id);
    if (labelHighlightTimer.current) clearTimeout(labelHighlightTimer.current);
    if (id) {
      labelHighlightTimer.current = setTimeout(() => setLabelHighlightId(null), 2000);
    }
  }

  function handleSetSelectedKRAIds(fn) {
    setLabelHighlightId(null);
    if (labelHighlightTimer.current) clearTimeout(labelHighlightTimer.current);
    setSelectedKRAIds(fn);
  }
  function handleLabelClickKRA(kraId) {
    // Toggle selection + highlight
    setSelectedKRAIds(prev => {
      const next = new Set(prev);
      next.has(kraId) ? next.delete(kraId) : next.add(kraId);
      return next;
    });
    setLabelHighlightId(kraId);
    if (labelHighlightTimer.current) clearTimeout(labelHighlightTimer.current);
    labelHighlightTimer.current = setTimeout(() => setLabelHighlightId(null), 2000);
  }

  function handleSetSelectedCatIds(fn) {
    setLabelHighlightId(null);
    if (labelHighlightTimer.current) clearTimeout(labelHighlightTimer.current);
    setSelectedCatIds(fn);
  }


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
  
      // Only close on edit; add/clone modal manages its own stay-open + reset
      if (mode === 'edit') {
        setKraModal({ open: false, kra: null, mode: 'add', prefillCatId: null });
      }
  
      showToast(mode === 'edit' ? 'KRA updated' : mode === 'clone' ? 'KRA cloned' : 'KRA added');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save KRA', 'error');
      throw err; // re-throw so modal can catch & show inline error
    }
  }

  async function handleKRADelete() {
    const cat = categories.find(c => c.id === deleteDialog.item?.category_id);
    if (cat?.is_standard && !canManageOrg) {
      showToast("You don't have permission to delete Org-level KRAs.", 'error');
      setDeleteDialog({ open: false, type: null, item: null });
      return;
    }
    setDeleting(true);
    try {
      await deleteKRA(deleteDialog.item.id);
      setDeleteDialog({ open: false, type: null, item: null });
      showToast('KRA removed');
      refresh();
    } catch (err) {
      setDeleteDialog({ open: false, type: null, item: null });
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error || '';
      if (status === 409) {
        const count = err?.response?.data?.assigned_kra_level_count ?? '';
        setBlockedDialog({
          open: true,
          title: 'Cannot Delete KRA',
          message: `"${deleteDialog.item?.name}" is currently assigned to ${count} employee${count !== 1 ? 's' : ''}. Unassign it from all active cycles before deleting.`,
        });
      } else {
        showToast(serverMsg || 'Failed to delete KRA', 'error');
      }
    } finally { setDeleting(false); }
  }

  async function handleCatSave(payload, id) {
    try {
      if (id) await updateCategory(id, payload); else await createCategory(payload);
  
      // Only close when editing
      if (id) {
        setCatModal({ open: false, cat: null });
      }
  
      showToast(id ? 'Category updated' : 'Category added');
      refresh();
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save category', 'error');
      throw err; // re-throw so modal can catch & show inline error
    }
  }

  async function handleCatDelete() {
    const cat = deleteDialog.item;
    if (cat?.is_standard && !canManageOrg) {
      showToast("You don't have permission to delete Org-level categories.", 'error');
      setDeleteDialog({ open: false, type: null, item: null });
      return;
    }
    setDeleting(true);
    try {
      await deleteCategory(deleteDialog.item.id);
      setDeleteDialog({ open: false, type: null, item: null });
      showToast('Category deleted');
      refresh();
    } catch (err) {
      setDeleteDialog({ open: false, type: null, item: null });
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error || '';
      if (status === 409) {
        const kraCount   = err?.response?.data?.assigned_kra_count ?? '';
        const levelCount = err?.response?.data?.assigned_kra_level_count ?? '';
        setBlockedDialog({
          open: true,
          title: 'Cannot Delete Category',
          message: `"${cat?.name}" contains ${kraCount} KRA${kraCount !== 1 ? 's' : ''} (${levelCount} level variant${levelCount !== 1 ? 's' : ''}) that are currently assigned to employees. Unassign all related KRAs from active cycles before deleting this category.`,
        });
      } else {
        showToast(serverMsg || 'Failed to delete category', 'error');
      }
    } finally { setDeleting(false); }
  }

  function handleDelete() {
    if (deleteDialog.type === 'kra')      return handleKRADelete();
    if (deleteDialog.type === 'category') return handleCatDelete();
  }

  async function handleBulkDelete() {
    if (!selectedKRAIds.size && !selectedCatIds.size) return;
    setBulkDeleting(true);
    const total = selectedKRAIds.size + selectedCatIds.size;
    const errors = [];
    const results = await Promise.allSettled([
      ...[...selectedKRAIds].map(id => deleteKRA(id).then(() => ({ type: 'kra', id, ok: true })).catch(err => ({ type: 'kra', id, ok: false, err }))),
      ...[...selectedCatIds].map(id => deleteCategory(id).then(() => ({ type: 'cat', id, ok: true })).catch(err => ({ type: 'cat', id, ok: false, err }))),
    ]);

    const succeeded = results.filter(r => r.value?.ok).map(r => r.value);
    const failed    = results.filter(r => !r.value?.ok).map(r => r.value);
    const blocked   = failed.filter(r => r?.err?.response?.status === 409);

    if (_cache.data) {
      const deletedKRAIds = new Set(succeeded.filter(r => r.type === 'kra').map(r => r.id));
      const deletedCatIds = new Set(succeeded.filter(r => r.type === 'cat').map(r => r.id));
      _cache.data.kras = _cache.data.kras.filter(k => !deletedKRAIds.has(k.id) && !deletedCatIds.has(k.category_id));
      _cache.data.categories = _cache.data.categories.filter(c => !deletedCatIds.has(c.id));
    }

    setSelectedKRAIds(new Set());
    setSelectedCatIds(new Set());

    if (succeeded.length > 0) {
      showToast(`Deleted ${succeeded.length} item${succeeded.length !== 1 ? 's' : ''} successfully`);
      refresh();
    }

    if (blocked.length > 0) {
      setBlockedDialog({
        open: true,
        title: `${blocked.length} Item${blocked.length !== 1 ? 's' : ''} Could Not Be Deleted`,
        message: `${blocked.length} item${blocked.length !== 1 ? 's are' : ' is'} assigned to employees in active cycles and cannot be deleted. Unassign them first.`,
      });
    } else if (failed.length > 0 && succeeded.length === 0) {
      showToast('Failed to delete selected items', 'error');
    }

    setBulkDeleting(false);
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
          <Stack direction="row"  spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.13)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LibraryBooksIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ lineHeight: 1.15, fontSize: 17, fontWeight: 800, color: '#fff' }}    >KRA Library</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}  >Master repository for Key Result Areas</Typography>
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
        <Stack direction="row"  sx={{ px: 2.5, minHeight: 40, gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}   >
            Categories ({categories.length})
          </Typography>
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
          {canManage && (
            <Chip label="+ KRA" size="small"
              onClick={() => setKraModal({ open: true, kra: null, mode: 'add', prefillCatId: selectedCatId })}
              sx={{
                height: 22, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                bgcolor: '#f0fdf4', color: '#166534', border: '1px dashed #bbf7d0', borderRadius: 1.25,
                '&:hover': { bgcolor: '#dcfce7', borderColor: '#166534' },
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Stack  spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={28} sx={{ color: '#1E3A8A' }} />
              <Typography sx={{ fontSize: 12.5, color: '#94a3b8' }}  >Loading KRA library…</Typography>
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
            kras={kras} categories={categories} levels={levels} canManage={canManage} canManageOrg={canManageOrg}
            selectedCatId={selectedCatId} onSelectCat={setSelectedCatId}
            onEditKRA={kra  => setKraModal({ open: true, kra, mode: 'edit',  prefillCatId: kra.category_id })}
            onCloneKRA={kra => setKraModal({ open: true, kra, mode: 'clone', prefillCatId: kra.category_id })}
            onDeleteKRA={kra => setDeleteDialog({ open: true, type: 'kra', item: kra })}
            onAddCategory={() => setCatModal({ open: true, cat: null })}
            onEditCategory={cat => setCatModal({ open: true, cat })}
            onDeleteCategory={cat => setDeleteDialog({ open: true, type: 'category', item: cat })}
            onAddKRAForCategory={handleAddKRAForCategory}
            highlightKRAId={highlightKRAId}
            catSortDir={catSortDir}   setCatSortDir={setCatSortDir}
            projSortDir={projSortDir} setProjSortDir={setProjSortDir}
            kraSortDir={kraSortDir} setKraSortDir={setKraSortDir}
            selectedKRAIds={selectedKRAIds} setSelectedKRAIds={handleSetSelectedKRAIds}
            selectedCatIds={selectedCatIds} setSelectedCatIds={handleSetSelectedCatIds}
            bulkDeleting={bulkDeleting} onBulkDelete={handleBulkDelete}
            labelHighlightId={labelHighlightId} setLabelHighlight={setLabelHighlight}
            onLabelClickKRA={handleLabelClickKRA}
          />
        )}
      </Box>

      <AddKRAModal open={kraModal.open} kra={kraModal.kra} mode={kraModal.mode}
        categories={categories} levels={levels} prefillCategoryId={kraModal.prefillCatId}
        kraNames={kras.map(k => k.name)}
        canManageOrg={canManageOrg}
        onClose={() => setKraModal({ open: false, kra: null, mode: 'add', prefillCatId: null })}
        onSaved={handleKRASave} />

      <AddCategoryModal open={catModal.open} category={catModal.cat}
        canManageOrg={canManageOrg}
        onClose={() => setCatModal({ open: false, cat: null })}
        onSaved={handleCatSave} />

      <DeleteConfirmDialog open={deleteDialog.open}
        title={`Delete ${deleteDialog.type ? deleteDialog.type.charAt(0).toUpperCase() + deleteDialog.type.slice(1) : ''}`}
        message={deleteDialog.type ? deleteMessages[deleteDialog.type] : ''}
        deleting={deleting}
        onClose={() => setDeleteDialog({ open: false, type: null, item: null })}
        onConfirm={handleDelete} />

      <BlockedDeleteDialog
        open={blockedDialog.open}
        title={blockedDialog.title}
        message={blockedDialog.message}
        onClose={() => setBlockedDialog({ open: false, title: '', message: '' })}
      />

      <Toast open={toast.open} message={toast.message} severity={toast.severity}
        onClose={() => setToast(t => ({ ...t, open: false }))} />
    </Box>
  );
}