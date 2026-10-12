<script setup>
import { computed } from 'vue';
import { CARDS } from '../sim/missionEvents.js';
import { clockOf } from '../utils/format.js';

const props = defineProps({
  t: { type: Number, required: true },        // 任務時間（秒）
  hidden: { type: Boolean, default: false },  // 摘要屏出現時隱藏
});

// 同一時間只顯示一張：取時間窗內最後一張
const card = computed(() => {
  const list = CARDS.filter(c => props.t >= c.t0 && props.t < c.t1);
  return list.length ? list[list.length - 1] : null;
});
const progress = computed(() => {
  const c = card.value;
  return c ? Math.min(1, Math.max(0, (props.t - c.t0) / (c.t1 - c.t0))) : 0;
});
</script>

<template>
<div class="events" aria-live="polite">
    <!-- 沒有 mode：新舊卡在同一個 grid 格子裡交叉淡入淡出，不會互相等待 -->
    <Transition name="cardfx">
      <article v-if="card && !hidden" :key="card.id" class="card" :style="{ '--accent': card.accent }">
        <div class="code">{{ card.code }}<span>{{ clockOf(card.t0) }}</span></div>
        <h3>{{ card.title }}</h3>
        <p>{{ card.body }}</p>
        <div v-if="card.stats" class="stat">
          <div v-for="s in card.stats" :key="s[1]"><b>{{ s[0] }}</b><span>{{ s[1] }}</span></div>
        </div>
        <div class="prog"><i :style="{ transform: `scaleX(${progress})` }"></i></div>
      </article>
    </Transition>
  </div>
</template>

<style scoped>
.events { position: fixed; left: max(16px, 4.5vw); top: 50%; transform: translateY(-46%); z-index: 10; width: min(520px, calc(100vw - 32px)); display: grid; pointer-events: none; }
.events > * { grid-area: 1 / 1; }
.card { position: relative; background: linear-gradient(100deg, rgba(5, 8, 15, .78), rgba(5, 8, 15, .5)); backdrop-filter: blur(16px) saturate(1.2); -webkit-backdrop-filter: blur(16px) saturate(1.2); border: 1px solid var(--line); border-radius: 3px; padding: 26px 30px 28px 32px; overflow: hidden; }
.card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent, var(--flame)); box-shadow: 0 0 18px var(--accent, var(--flame)); }
.card .code { font-family: var(--f-mono); font-size: 13px; letter-spacing: .2em; color: var(--accent, var(--flame)); display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.card .code span { color: var(--ink-2); letter-spacing: .12em; font-variant-numeric: tabular-nums; }
.card h3 { font-weight: 900; font-size: 38px; line-height: 1.12; margin: 10px 0 12px; letter-spacing: .02em; text-wrap: balance; }
.card p { margin: 0; color: #d3dae6; font-size: 17px; line-height: 1.8; max-width: 30em; }
.card .stat { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); display: flex; gap: 34px; flex-wrap: wrap; }
.card .stat div { display: flex; flex-direction: column; min-width: 0; }
.card .stat b { font-family: var(--f-display); font-weight: 700; font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.card .stat span { font-size: 13px; color: var(--ink-2); letter-spacing: .08em; margin-top: 7px; }
.card .prog { position: absolute; left: 3px; right: 0; bottom: 0; height: 2px; background: rgba(206,220,240,.08); }
.card .prog i { position: absolute; inset: 0; background: var(--accent, var(--flame)); opacity: .7; transform-origin: left; }
.cardfx-enter-active { transition: opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1); }
.cardfx-leave-active { transition: opacity .35s ease, transform .35s ease; }
.cardfx-enter-from { opacity: 0; transform: translateX(-18px); }
.cardfx-leave-to { opacity: 0; transform: translateX(10px); }
@media (max-width: 1240px) {
  .events { width: min(440px, calc(100vw - 32px)); }
  .card h3 { font-size: 32px; }
  .card p { font-size: 16px; }
}
@media (max-width: 760px) {
  .events { top: auto; bottom: 236px; transform: none; }
  .card { padding: 18px 20px 20px 22px; }
  .card h3 { font-size: 26px; margin: 6px 0 8px; }
  .card p { font-size: 15px; line-height: 1.7; }
  .card .stat { margin-top: 12px; padding-top: 10px; gap: 22px; }
  .card .stat b { font-size: 24px; }
  .card .stat span { font-size: 12px; }
}
@media (max-height: 760px) and (min-width: 761px) {
  .events { top: 78px; transform: none; width: min(440px, calc(100vw - 32px)); }
  .card { padding: 16px 20px 18px 22px; }
  .card .code { font-size: 11.5px; }
  .card h3 { font-size: 26px; margin: 6px 0 8px; }
  .card p { font-size: 14.5px; line-height: 1.65; }
  .card .stat { margin-top: 12px; padding-top: 10px; gap: 24px; }
  .card .stat b { font-size: 24px; }
  .card .stat span { font-size: 12px; margin-top: 4px; }
}
@media (max-height: 560px) and (min-width: 761px) {
  .card .stat { display: none; }
  .card p { font-size: 13.5px; line-height: 1.55; }
  .card h3 { font-size: 22px; }
}
</style>
