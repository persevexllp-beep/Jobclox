'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from './theme-constants';

export type ThemeMode = 'light' | 'dark';

const themeListeners = new Set<() => void>();

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(stored) ? stored : null;
}

function readDomTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  const root = document.documentElement;
  const datasetTheme = root.dataset.theme;
  if (isThemeMode(datasetTheme)) return datasetTheme;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function initializeTheme(): ThemeMode {
  const theme = readStoredTheme() ?? getSystemTheme();
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: ThemeMode) {
  applyTheme(theme);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  notifyThemeListeners();
}

export function toggleTheme() {
  const nextTheme = readDomTheme() === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

export function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, readDomTheme, () => 'light');
}
