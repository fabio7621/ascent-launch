<script setup>
defineProps({
  engines: { type: Array, required: true },               // [{ x, y, r }]，SVG 座標
  lit: { type: [Array, Boolean], default: false },        // 每具引擎是否點火，或整組同一狀態
  variant: { type: String, default: 'booster' },
  label: { type: String, default: '引擎狀態' },
});
</script>

<template>
<svg class="engmap" :class="variant" viewBox="-50 -50 100 100" :aria-label="label">
    <circle r="47" fill="none" stroke="rgba(206,220,240,.25)" stroke-width="1" />
    <circle
      v-for="(e, i) in engines" :key="i" :cx="e.x" :cy="e.y" :r="e.r"
      :fill="(Array.isArray(lit) ? lit[i] : lit) ? '#e8edf5' : 'transparent'"
      stroke="rgba(206,220,240,.55)" stroke-width="1.1"
    />
  </svg>
</template>

<style scoped>
.engmap { width: 70px; height: 70px; flex: none; }
.engmap.ship { width: 52px; height: 52px; }
@media (max-width: 760px) {
  .engmap { display: none; }
}
@media (max-height: 760px) and (min-width: 761px) {
  .engmap { width: 56px; height: 56px; }
}
</style>
