'use client';

import * as React from 'react';
import { useColorScheme } from '@mui/joy';
import IconButton from '@mui/joy/IconButton';
import Menu from '@mui/joy/Menu';
import MenuItem from '@mui/joy/MenuItem';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import Tooltip from '@mui/joy/Tooltip';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun03Icon, Moon02Icon, ComputerIcon } from '@hugeicons/core-free-icons';

type Mode = 'light' | 'dark' | 'system';

const OPTIONS: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Light',  icon: <HugeiconsIcon icon={Sun03Icon}     size={16} /> },
  { value: 'dark',   label: 'Dark',   icon: <HugeiconsIcon icon={Moon02Icon}      size={16} /> },
  { value: 'system', label: 'System', icon: <HugeiconsIcon icon={ComputerIcon} size={16} /> },
];

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const open = Boolean(anchorEl);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // En SSR y primer render renderiza un placeholder del mismo tamaño
  // para evitar layout shift
  if (!mounted) {
    return (
      <div className="absolute top-4 right-4 z-[999]">
        <IconButton variant="soft" size="sm" disabled aria-label="Toggle color theme">
          <HugeiconsIcon icon={ComputerIcon} size={16} />
        </IconButton>
      </div>
    );
  }

  const current = OPTIONS.find(o => o.value === mode) ?? OPTIONS[2];

  return (
    <div className="absolute top-4 right-4 z-[999]">
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