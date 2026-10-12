// 彩蛋：黑騎士衛星（Black Knight satellite）
// 外型參考 1998 年 STS-88 任務照片裡那個黑色、扭曲、像翅膀的物體（官方認為是太空漫步時遺失的隔熱毯）。
// 這裡把它做成傳說版本：皺摺的暗色主體、捲曲的翼片、長尾桿，以及會慢慢脈動的「遠古電路」紋路。
import * as THREE from 'three';
import { canvasTex, rand } from './textures.js';

// ---- 可重現的 3D 值雜訊（只在建模時用） ----
function makeNoise(seed) {
  const r = rand(seed), P = new Uint8Array(512), perm = [];
  for (let i = 0; i < 256; i++) perm.push(i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const h = (x, y, z) => P[P[P[x & 255] + (y & 255)] + (z & 255)] / 255;
  const s = t => t * t * (3 - 2 * t);
  const n3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), fx), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx), fy),
             l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx), fy), fz);
  };
  return (x, y, z, oct = 4) => { let a = 0.5, f = 1, v = 0; for (let i = 0; i < oct; i++) { v += a * n3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return v; };
}

export function createBlackKnight({ envMap, flareTex }) {
  const fbm = makeNoise(1960);
  const group = new THREE.Group();
  const tumble = new THREE.Group(); group.add(tumble);
  const L = 34; // 主體長度（公尺）

  // 表面：暗色帶金屬光澤，夾雜皺摺的銀色箔片；另一張貼圖是會發光的電路紋
  const skin = canvasTex(1024, 512, (g, w, h) => {
    const r = rand(77);
    g.fillStyle = '#121317'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 14 + r() * 26 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + r() * 0.5})`; g.fillRect(r() * w, r() * h, 2 + r() * 30, 1 + r() * 4); }
    for (let i = 0; i < 70; i++) { // 箔片
      const x = r() * w, y = r() * h, s = 10 + r() * 60;
      const gr = g.createLinearGradient(x, y, x + s, y + s * 0.6);
      gr.addColorStop(0, 'rgba(140,146,156,0)'); gr.addColorStop(0.5, `rgba(${170 + r() * 50 | 0},${172 + r() * 46 | 0},${180 + r() * 40 | 0},${0.35 + r() * 0.4})`); gr.addColorStop(1, 'rgba(140,146,156,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + r() * s * 0.4); g.lineTo(x + s * 0.7, y + s * 0.7); g.lineTo(x - s * 0.2, y + s * 0.5); g.fill();
    }
  });
  const glyph = canvasTex(1024, 512, (g, w, h) => {
    const r = rand(1899);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineCap = 'square';
    for (let k = 0; k < 46; k++) { // 正交走線＋節點，像古老的電路
      let x = r() * w, y = r() * h; g.lineWidth = r() < 0.2 ? 2.5 : 1.2; g.globalAlpha = 0.35 + r() * 0.65;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { if (r() < 0.5) x += (r() - 0.5) * 180; else y += (r() - 0.5) * 120; g.lineTo(x, y); }
      g.stroke();
      g.beginPath(); g.arc(x, y, 2 + r() * 3, 0, Math.PI * 2); g.stroke();
    }
    // 符文：在 3×3 格點上隨機連線，畫成類似未知文字的記號
    g.globalAlpha = 0.95; g.lineWidth = 1.6;
    for (let k = 0; k < 22; k++) {
      const cx = r() * w, cy = r() * h, s = 6 + r() * 5;
      g.beginPath();
      for (let n = 0; n < 4; n++) {
        const a = [(r() * 3 | 0) - 1, (r() * 3 | 0) - 1], b = [(r() * 3 | 0) - 1, (r() * 3 | 0) - 1];
        g.moveTo(cx + a[0] * s, cy + a[1] * s); g.lineTo(cx + b[0] * s, cy + b[1] * s);
      }
      g.stroke();
      if (r() < 0.4) { g.beginPath(); g.arc(cx, cy, s * 0.45, 0, Math.PI * 2); g.stroke(); }
    }
  });
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: skin, roughness: 0.42, metalness: 0.72, envMap, envMapIntensity: 1.2,
    emissive: 0xff5a26, emissiveMap: glyph, emissiveIntensity: 0.4, side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.38, metalness: 0.85, envMap, envMapIntensity: 1.3 });

  // ---- 主體：扭轉、彎曲、皺摺的長條 ----
  const bodyGeo = new THREE.BoxGeometry(L, 4.2, 9.5, 140, 10, 34);
  {
    const p = bodyGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const u = v.x / L + 0.5;
      // 剖面：靠前端鼓起、尾端收尖
      const prof = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.55) * (1 - 0.55 * Math.pow(u, 3)) + 0.04;
      let y = v.y * prof * (0.8 + 0.5 * fbm(u * 3, 1, 0, 2)), z = v.z * prof;
      // 扭轉
      const tw = (u - 0.3) * 1.9, c = Math.cos(tw), s = Math.sin(tw);
      [y, z] = [y * c - z * s, y * s + z * c];
      // 彎曲
      y += Math.sin(u * Math.PI) * 3.2 - u * u * 2.0;
      z += u * u * 5.5 - 1.5;
      // 皺摺：低頻折痕 + 中頻 + 細皺紋
      const nx = v.x * 0.16, ny = y * 0.4, nz = z * 0.22;
      const fold = (fbm(nx, ny, nz, 3) - 0.5) * 3.2 * prof;
      const wrin = (fbm(nx * 4.1, ny * 3.0, nz * 4.1, 2) - 0.5) * 0.7;
      const crease = Math.abs(Math.sin(v.x * 0.9 + fbm(nx, nz, 3, 2) * 6)) * 0.55 * prof;
      y += fold + wrin - crease * 0.6;
      z += (fbm(nx + 7, ny, nz, 3) - 0.5) * 2.4 * prof + wrin * 0.6;
      p.setXYZ(i, v.x, y, z);
    }
    bodyGeo.computeVertexNormals();
  }
  const body = new THREE.Mesh(bodyGeo, mat);
  tumble.add(body);

  // ---- 翼片：兩片捲曲的薄片 ----
  function wing(w, h, curl, seed) {
    const g = new THREE.PlaneGeometry(w, h, 60, 30);
    const p = g.attributes.position, nf = makeNoise(seed);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), u = x / w + 0.5, vv = y / h + 0.5;
      const edge = Math.pow(vv, 1.4);
      let z = Math.sin(u * Math.PI) * curl * edge + (nf(x * 0.35, y * 0.35, 1, 3) - 0.5) * 2.6 * edge + Math.sin(x * 1.3 + y * 0.6) * 0.25;
      const yy = y * (1 - 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 2));
      p.setXYZ(i, x, yy, z);
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
  const w1 = wing(17, 11, 4.5, 3); w1.position.set(-3, 5.5, 1.5); w1.rotation.set(-0.5, 0.25, 0.18); tumble.add(w1);
  const w2 = wing(13, 8, -3.5, 9); w2.position.set(1, -4.5, 2.5); w2.rotation.set(2.6, -0.2, -0.1); tumble.add(w2);

  // ---- 尾桿（分叉）與鉤狀突起 ----
  const tube = (pts, r, seg = 80) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))), seg, r, 10, false), dark);
  tumble.add(tube([[15, 1.0, 3.6], [22, 2.2, 5.4], [30, 1.6, 8.0], [38, -0.8, 9.6], [44, -2.6, 10.2]], 0.42));
  tumble.add(tube([[44, -2.6, 10.2], [47, -1.0, 12.4], [49, 0.6, 13.0]], 0.24, 30));
  tumble.add(tube([[44, -2.6, 10.2], [47.5, -4.8, 10.6], [50, -5.6, 9.4]], 0.24, 30));
  tumble.add(tube([[-14, 1.5, -2.5], [-18, 4.5, -3.2], [-19.5, 7.5, -1.2], [-17.5, 8.6, 0.8]], 0.55, 50));
  // 中段的環狀結構與三個暗晶體節點
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.32, 12, 48), dark); ring.position.set(-6, 1.8, -0.4); ring.rotation.set(0.4, 1.2, 0); tumble.add(ring);
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.15, metalness: 0.9, envMap, emissive: 0xff3c14, emissiveIntensity: 0.6 });
  [[-6, 1.8, -0.4], [6, 2.6, 0.6], [-11, 0.9, -1.8]].forEach(([x, y, z], i) => {
    const n = new THREE.Mesh(new THREE.OctahedronGeometry(i ? 0.8 : 1.15, 0), nodeMat); n.position.set(x, y, z); n.scale.y = 1.6; tumble.add(n);
  });

  // 紅色信標（讓人在把玩時能發現它）
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0x000000 }));
  beacon.position.set(-6, 1.8, -0.4); beacon.scale.setScalar(14); tumble.add(beacon);

  // 周圍漂浮的碎片
  const shards = new THREE.Group();
  {
    const r = rand(13);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.2 + r() * 0.45, 0), dark);
      const a = r() * Math.PI * 2, d = 18 + r() * 14;
      m.position.set(Math.cos(a) * d, (r() - 0.5) * 10, Math.sin(a) * d * 0.6);
      m.rotation.set(r() * 6, r() * 6, r() * 6); m.userData.spin = (r() - 0.5) * 0.8;
      shards.add(m);
    }
  }
  group.add(shards);

  // 看不見的點擊範圍：物體在翻滾，輪廓一直變，用球體讓它比較好點到
  const hitProxy = new THREE.Mesh(new THREE.SphereGeometry(24, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hitProxy);
  const pickables = [hitProxy];
  group.visible = false;

  function update(now, focus = 0) {
    // 慢速翻滾（照片裡的物體看起來在旋轉）
    tumble.rotation.set(now * 0.021, now * 0.034 + 0.6, Math.sin(now * 0.05) * 0.35);
    shards.rotation.y = now * 0.01;
    shards.children.forEach(m => { m.rotation.x += m.userData.spin * 0.01; m.rotation.y += m.userData.spin * 0.013; });
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.9);
    mat.emissiveIntensity = 0.18 + 0.55 * pulse * pulse + focus * 0.6;
    nodeMat.emissiveIntensity = 0.4 + 0.9 * pulse + focus;
    const blink = (Math.sin(now * 2.4) > 0.6 ? 1 : 0.08);
    beacon.material.color.setRGB(3.0 * blink, 0.35 * blink, 0.15 * blink);
  }

  return { group, pickables, update, radius: 30 };
}
