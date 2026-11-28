/** 생성 시각(ISO, +09:00 등)에서 날짜 부분(앞 10자)만. 형식이 이상하면 fallback */
export const dateOnly = (iso: string, fallback: string): string => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : fallback);

export const formatBytes = (n: number): string => (n < 1024 ? `${n}B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);
