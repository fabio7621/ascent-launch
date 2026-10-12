<script setup>
defineProps({ level: { type: Number, default: 1 } }); // 0–1
</script>

<template>
<div class="props">
    <div class="prop">LOX<i :style="{ '--w': level * 100 + '%' }"></i></div>
    <div class="prop">CH4<i :style="{ '--w': level * 100 + '%', '--c': '#9cc9ff' }"></i></div>
  </div>
</template>

<style scoped>
.props { display: flex; flex-direction: column; gap: 6px; width: 74px; flex: none; padding-bottom: 6px; }
.prop { font-family: var(--f-mono); font-size: 10px; letter-spacing: .16em; color: var(--ink-3); }
.prop i { display: block; height: 3px; background: rgba(206,220,240,.14); margin-top: 3px; position: relative; overflow: hidden; }
.prop i::after { content: ""; position: absolute; inset: 0 auto 0 0; width: var(--w); background: var(--c, var(--ink)); }
@media (max-width: 1080px) {
  .props { display: none; }
}
</style>
