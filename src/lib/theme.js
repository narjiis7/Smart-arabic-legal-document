import { writable } from 'svelte/store';

const STORAGE_KEY = 'legal_app_theme';

/** @returns {'light' | 'dark'} */
export function readInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** @param {'light' | 'dark'} t */
export function applyTheme(t) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light';
}

/** @type {import('svelte/store').Writable<'light' | 'dark'>} */
export const theme = writable('light');

export function initTheme() {
  const t = readInitialTheme();
  applyTheme(t);
  theme.set(t);
}

/** @param {'light' | 'dark'} next */
export function setTheme(next) {
  const t = next === 'dark' ? 'dark' : 'light';
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
  theme.set(t);
}

export function toggleTheme() {
  theme.update((cur) => {
    const next = cur === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
    return next;
  });
}
