import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, Tabs, Tab, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Tooltip, InputAdornment, TextField, Menu, MenuItem, ListItemIcon,
  TableSortLabel, Stepper, Step, StepLabel,
} from '@mui/material';
import AddIcon              from '@mui/icons-material/Add';
import ContentCopyIcon      from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutlined';
import SearchIcon           from '@mui/icons-material/Search';
import BlockIcon            from '@mui/icons-material/Block';
import PlayArrowIcon        from '@mui/icons-material/PlayArrow';
import PauseIcon            from '@mui/icons-material/Pause';
import CheckCircleIcon      from '@mui/icons-material/CheckCircle';
import EditIcon             from '@mui/icons-material/Edit';
import MoreVertIcon         from '@mui/icons-material/MoreVert';
import WarningAmberIcon     from '@mui/icons-material/WarningAmber';
import OpenInNewIcon        from '@mui/icons-material/OpenInNew';
import AssignmentIndIcon    from '@mui/icons-material/AssignmentInd';
import RateReviewIcon       from '@mui/icons-material/RateReview';

import { useNavigate }      from 'react-router';
import ROUTES               from '../../config/routes';
import { useCycles, invalidateCyclesCache } from '../../hooks/useCycles';
import { updateCycle, advanceCycleStage, getReferenceData }   from '../../api/cyclesApi';
import useRoleAccess        from '../../hooks/useRoleAccess';
import { Dialog, DialogContent, DialogActions } from '@mui/material';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const STATUS_STYLES = {
  ACTIVE:    { bgcolor: '#dcfce7', color: '#166534' },
  DRAFT:     { bgcolor: '#f1f5f9', color: '#475569' },
  CLOSED:    { bgcolor: '#f1f5f9', color: '#475569' },
  ON_HOLD:   { bgcolor: '#f1f5f9', color: '#475569' },
  CANCELLED: { bgcolor: '#f1f5f9', color: '#475569' },
};


const STATUS_ACTIONS = {
  DRAFT:     ['ACTIVE'],
  ACTIVE:    ['ON_HOLD', 'CLOSED', 'CANCELLED'],
  ON_HOLD:   ['ACTIVE', 'CANCELLED'],
  CLOSED:    [],
  CANCELLED: [],
};

const ACTION_CONFIG = {
  ACTIVE:    { label: 'Activate',    icon: <PlayArrowIcon sx={{ fontSize: 'small' }}  />,   confirmColor: '#15803d' },
  ON_HOLD:   { label: 'Put On Hold', icon: <PauseIcon sx={{ fontSize: 'small' }}  />,       confirmColor: '#9a3412' },
  CLOSED:    { label: 'Close',       icon: <CheckCircleIcon sx={{ fontSize: 'small' }}  />, confirmColor: '#1E3A8A' },
  CANCELLED: { label: 'Cancel',      icon: <BlockIcon sx={{ fontSize: 'small' }}  />,       confirmColor: '#dc2626' },
};
const ACTION_DIALOG_CONFIG = {
  ACTIVE: { title:'Activate Cycle', confirmLabel:'Activate Cycle', cancelLabel:'Not Now' },
  CLOSED: { title:'Close Cycle', confirmLabel:'Close Cycle', cancelLabel:'Keep Open' },
  CANCELLED: { title:'Cancel Cycle', confirmLabel:'Cancel Cycle', cancelLabel:'Keep Cycle' },
  ON_HOLD: { title:'Put Cycle On Hold', confirmLabel:'Put On Hold', cancelLabel:'Keep Active' },
};

const TAB_FILTERS = [null, 'DRAFT', 'CLOSED', 'ON_HOLD', 'CANCELLED'];
const TAB_LABELS  = ['All', 'Draft', 'Closed', 'On Hold', 'Cancelled'];

