import type { WhatsNewLabels, WhatsNewTheme } from './types';

export const defaultTheme: WhatsNewTheme = {
  background: '#FFFFFF',
  text: '#111114',
  secondaryText: '#6B6B76',
  accent: '#007AFF',
  onAccent: '#FFFFFF',
  dot: '#D1D1D6',
  backdrop: 'rgba(0, 0, 0, 0.4)',
  radius: 28,
  fonts: {},
};

export const darkTheme: WhatsNewTheme = {
  background: '#1C1C1E',
  text: '#F5F5F7',
  secondaryText: '#A1A1AA',
  accent: '#0A84FF',
  onAccent: '#FFFFFF',
  dot: '#48484A',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  radius: 28,
  fonts: {},
};

export const defaultLabels: WhatsNewLabels = {
  next: 'Continue',
  done: 'Got it',
  close: 'Close',
  page: (index, count) => `Page ${index} of ${count}`,
};

export type WhatsNewThemeInput = Partial<Omit<WhatsNewTheme, 'fonts'>> & {
  fonts?: WhatsNewTheme['fonts'];
};

export function mergeTheme(
  base: WhatsNewTheme,
  partial: WhatsNewThemeInput | undefined
): WhatsNewTheme {
  if (!partial) return base;
  return { ...base, ...partial, fonts: { ...base.fonts, ...partial.fonts } };
}

export function mergeLabels(
  partial: Partial<WhatsNewLabels> | undefined
): WhatsNewLabels {
  return partial ? { ...defaultLabels, ...partial } : defaultLabels;
}
