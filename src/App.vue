<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import TopBar from './components/TopBar.vue';
import HeroSection from './components/HeroSection.vue';
import MissionSummary from './components/MissionSummary.vue';
import EventCard from './components/EventCard.vue';
import AltimeterPanel from './components/AltimeterPanel.vue';
import TelemetryHud from './components/TelemetryHud.vue';
import FreeLookOverlay from './components/FreeLookOverlay.vue';
import ObservationPanel from './components/ObservationPanel.vue';
import { createLaunchScene } from './scene/LaunchScene.js';
import { EV } from './sim/flightData.js';
import { phaseOf } from './sim/missionEvents.js';
import { useScrollMission } from './composables/useScrollMission.js';
import { useLaunchAudio } from './composables/useLaunchAudio.js';

const canvasRef = ref(null);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// HUD 每一幀從場景狀態抄過來；three.js 物件本身不放進 Vue 的響應式系統（太大也沒必要）
const hud = reactive({
  t: -10, alt: 0, speed: 0, bAlt: 0, bSpeed: 0, q: 0, mach: 0, g: 1, pitch: 0, pr: 1,
  bProp: 1, sProp: 1, bLit: new Array(33).fill(false), sLit: false, phase: '',
});
// mode：flight＝捲動看發射；free＝關掉摘要後 360° 把玩；observe＝鎖定黑騎士近距離觀測
const ui = reactive({ chapter: 0, soundOn: false, heroFade: 1, finale: false, ready: false, mode: 'flight' });
const reticle = reactive({ x: 0, y: 0, on: false, hover: false });
const engines = reactive({ booster: [], ship: [] });

const { marks, measure, timeFromScroll } = useScrollMission();
const audio = useLaunchAudio();
let scene = null;
let rafId = 0;

function goTo(i) {
  const el = document.getElementById(['pad', 'ascent', 'space'][i]);
  const top = i === 0 ? 0 : el.getBoundingClientRect().top + scrollY + 2;
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
}
function toggleSound() { ui.soundOn = audio.toggle(); }

