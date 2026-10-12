<script setup>
import { computed } from 'vue';
import { LAYERS } from '../sim/missionEvents.js';
import { fmtNum } from '../utils/format.js';

const props = defineProps({
  hud: { type: Object, required: true },
  quiet: { type: Boolean, default: false },
});

// 刻度用平方根，讓低空（對流層、平流層）有足夠的空間
const altiPos = h => Math.min(100, Math.sqrt(Math.max(0, h) / 200000) * 100);
const isCurrent = l => !l.karman && props.hud.alt >= l.from && props.hud.alt < l.to;
const pressureText = computed(() => {
  const p = props.hud.pr * 101.325;
  return p > 1 ? p.toFixed(1) + ' kPa' : p > 0.001 ? (p * 1000).toFixed(1) + ' Pa' : '≈ 0';
});
</script>

<template>
<aside class="alti" :class="{ quiet }" aria-label="大氣層高度計">
    <div class="alti-scale">
      <div v-for="l in LAYERS" :key="l.name" class="alti-layer" :class="{ on: isCurrent(l), karman: l.karman }" :style="{ bottom: altiPos(l.from) + '%' }">
        {{ l.name }}<template v-if="l.sub"><br /><span>{{ l.sub }}</span></template>
      </div>
      <div class="alti-mark" :style="{ bottom: altiPos(hud.alt) + '%' }"></div>
    </div>
    <div class="alti-read">
      <div><span>動壓 q</span><b :class="{ hot: hud.q > 20000 }">{{ fmtNum(hud.q / 1000, 1) }} kPa</b></div>
      <div><span>馬赫數</span><b>{{ fmtNum(hud.mach, 2) }}</b></div>
      <div><span>外界氣壓</span><b>{{ pressureText }}</b></div>
      <div><span>過載</span><b>{{ fmtNum(hud.g, 2) }} g</b></div>
      <div><span>俯仰角</span><b>{{ fmtNum(hud.pitch, 1) }}°</b></div>
    </div>
  </aside>
</template>

<style scoped>
.alti { transition: opacity .6s ease; }
.alti.quiet { opacity: 0; }
.alti { position: fixed; right: max(16px, 2.4vw); top: 50%; transform: translateY(-56%); z-index: 10; display: flex; gap: 14px; align-items: stretch; height: min(52vh, 440px); pointer-events: none; }
.alti-scale { position: relative; width: 108px; border-right: 1px solid var(--line); }
.alti-layer { position: absolute; right: 0; left: 0; border-top: 1px dashed rgba(206,220,240,.12); font-size: 12.5px; color: var(--ink-3); text-align: right; padding: 3px 10px 0 0; letter-spacing: .08em; line-height: 1.3; }
.alti-layer.on { color: var(--ink); }
.alti-layer.karman { border-top: 1px solid var(--frost); color: var(--frost); }
.alti-mark { position: absolute; right: -6px; width: 11px; height: 11px; border: 1.5px solid var(--flame); background: var(--void); transform: translateY(50%) rotate(45deg); transition: bottom .12s linear; }
.alti-read { display: flex; flex-direction: column; justify-content: center; gap: 14px; font-family: var(--f-mono); }
.alti-read div { display: flex; flex-direction: column; }
.alti-read span { font-size: 11.5px; color: var(--ink-3); letter-spacing: .16em; }
.alti-read b { font-weight: 500; font-size: 17px; font-variant-numeric: tabular-nums; }
.alti-read b.hot { color: var(--warn); }
@media (max-width: 1080px) {
  .alti { display: none; }
}
@media (max-height: 760px) and (min-width: 761px) {
  .alti { height: min(46vh, 300px); }
}
@media (max-height: 560px) and (min-width: 761px) {
  .alti { display: none; }
}
</style>
