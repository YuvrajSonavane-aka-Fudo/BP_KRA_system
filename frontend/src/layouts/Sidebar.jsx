import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Stack, Avatar,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LoopIcon from '@mui/icons-material/Loop';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import GroupsIcon from '@mui/icons-material/Groups';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LayersIcon from '@mui/icons-material/Layers';
import HelpIcon from '@mui/icons-material/Help';
import LogoutIcon from '@mui/icons-material/Logout';
import useAuth from '../auth/useAuth';
import ROUTES from '../config/routes';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: ROUTES.DASHBOARD },
  { label: 'KRA Cycles', icon: <LoopIcon fontSize="small" />, path: ROUTES.CYCLES },
  { label: 'KRAs Library', icon: <LibraryBooksIcon fontSize="small" />, path: ROUTES.KRA_LIBRARY },
  { label: 'KRA Assignment', icon: <GroupsIcon fontSize="small" />, path: ROUTES.ASSIGNMENTS },
  { label: 'Reviews', icon: <RateReviewIcon fontSize="small" />, path: ROUTES.TEAM_PERFORMANCE },
  { label: 'Reports', icon: <AssessmentIcon fontSize="small" />, path: ROUTES.REPORTS },
  { label: 'Levels', icon: <LayersIcon fontSize="small" />, path: ROUTES.LEVELS },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  async function handleLogout() {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <Box sx={{ width: 240, minHeight: '100vh', bgcolor: '#0f1b4c', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1.5, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography fontWeight={800} fontSize={16} color="#fff">A</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.2 }}>
            Executive Portal
            </Typography>

            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
            Admin Access
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Nav */}
      <List sx={{ px: 1.5, py: 1.5, flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path || (item.path !== ROUTES.DASHBOARD && location.pathname.startsWith(item.path));
          return (
            <ListItemButton
              key={item.label}
              onClick={() => navigate(item.path)}
              selected={active}
              sx={{
                borderRadius: 1.5, mb: 0.5, px: 1.5, py: 1,
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                bgcolor: active ? 'rgba(255,255,255,0.12) !important' : 'transparent',
                borderRight: active ? '3px solid #60a5fa' : '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' },
                transition: 'all 0.15s',
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={
                  <Typography sx={{ fontSize: 13.5, fontWeight: active ? 700 : 400 }}>
                    {item.label}
                  </Typography>
                }
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <List sx={{ px: 1.5, py: 1 }}>
        <ListItemButton sx={{ borderRadius: 1.5, px: 1.5, py: 0.8, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff' } }}>
          <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}><HelpIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={ <Typography sx={{ fontSize: 13 }}> Support </Typography> }/>
        </ListItemButton>
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 1.5, px: 1.5, py: 0.8, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff' } }}>
          <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={ <Typography sx={{ fontSize: 13 }}> Logout </Typography> }/>
        </ListItemButton>
      </List>

      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#2d4fd6', fontSize: 12, fontWeight: 700 }}>{initials}</Avatar>
          <Box overflow="hidden">
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#fff" }} noWrap>{user?.full_name || 'User'}</Typography>
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }} noWrap>{user?.roles?.[0] || 'Admin'}</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