// ---- 自由觀察／黑騎士彩蛋 ----
function setMode(mode, opts) {
  ui.mode = mode;
  scene.setMode(mode, opts);
  // 自由觀察時鎖住頁面捲動，讓滾輪交給鏡頭縮放
  document.documentElement.style.overflow = mode === 'flight' ? '' : 'hidden';
  canvasRef.value.style.cursor = '';
}
function enterFreeLook() { setMode('free'); }
function backToSummary() { setMode('flight'); }
function observeKnight() { setMode('observe'); }
function endObservation() { setMode('free'); }
// 點「CONTACT ME」：連結本身會開新分頁，主畫面同時回到發射前
function resetMission() {
  setMode('flight', { instant: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
  measure();
  scene.state.t = scene.state.tTarget = -10;
}

const toNdc = e => ({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight * 2 - 1) });
let downAt = null;
function onCanvasDown(e) { downAt = { x: e.clientX, y: e.clientY }; }
function onCanvasUp(e) {
  if (!downAt || ui.mode === 'flight') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return; // 拖曳旋轉不算點擊
  const hit = scene.pick(toNdc(e));
  if (ui.mode === 'free' && hit === 'ship') backToSummary();
  else if (ui.mode === 'free' && hit === 'knight') observeKnight();
}
function onCanvasMove(e) {
  if (ui.mode !== 'free') return;
  const hit = scene.hover(toNdc(e));
  canvasRef.value.style.cursor = hit ? 'pointer' : 'grab';
}
function onKey(e) {
  if (e.key !== 'Escape') return;
  if (ui.mode === 'observe') endObservation();
  else if (ui.mode === 'free') backToSummary();
}

function onScroll() { scene.state.tTarget = timeFromScroll(scrollY); }
function onResize() { measure(); scene.resize(); }
function onPointer(e) {
  scene.state.mx = e.clientX / innerWidth * 2 - 1;
  scene.state.my = -(e.clientY / innerHeight * 2 - 1);
}

function syncHud() {
  const { state } = scene;
  const t = state.t, st = state.st, fly = t > 0;
  hud.t = t;
  hud.alt = fly ? st.h : 0;
  hud.speed = fly ? st.v * 3.6 : 0;
  hud.bAlt = fly ? (t > EV.sep ? st.bh : st.h) : 0;
  hud.bSpeed = fly ? (t > EV.sep ? Math.hypot(st.bvh, st.bvx) : st.v) * 3.6 : 0;
  hud.q = fly ? st.q : 0;
  hud.mach = fly ? st.mach : 0;
  hud.g = fly ? st.g : 1;
  hud.pitch = fly ? st.theta * 180 / Math.PI : 0;
  hud.pr = state.pr;
  hud.bProp = st.bProp;
  hud.sProp = st.sProp;
  for (let i = 0; i < 33; i++) if (hud.bLit[i] !== state.bLit[i]) hud.bLit[i] = state.bLit[i];
  hud.sLit = state.shipOn;
  hud.phase = phaseOf(t);
  const y = scrollY;
  ui.chapter = y < marks.a - innerHeight * 0.3 ? 0 : y < marks.s - innerHeight * 0.3 ? 1 : 2;
  ui.heroFade = Math.max(0, 1 - y / (innerHeight * 0.55));
  ui.finale = y + innerHeight * 0.7 > marks.fin;
  const b = state.bkScreen;
  reticle.x = b.x; reticle.y = b.y; reticle.on = b.on; reticle.hover = state.bkHover;
}

onMounted(() => {
  scene = createLaunchScene(canvasRef.value, { reduced });
  if (import.meta.env.DEV) window.__scene = scene; // 開發時方便在 console 除錯
  engines.booster = scene.B_ENG.map(e => ({ x: e.x / 4.5 * 42, y: e.z / 4.5 * 42, r: 5.4 }));
  engines.ship = scene.S_ENG.map(e => ({ x: e.x / 4.5 * 40, y: e.z / 4.5 * 40, r: e.vac ? 9.5 : 6 }));

  measure();
  addEventListener('resize', onResize);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('pointermove', onPointer);
  addEventListener('keydown', onKey);
  canvasRef.value.addEventListener('pointerdown', onCanvasDown);
  canvasRef.value.addEventListener('pointerup', onCanvasUp);
  canvasRef.value.addEventListener('pointermove', onCanvasMove);
  scene.state.tTarget = scene.state.t = timeFromScroll(scrollY);

  let last = performance.now();
  const frame = ms => {
    const now = ms / 1000, dt = Math.min(0.1, (ms - last) / 1000);
    last = ms;
    const s = scene.state;
    // 任務時間平滑跟隨捲動（指數趨近），滑鼠視差也一樣
    s.t += (s.tTarget - s.t) * (1 - Math.exp(-dt * (reduced ? 12 : 3.2)));
    s.mxs += (s.mx - s.mxs) * (1 - Math.exp(-dt * 2));
    s.mys += (s.my - s.mys) * (1 - Math.exp(-dt * 2));
    scene.update(now, dt);
    scene.render();
    audio.update(s, scene.sm);
    syncHud();
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
  setTimeout(() => (ui.ready = true), 200);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  removeEventListener('resize', onResize);
  removeEventListener('load', measure);
  removeEventListener('scroll', onScroll);
  removeEventListener('pointermove', onPointer);
  removeEventListener('keydown', onKey);
  document.documentElement.style.overflow = '';
  scene?.dispose();
  audio.dispose();
});
</script>

<template>
  <canvas id="gl" ref="canvasRef" aria-hidden="true"></canvas>
  <div id="veil" :class="{ gone: ui.ready }">正在計算飛行軌跡</div>

  <div class="ui" :class="{ free: ui.mode !== 'flight' }">
    <TopBar :chapter="ui.chapter" :sound-on="ui.soundOn" @go="goTo" @toggle-sound="toggleSound" />

    <main>
      <HeroSection :fade="ui.heroFade" />

      <section id="ascent" class="chapter track">
        <div class="chapter-mark">02 <b>穿越大氣</b> 對流層 → 中氣層</div>
      </section>

      <section id="space" class="chapter space">
        <div class="space-track"><div class="chapter-mark">03 <b>太空</b> 卡門線之上</div></div>
        <MissionSummary :hidden="ui.mode !== 'flight'" @replay="goTo(0)" @close="enterFreeLook" />
      </section>
    </main>

    <EventCard :t="hud.t" :hidden="ui.finale" />
    <AltimeterPanel :hud="hud" :quiet="ui.finale" />
    <TelemetryHud :hud="hud" :quiet="ui.finale" :booster-engines="engines.booster" :ship-engines="engines.ship" />

    <FreeLookOverlay v-if="ui.mode === 'free'" :reticle="reticle" @back="backToSummary" />
    <ObservationPanel v-if="ui.mode === 'observe'" @close="endObservation" @contact="resetMission" />
  </div>
</template>

<style scoped>
.ui { position: relative; z-index: 2; }
/* 自由觀察：內容層不接收滑鼠，事件直接落到畫布；HUD 收起來 */
.ui.free { pointer-events: none; }
.ui.free .hud, .ui.free .alti { opacity: 0; }
</style>
