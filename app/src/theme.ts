import { useColorScheme } from 'react-native';

import type { FontScale } from './lib/types';

const base = { primary: '#1D4ED8', warn: '#B45309', ok: '#15803D' };
export const light = {
  ...base, dark: false, bg: '#F4F6FA', card: '#FFFFFF', text: '#0F172A', sub: '#586274', faint: '#94A3B8',
  line: '#E2E8F0', primarySoft: '#DBEAFE', input: '#EEF2F7', danger: '#DC2626', warnSoft: '#FEF3C7', okSoft: '#DCFCE7', shadow: '0 1px 6px rgba(15,23,42,0.08)', onPrimary: '#FFFFFF',
};
export const dark = {
  ...base, dark: true, bg: '#0B0F1A', card: '#141A28', text: '#F1F5F9', sub: '#A3AEC2', faint: '#64748B',
  line: '#232C3F', primarySoft: '#16264D', input: '#1B2335', danger: '#F87171', warnSoft: '#3A2A0C', okSoft: '#0F2E1B', shadow: 'none', onPrimary: '#0B0F1A',
  primary: '#7CA5FF', warn: '#FBBF24', ok: '#4ADE80',
};
export type Theme = typeof light;
export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

export const FONT_SCALE: Record<FontScale, number> = { small: 0.9, normal: 1, large: 1.15, xlarge: 1.3 };
/** 설정 글자 크기를 반영한 글자 크기. 컴포넌트에서 fs(16) 처럼 쓴다 */
export const makeFs = (scale: FontScale) => (n: number) => Math.round(n * FONT_SCALE[scale] * 10) / 10;

export function useTheme(override: 'system' | 'light' | 'dark' = 'system'): Theme {
  const sys = useColorScheme();
  const mode = override === 'system' ? sys : override;
  return mode === 'dark' ? dark : light;
}
