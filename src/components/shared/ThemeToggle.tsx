'use client';

import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ThemeToggleProps {
  variant?: 'outline' | 'ghost';
  className?: string;
}

export function ThemeToggle({ variant = 'outline', className = '' }: ThemeToggleProps = {}) {
  const t = useTranslations('common');
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size="icon"
            className={cn('size-8 sm:size-9 rounded-md', className)}
            aria-label={t('theme')}
            title={t('theme')}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-sky-400" />
            <span className="sr-only">{t('theme')}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>{t('light')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>{t('dark')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>{t('system')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
