// 捲動位置 → 任務時間。各章節的起點每次 resize／字型載入後重新量測
import { EV } from '../sim/flightData.js';

export function useScrollMission() {
  const marks = { a: 0, s: 0, e: 1, fin: Infinity };
  function measure() {
    const asc = document.getElementById('ascent'), sp = document.getElementById('space'), fin = document.getElementById('finale');
    if (!asc || !sp) return;
    const top = el => el.getBoundingClientRect().top + scrollY;
    marks.a = top(asc);
    marks.s = top(sp);
    // 太空章節的任務時間在「摘要屏」進場前跑完
    marks.e = Math.max(marks.s + 10, (fin ? top(fin) : top(sp) + sp.offsetHeight) - innerHeight * 0.35);
    marks.fin = fin ? top(fin) : Infinity;
  }
  const ASCENT_KEYS = [[0, 0], [0.12, 10], [0.28, 38], [0.42, 60], [0.55, 100], [0.64, 138], [0.69, EV.meco - 3], [0.9, EV.sep + 16], [1, EV.t90]];
  function timeFromScroll(y) {
    const { a, s, e } = marks;
    if (y < a) { const u = Math.max(0, (y / a - 0.12) / 0.88); return -10 + 10 * u; }
    if (y < s) {
      // 分段對應：熱分離前後放慢（大約每 5vh 一秒），像慢動作
      const u = (y - a) / (s - a);
      const K = ASCENT_KEYS;
      for (let i = 1; i < K.length; i++) if (u <= K[i][0]) { const [u0, t0] = K[i - 1], [u1, t1] = K[i]; return t0 + (t1 - t0) * (u - u0) / (u1 - u0); }
      return EV.t90;
    }
    const u = Math.min(1, (y - s) / (e - s));
    return EV.t90 + (EV.end - EV.t90) * Math.pow(u, 1.15);
  }
  return { marks, measure, timeFromScroll };
}
