// 頁面載入時先跑完整條模擬，之後捲動只是「依任務時間查表」，所以可以自由倒帶
import { runSim } from './flightSim.js';

export const SIM = runSim();
export const S = SIM.samples, EV = SIM.events;
export const R_E = 6371000, PAD_H = 22, P0 = 101325;
const KEYS = ['h', 'x', 'vh', 'vx', 'v', 'q', 'mach', 'p', 'rho', 'theta', 'g', 'bProp', 'sProp', 'bh', 'bx', 'bvh', 'bvx', 'bTheta', 'thrB'];
export function sampleAt(t) {
  const f = Math.min(S.length - 1.001, Math.max(0, t / SIM.dt));
  const i = Math.floor(f), a = f - i, A = S[i], B = S[i + 1];
  const o = { t };
  for (const k of KEYS) o[k] = A[k] + (B[k] - A[k]) * a;
  const N = a < 0.5 ? A : B;
  o.stage = N.stage; o.engB = N.engB; o.engS = N.engS; o.bPhase = N.bPhase;
  if (t < 0) { o.v = 0; o.vh = 0; o.vx = 0; o.q = 0; o.mach = 0; o.g = 1; o.thrB = 0; o.engB = 0; }
  return o;
}
function firstWhere(fn) { for (const s of S) if (fn(s)) return s; return S[S.length - 1]; }
const sMeco = firstWhere(s => s.t >= EV.meco);
const sSeco = firstWhere(s => s.t >= EV.seco);
EV.mecoAlt = sMeco.h; EV.mecoV = sMeco.v;
EV.secoAlt = sSeco.h; EV.secoV = sSeco.v;
EV.t90 = firstWhere(s => s.h >= 90000).t;
EV.p20 = firstWhere(s => s.h >= 20000).p / P0;
EV.end = EV.seco + 32;
export const LIFTOFF_MASS = 5295;
export const TWR = 74.4e6 / (LIFTOFF_MASS * 1000 * 9.80665);
