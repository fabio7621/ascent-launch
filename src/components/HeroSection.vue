<script setup>
import { fmtNum } from '../utils/format.js';
import { LIFTOFF_MASS } from '../sim/flightData.js';

// fade：1 = 完全顯示，0 = 已捲走（由 App 依捲動位置計算）
defineProps({ fade: { type: Number, default: 1 } });
</script>

<template>
<section id="pad" class="chapter hero">
    <div class="hero-copy" :style="{ opacity: fade, transform: `translateY(${(1 - fade) * -30}px)` }">
      <div class="eyebrow"><i class="dot"></i>黎明發射窗口 · 推進劑加注完成 · 等待點火</div>
      <h1>把 <em>5,000</em> 噸<br />推出大氣層</h1>
      <p class="lede">兩級全可重複使用的超重型火箭停在發射台上。往下捲動開始倒數，捲得越深飛得越高。畫面與遙測數字全部來自頁面裡即時運算的飛行模擬。</p>
      <div class="specs">
        <div><b>121<small>m</small></b><span>全箭高度</span></div>
        <div><b>74.4<small>MN</small></b><span>起飛推力</span></div>
        <div><b>{{ fmtNum(LIFTOFF_MASS, 0) }}<small>t</small></b><span>起飛質量</span></div>
        <div><b>33<small>具</small></b><span>一級 Raptor 引擎</span></div>
      </div>
      <div class="cue"><i></i>向下捲動點火</div>
    </div>
  </section>
</template>

<style scoped>
.hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; padding-block: 120px 220px; }
.hero-copy { max-width: 620px; transition: opacity .5s, transform .5s; text-shadow: 0 2px 24px rgba(4, 6, 11, .55); }
.hero h1 { font-family: var(--f-zh); font-weight: 900; font-size: clamp(44px, 7.4vw, 104px); line-height: 1.02; letter-spacing: -.01em; margin: 18px 0 18px; text-wrap: balance; }
.hero h1 em { font-style: normal; font-family: var(--f-display); font-weight: 900; letter-spacing: .01em; color: var(--flame); }
.hero p.lede { color: #c4cddb; max-width: 34em; margin: 0 0 28px; font-size: 18px; line-height: 1.75; }
.specs { display: grid; grid-template-columns: repeat(4, auto); gap: 6px 28px; justify-content: start; }
.specs div { display: flex; flex-direction: column; }
.specs b { font-family: var(--f-display); font-weight: 700; font-size: 30px; line-height: 1; letter-spacing: .02em; font-variant-numeric: tabular-nums; }
.specs b small { font-size: 16px; color: var(--ink-2); margin-left: 3px; }
.specs span { font-size: 13px; color: var(--ink-3); letter-spacing: .12em; margin-top: 6px; }
.cue { margin-top: 36px; display: inline-flex; align-items: center; gap: 12px; font-size: 13px; letter-spacing: .2em; color: var(--ink-2); }
.cue i { width: 1px; height: 34px; background: linear-gradient(var(--ink), transparent); position: relative; overflow: hidden; }
.cue i::after { content: ""; position: absolute; left: -1px; width: 3px; height: 10px; background: var(--flame); animation: drop 1.8s ease-in infinite; }
@keyframes drop { from { top: -10px; } to { top: 34px; } }
@media (max-width: 760px) {
  .specs { grid-template-columns: repeat(2, auto); }
  .hero { padding-block: 100px 260px; }
  .hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(4,6,11,0) 8%, rgba(4,6,11,.55) 40%, rgba(4,6,11,.25) 75%, rgba(4,6,11,0)); pointer-events: none; }
  .hero-copy { position: relative; }
}
@media (prefers-reduced-motion: reduce) {
  .cue i::after { animation: none; }
}
</style>
