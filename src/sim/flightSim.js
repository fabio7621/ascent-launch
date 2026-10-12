// 兩級火箭飛行模擬：極座標近似（含離心項）、指數大氣、跨音速阻力峰值、重力轉彎與二級高度保持導引
// 飛行模擬：兩級火箭，極座標近似（含離心項）、指數大氣、重力轉彎
export function runSim() {
  const g0 = 9.80665, R = 6371000, MU = 3.986004e14;
  const P0 = 101325;
  const AREA = Math.PI * 4.5 * 4.5;
  function atmo(h) {
    h = Math.max(0, h);
    // 溫度：簡化美國標準大氣
    let T;
    if (h < 11000) T = 288.15 - 0.0065 * h;
    else if (h < 20000) T = 216.65;
    else if (h < 32000) T = 216.65 + 0.001 * (h - 20000);
    else if (h < 47000) T = 228.65 + 0.0028 * (h - 32000);
    else if (h < 51000) T = 270.65;
    else if (h < 71000) T = 270.65 - 0.0028 * (h - 51000);
    else if (h < 86000) T = 214.65 - 0.002 * (h - 71000);
    else T = 186.65 + Math.min(1, (h - 86000) / 40000) * 200;
    const rho = 1.225 * Math.exp(-h / 8500);
    const p = P0 * Math.exp(-h / 7900);
    const a = Math.sqrt(1.4 * 287.05 * T);
    return { rho, p, a, T };
  }
  function cd(mach) {
    // 細長圓柱體的阻力係數隨馬赫數的典型曲線（跨音速峰值）
    if (mach < 0.8) return 0.42;
    if (mach < 1.1) return 0.42 + (mach - 0.8) / 0.3 * 0.5;
    if (mach < 1.6) return 0.92 - (mach - 1.1) / 0.5 * 0.32;
    return Math.max(0.3, 0.6 - (mach - 1.6) * 0.05);
  }

  // 一級 Super Heavy（33 具 Raptor）
  const B = { dry: 275e3, prop: 3400e3, Fsl: 74.4e6, IspSl: 327, IspVac: 350, reserve: 0.075 };
  B.Fvac = B.Fsl * B.IspVac / B.IspSl;
  B.Ae = (B.Fvac - B.Fsl) / P0; // 噴嘴出口總面積（推力隨外界壓力變化）
  // 二級 Starship（3 海平面 + 3 真空 Raptor）
  const S = { dry: 120e3, prop: 1500e3, Fvac: 14.7e6, Isp: 368, Ae: 18 };

  const dt = 0.02;
  const G_LIM = 2.6, KICK = 0.045, H_TGT = 175000;
  let t = 0, h = 0, x = 0, vh = 0, vx = 0;
  let mB = B.prop, mS = S.prop; // 剩餘推進劑
  let stage = 1, events = {}, samples = [];
  let shipLit = false, sepDone = false, tMECO = null, tSep = null, tSECO = null;
  let kicked = false, theta = 0, maxQ = 0, maxG = 0;
  let boost = null; // 分離後的一級狀態
  const SAMPLE = 0.1;
  let nextSample = 0;
  let engB = 33, engS = 0;

  function gAt(h) { return MU / ((R + h) * (R + h)); }

  while (t < 560) {
    const A = atmo(h);
    const v = Math.hypot(vh, vx);
    const mach = v / A.a;
    const q = 0.5 * A.rho * v * v;
    let thr = 0, F = 0, mdot = 0, mass, mdotB = 0, mdotS = 0;
    // 一級節流：Max-Q 附近降至 72%，末段降推力限制過載
    if (stage === 1) {
      engB = 33;
      thr = 1.0;
      if (t > 46 && t < 74) thr = 0.72 + 0.28 * Math.max(0, Math.abs(t - 60) - 10) / 4;
      thr = Math.min(1, thr);
      // 過載限制：感受加速度不超過 G_LIM
      const mNow = B.dry + mB + S.dry + mS;
      const thrG = (G_LIM * g0 * mNow + (engB / 33) * B.Ae * A.p) / B.Fvac;
      thr = Math.max(0.4, Math.min(thr, thrG));
      const usable = B.prop * (1 - B.reserve);
      if (B.prop - mB >= usable && tMECO === null) { tMECO = t; events.meco = t; }
      if (tMECO !== null) { engB = 3; thr = 3 / 33 * 0.8; }
      F = thr * B.Fvac - (engB / 33) * B.Ae * A.p;
      mdotB = thr * B.Fvac / (B.IspVac * g0);
      mass = B.dry + mB + S.dry + mS;
      // 熱分離：MECO 後 1.2 s 二級點火，3.4 s 分離
      if (tMECO !== null && t - tMECO > 1.2) {
        shipLit = true; engS = 6;
        F += S.Fvac - S.Ae * A.p; mdotS = S.Fvac / (S.Isp * g0);
        if (!events.shipIgn) events.shipIgn = t;
      }
      if (tMECO !== null && t - tMECO > 3.4) {
        stage = 2; tSep = t; events.sep = t;
        boost = { h, x, vh, vx, m: B.dry + mB, prop: mB, theta, phase: 'flip', t0: t, eng: 0 };
      }
    }
    if (stage === 2) {
      engS = 6;
      if (tSECO === null) {
        F = S.Fvac - S.Ae * A.p; mdotS = S.Fvac / (S.Isp * g0);
        const vorb = Math.sqrt(MU / (R + h));
        // 次軌道測試：接近軌道速度（約 26,000 km/h）時關機
        if (vx >= 7200 || mS < S.prop * 0.04) { tSECO = t; events.seco = t; }
      } else { F = 0; mdot = 0; engS = 0; }
      mass = S.dry + mS;
    }

    // 導引
    if (stage === 1) {
      if (t < 7) theta = 0;
      else if (!kicked) { theta = Math.min(KICK, (t - 7) * KICK / 10); if (t > 17) kicked = true; }
      else theta = Math.atan2(vx, vh); // 重力轉彎：推力沿速度方向
    } else {
      // 二級：真空中用線性正切近似，把飛行路徑角從分離時慢慢壓平
      // 二級：簡化的高度保持導引（PD），讓航跡在目標高度附近變平
      const geff = gAt(h) - vx * vx / (R + h);
      const tau = 140;
      const aCmd = 2 * (H_TGT - h) / (tau * tau) - 2 * vh / tau;
      const aT = Math.max(1e-3, (S.Fvac - S.Ae * A.p) / (S.dry + mS));
      const sp = Math.max(-0.35, Math.min(0.62, (aCmd + geff) / aT));
      const want = tSECO === null ? Math.PI / 2 - Math.asin(sp) : theta;
      const maxStep = 0.03 * dt; // 約 1.7°/s 的姿態變化率限制
      theta += Math.max(-maxStep, Math.min(maxStep, want - theta));
    }
    if (stage === 1 && tMECO !== null && events.gamSep === undefined && t - tMECO > 3.3) {
      events.gamSep = Math.atan2(vh, vx) + 0.06;
    }

    // 力
    const dragAcc = v > 0 ? q * cd(mach) * AREA / mass : 0;
    const ah = (F / mass) * Math.cos(theta) - (v > 0 ? dragAcc * vh / v : 0) - gAt(h) + vx * vx / (R + h);
    const ax = (F / mass) * Math.sin(theta) - (v > 0 ? dragAcc * vx / v : 0) - vh * vx / (R + h);
    const sensed = Math.hypot(ah + gAt(h) - vx * vx / (R + h), ax + vh * vx / (R + h)) / g0;

    if (q > maxQ && t > 5) { maxQ = q; events.maxQ = t; events.maxQAlt = h; events.maxQVal = q; }
    if (sensed > maxG) maxG = sensed;
    if (events.mach1 === undefined && mach >= 1) events.mach1 = t;
    if (events.sunlit === undefined && h >= 8700) events.sunlit = t;
    if (events.karman === undefined && h >= 100000) events.karman = t;

    // 一級分離後獨立模擬：翻轉 → 返回點火 → 彈道下落
    if (boost) {
      const b = boost, Ab = atmo(b.h), vb = Math.hypot(b.vh, b.vx);
      let Fb = 0, th = Math.atan2(b.vx, b.vh), mdb = 0;
      const age = t - b.t0;
      if (age < 9) { b.phase = 'flip'; b.eng = 0; }
      else if (b.vx > -350 && b.prop > 60e3) {
        b.phase = 'boostback'; b.eng = 13;
        Fb = 13 / 33 * B.Fvac * 0.9; mdb = Fb / (B.IspVac * g0);
        th = -Math.PI / 2 + 0.25; // 推力朝向發射場方向
      } else { b.phase = 'coast'; b.eng = 0; }
      if (b.phase === 'boostback' && !events.boostback) events.boostback = t;
      const qb = 0.5 * Ab.rho * vb * vb;
      const db = vb > 0 ? qb * 1.1 * AREA / b.m : 0;
      const bah = Fb / b.m * Math.cos(th) - (vb > 0 ? db * b.vh / vb : 0) - gAt(b.h) + b.vx * b.vx / (R + b.h);
      const bax = Fb / b.m * Math.sin(th) - (vb > 0 ? db * b.vx / vb : 0) - b.vh * b.vx / (R + b.h);
      b.vh += bah * dt; b.vx += bax * dt; b.h += b.vh * dt; if (b.h < 0) { b.h = 0; b.vh = 0; b.vx = 0; b.phase = 'splash'; } b.x += b.vx * dt * R / (R + b.h);
      b.prop -= mdb * dt; b.m -= mdb * dt;
      b.thrustDir = th;
    }

    if (t >= nextSample - 1e-9) {
      samples.push({
        t, h, x, vh, vx, v, q, mach, p: A.p, rho: A.rho, theta, g: sensed, stage,
        bProp: mB / B.prop, sProp: mS / S.prop,
        thrB: stage === 1 ? thr : 0, engB: stage === 1 ? engB : (boost ? boost.eng : 0),
        engS: shipLit && tSECO === null ? 6 : 0,
        bh: boost ? boost.h : h, bx: boost ? boost.x : x, bvh: boost ? boost.vh : vh, bvx: boost ? boost.vx : vx,
        bTheta: boost ? boost.thrustDir : theta, bPhase: boost ? boost.phase : 'attached'
      });
      nextSample += SAMPLE;
    }

    vh += ah * dt; vx += ax * dt;
    h += vh * dt; x += vx * dt * R / (R + h);
    if (h < 0) { h = 0; vh = Math.max(0, vh); }
    if (stage === 1) mB -= mdotB * dt;
    mS -= mdotS * dt;
    t += dt;
  }
  events.maxG = maxG;
  return { samples, events, dt: SAMPLE };
}
