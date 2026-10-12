<script setup>
import { computed } from 'vue';
import ArcGauge from './ArcGauge.vue';
import EngineMap from './EngineMap.vue';
import PropellantBars from './PropellantBars.vue';
import MissionTimeline from './MissionTimeline.vue';
import { EV } from '../sim/flightData.js';
import { clockOf } from '../utils/format.js';

const props = defineProps({
  hud: { type: Object, required: true },
  quiet: { type: Boolean, default: false },
  boosterEngines: { type: Array, default: () => [] },
  shipEngines: { type: Array, default: () => [] },
});
const boosterGone = computed(() => props.hud.t > EV.sep + 40);
</script>

<template>
<footer class="hud" :class="{ quiet }">
    <div class="stage" :class="{ dim: boosterGone }">
      <div class="stage-name">BOOSTER</div>
      <ArcGauge :value="hud.bSpeed" :max="8000" unit="KM/H" label="SPEED" />
      <ArcGauge :value="hud.bAlt / 1000" :max="200" :digits="hud.bAlt < 10000 ? 2 : 1" unit="KM" label="ALTITUDE" color="#9cc9ff" />
      <EngineMap :engines="boosterEngines" :lit="hud.bLit" label="一級引擎狀態" />
      <PropellantBars :level="hud.bProp" />
    </div>

    <div class="center">
      <div class="phase">{{ hud.phase }}</div>
      <div class="clock">{{ clockOf(hud.t) }}</div>
      <MissionTimeline :t="hud.t" />
    </div>

    <div class="stage right">
      <PropellantBars :level="hud.sProp" />
      <EngineMap :engines="shipEngines" :lit="hud.sLit" variant="ship" label="二級引擎狀態" />
      <ArcGauge :value="hud.speed" :max="28000" unit="KM/H" label="SPEED" />
      <ArcGauge :value="hud.alt / 1000" :max="200" :digits="hud.alt < 10000 ? 2 : 1" unit="KM" label="ALTITUDE" color="#9cc9ff" />
      <div class="stage-name">SHIP</div>
    </div>
  </footer>
</template>

<style scoped>
.hud { transition: opacity .6s ease; }
.hud.quiet { opacity: .22; }
.hud { position: fixed; left: 0; right: 0; bottom: 0; z-index: 15; padding: 0 max(16px, 2.4vw) calc(14px + env(safe-area-inset-bottom, 0px)); display: grid; grid-template-columns: 1fr minmax(320px, 1.2fr) 1fr; align-items: end; gap: 18px; pointer-events: none; background: linear-gradient(to top, rgba(4,6,11,.78), rgba(4,6,11,0)); padding-top: 50px; }
.stage { display: flex; align-items: flex-end; gap: 14px; min-width: 0; transition: opacity .6s; }
.stage.right { justify-content: flex-end; }
.stage.dim { opacity: .38; }
.stage-name { font-family: var(--f-display); font-weight: 700; font-size: 14px; letter-spacing: .26em; color: var(--ink-2); writing-mode: vertical-rl; transform: rotate(180deg); padding-bottom: 4px; }
.center { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.clock { font-family: var(--f-display); font-weight: 700; font-size: 46px; line-height: 1; letter-spacing: .06em; font-variant-numeric: tabular-nums; }
.phase { font-size: 14px; letter-spacing: .24em; color: var(--ink-2); text-transform: uppercase; min-height: 1.2em; text-align: center; }
@media (max-width: 760px) {
  .hud { grid-template-columns: 1fr 1fr; padding-top: 30px; gap: 10px 12px; }
  .center { grid-column: 1 / -1; grid-row: 1; }
  .stage { gap: 8px; }
  .stage-name { font-size: 10px; }
  .clock { font-size: 30px; }
}
@media (max-height: 760px) and (min-width: 761px) {
  .hud { padding-top: 26px; }
  .clock { font-size: 34px; }
  .phase { font-size: 12px; }
}
</style>
