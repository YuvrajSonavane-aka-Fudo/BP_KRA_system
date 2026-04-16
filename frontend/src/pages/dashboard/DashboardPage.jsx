import React, { useState } from 'react';
import {
  Box, Typography, Stack, Paper, Button, Chip,
  CircularProgress, Alert, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';
import { useCycles } from '../../hooks/useCycles';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';
const shadow = '0px 12px 32px -4px rgba(30,58,138,0.06)';

const STATUS_STYLES = {
  ACTIVE:  { bgcolor: '#dbeafe', color: '#1d4ed8' },
  DRAFT:   { bgcolor: '#f1f5f9', color: '#64748b' },
  CLOSED:  { bgcolor: '#dcfce7', color: '#15803d' },
};

const STAGES = [
  'KRA Assignment By Lead',
  'KRA Tracking',
  'Assessment',
  'HR Validation',
  'Closure',
];

function StageStepper({ currentStageId }) {
  return (
    <Box sx={{ position: 'relative', mt: 2, px: 1 }}>
      <Box sx={{ position: 'absolute', top: 11, left: 12, right: 12, height: 2, bgcolor: 'rgba(255,255,255,0.15)', zIndex: 0 }} />
      <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
        {STAGES.map((stage, i) => {
          const n = i + 1;
          const done = n < currentStageId;
          const active = n === currentStageId;
          return (
            <Stack key={stage} alignItems="center" spacing={0.5}>
              <Box sx={{
                width: active ? 28 : 20, height: active ? 28 : 20, borderRadius: '50%',
                bgcolor: done || active ? '#fff' : 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                outline: active ? '3px solid rgba(255,255,255,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
                {done && <Typography sx={{ fontSize: 9, color: '#1E3A8A', fontWeight: 800 }}>✓</Typography>}
                {active && <Typography sx={{ fontSize: 9, color: '#1E3A8A', fontWeight: 800 }}>0{n}</Typography>}
              </Box>
              <Typography sx={{
                fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                letterSpacing: '0.02em', textAlign: 'center', maxWidth: 60, lineHeight: 1
              }}>
                {stage}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: allCycles, loading, error, refetch } = useCycles();
  
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const activeCycles  = allCycles?.filter(c => c.status === 'ACTIVE')  ?? [];
  const draftCycles   = allCycles?.filter(c => c.status === 'DRAFT')   ?? [];
  const closedCycles  = allCycles?.filter(c => c.status === 'CLOSED')  ?? [];
  const activeCycle   = activeCycles[0] ?? null;

  const currentListData = tabValue === 0 ? draftCycles : closedCycles;

  const handleChangeTab = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress sx={{ color: '#1E3A8A' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={<Button size="small" onClick={refetch} startIcon={<RefreshIcon />}>Retry</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E3A8A' }}>Performance Dashboard</Typography>
          <Typography sx={{ fontSize: 12, color: '#64748b' }}>Overview of KRA cycles and performance status</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={refetch} startIcon={<RefreshIcon />} sx={{ color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            Refresh
          </Button>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate(ROUTES.CYCLE_CREATE)}
            sx={{ background: gradient, color: '#fff', fontWeight: 700, px: 2, borderRadius: 1.5, '&:hover': { background: gradient, opacity: 0.9 } }}
          >
            New Cycle
          </Button>
        </Stack>
      </Stack>

      {/* Summary Cards Row */}
      <Stack direction="row" spacing={2} mb={1.5}>
        {[
          { label: 'Total', value: allCycles?.length ?? 0, icon: <TrendingUpIcon fontSize="small" />, color: '#1E3A8A', bg: '#eff6ff' },
          { label: 'Active', value: activeCycles.length, icon: <TrendingUpIcon fontSize="small" />, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Draft', value: draftCycles.length, icon: <PendingActionsIcon fontSize="small" />, color: '#d97706', bg: '#fffbeb' },
          { label: 'Closed', value: closedCycles.length, icon: <CheckCircleOutlineIcon fontSize="small" />, color: '#64748b', bg: '#f8fafc' },
        ].map(({ label, value, icon, color, bg }) => (
          <Paper key={label} elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 2, border: '1px solid rgba(197,197,211,0.2)', bgcolor: bg }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ color, display: 'flex' }}>{icon}</Box>
              <Box>
                <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{label}</Typography>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* Active Cycle Section */}
      {activeCycle && (
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(197,197,211,0.2)', mb: 1.5, flexShrink: 0 }}>
          <Box sx={{ background: gradient, p: 2, color: '#fff' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Chip label="Currently Active" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', mb: 0.5 }} />
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.1 }}>{activeCycle.name}</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(219,234,254,0.8)' }}>{activeCycle.start_date} — {activeCycle.end_date}</Typography>
              </Box>
              <Button
                size="small"
                onClick={() => navigate(ROUTES.CYCLES)}
                sx={{ bgcolor: '#fff', color: '#1E3A8A', fontWeight: 700, borderRadius: 1.5, fontSize: 12, '&:hover': { bgcolor: '#eff6ff' } }}
              >
                Manage
              </Button>
            </Stack>
            <StageStepper currentStageId={activeCycle.current_stage?.id ?? 1} />
          </Box>
        </Paper>
      )}

      {/* Tabs Section - Remaining Space */}
      <Paper elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid rgba(197,197,211,0.2)', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc' }}>
          <Tabs value={tabValue} onChange={handleChangeTab} size="small" sx={{ minHeight: 40 }}>
            <Tab label="Draft Cycles" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40 }} />
            <Tab label="Closed Cycles" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40 }} />
          </Tabs>
        </Box>
        
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>Cycle Name</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>Start Date</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>End Date</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentListData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((cycle) => (
                <TableRow key={cycle.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{cycle.name}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{cycle.start_date}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{cycle.end_date}</TableCell>
                  <TableCell>
                    <Chip 
                      label={cycle.status} 
                      size="small" 
                      sx={{ fontSize: 9, fontWeight: 700, height: 20, ...STATUS_STYLES[cycle.status] }} 
                    />
                  </TableCell>
                </TableRow>
              ))}
              {currentListData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: '#94a3b8', fontSize: 12 }}>No cycles found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5]}
          component="div"
          count={currentListData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          sx={{ borderTop: '1px solid #f3f4f5' }}
        />
      </Paper>
    </Box>
  );
}