// three.js 場景：發射台、火箭、尾焰、天空與地球、粒子、鏡頭
// 以「發射場座標」建構世界，每一幀把整個世界平移＋旋轉，讓火箭永遠在原點（避免 float32 抖動）
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBlackKnight } from './blackKnight.js';
import { EV, R_E, PAD_H, P0, sampleAt } from '../sim/flightData.js';
import { NOISE, smokeFrag, lightingGLSL } from './glsl.js';
import { canvasTex, rand, hullTextures, tileTexture, setMaxAnisotropy } from './textures.js';

/**
 * 建立發射場景
 * @param {HTMLCanvasElement} canvas
 * @param {{ reduced?: boolean }} opts
 * @returns {{ state, update(now:number, dt:number):void, render():void, resize():void, dispose():void, B_ENG, S_ENG }}
 */
export function createLaunchScene(canvas, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 6e6);
  const V3 = THREE.Vector3, ZAX = new V3(0, 0, 1);

  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
  });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.6, 0.82);
  composer.addPass(bloom);
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uShake: { value: 0 }, uExposure: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uShake, uExposure; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      void main(){
        vec2 cc = vUv - 0.5;
        float ca = 0.0012 + uShake * 0.006;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv - cc * ca).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv + cc * ca).b;
        col = aces(col * uExposure);
        col = pow(col, vec3(1.0/2.2));
        float v = smoothstep(1.05, 0.28, length(cc * vec2(1.0, 0.92)));
        col *= mix(0.62, 1.0, v);
        float n = fract(sin(dot(vUv * vec2(1271.3, 3117.7) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
        col += (n - 0.5) * 0.022;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  composer.addPass(finalPass);
  composer.setSize(innerWidth, innerHeight);

  /* ============================================================
     3. 天空＋地球：一個以光線追蹤畫完美球體的天幕
        地球不做網格（太大會有弦誤差），每個像素自己算與球的交點
     ============================================================ */
  const SUN_SITE = (() => { const e = THREE.MathUtils.degToRad(-3.0); return new V3(Math.cos(e) * 0.8, Math.sin(e), -Math.cos(e) * 0.6).normalize(); })();

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false,
    uniforms: {
      uUp: { value: new V3(0, 1, 0) }, uH: { value: 30 }, uSun: { value: SUN_SITE.clone() },
      uCamSite: { value: new V3() }, uToSite: { value: new THREE.Matrix3() }, uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uUp; uniform float uH; uniform vec3 uSun; uniform vec3 uCamSite; uniform mat3 uToSite; uniform float uTime;
      varying vec3 vDir;
      const float RE = 6371000.0;
      const vec3 BETA = vec3(0.17, 0.40, 0.95);
      ${NOISE}
      vec3 skyRad(vec3 d, float x, float dens, float sunUp, float muH, float limbOn){
        float c = dot(d, uSun);
        float sunAbove = sunUp - muH;
        float dayAmt = smoothstep(-0.02, 0.16, sunAbove);
        float twAmt = smoothstep(-0.2, 0.0, sunAbove);
        float xx = max(x, 0.0);
        float airV = dens / (xx + 0.035);
        vec3 scat = 1.0 - exp(-BETA * airV * 0.9);
        float airS = dens * 0.5 / max(sunAbove + 0.06, 0.012);
        vec3 sunT = exp(-BETA * airS * 1.4);
        float phase = 0.75 * (1.0 + c * c) + 2.0 * pow(max(c, 0.0), 12.0);
        vec3 col = scat * sunT * phase * (0.04 + 0.96 * dayAmt) * twAmt * 1.1;
        // 暮光天頂：深藍
        col += vec3(0.010, 0.026, 0.075) * twAmt * (1.0 - dayAmt) * (1.0 - exp(-airV * 1.5)) * (0.3 + 0.7 * dens);
        vec3 hd = normalize(d - uUp * dot(d, uUp) + 1e-6);
        vec3 hs = normalize(uSun - uUp * dot(uSun, uUp) + 1e-6);
        float az = dot(hd, hs);
        // 朝太陽方向的曙光帶
        float duskAmt = twAmt * (1.0 - smoothstep(0.05, 0.28, sunAbove));
        vec3 dusk = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.6, 0.28), smoothstep(-0.08, 0.04, sunAbove));
        float band = exp(-xx * mix(90.0, 11.0, dens));
        col += dusk * band * pow(az * 0.5 + 0.5, 4.0) * duskAmt * (0.25 + 0.75 * dens) * 1.0;
        col += dusk * 0.22 * exp(-xx * 10.0) * pow(az * 0.5 + 0.5, 2.0) * duskAmt * dens;
        col += vec3(0.08, 0.1, 0.22) * exp(-xx * 6.0) * duskAmt * dens * 0.35;
        // 背光側：金星帶
        float anti = pow(max(0.5 - az * 0.5, 0.0), 1.5);
        col += vec3(0.28, 0.14, 0.24) * exp(-abs(xx - 0.06) * 24.0) * anti * duskAmt * dens * 0.35;
        // 高空看到的大氣薄邊
        float hz = sqrt(max(uH, 1.0) * (2.0 * RE + uH));
        float w = clamp(9000.0 / hz, 0.0025, 0.45);
        float limbAmt = (1.0 - smoothstep(0.003, 0.12, dens)) * limbOn;
        float limb = exp(-xx / w) * limbAmt;
        float limbLit = smoothstep(-0.55, 0.2, az * 0.55 + sunAbove * 2.0);
        vec3 limbCol = mix(vec3(1.0, 0.38, 0.12), vec3(0.32, 0.6, 1.0), smoothstep(-0.15, 0.45, az * 0.45 + sunAbove * 2.5));
        col += limbCol * limb * limbLit * 1.1;
        col += vec3(0.6, 0.85, 1.0) * exp(-xx / (w * 0.25)) * limbAmt * limbLit * 0.5;
        return col;
      }
      void main(){
        vec3 d = normalize(uToSite * normalize(vDir));
        float h = max(uH, 1.0);
        float mu = dot(d, uUp);
        float k = h * (2.0 * RE + h) / ((RE + h) * (RE + h));
        float muH = -sqrt(k);
        float dens = exp(-h / 8500.0);
        float sunUp = dot(uSun, uUp);
        vec3 col;
        if (mu < muH) {
          // ---- 地表 ----
          float t = (RE + h) * (-mu - sqrt(max(mu * mu - k, 0.0)));
          vec3 rel = d * t;
          vec3 n = normalize(uUp * (RE + h) + rel);
          vec3 sp = uCamSite + rel;
          float nearW = 1.0 - smoothstep(25000.0, 75000.0, length(sp.xz));
          vec3 q = n * 6.0;
          float big = fbm(q + vec3(fbm(q * 1.7 + 3.1)) * 1.3);
          float landFar = smoothstep(0.565, 0.59, big);
          float coast = 2600.0 + 1400.0 * (vnoise(vec3(sp.z / 5000.0, 1.0, 2.0)) - 0.5) - sp.z * 0.03;
          float landNear = 1.0 - smoothstep(coast - 25.0, coast + 25.0, sp.x);
          float land = mix(landFar, landNear, nearW);
          float det = fbm(n * 160.0) * (1.0 - nearW) + fbm(vec3(sp.xz / 220.0, 3.0)) * nearW;
          vec3 soil = mix(vec3(0.075, 0.07, 0.045), vec3(0.15, 0.13, 0.085), det);
          soil = mix(soil, vec3(0.05, 0.075, 0.04), smoothstep(0.55, 0.75, fbm(n * 55.0 + 4.0)) * (1.0 - nearW));
          // 海岸沙灘與潟湖
          float beach = (1.0 - smoothstep(0.0, 140.0, abs(sp.x - coast))) * nearW;
          soil = mix(soil, vec3(0.2, 0.18, 0.13), beach * 0.8);
          vec3 ocean = mix(vec3(0.006, 0.02, 0.042), vec3(0.008, 0.03, 0.075), 1.0 - nearW) * (0.85 + 0.3 * vnoise(vec3(sp.xz / 900.0, 1.0)));
          vec3 alb = mix(ocean, soil, land);
          float pool = exp(-dot(sp.xz, sp.xz) / (130.0 * 130.0)) * (1.0 - smoothstep(2000.0, 8000.0, h));
          alb = mix(alb, vec3(0.16, 0.16, 0.15), exp(-dot(sp.xz, sp.xz) / (60.0 * 60.0)));
          float ndl = dot(n, uSun);
          float day = smoothstep(-0.07, 0.22, ndl);
          vec3 sunC = mix(vec3(1.0, 0.5, 0.25), vec3(1.0, 0.97, 0.93), smoothstep(0.0, 0.14, ndl));
          float tw = smoothstep(-0.3, 0.0, ndl);
          vec3 surf = alb * (sunC * day * 2.4 + vec3(0.08, 0.1, 0.16) * tw * 0.6 + vec3(0.004, 0.006, 0.012));
          // 海面反光
          vec3 r = reflect(d, n);
          surf += alb * vec3(0.75, 0.82, 1.0) * pool * 1.4;
          surf += (1.0 - land) * pow(max(dot(r, uSun), 0.0), 220.0) * vec3(1.0, 0.6, 0.3) * 6.0 * smoothstep(-0.03, 0.04, ndl);
          // 夜側城市燈光
          float night = 1.0 - smoothstep(-0.14, 0.03, ndl);
          if (night * land * (1.0 - nearW) > 0.001) {
            float city = smoothstep(0.74, 0.92, vnoise(n * 900.0)) * smoothstep(0.42, 0.68, fbm(n * 38.0 + 7.0));
            surf += land * city * night * vec3(1.0, 0.62, 0.28) * 0.9 * (1.0 - nearW);
          }
          // 雲（只在高空開始看見，近地面改由 3D 雲粒子負責）
          float cloudVis = smoothstep(9000.0, 30000.0, h);
          float cl = 0.0;
          if (cloudVis > 0.0) cl = smoothstep(0.55, 0.75, fbm(n * 48.0 + vec3(fbm(n * 11.0) * 2.2))) * (0.55 + 0.45 * smoothstep(0.35, 0.6, fbm(n * 7.0 + 2.0)));
          surf = mix(surf, vec3(0.92, 0.94, 0.98) * (sunC * day * 1.3 + 0.01 + vec3(0.05,0.06,0.1)*tw*0.4), cl * cloudVis * 0.9);
          // 大氣透視
          float od = t * (8500.0 / h) * (1.0 - exp(-h / 8500.0));
          vec3 T = exp(-vec3(0.45, 0.75, 1.35) * od / 52000.0);
          vec3 hz = normalize(d - uUp * mu);
          vec3 haze = skyRad(normalize(hz + uUp * muH * 0.5), 0.01, 0.7, dot(uSun, n), 0.0, 0.0) * 0.6;
          col = surf * T + haze * (1.0 - T) * 0.75;
        } else {
          float x = mu - muH;
          col = skyRad(d, x, dens, sunUp, muH, 1.0);
          // 太陽本體
          float c = dot(d, uSun);
          float sunVis = smoothstep(muH - 0.004, muH + 0.004, sunUp);
          float airS = dens * 0.55 / max(sunUp - muH + 0.07, 0.012);
          col += vec3(1.0, 0.8, 0.6) * exp(-BETA * airS * 1.5) * smoothstep(0.99985, 0.99997, c) * 60.0 * sunVis;
          col += vec3(1.0, 0.7, 0.45) * pow(max(c, 0.0), 600.0) * 2.0 * sunVis * (1.0 - dens * 0.7);
          // 銀河（暗天空才看得見）
          vec3 mw = normalize(vec3(0.35, 0.55, -0.76));
          float b = dot(d, mw);
          float darkness = 1.0 - clamp(dot(col, vec3(0.33)) * 5.0, 0.0, 1.0);
          float glow = exp(-b * b / 0.012) * (0.4 + 0.8 * fbm(d * 7.0)) * (1.0 - smoothstep(0.0, 0.14, abs(b) - 0.02 * fbm(d*20.0)));
          col += vec3(0.09, 0.085, 0.11) * glow * darkness * smoothstep(0.0, 0.08, x);
        }
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // 星星
  const starGeo = (() => {
    const N = 7000, pos = new Float32Array(N * 3), mag = new Float32Array(N), col = new Float32Array(N * 3);
    const mw = new V3(0.35, 0.55, -0.76).normalize();
    for (let i = 0; i < N; i++) {
      let v;
      if (i < N * 0.45) { // 銀河帶附近較密
        v = new V3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
        const b = v.dot(mw); v.addScaledVector(mw, -b * 0.88).normalize();
      } else v = new V3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      pos.set([v.x, v.y, v.z], i * 3);
      mag[i] = Math.pow(Math.random(), 7.0);
      const tC = Math.random();
      const c = tC < 0.15 ? [1.0, 0.78, 0.6] : tC < 0.35 ? [0.75, 0.85, 1.0] : [1, 0.97, 0.94];
      col.set(c, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    return g;
  })();
  const starMat = new THREE.ShaderMaterial({
    transparent: false, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAlpha: { value: 0 }, uScale: { value: 1 }, uUp: { value: new V3(0, 1, 0) }, uMuH: { value: 0 }, uToSite: { value: new THREE.Matrix3() }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aMag; attribute vec3 aCol;
      uniform float uAlpha, uScale, uMuH, uTime; uniform vec3 uUp; uniform mat3 uToSite;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 d = normalize(position);
        float mu = dot(uToSite * d, uUp);
        float vis = smoothstep(uMuH + 0.002, uMuH + 0.05, mu);
        gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + d * 800.0, 1.0);
        gl_PointSize = (1.1 + aMag * 3.2) * uScale;
        vCol = aCol;
        vA = uAlpha * vis * (0.28 + aMag * 1.6) * (0.8 + 0.2 * sin(uTime * 2.3 + position.x * 913.0));
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vCol * a * vA * 1.6, 1.0); }`
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars);

  /* ============================================================
     4. 環境貼圖（不鏽鋼反射用）
     ============================================================ */
  // 以等距柱狀投影的 DataTexture 當環境貼圖，three.js 會自動做 PMREM 預濾波
  function makeEnv(kind) {
    const W = 256, H = 128, data = new Uint8Array(W * H * 4);
    const sunD = new V3(0.8, 0.02, -0.6).normalize();
    const flood1 = new V3(0.6, -0.05, 0.6).normalize(), flood2 = new V3(-0.6, -0.05, 0.7).normalize();
    const d = new V3();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const phi = u * Math.PI * 2, th = v * Math.PI;
      d.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
      const y = d.y; let r, g, bl;
      if (kind === 0) {
        const sd = Math.max(0, d.dot(sunD));
        if (y > 0) { const k = Math.pow(y, 0.45); r = 0.55 * (1 - k) + 0.05 * k; g = 0.32 * (1 - k) + 0.09 * k; bl = 0.3 * (1 - k) + 0.22 * k; }
        else { const k = Math.pow(-y, 0.3); r = 0.2 * (1 - k) + 0.05 * k; g = 0.13 * (1 - k) + 0.045 * k; bl = 0.11 * (1 - k) + 0.04 * k; }
        const glow = Math.pow(sd, 5) * (y > -0.2 ? 1 : 0.2);
        r += 1.0 * glow; g += 0.45 * glow; bl += 0.15 * glow;
        const f = Math.pow(Math.max(0, d.dot(flood1)), 40) + Math.pow(Math.max(0, d.dot(flood2)), 40);
        r += f * 0.9; g += f * 0.95; bl += f;
      } else {
        r = g = bl = 0;
        if (y < -0.12) { const k = Math.min(1, (-y - 0.12) * 3); r = 0.06 * k; g = 0.12 * k; bl = 0.2 * k; }
        const limb = Math.exp(-Math.abs(y + 0.12) * 28);
        r += 0.2 * limb; g += 0.4 * limb; bl += 0.8 * limb;
        const s = Math.pow(Math.max(0, d.dot(sunD)), 300); r += s; g += s * 0.95; bl += s * 0.9;
      }
      const o = (j * W + i) * 4;
      data[o] = Math.min(255, r * 255); data[o + 1] = Math.min(255, g * 255); data[o + 2] = Math.min(255, bl * 255); data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  }
  const envTw = makeEnv(0), envSpace = makeEnv(1);

  /* ============================================================
     5. 火箭模型（程序化：不鏽鋼、焊縫、結霜、隔熱瓦）
     ============================================================ */
  function steelMat(tex, extra = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: 0xffffff, map: tex.color, roughnessMap: tex.rm, metalnessMap: tex.rm, normalMap: tex.normal, normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 1, metalness: 1, envMap: envTw, envMapIntensity: 1.0
    }, extra));
  }
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2b2a29, metalness: 0.8, roughness: 0.45, envMap: envTw });
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTexture(), metalness: 0.05, roughness: 0.82, envMap: envTw, envMapIntensity: 0.35 });

  // 引擎噴嘴（鐘型）
  function bellGeo(r1, len) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const s = i / 12; pts.push(new THREE.Vector2(r1 * (0.34 + 0.66 * Math.pow(s, 0.62)), -len * s)); }
    return new THREE.LatheGeometry(pts, 24);
  }
  const bellMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, metalness: 0.75, roughness: 0.42, emissive: 0xff7a2a, emissiveIntensity: 0, side: THREE.DoubleSide, envMap: envTw });

  // 一級 33 具：中央 3、中圈 10、外圈 20
  const B_ENG = [];
  [[3, 1.05, 0.3], [10, 2.75, 0], [20, 3.92, 0.08]].forEach(([n, r, off], ring) => {
    for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; B_ENG.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ring, off: ((i * 7919) % 13) / 13 }); }
  });
  const S_ENG = [];
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * Math.PI * 2 / 3; S_ENG.push({ x: Math.cos(a) * 1.0, z: Math.sin(a) * 1.0, vac: false }); }
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; S_ENG.push({ x: Math.cos(a) * 2.95, z: Math.sin(a) * 2.95, vac: true }); }

  const stack = new THREE.Group(); scene.add(stack);
  const booster = new THREE.Group(); stack.add(booster);
  const ship = new THREE.Group(); ship.position.y = 71.5; stack.add(ship);

  // --- 一級 Super Heavy ---
  const BH = 69;
  const bTex = hullTextures(BH, { frost: [[4, 44], [46.5, 64]], seed: 7, soot: 'booster', marks: 'booster', W: 1024, H: 2048 });
  const bBody = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, BH, 128, 1, true), steelMat(bTex));
  bBody.position.y = BH / 2; booster.add(bBody);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(4.56, 4.62, 3.2, 96, 1, true), steelMat(bTex, { color: 0xb8bcc2 }));
  skirt.position.y = 1.4; booster.add(skirt);
  const aftDome = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), darkMetal); aftDome.rotation.x = Math.PI / 2; aftDome.position.y = 0.6; booster.add(aftDome);
  // 熱分離環（排氣口在分離時發光）
  const ringTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#9a9ea5'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { g.fillStyle = '#16171a'; g.fillRect(i * w / 24 + 8, 22, w / 24 - 16, h - 44); }
  });
  const ringGlow = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { g.fillStyle = '#ffffff'; g.fillRect(i * w / 24 + 10, 26, w / 24 - 20, h - 52); }
  });
  const ringMat = new THREE.MeshStandardMaterial({ map: ringTex, metalness: 0.85, roughness: 0.4, envMap: envTw, emissive: 0xff8a40, emissiveMap: ringGlow, emissiveIntensity: 0 });
  const hsRing = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2.5, 96, 1, true), ringMat);
  hsRing.position.y = BH + 1.25; booster.add(hsRing);
  for (let i = 0; i < 24; i++) { // 熱分離環的立柱
    const a = (i + 0.5) / 24 * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x7d8188, metalness: 0.8, roughness: 0.4, envMap: envTw }));
    strut.position.set(Math.cos(a) * 4.55, BH + 1.25, Math.sin(a) * 4.55); strut.rotation.y = -a; booster.add(strut);
  }
  const bTop = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), darkMetal); bTop.rotation.x = -Math.PI / 2; bTop.position.y = BH + 2.4; booster.add(bTop);
  // 柵格翼（4 片）
  const gridTex = canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(3, 3, w - 6, h - 6);
    for (let i = -h; i < w + h; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
  });
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x45464a, metalness: 0.85, roughness: 0.5, alphaMap: gridTex, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, envMap: envTw });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.9), gridMat);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.1, 0.35), darkMetal);
    const gF = new THREE.Group(); gF.add(fin);
    const box = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.25, 0.5), darkMetal); box.position.y = 1.5; gF.add(box);
    const box2 = box.clone(); box2.position.y = -1.5; gF.add(box2);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.1, 0.5), darkMetal); s1.position.x = 2.85; gF.add(s1);
    gF.position.set(Math.cos(a) * (4.5 + 2.9), 65.6, Math.sin(a) * (4.5 + 2.9));
    gF.rotation.y = -a; gF.rotation.x = 0.05;
    booster.add(gF);
    void frame;
  }
  // 線槽（chine / raceway）
  for (const a of [0.2, Math.PI + 0.2]) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 60, 0.5), new THREE.MeshStandardMaterial({ color: 0xa9aeb5, metalness: 0.7, roughness: 0.38, envMap: envTw }));
    ch.position.set(Math.cos(a) * 4.6, 33, Math.sin(a) * 4.6); ch.rotation.y = -a; booster.add(ch);
  }
  const bBells = new THREE.InstancedMesh(bellGeo(0.66, 1.8), bellMat, B_ENG.length);
  B_ENG.forEach((e, i) => { const m = new THREE.Matrix4().makeTranslation(e.x, 0.6, e.z); bBells.setMatrixAt(i, m); });
  booster.add(bBells);

  // --- 二級 Starship ---
  const SB = 33.5, NOSE = 16.5;
  const tileRange = [0.25, 0.75];
  const sTex = hullTextures(SB, { frost: [[1.5, 26]], tiles: tileRange, seed: 21, soot: 'ship', marks: 'ship', W: 1024, H: 1024 });
  const sBody = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, SB, 128, 1, true), steelMat(sTex));
  sBody.position.y = SB / 2; ship.add(sBody);
  const noseTex = hullTextures(NOSE, { tiles: tileRange, seed: 33, gores: 8, W: 1024, H: 512 });
  const noseGeo = (() => {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const s = i / 40; const y = s * NOSE; const r = 4.5 * Math.pow(1 - Math.pow(s, 2.1), 0.55); pts.push(new THREE.Vector2(Math.max(r, 0.001), y)); }
    return new THREE.LatheGeometry(pts, 128);
  })();
  const nose = new THREE.Mesh(noseGeo, steelMat(noseTex)); nose.position.y = SB; ship.add(nose);
  const sAft = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), darkMetal); sAft.rotation.x = Math.PI / 2; sAft.position.y = 0.2; ship.add(sAft);
  // 襟翼：位於隔熱瓦與不鏽鋼交界（u = 0.25 / 0.75 → ±x）
  function flap(w, h, taper) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w, h * taper * 0.25); sh.lineTo(w, h * (1 - taper * 0.15)); sh.lineTo(0, h); sh.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: false });
  }
  for (const side of [1, -1]) {
    const af = new THREE.Mesh(flap(3.6, 10.5, 1), tileMat);
    af.position.set(side * 4.35, 0.8, -0.22); if (side < 0) af.rotation.y = Math.PI; ship.add(af);
    const ff = new THREE.Mesh(flap(2.6, 7.2, 1.4), tileMat);
    ff.position.set(side * 3.2, SB + 3.2, -0.22); ff.rotation.z = side * -0.32; if (side < 0) { ff.rotation.y = Math.PI; ff.rotation.z = -0.32; } ship.add(ff);
  }
  // 後襟翼的鉸鏈整流罩（aerocover）
  for (const side of [1, -1]) {
    const cov = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 9.5, 20, 1, false, 0, Math.PI), tileMat);
    cov.position.set(side * 4.3, 6.2, 0.05); cov.rotation.y = side > 0 ? 0 : Math.PI; ship.add(cov);
  }
  const sBells = new THREE.Group(); ship.add(sBells);
  S_ENG.forEach(e => {
    const b = new THREE.Mesh(e.vac ? bellGeo(1.15, 3.0) : bellGeo(0.66, 1.8), bellMat);
    b.position.set(e.x, e.vac ? 0.8 : 0.4, e.z); sBells.add(b);
  });
  // 讓隔熱瓦與不鏽鋼的分界線面向主鏡頭
  ship.rotation.y = -1.75;

  /* ============================================================
     6. 尾焰
     ============================================================ */
  const plumeShader = {
    vertexShader: `
      uniform float uLen, uR0, uR1, uPow, uClose, uDia, uDiaN;
      varying float vS; varying vec3 vN; varying vec3 vV; varying float vAng; varying float vDist;
      void main(){
        float s = -position.y;
        float prof = uR0 + (uR1 - uR0) * (1.0 - pow(1.0 - s, uPow));
        prof *= 1.0 - uClose * pow(s, 2.5);
        prof *= 1.0 + uDia * 0.12 * cos(s * uDiaN * 6.2832) * (1.0 - s);
        vec3 p = vec3(position.x * prof, -s * uLen, position.z * prof);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
        vV = normalize(-mv.xyz); vS = s; vAng = atan(position.z, position.x); vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uI, uDia, uDiaN, uSoft, uFade, uLen;
      uniform vec3 uC0, uC1, uC2;
      varying float vS; varying vec3 vN; varying vec3 vV; varying float vAng; varying float vDist;
      ${NOISE}
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float body = pow(f, uSoft);
        vec3 q = vec3(cos(vAng) * 2.0, sin(vAng) * 2.0, vS * uLen * 0.06 - uTime * 7.0);
        float n = vnoise(q);
        float n2 = vnoise(q * 3.1 + vec3(0.0, 0.0, -uTime * 11.0));
        float dia = 1.0 + uDia * (1.6 * pow(0.5 + 0.5 * cos(vS * uDiaN * 6.2832), 8.0) - 0.35) * (1.0 - smoothstep(0.0, 0.55, vS));
        float fade = smoothstep(0.0, 0.025, vS) * (1.0 - smoothstep(uFade, 1.0, vS));
        vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.22, vS));
        col = mix(col, uC2, smoothstep(0.18, 0.9, vS));
        float a = body * fade * uI * (0.55 + 0.6 * n + 0.25 * n2) * dia * smoothstep(15.0, 90.0, vDist);
        gl_FragColor = vec4(col * max(a, 0.0), 1.0);
      }`
  };
  function makePlumeLayer() {
    const g = new THREE.CylinderGeometry(1, 1, 1, 48, 80, true); g.translate(0, -0.5, 0);
    const m = new THREE.ShaderMaterial({
      vertexShader: plumeShader.vertexShader, fragmentShader: plumeShader.fragmentShader,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      uniforms: {
        uLen: { value: 40 }, uR0: { value: 4 }, uR1: { value: 5 }, uPow: { value: 1 }, uClose: { value: 0.3 }, uDia: { value: 0 }, uDiaN: { value: 6 },
        uTime: { value: 0 }, uI: { value: 0 }, uSoft: { value: 1.5 }, uFade: { value: 0.5 },
        uC0: { value: new V3(3, 2.6, 2) }, uC1: { value: new V3(2, 1, 0.3) }, uC2: { value: new V3(0.5, 0.2, 0.05) }
      }
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    return mesh;
  }
  function makePlume(parent, y) {
    const core = makePlumeLayer(), env = makePlumeLayer(), halo = makePlumeLayer();
    [core, env, halo].forEach(m => { m.position.y = y; parent.add(m); });
    return { core, env, halo };
  }
  const bPlume = makePlume(booster, -1.1);
  const sPlume = makePlume(ship, -2.0);
  const boostbackPlume = makePlume(booster, -1.1);

  // 單一引擎小火焰（instanced）
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uLen: { value: 14 }, uWide: { value: 1.6 }, uTime: { value: 0 }, uI: { value: 0 }, uCol: { value: new V3(2.6, 1.6, 0.8) } },
    vertexShader: `
      attribute float aOn;
      uniform float uLen, uWide, uTime;
      varying float vS; varying float vOn; varying vec3 vN; varying vec3 vV;
      void main(){
        float s = -position.y;
        float r = mix(1.0, uWide, pow(s, 0.65));
        r *= 1.0 + 0.1 * sin(s * 22.0 - uTime * 50.0) * (1.0 - s);
        vec3 p = vec3(position.x * r, -s * uLen, position.z * r);
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vec4 mv = viewMatrix * wp;
        vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * vec3(position.x, 0.0, position.z));
        vV = normalize(-mv.xyz); vS = s; vOn = aOn;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uI; uniform vec3 uCol;
      varying float vS; varying float vOn; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
        float fade = smoothstep(0.0, 0.04, vS) * (1.0 - smoothstep(0.25, 1.0, vS));
        vec3 c = mix(vec3(3.5, 3.0, 2.6), uCol, smoothstep(0.0, 0.4, vS));
        float a = f * fade * uI * vOn;
        gl_FragColor = vec4(c * a, 1.0);
      }`
  });
  function makeFlames(parent, list, y, radius) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 14, 16, true); g.translate(0, -0.5, 0);
    const im = new THREE.InstancedMesh(g, flameMat.clone(), list.length);
    const on = new Float32Array(list.length);
    g.setAttribute('aOn', new THREE.InstancedBufferAttribute(on, 1));
    list.forEach((e, i) => {
      const r = typeof radius === 'function' ? radius(e) : radius;
      im.setMatrixAt(i, new THREE.Matrix4().compose(new V3(e.x, typeof y === 'function' ? y(e) : y, e.z), new THREE.Quaternion(), new V3(r, 1, r)));
    });
    im.frustumCulled = false; parent.add(im);
    return { mesh: im, on, attr: g.attributes.aOn };
  }
  const bFlames = makeFlames(booster, B_ENG, -1.15, 0.62);
  const sFlames = makeFlames(ship, S_ENG, e => e.vac ? -2.2 : -1.4, e => e.vac ? 1.08 : 0.62);
  // 熱分離排氣：從級間環向外噴
  const VENTS = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; VENTS.push({ a }); }
  const ventFlames = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 10, 10, true); g.translate(0, -0.5, 0);
    const im = new THREE.InstancedMesh(g, flameMat.clone(), VENTS.length);
    const on = new Float32Array(VENTS.length).fill(1);
    g.setAttribute('aOn', new THREE.InstancedBufferAttribute(on, 1));
    VENTS.forEach((v, i) => {
      const dir = new V3(Math.cos(v.a), -0.55, Math.sin(v.a)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), dir);
      im.setMatrixAt(i, new THREE.Matrix4().compose(new V3(Math.cos(v.a) * 4.4, BH + 1.25, Math.sin(v.a) * 4.4), q, new V3(1.1, 1, 1.1)));
    });
    im.frustumCulled = false; booster.add(im);
    im.material.uniforms.uCol.value.set(2.6, 1.0, 0.25);
    return im;
  })();

  // 跨音速凝結雲
  const vaporMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0 }, uTime: { value: 0 }, uLight: { value: new V3(0.3, 0.32, 0.38) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI, uTime; uniform vec3 uLight; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = vnoise(vec3(cos(vUv.x*6.2832)*3.0, sin(vUv.x*6.2832)*3.0, vUv.y * 5.0 - uTime * 3.0));
        float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
        float al = uI * edge * (0.35 + 0.65 * a) * (0.3 + 0.7 * f);
        gl_FragColor = vec4(uLight, clamp(al, 0.0, 0.85));
      }`
  });
  const vapor = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 10, 22, 64, 8, true), vaporMat);
  vapor.position.y = 76; stack.add(vapor);
  const vapor2 = new THREE.Mesh(new THREE.CylinderGeometry(4.65, 8.5, 14, 64, 8, true), vaporMat);
  vapor2.position.y = 104; stack.add(vapor2);

  /* ============================================================
     7. 世界群組（地面、發射塔、雲、煙）：以「發射場座標」建構，
        每一幀把整個世界平移＋旋轉，讓火箭永遠在原點（避免浮點抖動）
     ============================================================ */
  const world = new THREE.Group(); scene.add(world);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.95, metalness: 0.0 });
  // 發射台（OLM）
  const olm = new THREE.Group(); world.add(olm);
  const steelGrey = new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.75, roughness: 0.45, envMap: envTw });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 4.5, 6, 1, true), steelGrey); table.position.y = 19.8; olm.add(table);
  const tableTop = new THREE.Mesh(new THREE.RingGeometry(5, 9, 6, 1), steelGrey); tableTop.rotation.x = -Math.PI / 2; tableTop.position.y = 22; olm.add(tableTop);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 18, 2.4), steelGrey); leg.position.set(Math.cos(a) * 9, 9, Math.sin(a) * 9); olm.add(leg); }
  const deflector = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 1.2, 48), new THREE.MeshStandardMaterial({ color: 0x3d3b39, metalness: 0.6, roughness: 0.6 })); deflector.position.y = 0.6; olm.add(deflector);
  // 發射塔（桁架）
  const TOWER = { x: -27, z: -7, w: 10, h: 146 };
  const towerGroup = new THREE.Group(); towerGroup.position.set(TOWER.x, 0, TOWER.z); world.add(towerGroup);
  (() => {
    const mats = [];
    const W = TOWER.w / 2, bay = 9.1, H = TOWER.h;
    const add = (a, b, t) => mats.push([a, b, t]);
    const c = [[-W, -W], [W, -W], [W, W], [-W, W]];
    c.forEach(([x, z]) => add(new V3(x, 0, z), new V3(x, H, z), 1.0));
    for (let y = 0; y <= H; y += bay) {
      for (let i = 0; i < 4; i++) { const [x1, z1] = c[i], [x2, z2] = c[(i + 1) % 4]; add(new V3(x1, y, z1), new V3(x2, y, z2), 0.5); if (y + bay <= H) { add(new V3(x1, y, z1), new V3(x2, y + bay, z2), 0.32); add(new V3(x2, y, z2), new V3(x1, y + bay, z1), 0.32); } }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x4c4e52, metalness: 0.7, roughness: 0.55, envMap: envTw, envMapIntensity: 0.6 }), mats.length);
    const up = new V3(0, 1, 0);
    mats.forEach(([a, b, t], i) => {
      const d = b.clone().sub(a), L = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(up, d.normalize());
      im.setMatrixAt(i, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new V3(t, L, t)));
    });
    towerGroup.add(im);
    // 夾筷（catch arms）與托架
    const armMat = new THREE.MeshStandardMaterial({ color: 0x34363a, metalness: 0.7, roughness: 0.55, envMap: envTw, envMapIntensity: 0.5 });
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(13, 9, 13), armMat); carriage.position.y = 104; towerGroup.add(carriage);
    const toRocket = Math.atan2(-TOWER.z, -TOWER.x);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(31, 3.2, 2.2), armMat);
      const a = -toRocket + s * 0.42;
      arm.position.set(Math.cos(-a) * 20 , 104, Math.sin(-a) * 20 ); arm.rotation.y = a; towerGroup.add(arm);
    }
    // 頂部吊臂與避雷針
    const crane = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 1.6), armMat); crane.position.set(4, H + 1, 0); towerGroup.add(crane);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 18, 8), armMat); rod.position.y = H + 9; towerGroup.add(rod);
  })();
  // 船體快速接頭臂（QD arm）：點火前收回
  const qdPivot = new THREE.Group(); qdPivot.position.set(TOWER.x + 5, 90.5, TOWER.z + 2); world.add(qdPivot);
  const qdArm = new THREE.Mesh(new THREE.BoxGeometry(19, 2.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x55585d, metalness: 0.6, roughness: 0.5, envMap: envTw }));
  qdArm.position.x = 9.5; qdPivot.add(qdArm);
  qdPivot.rotation.y = -Math.atan2(-TOWER.z - 2, -TOWER.x - 5);
  const QD_BASE = qdPivot.rotation.y;
  // 塔燈與航空障礙燈
  const lightDotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6) });
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.1) });
  for (let y = 12; y < TOWER.h; y += 18.2) for (const [x, z] of [[5.4, 5.4], [5.4, -5.4]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lightDotMat); d.position.set(TOWER.x + x, y, TOWER.z + z); world.add(d); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), beaconMat); beacon.position.set(TOWER.x, TOWER.h + 18.5, TOWER.z); world.add(beacon);
  // 儲槽區與高棚
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xd4d7db, metalness: 0.6, roughness: 0.35, envMap: envTw, envMapIntensity: 0.7 });
  [[-260, -190, 7, 30], [-282, -168, 7, 30], [-245, -160, 5, 22], [-305, -205, 9, 26], [-230, -215, 4, 16], [-330, -150, 6, 24]].forEach(([x, z, r, h]) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), tankMat); t.position.set(x, h / 2, z); world.add(t);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), tankMat); cap.position.set(x, h, z); world.add(cap);
  });
  const winTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rand(4);
    for (let y = 10; y < h; y += 16) for (let x = 8; x < w; x += 12) if (r() < 0.45) { g.fillStyle = `rgba(255,${190 + r() * 50 | 0},${120 + r() * 60 | 0},${0.5 + r() * 0.5})`; g.fillRect(x, y, 6, 7); }
  });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.repeat.set(2, 2);
  const bldgMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8, metalness: 0.2, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.6 });
  [[-760, -520, 60, 92, 46], [-860, -380, 90, 40, 70], [-640, -640, 40, 28, 40], [-1100, -300, 120, 30, 60]].forEach(([x, z, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat); b.position.set(x, h / 2, z); world.add(b); });
  // 發射台照明
  const floods = [];
  [[70, 2, 90], [-90, 2, 70], [80, 2, -80]].forEach(([x, y, z]) => {
    const sl = new THREE.SpotLight(0xdde8ff, 0.75, 600, 0.26, 0.75, 1.0);
    sl.position.set(x, y, z); sl.target.position.set(0, 70, 0); world.add(sl); world.add(sl.target); floods.push(sl);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), lightDotMat); lamp.position.set(x, y + 1.5, z); world.add(lamp);
  });
  // 照明燈光束（體積光的近似：沿長度與邊緣淡出的加法錐體）
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uI: { value: 1 } },
    vertexShader: 'varying float vS; varying vec3 vN; varying vec3 vV; void main(){ vS = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uI; varying float vS; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = f * pow(vS, 1.6) * uI * 0.04; gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a, 1.0); }'
  });
  floods.forEach(sl => {
    const from = sl.position.clone(), to = new V3(0, 60, 0);
    const L = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(1.2, L * Math.tan(0.2), L, 32, 1, true); g.translate(0, -L / 2, 0);
    const m = new THREE.Mesh(g, beamMat);
    m.position.copy(from); m.quaternion.setFromUnitVectors(new V3(0, -1, 0), to.clone().sub(from).normalize());
    world.add(m);
  });
  // 地面火光
  const splashMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { uI: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uI; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = exp(-r * r * 5.0) * uI; gl_FragColor = vec4(vec3(2.6, 1.3, 0.45) * a, 1.0); }'
  });
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), splashMat); splash.rotation.x = -Math.PI / 2; splash.position.y = 1.2; splash.scale.set(260, 260, 1); world.add(splash);

  /* ---------- 粒子：地面煙雲 / 升空尾跡 / 雲層 / 排放蒸氣 ---------- */
  const commonSmokeUniforms = () => ({
    uT: { value: -10 }, uScale: { value: 1 }, uTime: { value: 0 },
    uGlowPos: { value: new V3() }, uGlow: { value: 0 }, uAmb: { value: new V3(0.05, 0.06, 0.08) }, uSunCol: { value: new V3(1, 1, 1) }, uFlood: { value: 0.4 }
  });
  // 地面煙雲：每顆粒子的位置是「任務時間」的函數，可以倒帶
  const groundSmoke = (() => {
    const N = 2400, dir = new Float32Array(N * 3), birth = new Float32Array(N), seed = new Float32Array(N * 4), pos = new Float32Array(N * 3);
    const r = rand(99);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2;
      dir.set([Math.cos(a), 0, Math.sin(a)], i * 3);
      birth[i] = -3 + Math.pow(r(), 1.7) * 26;
      const column = r() < 0.18 ? 1 : 0;
      seed.set([column ? 25 + r() * 60 : 90 + Math.pow(r(), 0.7) * 380, r(), column ? 1 : r() * 0.35, r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: commonSmokeUniforms(),
      vertexShader: `
        attribute vec3 aDir; attribute float aBirth; attribute vec4 aSeed;
        uniform float uT, uScale, uTime;
        ${lightingGLSL}
        varying vec4 vCol; varying float vSeed;
        void main(){
          float age = uT - aBirth;
          vSeed = aSeed.w;
          if (age <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); gl_PointSize = 0.0; vCol = vec4(0.0); return; }
          float R = aSeed.x;
          float rr = R * (1.0 - exp(-age / (1.6 + aSeed.y * 3.5)));
          vec3 p = aDir * rr;
          p.y = 4.0 + aSeed.z * (age * (5.0 + 9.0 * aSeed.y)) + rr * 0.08 + age * 0.9 + 0.012 * age * age;
          p.x += age * 2.5;
          float size = (14.0 + 34.0 * aSeed.y) * (0.35 + 1.25 * (1.0 - exp(-age / 5.0))) + age * 1.4;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vec4 mv = viewMatrix * wp;
          float a = smoothstep(0.0, 0.5, age) * (1.0 - smoothstep(55.0, 110.0, age)) * 0.62;
          a *= smoothstep(size * 0.2, size * 1.0, -mv.z);
          vec3 L = lightAt(p, wp.xyz);
          vCol = vec4(vec3(0.82, 0.8, 0.78) * L, a);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(size * uScale / max(-mv.z, 1.0), 1100.0);
        }`,
      fragmentShader: smokeFrag
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; world.add(pts);
    return pts;
  })();
  // 升空尾跡：粒子出生在「出生那一刻火箭所在位置」，事先烘焙在屬性裡
  function siteOf(h, x) { const phi = x / R_E, r = R_E + h + PAD_H; return new V3(r * Math.sin(phi), r * Math.cos(phi) - R_E, 0); }
  const trail = (() => {
    const N = 4200, base = new Float32Array(N * 3), dir = new Float32Array(N * 3), birth = new Float32Array(N), seed = new Float32Array(N * 4);
    const r = rand(1234);
    for (let i = 0; i < N; i++) {
      const b = 3 + Math.pow(r(), 1.45) * (EV.meco - 3);
      const s = sampleAt(b);
      const P = siteOf(s.h, s.x);
      // 尾焰末端（噴嘴後方一段距離）
      const back = new V3(-Math.sin(s.theta), -Math.cos(s.theta), 0).multiplyScalar(30 + r() * 60);
      base.set([P.x + back.x, P.y + back.y, P.z], i * 3);
      const v = new V3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      birth[i] = b;
      seed.set([Math.pow(r(), 0.5), r(), r(), r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: commonSmokeUniforms(),
      vertexShader: `
        attribute vec3 aDir; attribute float aBirth; attribute vec4 aSeed;
        uniform float uT, uScale;
        ${lightingGLSL}
        varying vec4 vCol; varying float vSeed;
        void main(){
          float age = uT - aBirth;
          vSeed = aSeed.w;
          if (age <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); gl_PointSize = 0.0; vCol = vec4(0.0); return; }
          float alt = position.y;
          float grow = 1.0 + alt / 3500.0;
          float spread = (5.0 + 5.0 * sqrt(age)) * grow;
          float wind = 6.0 + 34.0 * exp(-pow((alt - 11000.0) / 5000.0, 2.0));
          vec3 p = position + aDir * spread * aSeed.x + vec3(wind * age, -0.4 * age, wind * 0.3 * age);
          float size = (16.0 + 10.0 * sqrt(age)) * grow * (0.55 + aSeed.y);
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vec4 mv = viewMatrix * wp;
          float a = smoothstep(0.0, 0.8, age) * 0.5 * (0.25 + 0.75 * exp(-alt / 22000.0)) * (1.0 - smoothstep(400.0, 800.0, age));
          a *= smoothstep(size * 0.25, size * 1.2, -mv.z);
          vec3 L = lightAt(p, wp.xyz);
          vCol = vec4(vec3(0.85, 0.84, 0.86) * L, a);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(size * uScale / max(-mv.z, 1.0), 900.0);
        }`,
      fragmentShader: smokeFrag
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; world.add(pts);
    return pts;
  })();
  // 雲層（3–5 km）：火箭會從雲中穿出
  const clouds = (() => {
    const N = 1300, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
    const r = rand(77); let n = 0;
    for (let c = 0; c < 70; c++) { // 成團分佈
      const cx = -25000 + r() * 70000, cz = -40000 + r() * 80000, cy = 3200 + r() * 1800, rad = 1500 + r() * 4500;
      const k = 10 + (r() * 22 | 0);
      for (let i = 0; i < k && n < N; i++, n++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
        pos.set([cx + Math.cos(a) * d, cy + (r() - 0.3) * 600, cz + Math.sin(a) * d], n * 3);
        seed.set([0, r(), r(), r()], n * 4);
      }
    }
    // 確保穿越點附近有雲
    for (; n < N; n++) { const a = r() * Math.PI * 2, d = 1200 + Math.sqrt(r()) * 3000; pos.set([1800 + Math.cos(a) * d, 3600 + r() * 900, -1500 + Math.sin(a) * d], n * 3); seed.set([0, r(), r(), r()], n * 4); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: Object.assign(commonSmokeUniforms(), { uCloudA: { value: 1 } }),
      vertexShader: `
        attribute vec4 aSeed; uniform float uScale, uCloudA;
        ${lightingGLSL}
        varying vec4 vCol; varying float vSeed;
        void main(){
          vSeed = aSeed.w;
          float size = 900.0 + 1800.0 * aSeed.y;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec4 mv = viewMatrix * wp;
          float a = 0.7 * uCloudA * smoothstep(size * 0.15, size * 0.9, -mv.z);
          vec3 L = lightAt(position, wp.xyz);
          vCol = vec4(vec3(0.55, 0.6, 0.7) * L + vec3(0.06, 0.07, 0.1) * (0.6 + aSeed.z), a);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(size * uScale / max(-mv.z, 1.0), 1400.0);
        }`,
      fragmentShader: smokeFrag
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; world.add(pts);
    return pts;
  })();
  // 分離瞬間：級間環噴出的氣體雲與火花。粒子位置是「距分離經過時間」的函數，可倒帶
  const sepBurst = (() => {
    const N = 420, pos = new Float32Array(N * 3), dir = new Float32Array(N * 3), seed = new Float32Array(N * 4);
    const r = rand(404);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, up = (r() - 0.35) * 0.9;
      pos.set([Math.cos(a) * 4.6, BH + 1.25 + (r() - 0.5) * 1.6, Math.sin(a) * 4.6], i * 3);
      const d = new V3(Math.cos(a), up, Math.sin(a)).normalize(); dir.set([d.x, d.y, d.z], i * 3);
      seed.set([r(), r(), r(), r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uAge: { value: -99 }, uPre: { value: 2.2 }, uScale: { value: 1 }, uLight: { value: 1 } },
      vertexShader: `
        attribute vec3 aDir; attribute vec4 aSeed;
        uniform float uAge, uPre, uScale, uLight;
        varying vec4 vCol; varying float vSeed;
        void main(){
          float birth = -uPre + aSeed.y * (uPre + 0.9);
          float age = uAge - birth;
          vSeed = aSeed.w;
          if (age <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); gl_PointSize = 0.0; vCol = vec4(0.0); return; }
          float sp = 14.0 + 40.0 * aSeed.x;
          vec3 p = position + aDir * (sp * age / (1.0 + age * 0.35));
          float size = (1.8 + 5.0 * aSeed.z) * (0.5 + age * 1.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float hot = 1.0 - smoothstep(0.0, 1.4, age);
          vec3 c = mix(vec3(0.62, 0.66, 0.74) * uLight, vec3(2.4, 1.15, 0.4), hot);
          vCol = vec4(c, (1.0 - smoothstep(0.8, 4.5, age)) * smoothstep(0.0, 0.1, age) * mix(0.16, 0.4, hot));
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(size * uScale / max(-mv.z, 1.0), 500.0);
        }`,
      fragmentShader: smokeFrag
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; booster.add(pts);
    return pts;
  })();
  const sepSparks = (() => {
    const N = 220, pos = new Float32Array(N * 3), dir = new Float32Array(N * 3), seed = new Float32Array(N * 4);
    const r = rand(808);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2;
      pos.set([Math.cos(a) * 4.5, BH + 1.25, Math.sin(a) * 4.5], i * 3);
      const d = new V3(Math.cos(a), (r() - 0.4) * 1.2, Math.sin(a)).normalize(); dir.set([d.x, d.y, d.z], i * 3);
      seed.set([r(), r(), r(), r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uAge: { value: -99 }, uScale: { value: 1 } },
      vertexShader: `
        attribute vec3 aDir; attribute vec4 aSeed; uniform float uAge, uScale; varying float vA;
        void main(){
          float birth = -2.0 + aSeed.y * 2.6;
          float age = uAge - birth, life = 0.5 + aSeed.z * 1.3;
          vec3 p = position + aDir * (40.0 + 90.0 * aSeed.x) * age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (age > 0.0 && age < life) ? (1.0 - age / life) : 0.0;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vA > 0.0 ? clamp(0.9 * uScale / max(-mv.z, 1.0), 1.5, 8.0) : 0.0;
        }`,
      fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = (1.0 - r) * vA; gl_FragColor = vec4(vec3(3.2, 1.7, 0.6) * a, 1.0); }`
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; booster.add(pts);
    return pts;
  })();
  // 二級尾焰打在一級頂部的閃光
  const flareTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,220,170,.6)'); gr.addColorStop(0.5, 'rgba(255,140,60,.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0x000000 }));
  flare.position.y = BH + 2.2; booster.add(flare);

  // 點火前：低溫推進劑排放蒸氣（冷蒸氣比空氣重，會往下流）
  const vent = (() => {
    const N = 260, seed = new Float32Array(N * 4), pos = new Float32Array(N * 3);
    const r = rand(5);
    const SRC = [[66, 1.9, 1.0], [96, 2.5, 0.8], [108, 0.9, 0.6], [44, 1.4, 0.7]];
    for (let i = 0; i < N; i++) {
      const s = SRC[i % SRC.length];
      const a = s[1] + (r() - 0.5) * 0.5;
      pos.set([Math.cos(a) * 4.6, s[0], Math.sin(a) * 4.6], i * 3);
      seed.set([r(), r(), r(), s[2]], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uA: { value: 1 }, uLight: { value: new V3(0.5, 0.55, 0.62) } },
      vertexShader: `
        attribute vec4 aSeed; uniform float uTime, uScale, uA; uniform vec3 uLight;
        varying vec4 vCol; varying float vSeed;
        void main(){
          float ph = fract(uTime * (0.07 + 0.05 * aSeed.y) + aSeed.x);
          vec3 out_ = normalize(vec3(position.x, 0.0, position.z));
          vec3 p = position + out_ * (1.0 + ph * 6.0 * aSeed.w) + vec3(ph * 6.0, -ph * ph * 12.0 * aSeed.w, ph * 2.0);
          float size = 1.5 + ph * 9.0 * aSeed.w;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vSeed = aSeed.z;
          vCol = vec4(uLight * (0.9 + 0.3 * aSeed.z), uA * 0.2 * sin(ph * 3.1416) * aSeed.w);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(size * uScale / max(-mv.z, 1.0), 400.0);
        }`,
      fragmentShader: smokeFrag
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; stack.add(pts);
    return pts;
  })();

  /* ============================================================
     8. 燈光
     ============================================================ */
  const sun = new THREE.DirectionalLight(0xffffff, 0); scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x223355, 0x0a0806, 0.5); scene.add(hemi);
  const plumeLight = new THREE.PointLight(0xff8a3a, 0, 900, 1.4); scene.add(plumeLight);
  const shipLight = new THREE.PointLight(0xffa060, 0, 140, 2); scene.add(shipLight);

  /* ============================================================
     9. 每幀更新
     ============================================================ */
  const tmpQ = new THREE.Quaternion();
  const state = { t: -10, tTarget: -10, mx: 0, my: 0, mxs: 0, mys: 0, pxScale: 800, shake: 0, pr: 1, bLit: new Array(33).fill(false), shipOn: false,
    mode: 'flight', bkHover: false, bkScreen: { x: 0, y: 0, on: false } };

  // ---- 自由觀察模式：OrbitControls 接手鏡頭；黑騎士彩蛋只在這時出現 ----
  const blackKnight = createBlackKnight({ envMap: envSpace, flareTex });
  scene.add(blackKnight.group);
  // 相對二級中心的位置：在太空船後下方，從預設視角看過去剛好襯著地球（像 1998 年那張照片）
  const BK_OFFSET = new V3(-140, -70, -340);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.55, zoomSpeed: 0.8 });
  let camTween = null;
  const shipCenterW = new V3(), bkPosW = new V3();
  const raycaster = new THREE.Raycaster();
  const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function tweenTo(pos, target, dur = 2.2) {
    camTween = { p0: camera.position.clone(), p1: pos.clone(), c0: controls.target.clone(), c1: target.clone(), t0: performance.now() / 1000, dur };
    controls.enabled = false;
  }
  let returnFrom = null;
  function setMode(mode, opts = {}) {
    const prev = state.mode;
    state.mode = mode;
    if (mode === 'flight') {
      // 從自由觀察回來時，讓鏡頭用 1.6 秒滑回任務機位；重新發射則直接切換
      returnFrom = (prev !== 'flight' && !opts.instant) ? { pos: camera.position.clone(), tgt: controls.target.clone(), fov: camera.fov, t0: performance.now() / 1000 } : null;
      controls.enabled = false; controls.autoRotate = false; camTween = null; blackKnight.group.visible = false; state.bkHover = false; return;
    }
    blackKnight.group.visible = true;
    if (mode === 'free') {
      controls.minDistance = 60; controls.maxDistance = 1600; controls.autoRotate = false;
      if (prev === 'flight') { controls.target.copy(shipCenterW); controls.enabled = true; controls.update(); }
      else {
        const dir = camera.position.clone().sub(shipCenterW).normalize();
        tweenTo(shipCenterW.clone().addScaledVector(dir, 420), shipCenterW);
      }
    }
    if (mode === 'observe') {
      controls.minDistance = 55; controls.maxDistance = 300; controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
      // 從偏向太陽的一側接近，讓表面被照亮
      const sunW = rotZ(SUN_SITE, sampleAt(Math.max(0, state.t)).x / R_E);
      const toCam = camera.position.clone().sub(bkPosW).normalize();
      const dir = toCam.multiplyScalar(0.8).addScaledVector(sunW, 0.7).add(new V3(0, 0.25, 0)).normalize();
      tweenTo(bkPosW.clone().addScaledVector(dir, 125), bkPosW, 2.6);
    }
  }
  function ndcRay(ndc) { raycaster.setFromCamera(ndc, camera); return raycaster; }
  function pick(ndc) {
    if (state.mode === 'flight') return null;
    const r = ndcRay(ndc);
    if (r.intersectObjects(blackKnight.pickables, false).length) return 'knight';
    if (r.intersectObjects([sBody, nose], false).length) return 'ship';
    return null;
  }
  function hover(ndc) {
    if (state.mode !== 'free') { state.bkHover = false; return null; }
    const r = ndcRay(ndc);
    if (r.intersectObjects(blackKnight.pickables, false).length) { state.bkHover = true; return 'knight'; }
    state.bkHover = false;
    return r.intersectObjects([sBody, nose], false).length ? 'ship' : null;
  }
  function freeCamera(now) {
    state.shake = 0;
    if (camTween) {
      const k = Math.min(1, (now - camTween.t0) / camTween.dur), e = ease(k);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e);
      controls.target.lerpVectors(camTween.c0, camTween.c1, e);
      camera.lookAt(controls.target);
      if (k >= 1) { camTween = null; controls.enabled = true; }
    } else {
      if (state.mode === 'free') controls.target.lerp(shipCenterW, 0.1);
      controls.update();
    }
    const portrait = innerWidth < innerHeight;
    const fov = state.mode === 'observe' ? (portrait ? 52 : 38) : (portrait ? 60 : 45);
    const off = state.mode === 'observe' && !portrait ? 4.2 : 0;
    camera.fov += (fov - camera.fov) * 0.06;
    camera.filmOffset += (off - camera.filmOffset) * 0.06;
    camera.updateProjectionMatrix();
    // 黑騎士的螢幕座標（給 HUD 的準星用）
    const v = bkPosW.clone().project(camera);
    state.bkScreen.on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    state.bkScreen.x = (v.x * 0.5 + 0.5) * innerWidth;
    state.bkScreen.y = (-v.y * 0.5 + 0.5) * innerHeight;
    state.pxScale = (renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  }
  function sm(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoother(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * t * (t * (t * 6 - 15) + 10); }
  const SEP_THETA = sampleAt(EV.sep).theta;
  function rotZ(v, a) { const c = Math.cos(a), s = Math.sin(a); return new V3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }

  function engineIntensity(t, ring) {
    // 點火序列：中心 → 中圈 → 外圈
    const start = [-3.0, -2.5, -2.0][ring];
    return sm(start, start + 0.6, t);
  }

  function update(now, dtReal) {
    const t = state.t;
    const st = sampleAt(Math.max(0, t));
    const flying = t > 0;
    const h = flying ? st.h : 0, x = flying ? st.x : 0;
    const theta = flying ? st.theta : 0;
    const phi = x / R_E;

    // ---- 世界座標：火箭在原點 ----
    const Psite = siteOf(h, x);
    world.rotation.z = phi;
    world.position.copy(rotZ(Psite, phi).negate());
    world.updateMatrixWorld(true);
    const toSite = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationZ(-phi));

    // ---- 火箭姿態 ----
    stack.rotation.z = -theta;
    const A = new V3(Math.sin(theta), Math.cos(theta), 0);
    const sepT = EV.sep;
    const sepK = sm(sepT, sepT + 6, t);

    // 一級分離後：用一級自己的模擬軌跡，換算成相對二級的位置
    let bTopW = A.clone().multiplyScalar(71.5);
    if (t > sepT) {
      const relSite = siteOf(st.bh, st.bx).sub(Psite);
      const rel = rotZ(relSite, phi);
      const age = t - sepT;
      // 二級尾焰打在一級頂部，把它往軸線外推一點，然後才開始翻轉
      const Nw = new V3(A.y, -A.x, 0);
      rel.addScaledVector(Nw, Math.min(80, 0.42 * age * age));
      const thSep = SEP_THETA, thBB = -Math.PI / 2 + 0.25;
      const e = smoother(1.0, 13, age);
      let thB = lerp(thSep, thBB, e) + 0.06 * sm(0, 2.2, age) * (1 - e) + Math.max(0, age - 30) * 0.01;
      // rel 為世界座標；booster 是 stack 的子物件，需轉回 stack 局部
      booster.position.copy(rel.clone().applyAxisAngle(ZAX, theta));
      booster.rotation.set(0.06 * Math.sin(age * 0.7) * sm(0.5, 4, age), 0, -(thB - theta));
      bTopW = rel.clone().add(new V3(Math.sin(thB), Math.cos(thB), 0).multiplyScalar(71.5));
    } else { booster.position.set(0, 0, 0); booster.rotation.set(0, 0, 0); }
    state.bTopW = bTopW; state.shipBaseW = A.clone().multiplyScalar(71.5);

    // ---- 外界環境 ----
    const pr = flying ? st.p / P0 : 1;
    const dens = Math.exp(-h / 8500);
    // 太陽：在發射場座標固定，轉到世界
    const sunW = rotZ(SUN_SITE, phi);
    const upAtRocket = new V3(0, 1, 0);
    const kR = (h + PAD_H) * (2 * R_E + h) / Math.pow(R_E + h, 2);
    const sunAbove = sunW.dot(upAtRocket) + Math.sqrt(kR);
    const rocketLit = sm(-0.004, 0.006, sunAbove);
    const sunRed = sm(0.0, 0.15, sunAbove + (1 - dens) * 0.1);
    sun.color.setRGB(1.0, lerp(0.45, 0.95, sunRed), lerp(0.22, 0.88, sunRed));
    sun.intensity = 3.2 * rocketLit;
    sun.position.copy(sunW).multiplyScalar(500); sun.target.position.set(0, 0, 0);
    const night = 1 - rocketLit;
    hemi.color.setRGB(lerp(0.12, 0.02, 1 - dens), lerp(0.18, 0.03, 1 - dens), lerp(0.32, 0.06, 1 - dens));
    hemi.groundColor.setRGB(lerp(0.05, 0.03, 1 - dens), lerp(0.04, 0.06, 1 - dens), lerp(0.03, 0.12, 1 - dens));
    hemi.intensity = lerp(0.9, 0.6, 1 - dens);
    const spaceEnv = h > 45000;
    for (const m of [bBody.material, sBody.material, nose.material, skirt.material]) {
      if ((m.envMap === envSpace) !== spaceEnv) { m.envMap = spaceEnv ? envSpace : envTw; m.needsUpdate = true; }
      m.envMapIntensity = spaceEnv ? 1.4 : lerp(1.0, 0.7, sm(0, 30000, h));
    }

    // ---- 引擎與尾焰 ----
    const preIgn = t < 0;
    const thrust = preIgn ? sm(-3, -1.5, t) : 1;
    // 一級（未分離時）
    const lit = new Array(33).fill(0);
    let bLitCount = 0;
    for (let i = 0; i < 33; i++) {
      const ring = B_ENG[i].ring;
      let on;
      if (t < 0) on = engineIntensity(t, ring);
      else if (t < EV.meco) on = 1;
      else if (t < sepT) { const d = ring === 2 ? B_ENG[i].off * 0.55 : 0.6 + B_ENG[i].off * 0.45; on = ring === 0 ? 1 : 1 - sm(EV.meco + d, EV.meco + d + 0.18, t); }
      else on = (st.bPhase === 'boostback') ? (ring <= 1 ? 1 : 0) : 0;
      if (t >= sepT && t < sepT + 1.6) on = ring === 0 ? 1 - sm(0.2, 1.6, t - sepT) : on;
      if (st.bPhase === 'boostback' && ring <= 1) on = sm(EV.boostback, EV.boostback + 0.5 + B_ENG[i].off * 0.6, t);
      bFlames.on[i] = on; lit[i] = on > 0.5; if (on > 0.5) bLitCount++;
    }
    bFlames.attr.needsUpdate = true;
    const pressFactor = Math.pow(pr, 0.22);
    const engineCoverage = bLitCount / 33;
    const attached = t < sepT;
    // 一級主尾焰
    {
      const k = attached ? (t < EV.meco ? thrust : lerp(1, 0.16, sm(EV.meco, EV.meco + 1.1, t))) : 0.16 * (1 - sm(sepT + 0.2, sepT + 1.6, t));
      const groundCap = (h + PAD_H) / Math.max(0.2, Math.cos(theta)) + 4;
      const coreLen = Math.min(26 + 70 * (1 - pr), groundCap);
      const envLen = Math.min(70 + 900 * (1 - Math.pow(pr, 0.3)), groundCap);
      const lowFade = sm(-0.5, 2.0, t);
      setPlume(bPlume, {
        core: { len: coreLen, r0: 3.8, r1: 4.3 + 2.0 * (1 - pr), pow: 1.2, close: 0.4, dia: pr * 1.0, diaN: 5, I: 1.15 * k * (0.5 + 0.5 * engineCoverage), soft: 1.4, fade: 0.45 },
        env: { len: envLen, r0: 4.3, r1: 5.5 + 160 * Math.pow(1 - pressFactor, 1.3), pow: lerp(1.0, 3.2, 1 - pr), close: lerp(0.5, 0.15, 1 - pr), dia: pr * 0.6, diaN: 3, I: k * lerp(0.7, 0.16, 1 - pressFactor) * (0.3 + 0.7 * engineCoverage) * (0.45 + 0.55 * lowFade), soft: lerp(1.0, 2.2, 1 - pr), fade: lerp(0.35, 0.6, 1 - pr) },
        halo: { len: envLen * 1.1, r0: 5, r1: 20 + 200 * Math.pow(1 - pressFactor, 1.2), pow: 3.5, close: 0.0, dia: 0, diaN: 1, I: k * 0.05 * (1 - pressFactor) * (0.3 + 0.7 * rocketLit), soft: 2.6, fade: 0.25 }
      }, pr, rocketLit);
    }
    // 一級返航點火
    {
      const k = (!attached && st.bPhase === 'boostback') ? sm(EV.boostback, EV.boostback + 1.2, t) : 0;
      setPlume(boostbackPlume, {
        core: { len: 60, r0: 2.9, r1: 6, pow: 1.5, close: 0.4, dia: 0, diaN: 1, I: 0.9 * k, soft: 1.2, fade: 0.4 },
        env: { len: 700, r0: 3, r1: 150, pow: 3.2, close: 0.15, dia: 0, diaN: 1, I: 0.2 * k, soft: 2.0, fade: 0.55 },
        halo: { len: 800, r0: 5, r1: 220, pow: 3.6, close: 0, dia: 0, diaN: 1, I: 0.05 * k, soft: 2.6, fade: 0.3 }
      }, 0, 1);
    }
    // 小火焰
    const bfm = bFlames.mesh.material.uniforms;
    bfm.uLen.value = lerp(18, 34, 1 - pr); bfm.uWide.value = lerp(1.5, 4.5, 1 - pressFactor); bfm.uI.value = (t < sepT + 1.6 || st.bPhase === 'boostback') ? 1.3 : 0; bfm.uTime.value = now;
    // 二級
    const shipOn = t > EV.shipIgn ? sm(EV.shipIgn, EV.shipIgn + 0.8, t) * (1 - sm(EV.seco, EV.seco + 1.0, t)) : 0;
    for (let i = 0; i < 6; i++) sFlames.on[i] = shipOn;
    sFlames.attr.needsUpdate = true;
    const sfm = sFlames.mesh.material.uniforms;
    sfm.uLen.value = 30; sfm.uWide.value = 4.5; sfm.uI.value = 1.4; sfm.uTime.value = now; sfm.uCol.value.set(1.4, 1.1, 2.4);
    setPlume(sPlume, {
      core: { len: 55, r0: 3.6, r1: 6.5, pow: 1.4, close: 0.4, dia: 0, diaN: 1, I: 0.8 * shipOn, soft: 1.6, fade: 0.35 },
      env: { len: 700, r0: 4.2, r1: 120, pow: 2.6, close: 0.25, dia: 0, diaN: 1, I: 0.075 * shipOn, soft: 2.4, fade: 0.45 },
      halo: { len: 900, r0: 6, r1: 200, pow: 3.0, close: 0.2, dia: 0, diaN: 1, I: 0.025 * shipOn * (0.4 + 0.6 * rocketLit), soft: 3.0, fade: 0.3 }
    }, 0, rocketLit, true);
    // 熱分離排氣
    const hs = t > EV.shipIgn - 0.2 && t < sepT + 1.5 ? sm(EV.shipIgn - 0.2, EV.shipIgn + 0.3, t) * (1 - sm(sepT, sepT + 1.5, t)) : 0;
    const flick = 0.75 + 0.25 * Math.sin(now * 47.0) * Math.sin(now * 31.0);
    ventFlames.material.uniforms.uI.value = hs * 1.1 * flick; ventFlames.material.uniforms.uLen.value = 9 + 5 * hs * flick; ventFlames.material.uniforms.uWide.value = 2.6; ventFlames.material.uniforms.uTime.value = now;
    // 分離特效
    const sAge = t - sepT;
    sepBurst.material.uniforms.uAge.value = sAge; sepBurst.material.uniforms.uScale.value = state.pxScale; sepBurst.material.uniforms.uLight.value = 0.35 + 0.65 * rocketLit;
    sepBurst.material.uniforms.uPre.value = sepT - EV.shipIgn;
    sepSparks.material.uniforms.uAge.value = sAge; sepSparks.material.uniforms.uScale.value = state.pxScale;
    sepBurst.visible = sAge > -3 && sAge < 12; sepSparks.visible = sAge > -2.5 && sAge < 3;
    const impinge = sAge > 0 ? (1 - sm(0.3, 4.0, sAge)) * sm(0, 0.25, sAge) : 0;
    const fI = hs * 0.4 * flick + impinge * 0.8;
    flare.material.color.setRGB(2.2 * fI, 1.3 * fI, 0.6 * fI);
    flare.scale.setScalar(22 + 40 * fI);
    flare.visible = fI > 0.005;
    ringMat.emissiveIntensity = hs * 3 + (attached && t > EV.shipIgn ? 0.5 : 0) * (1 - sepK);
    // 噴嘴發紅
    bellMat.emissiveIntensity = (attached ? thrust * 0.9 : 0) + shipOn * 0.6;

    // 凝結雲（跨音速 + 濕空氣）
    const vI = flying ? sm(0.86, 0.98, st.mach) * (1 - sm(1.12, 1.4, st.mach)) * sm(2000, 5000, h) * (1 - sm(9000, 13000, h)) : 0;
    vaporMat.uniforms.uI.value = vI * 0.9; vaporMat.uniforms.uTime.value = now;
    vaporMat.uniforms.uLight.value.set(0.25 + 0.6 * rocketLit, 0.27 + 0.45 * rocketLit, 0.33 + 0.3 * rocketLit);

    // 地面火光、點光源
    const splashI = t > -3 ? thrust * Math.exp(-Math.max(0, h) / 120) * 1.6 : 0;
    splashMat.uniforms.uI.value = splashI;
    const plumeWorld = A.clone().multiplyScalar(-14);
    plumeLight.position.copy(plumeWorld);
    plumeLight.intensity = (attached ? thrust * (0.25 + 0.75 * engineCoverage) : 0) * 9 * Math.max(0.15, pressFactor);
    shipLight.position.copy(A.clone().multiplyScalar(60));
    shipLight.intensity = shipOn * 0.8;

    beamMat.uniforms.uI.value = 1 - sm(-3, 4, t) * 0.7;
    // QD 臂收回
    qdPivot.rotation.y = QD_BASE + sm(-9, -4, t) * 1.1;
    // 航空障礙燈閃爍
    beaconMat.color.setRGB(Math.sin(now * 3.0) > 0.2 ? 4 : 0.15, 0.1, 0.05);

    // ---- 粒子 uniforms ----
    const glowW = A.clone().multiplyScalar(-20);
    const ambNight = new V3(0.035, 0.045, 0.07);
    const glowI = (attached ? thrust : 0) * 2.4;
    for (const p of [groundSmoke, trail, clouds]) {
      const u = p.material.uniforms;
      u.uT.value = t; u.uTime.value = now; u.uScale.value = state.pxScale;
      u.uGlowPos.value.copy(glowW); u.uGlow.value = glowI;
      u.uAmb.value.copy(ambNight);
      u.uSunCol.value.set(1.15, 1.1, 1.05);
      u.uFlood.value = 0.55;
    }
    clouds.material.uniforms.uCloudA.value = 1 - sm(60000, 90000, h);
    vent.material.uniforms.uTime.value = now; vent.material.uniforms.uScale.value = state.pxScale;
    vent.material.uniforms.uA.value = 1 - sm(-3, 0.5, t);

    // ---- 鏡頭 ----
    shipCenterW.copy(A).multiplyScalar(71.5 + 26);
    bkPosW.copy(shipCenterW).add(BK_OFFSET);
    blackKnight.group.position.copy(bkPosW);
    if (blackKnight.group.visible) blackKnight.update(now, state.mode === 'observe' ? 1 : 0);
    if (state.mode === 'flight') updateCamera(t, st, A, theta, now, phi, Psite, sepK);
    else freeCamera(now);

    // ---- 天空 uniforms（以鏡頭位置） ----
    const camSite = Psite.clone().add(rotZ(camera.position, -phi));
    const camR = new V3(camSite.x, camSite.y + R_E, camSite.z);
    const camH = Math.max(1, camR.length() - R_E);
    const camUp = camR.clone().normalize();
    skyMat.uniforms.uUp.value.copy(camUp);
    skyMat.uniforms.uH.value = camH;
    skyMat.uniforms.uCamSite.value.copy(camSite);
    skyMat.uniforms.uToSite.value.copy(toSite);
    skyMat.uniforms.uTime.value = now;
    const kC = camH * (2 * R_E + camH) / Math.pow(R_E + camH, 2);
    const densC = Math.exp(-camH / 8500);
    starMat.uniforms.uToSite.value.copy(toSite);
    starMat.uniforms.uUp.value.copy(camUp);
    starMat.uniforms.uMuH.value = -Math.sqrt(kC);
    starMat.uniforms.uAlpha.value = lerp(0.22, 1.0, sm(0.6, 0.02, densC));
    starMat.uniforms.uScale.value = DPR;
    starMat.uniforms.uTime.value = now;

    // 後製
    finalPass.uniforms.uTime.value = now % 10;
    finalPass.uniforms.uShake.value = state.shake;
    finalPass.uniforms.uExposure.value = lerp(1.25, 1.0, sm(20000, 80000, h));
    bloom.strength = lerp(0.85, 1.05, sm(30000, 120000, h));

    // 讓 HUD 能讀
    state.st = st; state.rocketLit = rocketLit; state.pr = pr; state.bLit = lit; state.shipOn = shipOn > 0.5;
  }

  function setPlume(P, cfg, pr, lit, isShip) {
    const hot = new V3(3.2, 2.7, 2.1);
    // 低空：橘黃；高空：甲烷/液氧的藍紫，外層被陽光照成白藍
    const lowC1 = new V3(2.4, 1.15, 0.35), lowC2 = new V3(0.7, 0.24, 0.06);
    const hiC1 = new V3(0.9, 0.75, 1.6), hiC2 = new V3(0.22, 0.3, 0.65);
    const k = isShip ? 1 : 1 - Math.pow(pr, 0.5);
    for (const key of ['core', 'env', 'halo']) {
      const c = cfg[key], u = P[key].material.uniforms;
      u.uLen.value = Math.max(1, c.len); u.uR0.value = c.r0; u.uR1.value = c.r1; u.uPow.value = c.pow; u.uClose.value = c.close;
      u.uDia.value = c.dia; u.uDiaN.value = c.diaN; u.uI.value = c.I; u.uSoft.value = c.soft; u.uFade.value = c.fade;
      u.uTime.value = performance.now() / 1000;
      u.uC0.value.copy(hot);
      u.uC1.value.copy(lowC1).lerp(hiC1, k);
      u.uC2.value.copy(lowC2).lerp(hiC2, k);
      if (key === 'halo') { u.uC0.value.set(0.9, 0.9, 1.1); u.uC1.value.set(0.55, 0.65, 0.95).multiplyScalar(0.4 + 0.6 * lit); u.uC2.value.set(0.25, 0.32, 0.55).multiplyScalar(0.4 + 0.6 * lit); }
      P[key].visible = c.I > 0.001;
    }
  }

  /* ---------- 鏡頭機位：依任務時間在五組機位間混合 ---------- */
  const camPos = new V3(), camTgt = new V3();
  function updateCamera(t, st, A, theta, now, phi, Psite, sepK) {
    const Sd = new V3(0, 0, 1);
    const N = new V3(A.y, -A.x, 0);
    const up = new V3(0, 1, 0);
    const cStack = A.clone().multiplyScalar(62);
    const cShip = A.clone().multiplyScalar(71.5 + 26);
    const cF = cStack.clone().lerp(cShip, sepK);
    const mx = state.mxs, my = state.mys;
    const portrait = innerWidth < innerHeight;

    const rigs = [];
    // R0：地面固定機位，看著火箭起飛、追著它往上
    {
      const drift = reduced ? 0 : Math.sin(now * 0.06) * 18;
      const site = new V3(-215 + mx * 30 + drift, 12 + my * 8, 255 - drift * 0.5);
      const pos = world.localToWorld(site.clone());
      const tgt = t < 0 ? world.localToWorld(new V3(0, 76, 0)) : cF.clone();
      rigs.push({ w: 1 - sm(6, 18, t), pos, tgt, fov: portrait ? 56 : 42, off: portrait ? 0 : -4.6 });
    }
    // R1：從下方追，看箭身與尾焰、地面往下退
    {
      // 貼近機身掠過：從引擎段滑到船頭，看清焊縫、結霜與隔熱瓦
      const k = sm(8, 32, t);
      const slide = lerp(-55, 52, k);
      const pos = cF.clone().addScaledVector(Sd, lerp(70, 105, k)).addScaledVector(A, slide - 18).addScaledVector(N, lerp(-26, 10, k) + mx * 10);
      rigs.push({ w: sm(6, 14, t) * (1 - sm(30, 42, t)), pos, tgt: cF.clone().addScaledVector(A, slide * 0.85), fov: portrait ? 56 : 40, off: portrait ? 0 : -3.4 });
    }
    // R2：側面，Max-Q 震動
    rigs.push({ w: sm(30, 44, t) * (1 - sm(112, 128, t)), pos: cF.clone().addScaledVector(Sd, 180).addScaledVector(A, 15).addScaledVector(N, -30 + mx * 30), tgt: cF.clone().addScaledVector(A, -25), fov: portrait ? 60 : 46, off: portrait ? 0 : -3.2 });
    // R3：高空爬升，拉遠看整枝箭與張開的尾焰
    rigs.push({ w: sm(112, 128, t) * (1 - sm(EV.meco - 9, EV.meco - 3, t)), pos: cF.clone().addScaledVector(Sd, 260).addScaledVector(A, -60).addScaledVector(N, 40 + mx * 30), tgt: cF.clone().addScaledVector(A, -45), fov: portrait ? 64 : 50, off: portrait ? 0 : -3.2 });
    // RS：熱分離特寫。鏡頭對準兩節之間的中點，距離隨間隙拉開，兩節始終都在畫面裡
    {
      const sb = state.shipBaseW || A.clone().multiplyScalar(71.5), bt = state.bTopW || sb;
      const mid = sb.clone().lerp(bt, 0.5), gap = sb.distanceTo(bt);
      const pos = mid.clone().addScaledVector(Sd, 150 + gap * 1.15).addScaledVector(N, 30 + gap * 0.25).addScaledVector(A, 25 - gap * 0.15);
      rigs.push({ w: sm(EV.meco - 9, EV.meco - 3, t) * (1 - sm(EV.sep + 13, EV.sep + 22, t)), pos, tgt: mid, fov: portrait ? 62 : 44, off: portrait ? 0 : -3.4 });
    }
    // R3b：分離後，二級為主的廣角
    rigs.push({ w: sm(EV.sep + 13, EV.sep + 22, t) * (1 - sm(178, 198, t)), pos: cShip.clone().addScaledVector(Sd, 280).addScaledVector(A, -40).addScaledVector(N, 50 + mx * 30), tgt: cShip.clone().addScaledVector(A, -60), fov: portrait ? 64 : 50, off: portrait ? 0 : -3.2 });
    // R4：太空，環繞二級，地球弧線在下方
    {
      const ang = 0.55 + (t - 190) * 0.0016 + mx * 0.3;
      const dir = Sd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(A, Math.sin(ang) * 0.6).addScaledVector(up, 0.3 + my * 0.15).normalize();
      const dist = lerp(300, 380, sm(200, 480, t));
      rigs.push({ w: sm(178, 198, t), pos: cShip.clone().addScaledVector(dir, dist), tgt: cShip.clone().addScaledVector(up, -35), fov: portrait ? 58 : 42, off: portrait ? 0 : -2.6 });
    }
    let W = 0; const P = new V3(), T = new V3(); let fov = 0, off = 0;
    for (const r of rigs) { if (r.w <= 0) continue; W += r.w; P.addScaledVector(r.pos, r.w); T.addScaledVector(r.tgt, r.w); fov += r.fov * r.w; off += r.off * r.w; }
    P.multiplyScalar(1 / W); T.multiplyScalar(1 / W); fov /= W; off /= W;

    // 震動：Max-Q 與地面點火時最強
    const q = t > 0 ? st.q : 0;
    let shake = 0;
    if (t > -3) shake += sm(-3, -1, t) * (1 - sm(4, 20, t)) * 0.9;
    shake += Math.min(1, q / 30000) * 0.8;
    if (t > EV.shipIgn) shake += 0.75 * Math.exp(-(t - EV.shipIgn) * 1.6);
    if (t > EV.sep) shake += 0.6 * Math.exp(-(t - EV.sep) * 1.2);
    if (reduced) shake *= 0.15;
    state.shake = shake;
    const n1 = Math.sin(now * 37.1) * 0.6 + Math.sin(now * 53.7) * 0.4, n2 = Math.sin(now * 41.3 + 1.2) * 0.6 + Math.sin(now * 67.1) * 0.4;
    const dist = P.distanceTo(T);
    const amp = shake * dist * 0.0035;
    T.x += n1 * amp; T.y += n2 * amp;

    if (returnFrom) {
      const k = ease(Math.min(1, (now - returnFrom.t0) / 1.6));
      P.lerpVectors(returnFrom.pos, P, k); T.lerpVectors(returnFrom.tgt, T, k); fov = returnFrom.fov + (fov - returnFrom.fov) * k;
      if (k >= 1) returnFrom = null;
    }
    camPos.copy(P); camTgt.copy(T);
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(camTgt);
    if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(camera.filmOffset - off) > 0.01) { camera.fov = fov; camera.filmOffset = off; camera.updateProjectionMatrix(); }
    state.pxScale = (renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  }

  function render() { composer.render(); }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function dispose() {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { Object.values(m).forEach(v => v && v.isTexture && v.dispose()); m.dispose(); });
    });
    controls.dispose(); rt.dispose(); renderer.dispose();
  }
  return { state, update, render, resize, dispose, setMode, pick, hover, B_ENG, S_ENG, sm };
}
