<script setup>
import { EV } from '../sim/flightData.js';
import { MILESTONES } from '../sim/missionEvents.js';

defineProps({ t: { type: Number, default: -10 } });
const pos = t => Math.min(100, Math.max(0, (t + 10) / (EV.seco + 10) * 100));
</script>

<template>
<div class="tl">
    <div class="tl-line"></div>
    <div class="tl-fill" :style="{ width: pos(t) + '%' }"></div>
    <div
      v-for="m in MILESTONES" :key="m.label" class="tl-ev"
      :class="{ past: t > m.t + 2, now: Math.abs(t - m.t) <= 2 }"
      :style="{ left: pos(m.t) + '%' }"
    ><i></i><span>{{ m.label }}</span></div>
  </div>
</template>

<style scoped>
.tl { position: relative; width: 100%; height: 34px; }
.tl-line { position: absolute; left: 0; right: 0; top: 9px; height: 1px; background: var(--line); }
.tl-fill { position: absolute; left: 0; top: 9px; height: 1px; background: var(--ink); }
.tl-ev { position: absolute; top: 5px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.tl-ev i { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--ink-3); background: var(--void); transition: background .3s, border-color .3s, box-shadow .3s; }
.tl-ev.past i { background: var(--ink); border-color: var(--ink); }
.tl-ev.now i { background: var(--flame); border-color: var(--flame); box-shadow: 0 0 10px var(--flame); }
.tl-ev span { font-family: var(--f-mono); font-size: 10.5px; letter-spacing: .1em; color: var(--ink-3); white-space: nowrap; }
.tl-ev.past span, .tl-ev.now span { color: var(--ink-2); }
@media (max-width: 760px) {
  .tl-ev span { display: none; }
  .tl-ev.now span { display: block; }
}
</style>
