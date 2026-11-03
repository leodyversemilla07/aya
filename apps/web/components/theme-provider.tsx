'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeController />
      {children}
    </>
  );
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  document.documentElement.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

function ThemeController() {
  const [, setTheme] = React.useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme') as Theme | null;
    const nextTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system';
    setTheme(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => {
      if (nextTheme === 'system') setResolvedTheme(applyTheme('system'));
    };
    mediaQuery.addEventListener('change', onSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', onSystemThemeChange);
  }, []);

  const toggleTheme = React.useCallback(() => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }, [resolvedTheme]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (event.key.toLowerCase() !== 'd' || isTypingTarget(event.target)) return;
      toggleTheme();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleTheme]);

  return null;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export { ThemeProvider };
