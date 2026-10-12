// 程序化貼圖：外殼（不鏽鋼、焊縫、結霜、煙灰、隔熱瓦）與各種小貼圖
import * as THREE from 'three';

let maxAniso = 4;
export function setMaxAnisotropy(n) { maxAniso = Math.min(8, n); }

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = maxAniso;
  return t;
}
export function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// 外殼貼圖：逐像素生成高度圖 → 顏色 / 粗糙度+金屬度 / 法線
// 鋼環高 1.83 m，每圈有一條縱向焊縫；薄壁鋼板在焊縫之間微微外鼓（oil canning），每圈鋼捲色調略有不同
export function hullTextures(heightM, opt) {
  const { frost = [], tiles = null, seed = 1, soot = 'none', gores = 0, W = 1024, H = 2048, marks = 'none' } = opt;
  const rnd = rand(seed);
  const RING = 1.83, circM = 2 * Math.PI * 4.5;
  const pxM = H / heightM, pxMx = W / circM;
  // 低頻雜訊格（u 方向週期）
  const GX = 64, GY = Math.max(8, Math.round(64 * heightM / circM));
  const grid = new Float32Array(GX * GY); for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const n2 = (u, v, f) => {
    const x = u * GX * f, y = v * GY * f, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const gx = GX * f | 0, gy = GY * f | 0;
    const g = (a, b) => grid[(((b % gy) + gy) % gy % GY) * GX + ((((a % gx) + gx) % gx) % GX)];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  // 縱向拉絲：每一欄一個隨機漫步值
  const colS = new Float32Array(W); { let v = 0; for (let x = 0; x < W; x++) { v = v * 0.9 + (rnd() - 0.5) * 0.9; colS[x] = v; } }
  const colSoot = new Float32Array(W); { let v = 0; for (let x = 0; x < W; x++) { v = v * 0.7 + (rnd() - 0.5); colSoot[x] = Math.max(0, v); } }
  // 每圈鋼環的參數
  const nR = Math.ceil(heightM / RING) + 1;
  const ring = []; for (let i = 0; i < nR; i++) ring.push({ seam: rnd(), tint: rnd() - 0.5, amp: 0.4 + rnd() * 0.6, warm: rnd() });
  const goreSeams = []; for (let i = 0; i < gores; i++) goreSeams.push((i + 0.15 * (rnd() - 0.5)) / gores);
  const hgt = new Float32Array(W * H);
  const col = new Uint8ClampedArray(W * H * 4), rm = new Uint8ClampedArray(W * H * 4);
  const S3 = Math.sqrt(3), HEX = 5.6; // 隔熱瓦：六角形，約 0.3 m
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const frostEdge = frost.map(() => [rnd() * 10, rnd() * 10]);

  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H, m = v * heightM;
    let ri, f, distWeldM;
    if (gores) { ri = Math.floor(m / 5.5); f = (m % 5.5) / 5.5; distWeldM = Math.min(m % 5.5, 5.5 - m % 5.5); }
    else { ri = Math.floor(m / RING); f = (m % RING) / RING; distWeldM = Math.min(m % RING, RING - m % RING); }
    const R = ring[Math.min(ri, nR - 1)];
    const beadH = Math.exp(-Math.pow(distWeldM * pxM / 1.5, 2));
    const bulge = Math.sin(f * Math.PI) * R.amp;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, i = y * W + x, o = i * 4;
      // 縱向焊縫
      let sd;
      if (gores) { sd = 1; for (const g of goreSeams) { const d = Math.abs(u - g); sd = Math.min(sd, Math.min(d, 1 - d)); } }
      else { const d = Math.abs(u - R.seam); sd = Math.min(d, 1 - d); }
      const seamH = Math.exp(-Math.pow(sd * W / 1.4, 2));
      const weld = Math.max(beadH, seamH);
      const dent = n2(u, v, 1) - 0.5, dentF = n2(u, v, 4) - 0.5;
      let h = bulge * 0.7 + weld * 0.7 + dent * 0.9 + dentF * 0.35;
      // ---- 不鏽鋼底色 ----
      const tone = 192 + R.tint * 36 + colS[x] * 4.5 + dentF * 14 + (rnd() - 0.5) * 6;
      let r = tone - 2 + R.warm * 3, g = tone + 1, b = tone + 5 - R.warm * 4;
      // 焊道熱色（淡金、偏藍）
      const heat = Math.exp(-Math.pow((gores ? sd * W : Math.min(distWeldM * pxM, sd * W)) / 4.5, 2));
      r += heat * (R.warm > 0.5 ? 10 : -14); g += heat * (R.warm > 0.5 ? -4 : -10); b += heat * (R.warm > 0.5 ? -30 : 8);
      r -= weld * 62; g -= weld * 62; b -= weld * 58;
      let rough = 0.27 + R.tint * 0.1 + Math.abs(colS[x]) * 0.03 + weld * 0.35, metal = 0.72 - weld * 0.25;
      // ---- 結霜 ----
      for (let k = 0; k < frost.length; k++) {
        const [a, bb] = frost[k], [e1, e2] = frostEdge[k];
        const a2 = a + (n2(u + e1, 0.3, 2) - 0.5) * 1.2, b2 = bb + (n2(u + e2, 0.7, 3) - 0.5) * 1.6;
        let fr = smooth(a2, a2 + 0.25, m) * (1 - smooth(b2 - 0.5, b2, m));
        if (fr <= 0) continue;
        const patchy = 0.45 + 0.75 * n2(u * 1.7, v * 1.3, 3);
        const thin = smooth(b2 - 3.5, b2 - 0.2, m); // 霜線附近變薄、成片狀
        fr *= Math.min(1, patchy * (1 - thin * 0.6) + 0.25);
        const grain = rnd();
        const fc = 214 + grain * 30 - (1 - patchy) * 20;
        r = r + (fc - r) * fr; g = g + (fc + 4 - g) * fr; b = b + (fc + 9 - b) * fr;
        h += fr * (0.5 + grain * 0.9) - fr * bulge * 0.4;
        rough = rough + (0.92 - rough) * fr; metal = metal + (0.06 - metal) * fr;
      }
      // ---- 煙灰 ----
      let st = 0;
      if (soot === 'booster') st = (1 - smooth(0.5, 7, m)) * 0.85 + colSoot[x] * 0.22 * Math.exp(-m / 6) + (1 - smooth(0, 1.2, Math.abs(m - heightM + 0.6))) * 0.35;
      if (soot === 'ship') st = (1 - smooth(0, 2.4, m)) * 0.7 + colSoot[x] * 0.1 * Math.exp(-m / 2);
      if (st > 0) { st = Math.min(0.9, st); r = r + (58 - r) * st; g = g + (52 - g) * st; b = b + (48 - b) * st; rough = rough + (0.75 - rough) * st; metal = metal + (0.3 - metal) * st; }
      // ---- 隔熱瓦 ----
      if (tiles) {
        const px = u * W, py = y;
        const q = (S3 / 3 * px - py / 3) / HEX, rr = (2 / 3 * py) / HEX;
        let cx = q, cz = rr, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
        const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
        if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
        const ccx = HEX * S3 * (rx + rz / 2), ccy = HEX * 1.5 * rz;
        const cu = ccx / W;
        if (cu > tiles[0] && cu < tiles[1]) {
          const ax = Math.abs(px - ccx), ay = Math.abs(py - ccy);
          const edge = HEX * 0.866 - Math.max(ax, ax * 0.5 + ay * 0.866);
          const id = hash((rx * 7349 + rz * 1931) | 0);
          const gap = edge < 0.75 ? 1 : 0;
          let tv = 27 + id * 12;
          if (id > 0.975) tv = 74 + id * 10;      // 換過的新瓦片顏色較淺
          if (id < 0.006) tv = 210;              // 少數白色的保護塞
          tv += (rnd() - 0.5) * 4 + (ay / HEX) * 4;
          r = g = b = gap ? 12 : tv; b += gap ? 0 : 2;
          h = gap ? 0 : 1.3 + (id - 0.5) * 0.2;
          rough = gap ? 0.95 : 0.78; metal = 0.04;
        }
      }
      col[o] = r; col[o + 1] = g; col[o + 2] = b; col[o + 3] = 255;
      rm[o] = 0; rm[o + 1] = Math.min(1, rough) * 255; rm[o + 2] = metal * 255; rm[o + 3] = 255;
      hgt[i] = h;
    }
  }
  // 法線：由高度圖的差分求得（u 方向環繞）
  const nrm = new Uint8ClampedArray(W * H * 4), K = 0.55;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, o = i * 4;
    const hL = hgt[y * W + (x - 1 + W) % W], hR = hgt[y * W + (x + 1) % W];
    const hU = hgt[Math.max(0, y - 1) * W + x], hD = hgt[Math.min(H - 1, y + 1) * W + x];
    let nx = (hL - hR) * K * 0.5, ny = (hD - hU) * K * 0.5, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nrm[o] = (nx * 0.5 + 0.5) * 255; nrm[o + 1] = (ny * 0.5 + 0.5) * 255; nrm[o + 2] = (nz * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
  }
  const toTex = (data, after) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.putImageData(new ImageData(data, W, H), 0, 0);
    if (after) after(g);
    const t = new THREE.CanvasTexture(c); t.anisotropy = maxAniso;
    return t;
  };
  const yOf = mm => (1 - mm / heightM) * H;
  const color = toTex(col, g => {
    // 對位標記、快接板、檢修蓋（通用標記，無品牌）
    g.fillStyle = 'rgba(18,18,20,.85)';
    if (marks === 'booster') {
      for (let mm = 3 * RING; mm < heightM - 3; mm += 3 * RING) { const yy = yOf(mm); g.fillRect(W * 0.04, yy - 9, 4, 18); g.fillRect(W * 0.54, yy - 9, 4, 18); }
      g.fillStyle = 'rgba(30,30,33,.92)'; g.fillRect(W * 0.62, yOf(5.2), W * 0.05, yOf(2.4) - yOf(5.2));
      g.fillStyle = 'rgba(70,72,76,.9)'; g.fillRect(W * 0.625, yOf(5.0), W * 0.04, 6); g.fillRect(W * 0.625, yOf(3), W * 0.04, 6);
      g.font = '700 30px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(20,20,22,.8)';
      g.save(); g.translate(W * 0.115, yOf(52)); g.rotate(-Math.PI / 2); g.fillText('B-17', 0, 0); g.restore();
      for (let k = 0; k < 6; k++) { const yy = yOf(66 - k * 0.5); g.fillStyle = 'rgba(25,25,28,.85)'; g.fillRect(W * 0.3, yy, W * 0.012, 5); }
    }
    if (marks === 'ship') {
      g.fillStyle = 'rgba(30,30,33,.9)'; g.fillRect(W * 0.86, yOf(3.6), W * 0.04, yOf(1.6) - yOf(3.6));
      g.font = '700 26px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(20,20,22,.8)';
      g.save(); g.translate(W * 0.9, yOf(30)); g.rotate(-Math.PI / 2); g.fillText('S-31', 0, 0); g.restore();
      for (let mm = 2 * RING; mm < heightM - 2; mm += 2 * RING) { const yy = yOf(mm); g.fillStyle = 'rgba(18,18,20,.8)'; g.fillRect(W * 0.8, yy - 7, 3, 14); }
    }
  });
  return { color, rm: toTex(rm), normal: toTex(nrm) };
}
// 襟翼用的隔熱瓦貼圖（4 m × 4 m 一格）
export function tileTexture() {
  const W = 512, H = 512, rnd = rand(91), S3 = Math.sqrt(3), HEX = 7.5;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#0c0c0d'; g.fillRect(0, 0, W, H);
  for (let rz = -1; rz * HEX * 1.5 < H + HEX * 2; rz++) for (let rx = -Math.ceil(rz / 2) - 1; HEX * S3 * (rx + rz / 2) < W + HEX * 2; rx++) {
    const cx = HEX * S3 * (rx + rz / 2), cy = HEX * 1.5 * rz; const v = 24 + rnd() * 14 | 0;
    g.fillStyle = rnd() > 0.97 ? `rgb(${v + 45},${v + 45},${v + 47})` : `rgb(${v},${v},${v + 2})`;
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * (HEX - 0.9), cy + Math.sin(a) * (HEX - 0.9)); } g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.25, 0.25);
  t.anisotropy = maxAniso;
  return t;
}
