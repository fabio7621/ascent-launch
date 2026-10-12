<script setup>
import { EV } from '../sim/flightData.js';
import { fmtNum, mmss } from '../utils/format.js';

defineProps({ hidden: { type: Boolean, default: false } });
const emit = defineEmits(['replay', 'close']);
</script>

<template>
<div id="finale" class="finale">
    <div class="summary" :class="{ off: hidden }">
      <button type="button" class="close" aria-label="關閉摘要，自由觀察" @click="emit('close')"><span>自由觀察</span><b>×</b></button>
      <div class="sum-main">
        <div class="eyebrow">任務摘要 · SECO T+{{ mmss(EV.seco) }}</div>
        <h2><span>二級關機，</span><span>進入次軌道滑行</span></h2>
        <p>從點火到卡門線只花了 {{ Math.round(EV.karman) }} 秒。一級在 {{ fmtNum(EV.mecoAlt / 1000, 0) }} km 熱分離後翻轉返航，二級繼續加速到接近軌道速度。</p>
        <button class="replay" @click="emit('replay')">重新發射</button>
      </div>
      <div class="sum-grid">
        <div><span>最大動壓</span><b>{{ fmtNum(EV.maxQVal / 1000, 1) }}<small>kPa</small></b></div>
        <div><span>Max-Q 高度</span><b>{{ fmtNum(EV.maxQAlt / 1000, 1) }}<small>km</small></b></div>
        <div><span>抵達卡門線</span><b>T+{{ mmss(EV.karman) }}</b></div>
        <div><span>最大過載</span><b>{{ fmtNum(EV.maxG, 1) }}<small>g</small></b></div>
        <div><span>關機速度</span><b>{{ fmtNum(EV.secoV * 3.6, 0) }}<small>km/h</small></b></div>
        <div><span>關機高度</span><b>{{ fmtNum(EV.secoAlt / 1000, 0) }}<small>km</small></b></div>
      </div>
      <div class="sources">模型參數參考 Super Heavy／Starship 公開規格；大氣為指數密度近似，阻力係數含跨音速峰值。</div>
    </div>
  </div>
</template>

<style scoped>
.finale { position: relative; z-index: 16; min-height: 100vh; display: flex; align-items: center; padding-block: 96px 120px; }
.summary { width: min(1080px, 100%); display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 8px 48px; align-items: end; background: linear-gradient(100deg, rgba(5, 8, 15, .86), rgba(5, 8, 15, .62)); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid var(--line); border-radius: 4px; padding: 34px 38px; }
.sum-main { min-width: 0; }
.summary h2 { font-family: var(--f-zh); font-weight: 900; font-size: clamp(28px, 3.2vw, 46px); line-height: 1.12; margin: 12px 0 14px; }
.summary h2 span { display: inline-block; }
.summary p { color: #c4cddb; margin: 0; max-width: 32em; font-size: 17px; line-height: 1.75; }
.sum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; border-top: 1px solid var(--line); min-width: 0; }
.sum-grid div { padding: 14px 0 12px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sum-grid span { font-size: 13px; color: var(--ink-3); letter-spacing: .1em; }
.sum-grid b { font-family: var(--f-display); font-size: 30px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.sum-grid b small { font-size: 14px; color: var(--ink-2); margin-left: 3px; font-weight: 500; }
.replay { margin-top: 24px; appearance: none; border: 1px solid var(--flame); color: var(--ink); background: rgba(255, 164, 92, .12); padding: 12px 22px; font: 700 14px/1 var(--f-zh); letter-spacing: .2em; border-radius: 2px; cursor: pointer; transition: background .3s; }
.replay:hover { background: rgba(255, 164, 92, .26); }
.sources { grid-column: 1 / -1; margin-top: 14px; font-size: 12px; color: var(--ink-3); }
@media (max-width: 900px) {
  .summary { grid-template-columns: 1fr; padding: 26px 24px; }
}
@media (max-height: 760px) and (min-width: 761px) {
  .finale { padding-block: 76px 40px; }
  .summary { padding: 22px 28px; }
  .summary h2 { font-size: 30px; margin: 8px 0 10px; }
  .summary p { font-size: 15px; }
  .sum-grid div { padding: 9px 0 8px; }
  .sum-grid b { font-size: 24px; }
}
.summary { position: relative; transition: opacity .5s ease, transform .5s ease; }
.summary.off { opacity: 0; transform: translateY(16px) scale(.98); pointer-events: none; }
.close { position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; gap: 10px; appearance: none; border: 1px solid var(--line); background: rgba(232, 237, 245, .05); color: var(--ink-2); padding: 7px 8px 7px 14px; border-radius: 999px; font: 500 13px/1 var(--f-zh); letter-spacing: .14em; cursor: pointer; transition: color .2s, border-color .2s; }
.close b { font-size: 18px; font-weight: 400; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: rgba(232, 237, 245, .1); }
.close:hover { color: var(--ink); border-color: var(--frost); }
</style>
