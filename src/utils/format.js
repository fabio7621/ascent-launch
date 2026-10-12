// 數字與任務時鐘格式
export const fmtNum = (v, d = 0) => (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export function clockOf(t) {
  const neg = t < 0, a = Math.abs(t);
  const hh = Math.floor(a / 3600), mm = Math.floor(a % 3600 / 60), ss = Math.floor(a % 60);
  const p = n => String(n).padStart(2, '0');
  return (neg ? 'T−' : 'T+') + p(hh) + ':' + p(mm) + ':' + p(ss);
}
export const mmss = t => { const a = Math.max(0, Math.round(t)); return Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); };
