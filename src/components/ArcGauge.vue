<script setup>
import { fmtNum } from '../utils/format.js';

defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, required: true },
  digits: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  label: { type: String, default: '' },
  color: { type: String, default: '#e8edf5' },
});

// 270° 圓弧：stroke-dasharray / dashoffset 控制填滿比例
const R = 44;
const arcLen = R * Math.PI * 1.5;
const arcPath = (() => {
  const p = a => [50 + R * Math.cos(a), 50 + R * Math.sin(a)];
  const [x0, y0] = p(Math.PI * 0.75), [x1, y1] = p(Math.PI * 2.25);
  return `M ${x0} ${y0} A ${R} ${R} 0 1 1 ${x1} ${y1}`;
})();
</script>

<template>
<div class="gauge">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path :d="arcPath" fill="none" stroke="rgba(206,220,240,.16)" stroke-width="3" />
      <path :d="arcPath" fill="none" :stroke="color" stroke-width="3" :stroke-dasharray="arcLen" :stroke-dashoffset="arcLen * (1 - Math.min(1, value / max))" />
    </svg>
    <div class="val"><b>{{ fmtNum(value, digits) }}</b><span>{{ unit }}</span></div>
    <div class="lbl">{{ label }}</div>
  </div>
</template>

<style scoped>
.gauge { position: relative; width: 100px; height: 100px; flex: none; }
.gauge svg { width: 100%; height: 100%; display: block; }
.gauge .val { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 4px; }
.gauge .val b { font-family: var(--f-display); font-weight: 700; font-size: 25px; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.gauge .val span { font-family: var(--f-mono); font-size: 10px; letter-spacing: .14em; color: var(--ink-3); margin-top: 3px; }
.gauge .lbl { position: absolute; bottom: -4px; left: 0; right: 0; text-align: center; font-family: var(--f-mono); font-size: 10px; letter-spacing: .2em; color: var(--ink-2); }
@media (max-width: 760px) {
  .gauge { width: 70px; height: 70px; }
  .gauge .val b { font-size: 17px; }
}
@media (max-height: 760px) and (min-width: 761px) {
  .gauge { width: 78px; height: 78px; }
  .gauge .val b { font-size: 19px; }
}
</style>
