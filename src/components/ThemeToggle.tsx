'use client';

import * as React from 'react';
import { useColorScheme } from '@mui/joy';
import IconButton from '@mui/joy/IconButton';
import Menu from '@mui/joy/Menu';
import MenuItem from '@mui/joy/MenuItem';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import Tooltip from '@mui/joy/Tooltip';

// ── Iconos SVG inline (sin dependencias extra) ────────────────────────────────

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

type Mode = 'light' | 'dark' | 'system';

const OPTIONS: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Light',  icon: <SunIcon />    },
  { value: 'dark',   label: 'Dark',   icon: <MoonIcon />   },
  { value: 'system', label: 'System', icon: <SystemIcon /> },
];

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const current = OPTIONS.find(o => o.value === mode) ?? OPTIONS[2];

  return (
    <div className="absolute top-4 right-4 overflow-hidden">
      <Tooltip title="Color theme" placement="bottom">
        <IconButton
          variant="soft"
          size="sm"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Toggle color theme"
        >
          {current.icon}
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        placement="bottom-end"
        sx={{ minWidth: 140, zIndex: 9999 }}
      >
        {OPTIONS.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={mode === opt.value}
            onClick={() => {
              setMode(opt.value);
              setAnchorEl(null);
            }}
            sx={{
              gap: 1,
              fontSize: '0.875rem',
              '&.Mui-selected': {
                backgroundColor: 'var(--soft-bg-success)',
                color: 'var(--color-accent-500)',
              },
            }}
          >
            <ListItemDecorator>{opt.icon}</ListItemDecorator>
            {opt.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}