function useRowsPerPage(rowHeightPx = 40, reservedPx = 370) {
  const [rows, setRows] = useState(7);
  useEffect(() => {
    function calc() {
      const available = window.innerHeight - reservedPx;
      setRows(Math.max(3, Math.floor(available / rowHeightPx)));
    }
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [rowHeightPx, reservedPx]);
  return rows;
}

/* ─── Calendar helpers ─── */
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
function toDateOnly(s) { return s ? String(s).split('T')[0].split(' ')[0].trim() : ''; }
function toISO(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmtShort(s) {
  if (!s) return null;
  const d = new Date(toDateOnly(s) + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ─── RangePicker (same as CycleDetailPage) ─── */
function RangePicker({ startDate, endDate, onChange, onClose }) {
  const init = () => {
    const src = startDate;
    if (src) { const d = new Date(toDateOnly(src) + 'T00:00:00'); return { y: d.getFullYear(), m: d.getMonth() }; }
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() };
  };
  const [vy, setVy] = useState(() => init().y);
  const [vm, setVm] = useState(() => init().m);
  const [picking, setPicking] = useState(startDate ? 'end' : 'start');
  const [hover, setHover] = useState(null);
  const startD = startDate ? new Date(toDateOnly(startDate) + 'T00:00:00') : null;
  const endD   = endDate   ? new Date(toDateOnly(endDate)   + 'T00:00:00') : null;
  const totalDays = new Date(vy, vm+1, 0).getDate();
  const firstDay  = new Date(vy, vm, 1).getDay();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i+1)];
  function disabled(d) {
    if (!d) return true;
    if (picking === 'end' && startD) { const s = new Date(startD); s.setHours(0,0,0,0); if (new Date(vy,vm,d)<s) return true; }
    return false;
  }
  function dayState(d) {
    if (!d) return {};
    const dt = new Date(vy,vm,d); dt.setHours(0,0,0,0);
    const st = startD ? new Date(startD).setHours(0,0,0,0) : null;
    const et = endD   ? new Date(endD).setHours(0,0,0,0)   : null;
    const ht = hover  ? new Date(vy,vm,hover).setHours(0,0,0,0) : null;
    const dtt = dt.getTime();
    const isStart = st!==null && dtt===st, isEnd = et!==null && dtt===et;
    const re = picking==='end'&&ht ? ht : et;
    const inRange = st!==null&&re!==null&&dtt>st&&dtt<re;
    return { isStart, isEnd, inRange };
  }
  function isToday(d) { const t=new Date(); return !!d&&t.getFullYear()===vy&&t.getMonth()===vm&&t.getDate()===d; }
  function selectDay(d) {
    const iso = toISO(vy,vm,d);
    if (picking==='start') { onChange({ start_date:iso, end_date:'' }); setPicking('end'); }
    else { onChange({ start_date:startDate, end_date:iso }); onClose&&onClose(); }
    setHover(null);
  }
  return (
    <Box sx={{ width:248, borderRadius:2, overflow:'hidden', bgcolor:'#fff', boxShadow:'0 12px 40px -4px rgba(15,23,42,0.18)', border:'1px solid #e2e8f0' }}>
      <Stack direction="row"   sx={{ px:1.25, py:0.75, background:gradient, alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton size="small" onClick={() => vm===0?(setVm(11),setVy(y=>y-1)):setVm(m=>m-1)} sx={{ color:'#fff',p:0.2,'&:hover':{bgcolor:'rgba(255,255,255,0.15)',borderRadius:1} }}><ChevronLeftIcon sx={{ fontSize:14 }}/></IconButton>
        <Typography sx={{ fontWeight:700, fontSize:12, color:'#fff' }}>{MONTHS[vm].slice(0,3)} {vy}</Typography>
        <IconButton size="small" onClick={() => vm===11?(setVm(0),setVy(y=>y+1)):setVm(m=>m+1)} sx={{ color:'#fff',p:0.2,'&:hover':{bgcolor:'rgba(255,255,255,0.15)',borderRadius:1} }}><ChevronRightIcon sx={{ fontSize:14 }}/></IconButton>
        <Stack direction="row"  spacing={0.4} sx={{ ml:0.5, alignItems: 'center' }}>
          {[{key:'start',val:startDate},{key:'end',val:endDate}].map(({key,val},i)=>(
            <React.Fragment key={key}>
              {i===1&&<Typography sx={{fontSize:9,color:'rgba(255,255,255,0.5)'}}>→</Typography>}
              <Box onClick={()=>key==='end'&&!startDate?null:setPicking(key)} sx={{ px:0.75,py:0.2,borderRadius:1,bgcolor:picking===key?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.1)',cursor:key==='end'&&!startDate?'default':'pointer',border:picking===key?'1px solid rgba(255,255,255,0.4)':'1px solid transparent',opacity:key==='end'&&!startDate?0.45:1,transition:'all 0.12s' }}>
                <Typography sx={{fontSize:9.5,fontWeight:700,color:'#fff',whiteSpace:'nowrap'}}>{val?fmtShort(val):(key==='start'?'From':'To')}</Typography>
              </Box>
            </React.Fragment>
          ))}
          {(startDate||endDate)&&<IconButton size="small" onClick={()=>onChange({start_date:'',end_date:''})} sx={{color:'rgba(255,255,255,0.5)',p:0.15,ml:0.25,'&:hover':{color:'#fff'}}}><CloseIcon sx={{fontSize:11}}/></IconButton>}
        </Stack>
      </Stack>
      <Box sx={{ px:1.25, pt:0.75, pb:0.75 }}>
        <Stack direction="row" sx={{ mb: 0.4 }} >{WEEK_DAYS.map(d=><Box key={d} sx={{flex:1,textAlign:'center'}}><Typography sx={{fontSize:9,fontWeight:700,color:'#cbd5e1'}}>{d}</Typography></Box>)}</Stack>
        {Array.from({length:Math.ceil(cells.length/7)},(_,ri)=>(
          <Stack key={ri} direction="row" sx={{mb:0.1}}>
            {cells.slice(ri*7,ri*7+7).map((d,ci)=>{
              const dis=disabled(d);
              const {isStart,isEnd,inRange}=dayState(d);
              const today=isToday(d), hi=isStart||isEnd;
              return (
                <Box key={ci} sx={{flex:1,display:'flex',justifyContent:'center'}}>
                  {d?<Box onClick={()=>!dis&&selectDay(d)} onMouseEnter={()=>!dis&&picking==='end'&&setHover(d)} onMouseLeave={()=>setHover(null)} sx={{ width:26,height:26,borderRadius:hi?'50%':inRange?0:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:dis?'not-allowed':'pointer',bgcolor:hi?'#1E3A8A':inRange?'#dbeafe':'transparent',color:hi?'#fff':dis?'#cbd5e1':today?'#1E3A8A':'#374151',fontWeight:hi?700:today?700:400,fontSize:11,outline:today&&!hi?'1.5px solid #93c5fd':'none',outlineOffset:'-1px',transition:'background 0.1s','&:hover':!dis?{bgcolor:hi?'#1E3A8A':'#eff6ff',color:hi?'#fff':'#1E3A8A',fontWeight:600}:{} }}>{d}</Box>:<Box sx={{width:26,height:26}}/>}
                </Box>
              );
            })}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

/* StageDatePickerRow and RollbackDatesDialog removed — rollback now navigates to CycleDetailPage */

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(String(dateStr).split('T')[0] + 'T00:00:00');
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Stage stepper for active cycle banner ── */
function BannerStepper({
  stages,
  stageWindows,
  currentStageId,
  canAdvance,
  canRollback,
  onAdvanceClick,
  onRollbackClick,
}) {

  return (
    <Box sx={{ mt: 2 }}>

      <Stepper
        activeStep={(currentStageId ?? 1) - 1}
        alternativeLabel
        sx={{

        '& .MuiStepConnector-line': {
          borderColor: 'rgba(255,255,255,0.14)',
          borderTopWidth: 2,
          borderRadius: 99,
          transition: '0.2s ease',
        },

        '& .MuiStepLabel-label': {
          color: 'rgba(255,255,255,0.48)',
          fontSize: 11,
          fontWeight: 500,
          mt: 0.9,
          transition: 'all 0.2s ease',
          letterSpacing: '0.01em',
        },

        '& .MuiStepLabel-label.Mui-active': {
          color: '#ffffff !important',
          fontWeight: '800 !important',
          opacity: 1,
        },

        '& .MuiStepLabel-label.Mui-completed': {
          color: '#86efac !important',
          fontWeight: '600 !important',
        },

        '& .MuiStepIcon-root': {
          color: 'rgba(255,255,255,0.18)',
          fontSize: 30,
          transition: 'all 0.22s ease',
        },

        '& .MuiStepIcon-text': {
          fill: '#dbeafe',
          fontWeight: 700,
          fontSize: 12,
        },

        /* ACTIVE STEP */
        '& .Mui-active .MuiStepIcon-root': {
          color: '#ffffff',

          border: '2px solid rgba(255,255,255,0.72)',
          borderRadius: '50%',
          padding: '2px',
          boxSizing: 'content-box',

          filter: 'drop-shadow(0 2px 10px rgba(255,255,255,0.12))',
        },

        '& .Mui-active .MuiStepIcon-text': {
          fill: '#1E3A8A',
          fontWeight: 800,
        },

        /* COMPLETED STEP */
        '& .Mui-completed .MuiStepIcon-root': {
          color: '#22c55e',
        },

        '& .Mui-completed .MuiStepIcon-text': {
          fill: '#ffffff',
        },

        /* HOVER */
        '& .MuiStepLabel-root:hover .MuiStepIcon-root': {
          transform: 'scale(1.05)',
        },
      }}
      >

        {stages.map((stage) => {

          const isNext =
            canAdvance &&
            stage.id === currentStageId + 1;

          const isBack =
            canRollback &&
            stage.id < currentStageId;

          const clickable = isNext || isBack;

          const win = (stageWindows ?? []).find(w => w.stage_id === stage.id);

          return (
            <Step
              key={stage.id}
              completed={stage.id < currentStageId}
            >
              <Tooltip
                title={
                  win?.start_date && win?.end_date
                    ? `${formatDate(win.start_date)} → ${formatDate(win.end_date)}`
                    : 'No dates configured'
                }
                arrow
                placement="top"
              >
                <StepLabel
                  onClick={() => {
                    if (isNext) onAdvanceClick(stage);
                    if (isBack) onRollbackClick(stage);
                  }}
                  sx={{ cursor: clickable ? 'pointer' : 'default' }}
                >
                  {stage.name}
                </StepLabel>
              </Tooltip>
            </Step>
          );
        })}

      </Stepper>

      {(canAdvance || canRollback) && (
        <Typography
          sx={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.45)',
            textAlign: 'center',
            mt: 1,
          }}
        >
          {canAdvance && canRollback
            ? 'Click next stage to advance · Click completed stage to roll back'
            : canAdvance
              ? 'Click next stage to advance'
              : 'Click completed stage to roll back'}
        </Typography>
      )}

    </Box>
  );
}

/* ── Confirm dialog ── */
function ConfirmDialog({ open, title, message, warning, confirmLabel, cancelLabel = 'Cancel', confirmColor, onClose, onConfirm, loading, error }) {
  return (
    <Dialog open={open} onClose={() => !loading && onClose()}  fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }} sx={{ maxWidth: 'xs' }}>
      <Box sx={{ bgcolor: '#fffbeb', px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid #fde68a' }}>
        <Stack direction="row"  spacing={1} sx={{ alignItems: 'center' }}>
          <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}   >{title}</Typography>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Typography sx={{ mb: warning ? 1.5 : 0, fontSize: 13, color: '#374151' }}   >{message}</Typography>
        {warning && (
          <Box sx={{ px: 1.5, py: 1, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
            <Typography sx={{ fontSize: 12, color: '#991b1b' }}  >{warning}</Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5, fontSize: 12, borderRadius: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, borderRadius: 1.5, fontSize: 13 }}>{cancelLabel}</Button>
        <Button onClick={onConfirm} disabled={loading} variant="contained"
          startIcon={loading ? <CircularProgress size={12}  /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, px: 2.5, fontSize: 13, bgcolor: confirmColor, '&:hover': { bgcolor: confirmColor, opacity: 0.88 }, '&:disabled': { opacity: 0.6 }, color: 'inherit' }}>
          {loading ? 'Processing…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ══════════════ MAIN ══════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { canManageCycles, canManageCyclesActions, isAdmin, isManager  } = useRoleAccess();
  const { data: allCycles, loading, error, refetch } = useCycles();

  const [stages, setStages] = useState([]);

  useEffect(() => {
    getReferenceData()
      .then(res => setStages(res.data.stages ?? []))
      .catch(() => {});
  }, []);
  const [tab, setTab]       = useState(0);
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');

  /* ── Sort state ── */
  const [sortConfig, setSortConfig] = useState({
  key: 'name',
  direction: 'asc',
});

const handleSort = (key) => {
  setSortConfig((prev) => ({
    key,
    direction:
      prev.key === key && prev.direction === 'asc'
        ? 'desc'
        : 'asc',
  }));

  setPage(0);
};

const headerSx = {
  fontWeight: 700,
  fontSize: 10,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  bgcolor: '#f8fafc',
  py: 0.6,
  borderBottom: '1px solid #e2e8f0',
};

  const [successMsg, setSuccessMsg] = useState('');
  const [actionsAnchor, setActionsAnchor] = useState(null);

  const [confirm, setConfirm]               = useState({ open: false, action: null, cycle: null });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError]     = useState('');

  const [advanceConfirm, setAdvanceConfirm] = useState({ open: false, toStage: null, cycle: null });
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError]     = useState('');
  const [rollbackConfirm, setRollbackConfirm] = useState({ open: false, stage: null });

  // Rollback now navigates to CycleDetailPage with ?rollback=STAGE_ID

  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  function flash(msg) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); }

  const activeCycle = useMemo(() => (allCycles ?? []).find(c => c.status === 'ACTIVE') ?? null, [allCycles]);

  const tabCounts = useMemo(() => {
    const all = allCycles ?? [];
    return TAB_FILTERS.map(f => f ? all.filter(c => c.status === f).length : all.length);
  }, [allCycles]);

  /* ── Filter → sort pipeline ── */
  const filteredAndSorted = useMemo(() => {
  const sf = TAB_FILTERS[tab];

  let base = sf
    ? (allCycles ?? []).filter(c => c.status === sf)
    : (allCycles ?? []);

  if (search.trim()) {
    const q = search.toLowerCase();

    base = base.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }

  return [...base].sort((a, b) => {

    // ALWAYS keep ACTIVE cycle on top
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') {
      return -1;
    }

    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') {
      return 1;
    }
    let aValue;
    let bValue;

    switch (sortConfig.key) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;

      case 'period':
        aValue = new Date(a.start_date);
        bValue = new Date(b.start_date);
        break;

      case 'stage':
        aValue = a.current_stage?.id || 0;
        bValue = b.current_stage?.id || 0;
        break;

      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;

      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }

    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }

    return 0;
  });

}, [allCycles, tab, search, sortConfig]);



  function openConfirm(cycle, action) {
    setConfirmError('');
    setConfirm({ open: true, action, cycle });
    setActionsAnchor(null);
  }

  async function handleConfirmAction() {
    const { cycle, action } = confirm;
    if (!cycle || !action) return;
    if (action === 'ACTIVE') {
      const other = (allCycles ?? []).find(c => c.status === 'ACTIVE' && c.id !== cycle.id);
      if (other) { setConfirmError(`"${other.name}" is already active. Close or put it on hold first.`); return; }
    }
    setConfirmLoading(true); setConfirmError('');
    try {
      await updateCycle(cycle.id, { status: action });
      invalidateCyclesCache(); await refetch();
      setConfirm({ open: false, action: null, cycle: null });
      const labels = { ACTIVE: 'activated', ON_HOLD: 'put on hold', CLOSED: 'closed', CANCELLED: 'cancelled' };
      flash(`"${cycle.name}" ${labels[action] ?? 'updated'}.`);
    } catch (err) {
      setConfirmError(err?.response?.data?.error || 'Action failed. Please try again.');
    } finally { setConfirmLoading(false); }
  }

  async function handleAdvanceStage() {
    const { cycle, toStage } = advanceConfirm;
    if (!cycle || !toStage) return;
    setAdvanceLoading(true); setAdvanceError('');
    try {
      await advanceCycleStage(cycle.id, {});
      invalidateCyclesCache(); await refetch();
      setAdvanceConfirm({ open: false, toStage: null, cycle: null });
      flash(`Cycle advanced to Stage ${toStage.id}: "${toStage.name}".`);
    } catch (err) {
      setAdvanceError(err?.response?.data?.error || 'Failed to advance stage.');
    } finally { setAdvanceLoading(false); }
  }

  // handleRollbackStage removed — rollback now navigates to CycleDetailPage

  async function handleDelete() {
    if (!deleteTarget || deleteTarget.status !== 'DRAFT') return;
    setDeleteLoading(true); setDeleteError('');
    try {
      await updateCycle(deleteTarget.id, { is_deleted: true });
      invalidateCyclesCache(); await refetch();
      setDeleteOpen(false);
      flash(`"${deleteTarget.name}" deleted.`);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Delete failed.');
    } finally { setDeleteLoading(false); }
  }

  const ROWS_PER_PAGE = useRowsPerPage(40, activeCycle ? 390 : 260);
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress sx={{ color: '#1E3A8A' }} />
    </Box>
  );
  if (error) return (
    <Alert severity="error" action={<Button onClick={refetch}>Retry</Button>}>{error}</Alert>
  );

  const currentStageId = activeCycle?.current_stage?.id
    ?? (activeCycle?.cycle_stages?.length > 0
      ? Math.max(...activeCycle.cycle_stages.map(s => s.stage_id))
      : null);
  const activeActions    = activeCycle ? (STATUS_ACTIONS[activeCycle.status] ?? []) : [];
  const maxStageId = stages.length > 0 ? Math.max(...stages.map(s => s.id)) : 5;
  const minStageId = stages.length > 0 ? Math.min(...stages.map(s => s.id)) : 1;
  const canAdvanceActive = !!activeCycle && activeCycle.status === 'ACTIVE' && canManageCycles && currentStageId && currentStageId < maxStageId;
  const canRollbackActive = !!activeCycle && activeCycle.status === 'ACTIVE' && canManageCycles && currentStageId && currentStageId > minStageId;

  const paginatedRows = filteredAndSorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  return (
    <Box sx={{ height: '100vh', p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8fafc', gap: 1.5, boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}   >
        <Box>
          <Typography   sx={{ fontSize: '1.15rem', lineHeight: 1.2, fontWeight: 800, color: '#0f172a' }}>Performance Dashboard</Typography>
          <Typography sx={{ fontSize: 12, color: '#64748b' }}  >KRA cycle overview</Typography>
        </Box>
        {canManageCycles && (
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => navigate(ROUTES.CYCLE_DETAIL.replace(':id', 'new'))}
            sx={{ px: 2.5, background: gradient, borderRadius: 2, fontWeight: 700, boxShadow: '0 4px 12px rgba(30,58,138,0.3)', '&:hover': { background: gradient, opacity: 0.9 } }}>
            New Cycle
          </Button>
        )}  
      </Stack>

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ borderRadius: 2, flexShrink: 0 }}>{successMsg}</Alert>
      )}

      {/* ── Active cycle banner ── */}
      {activeCycle && (
        <Paper elevation={0} sx={{ borderRadius: 2, flexShrink: 0, overflow: 'hidden', boxShadow: '0 4px 20px rgba(30,58,138,0.18)' }}>
          <Box sx={{ px: 2.5, pt: 2, pb: 2, background: gradient, color: '#fff' }}>
            <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}  >
              <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}   >
                <Stack direction="row"  spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}   >
                  <Chip
                    label={activeCycle.status === 'ACTIVE' ? 'ACTIVE' : activeCycle.status === 'DRAFT' ? 'DRAFT' : activeCycle.status.replace('_', ' ')}
                    size="small"
                    sx={{
                      bgcolor: activeCycle.status === 'ACTIVE' ? '#10b981' : activeCycle.status === 'DRAFT' ? '#64748b' : activeCycle.status === 'CLOSED' ? '#166534' : '#92400e',
                      color: '#fff', fontSize: 9, fontWeight: 800, height: 17
                    }}
                  />
                  <Typography  sx={{ fontSize: '1rem', fontWeight: 800 }} noWrap>{activeCycle.name}</Typography>
                  <Typography  sx={{ opacity: 0.85, fontSize: 11 }}>
                    {formatDate(activeCycle.start_date)} — {formatDate(activeCycle.end_date)}
                  </Typography>
                  {(() => {
                    const today = new Date(); today.setHours(0, 0, 0, 0);

                    // find current stage's end date from cycle_stages
                    const currentStage = activeCycle.cycle_stages?.find(
                      cs => cs.stage_id === currentStageId
                    );
                    const stageEndDate = currentStage?.end_date
                      ? new Date(toDateOnly(currentStage.end_date) + 'T00:00:00')
                      : null;

                    if (!stageEndDate) return null;

                    const days = Math.ceil((stageEndDate - today) / (1000 * 60 * 60 * 24));

                    return (
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: days > 7 ? 'rgba(255,255,255,0.68)' : days >= 0 ? '#fcd34d' : '#fca5a5',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {`( Stage Duration: ${formatDate(currentStage.start_date)} -> ${formatDate(currentStage.end_date)}  ·  ${
                          days > 0 ? `${days} days left )` : days === 0 ? 'Ends today' : `Overdue by ${Math.abs(days)} days`
                        }`}
                      </Typography>
                    );
                  })()}
                </Stack>
              </Box>

              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexShrink: 0 }}  >
                {canManageCycles && (
                  <Tooltip title="Clone this cycle">
                    <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                      onClick={() => navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', 'new')}?clone=${activeCycle.id}`)}
                      sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, fontSize: 11, fontWeight: 600, px: 1.25, py: 0.4, textTransform: 'none', minWidth: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                      Clone
                    </Button>
                  </Tooltip>
                )}
                {canManageCycles && (
                  <Tooltip title="Edit cycle details">
                    <Button size="small" startIcon={<EditIcon sx={{ fontSize: 13 }} />}
                      onClick={() => navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', activeCycle.id)}?edit=true`)}
                      sx={{ bgcolor: '#fff', color: '#1E3A8A', borderRadius: 99, fontSize: 11, fontWeight: 700, px: 1.25, py: 0.4, textTransform: 'none', minWidth: 0, '&:hover': { bgcolor: '#f0f6ff' } }}>
                      Edit
                    </Button>
                  </Tooltip>
                )}
                {canManageCycles && activeActions.filter(a => ['ON_HOLD', 'CANCELLED', 'CLOSED'].includes(a)).length > 0 && (
                  <>
                    <Tooltip title="Quick actions">
                      <IconButton size="small" onClick={e => setActionsAnchor(e.currentTarget)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, width: 28, height: 28, '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}>
                        <MoreVertIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
                      PaperProps={{ sx: { borderRadius: 2, mt: 0.5, minWidth: 160, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '0.5px solid #e2e8f0' } }}>
                      {activeActions.filter(a => ['ON_HOLD', 'CANCELLED', 'CLOSED'].includes(a)).map(action => {
                        const cfg = ACTION_CONFIG[action];
                        return (
                          <MenuItem key={action} onClick={() => openConfirm(activeCycle, action)}
                            sx={{ fontSize: 13, fontWeight: 600, py: 1, gap: 1 }}>
                            <ListItemIcon sx={{ minWidth: 24 }}>{cfg.icon}</ListItemIcon>
                            {cfg.label}
                          </MenuItem>
                        );
                      })}
                    </Menu>
                  </>
                )}
              </Stack>
            </Stack>

            <BannerStepper
              stages={stages}
              stageWindows={activeCycle?.cycle_stages ?? []} 
              currentStageId={currentStageId ?? 1}
              canAdvance={canAdvanceActive}
              canRollback={canRollbackActive}
              onAdvanceClick={(stage) => {
                setAdvanceError('');
                setAdvanceConfirm({ open: true, toStage: stage, cycle: activeCycle });
              }}
              onRollbackClick={(stage) => {
                setRollbackConfirm({ open: true, stage });
              }}
            />
          </Box>
        </Paper>
      )}

      {/* ── Cycles table ── */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: 444 }}>

        {/* Tab bar + search */}
        <Stack direction="row"  
          sx={{ borderBottom: '1px solid #f1f5f9', px: 1.5, bgcolor: '#fff', flexShrink: 0, alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }}
            variant="scrollable" scrollButtons={false}
            sx={{
              minHeight: 42, flex: 1,
              '& .MuiTab-root': { fontSize: 12, fontWeight: 600, textTransform: 'none', minHeight: 42, py: 0, px: 1.5 },
              '& .Mui-selected': { color: '#1E3A8A' },
              '& .MuiTabs-indicator': { bgcolor: '#1E3A8A', height: 2.5 },
            }}>
            {TAB_LABELS.map((label, i) => (
              <Tab key={label} label={
                <Stack direction="row"  spacing={0.5}>
                  <span>{label}</span>
                  <Box sx={{ px: 0.75, py: 0.1, bgcolor: tab === i ? '#1E3A8A' : '#f1f5f9', borderRadius: 99, minWidth: 18, textAlign: 'center', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: tab === i ? '#fff' : '#64748b', lineHeight: 1.6 }}>
                      {tabCounts[i]}
                    </Typography>
                  </Box>
                </Stack>
              } />
            ))}
          </Tabs>
          <TextField size="small" placeholder="Search cycles…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            slotProps={{ input: { startAdornment: <InputAdornment ><SearchIcon sx={{ fontSize: 15, color: '#94a3b8', position: 'start' }} /></InputAdornment> } }}
            sx={{ ml: 1.5, width: 200, flexShrink: 0, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, height: 32 } }}
          />
        </Stack>

        {/* Table */}
        <TableContainer sx={{ flex: 1, overflow: 'overflow', '&::-webkit-scrollbar': { width: 0, height: 0 } }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={headerSx}>
                  <TableSortLabel
                    active={sortConfig.key === 'name'}
                    direction={sortConfig.key === 'name' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Cycle Name
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={headerSx}>
                  <TableSortLabel
                    active={sortConfig.key === 'period'}
                    direction={sortConfig.key === 'period' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('period')}
                  >
                    Period
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={headerSx}>
                  <TableSortLabel
                    active={sortConfig.key === 'stage'}
                    direction={sortConfig.key === 'stage' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('stage')}
                  >
                    Stage
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={headerSx}>
                  <TableSortLabel
                    active={sortConfig.key === 'status'}
                    direction={sortConfig.key === 'status' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={headerSx}>Actions</TableCell>

              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedRows.map((cycle) => {
                const stageId   = cycle.current_stage?.id ?? 1;
                const stageName = cycle.current_stage
                  ? (stages.find(s => s.id === cycle.current_stage.id)?.name ?? cycle.current_stage.name)
                  : (stages[0]?.name ?? '—');
                const canDelete = cycle.status === 'DRAFT';
                const isActive  = cycle.status === 'ACTIVE';

                return (
                  <TableRow key={cycle.id} hover
                    sx={{
                      height: 40, cursor: 'default',
                      bgcolor: isActive ? 'rgba(30,58,138,0.02)' : 'transparent',
                      '&:hover': { bgcolor: isActive ? 'rgba(30,58,138,0.05)' : '#f8fafc' },
                    }}
                  >

                    <TableCell sx={{ maxWidth: 240, pl: 2 }}>
                      <Stack direction="row"  spacing={1} sx={{ alignItems: 'center' }}>
                        {isActive && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />}
                        <Box sx={{ minWidth: 0 }} >
                          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1E3A8A' }} noWrap>{cycle.name}</Typography>
                          {cycle.description && (
                            <Typography sx={{ fontSize: 11, color: '#94a3b8' }} noWrap>{cycle.description}</Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                    </TableCell>

                    <TableCell>
                      <Stack direction="row"  spacing={0.75} sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                          {stageId}
                        </Box>
                        <Typography sx={{ fontSize: 12, color: '#475569' }} noWrap>{stageName}</Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Chip label={cycle.status.replace('_', ' ')} size="small"
                        sx={{ fontSize: 10, height: 20, fontWeight: 700, borderRadius: 99, ...(STATUS_STYLES[cycle.status] ?? STATUS_STYLES.DRAFT) }} />
                    </TableCell>

                    <TableCell onClick={e => e.stopPropagation()} sx={{ pr: 1.5 }}>
                      <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex' }} >
                          <Tooltip title="Open Cycle">
                            <IconButton size="small"
                              onClick={e => { e.stopPropagation(); navigate(ROUTES.CYCLE_DETAIL.replace(':id', cycle.id)); }}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' }, p: 0.4 }}>
                              <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                          {/* only visible to admin and manager */}
                          {canManageCyclesActions && (
                            <>
                              <Tooltip title="KRA Assignment">
                                <IconButton size="small"
                                  onClick={e => { e.stopPropagation(); navigate(`${ROUTES.ASSIGNMENTS}?cycleId=${cycle.id}`); }}
                                  sx={{ color: '#94a3b8', '&:hover': { color: '#0369a1' }, p: 0.4 }}>
                                  <AssignmentIndIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="KRA Assessment">
                                <IconButton size="small"
                                  onClick={e => { e.stopPropagation(); navigate(`${ROUTES.ASSESSMENTS_SELF}?cycleId=${cycle.id}`); }}
                                  sx={{ color: '#94a3b8', '&:hover': { color: '#7c3aed' }, p: 0.4 }}>
                                  <RateReviewIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        {canManageCycles && (
                          <>
                            <Tooltip title="Clone">
                              <IconButton size="small"
                                onClick={e => { e.stopPropagation(); navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', 'new')}?clone=${cycle.id}`); }}
                                sx={{ color: '#94a3b8', '&:hover': { color: '#1E3A8A' }, p: 0.4 }}>
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={canDelete ? 'Delete' : 'Only draft cycles can be deleted'}>
                              <span>
                                <IconButton size="small" disabled={!canDelete}
                                  onClick={e => { e.stopPropagation(); if (canDelete) { setDeleteTarget(cycle); setDeleteError(''); setDeleteOpen(true); } }}
                                  sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' }, '&.Mui-disabled': { color: '#e2e8f0' }, p: 0.4 }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredAndSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#94a3b8', fontSize: 13 }}>
                    {search ? `No cycles match "${search}"` : 'No cycles found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Pagination footer — 6 rows per page ── */}
        <Stack direction="row"  
          sx={{ px: 2, py: 0.20, borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa', flexShrink: 0, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}  >
            {filteredAndSorted.length > 0
              ? `${page * ROWS_PER_PAGE + 1}–${Math.min((page + 1) * ROWS_PER_PAGE, filteredAndSorted.length)} of ${filteredAndSorted.length}`
              : '0 results'}
          </Typography>
          <TablePagination
            rowsPerPageOptions={[ROWS_PER_PAGE]}
            component="div"
            count={filteredAndSorted.length}
            rowsPerPage={ROWS_PER_PAGE}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            sx={{
              border: 'none',
              '& .MuiToolbar-root': { minHeight: 28, px: 0 },
              '& .MuiTablePagination-displayedRows': { display: 'none' },
            }}
          />
        </Stack>
      </Paper>

      {/* ── Dialogs ── */}
      {confirm.open && confirm.action && (
        <ConfirmDialog
          open={confirm.open}
          title={ACTION_DIALOG_CONFIG[confirm.action]?.title}
          message={`Are you sure you want to ${ACTION_CONFIG[confirm.action]?.label?.toLowerCase()} "${confirm.cycle?.name}"?`}
          warning={
            confirm.action === 'CANCELLED' ? 'This action cannot be undone. All assignments will be permanently cancelled.'
              : confirm.action === 'CLOSED' ? 'Closing will lock all assessments. This cannot be reversed.'
              : confirm.action === 'ACTIVE' ? 'Activating will send email notifications to all VLs and HRs.'
              : null
          }
          confirmLabel={ACTION_DIALOG_CONFIG[confirm.action]?.confirmLabel}
          cancelLabel={ACTION_DIALOG_CONFIG[confirm.action]?.cancelLabel}
          confirmColor={ACTION_CONFIG[confirm.action]?.confirmColor}
          loading={confirmLoading}
          error={confirmError}
          onClose={() => { setConfirm({ open: false, action: null, cycle: null }); setConfirmError(''); }}
          onConfirm={handleConfirmAction}
        />
      )}
      <ConfirmDialog
        open={advanceConfirm.open}
        title="Advance Stage"
        message={`Move "${advanceConfirm.cycle?.name}" to Stage ${advanceConfirm.toStage?.id}: "${advanceConfirm.toStage?.name}"?`}
        warning="All enrolled employees will be moved to the new stage."
        confirmLabel="Advance Stage"
        confirmColor="#1E3A8A"
        loading={advanceLoading}
        error={advanceError}
        onClose={() => { setAdvanceConfirm({ open: false, toStage: null, cycle: null }); setAdvanceError(''); }}
        onConfirm={handleAdvanceStage}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Cycle"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="#dc2626"
        loading={deleteLoading}
        error={deleteError}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={rollbackConfirm.open}
        title="Roll Back Stage"
        message={`Roll back "${activeCycle?.name}" to Stage ${rollbackConfirm.stage?.id}: "${rollbackConfirm.stage?.name}"?`}
        warning="All employees will be moved back to this stage. You will set new dates on the next page."
        confirmLabel="Roll Back"
        confirmColor="#9a3412"
        loading={false}
        error=""
        onClose={() => setRollbackConfirm({ open: false, stage: null })}
        onConfirm={() => {
          navigate(`${ROUTES.CYCLE_DETAIL.replace(':id', activeCycle.id)}?rollback=${rollbackConfirm.stage.id}`);
          setRollbackConfirm({ open: false, stage: null });
        }}
      />
    </Box>
  );
}