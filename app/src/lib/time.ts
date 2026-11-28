/** "방금", "N분 전", "N시간 전", "어제", "N일 전" */
export function relative(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86_400) return `${Math.floor(s / 3600)}시간 전`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? '어제' : `${d}일 전`;
}

const WD = '일월화수목금토';
/** '2026-11-27' → '11월 27일 (금)' (연도가 다르면 연도 포함) */
export function dateLabel(date: string, now: Date = new Date()): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y === now.getFullYear() ? '' : `${y}년 `}${m}월 ${d}일 (${wd})`;
}
export const slotLabel = (slot: 'am' | 'pm') => (slot === 'am' ? '아침' : '저녁');
