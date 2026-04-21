import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Stack, Avatar, Tooltip, IconButton,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import GroupsIcon from '@mui/icons-material/Groups';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LayersIcon from '@mui/icons-material/Layers';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import useAuth from '../auth/useAuth';
import ROUTES from '../config/routes';

const gradient = 'linear-gradient(135deg, #1E3A8A 0%, #00236f 100%)';
const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 60;

const NAV_ITEMS = [
  { label: 'Dashboard',      icon: <DashboardIcon fontSize="small" />,    path: ROUTES.DASHBOARD },
  { label: 'KRAs Library',   icon: <LibraryBooksIcon fontSize="small" />, path: ROUTES.KRA_LIBRARY },
  { label: 'KRA Assignment', icon: <GroupsIcon fontSize="small" />,       path: ROUTES.ASSIGNMENTS },
  { label: 'Reviews',        icon: <RateReviewIcon fontSize="small" />,   path: ROUTES.TEAM_PERFORMANCE },
  { label: 'Reports',        icon: <AssessmentIcon fontSize="small" />,   path: ROUTES.REPORTS },
];

export default function Sidebar({ onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    onToggle?.(next);
  }

  async function handleLogout() {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <Box
      sx={{
        width,
        minHeight: '100vh',
        bgcolor: '#0f1b4c',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* USER PROFILE + TOGGLE */}
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
          flexShrink: 0,
        }}
      >
        {/* Avatar + name */}
        <Stack direction="row" alignItems="center" spacing={collapsed ? 0 : 1.5} overflow="hidden">
          <Tooltip title={collapsed ? (user?.full_name || 'User') : ''} placement="right">
            <Avatar
              sx={{
                width: 36,
                height: 36,
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 1.5,
                background: gradient,
                flexShrink: 0,
                cursor: 'default',
              }}
            >
              {initials}
            </Avatar>
          </Tooltip>
          {!collapsed && (
            <Box overflow="hidden">
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1.2 }} noWrap>
                {user?.full_name || 'User'}
              </Typography>
              <Typography
                sx={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                }}
                noWrap
              >
                {user?.roles?.[0] || 'Admin'}
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Collapse / expand toggle — always in the header */}
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            onClick={handleToggle}
            size="small"
            sx={{
              flexShrink: 0,
              ml: collapsed ? 0 : 0.5,
              color: 'rgba(255,255,255,0.4)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* NAV ITEMS */}
      <List sx={{ px: collapsed ? 0.5 : 1.5, py: 1.5, flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active =
            location.pathname === item.path ||
            (item.path !== ROUTES.DASHBOARD && location.pathname.startsWith(item.path));

          const btn = (
            <ListItemButton
              key={item.label}
              onClick={() => navigate(item.path)}
              selected={active}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                px: collapsed ? 0 : 1.5,
                py: 1,
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                bgcolor: active ? 'rgba(255,255,255,0.12) !important' : 'transparent',
                borderRight: active ? '3px solid #60a5fa' : '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' },
                transition: 'all 0.15s',
                minHeight: 40,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 34,
                  color: 'inherit',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: 13.5, fontWeight: active ? 700 : 400 }}>
                      {item.label}
                    </Typography>
                  }
                />
              )}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.label} title={item.label} placement="right">
              {btn}
            </Tooltip>
          ) : (
            btn
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* STICKY LOGOUT */}
      <List sx={{ px: collapsed ? 0.5 : 1.5, py: 1, flexShrink: 0 }}>
        {collapsed ? (
          <Tooltip title="Logout" placement="right">
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 1.5,
                px: 0,
                py: 0.8,
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.45)',
                '&:hover': { color: '#fff' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        ) : (
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 1.5,
              px: 1.5,
              py: 0.8,
              color: 'rgba(255,255,255,0.45)',
              '&:hover': { color: '#fff' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={<Typography sx={{ fontSize: 13 }}>Logout</Typography>} />
          </ListItemButton>
        )}
      </List>
    </Box>
  );
}