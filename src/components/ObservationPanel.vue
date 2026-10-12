<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { PROFILE } from '../config/profile.js';

// 觀測黑騎士時跳出的高科技視窗：物體檔案 → 訊號解碼 → 發送者（也就是作者本人）
const emit = defineEmits(['close', 'contact']);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const DOSSIER = [
  ['1899', '特斯拉的無線電實驗收到無法解釋的規律訊號'],
  ['1954', '報紙報導美國空軍偵測到兩顆不屬於任何國家的衛星'],
  ['1960', '美國海軍追蹤到一個暗色物體，後來確認是 Discoverer 8 殘骸'],
  ['1998', 'STS-88 任務拍到一個黑色、扭曲、像翅膀的物體'],
];

// 解碼字串：逐字出現，未解出的位置用雜訊字元填滿
const LINE = '解碼完成。這段週期性脈衝其實是一則訊息，發送者是：';
const NOISE = '01#%&$@<>/\\|=+*';
const decoded = ref(reduced ? LINE : '');
const showSender = ref(reduced);
const elapsed = ref(0);
let iv = 0, clock = 0;
onMounted(() => {
  const t0 = performance.now();
  clock = setInterval(() => (elapsed.value = (performance.now() - t0) / 1000), 250);
  if (reduced) return;
  let i = 0;
  setTimeout(() => {
    iv = setInterval(() => {
      i++;
      const tail = Array.from({ length: Math.min(6, LINE.length - i) }, () => NOISE[(Math.random() * NOISE.length) | 0]).join('');
      decoded.value = LINE.slice(0, i) + tail;
      if (i >= LINE.length) { clearInterval(iv); decoded.value = LINE; setTimeout(() => (showSender.value = true), 250); }
    }, 38);
  }, 1300);
});
onBeforeUnmount(() => { clearInterval(iv); clearInterval(clock); });
const trk = computed(() => { const s = Math.floor(elapsed.value); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; });
</script>

<template>
  <section class="obs" role="dialog" aria-label="黑騎士觀測視窗">
    <span class="cn a"></span><span class="cn b"></span><span class="cn c"></span><span class="cn d"></span>
    <header>
      <div class="rec"><i></i>OBSERVATION LOG</div>
      <div class="trk">TRK {{ trk }}</div>
      <button type="button" class="x" aria-label="結束觀測" @click="emit('close')">×</button>
    </header>

    <div class="scroll">
      <div class="target">
        <span class="lbl">目標鎖定 · 未登錄軌道物體</span>
        <h2>黑騎士衛星</h2>
        <span class="en">BLACK KNIGHT SATELLITE</span>
      </div>

      <dl class="log">
        <div v-for="[y, txt] in DOSSIER" :key="y"><dt>{{ y }}</dt><dd>{{ txt }}</dd></div>
      </dl>
      <p class="note">官方解釋：照片裡是太空人在太空漫步時遺失的隔熱毯，幾天後就在大氣層燒毀。傳說則說它在極地軌道上繞了一萬三千年。</p>

      <div class="decode">
        <span class="lbl">訊號解碼</span>
        <p class="type">&gt; {{ decoded }}<i v-if="!showSender" class="caret"></i></p>
      </div>

      <Transition name="sender">
        <div v-if="showSender" class="sender">
          <div class="who">
            <b>{{ PROFILE.name }}</b>
            <span>{{ PROFILE.role }}</span>
          </div>
          <p class="tagline">{{ PROFILE.tagline }}</p>
          <ul class="links">
            <li><span>GITHUB</span><a :href="PROFILE.github" target="_blank" rel="noopener">{{ PROFILE.githubLabel }}</a></li>
            <li><span>PORTFOLIO</span><a :href="PROFILE.resume" target="_blank" rel="noopener">{{ PROFILE.resumeLabel }}</a></li>
            <li v-if="PROFILE.email"><span>EMAIL</span><a :href="'mailto:' + PROFILE.email">{{ PROFILE.email }}</a></li>
          </ul>
        </div>
      </Transition>
    </div>

    <footer>
      <button type="button" class="ghost" @click="emit('close')">結束觀測</button>
      <a class="contact" :href="PROFILE.resume" target="_blank" rel="noopener" @click="emit('contact')">
        CONTACT ME <span aria-hidden="true">↗</span>
      </a>
    </footer>
    <div class="scan" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
.obs {
  --hot: #ff6a3a;
  position: fixed; z-index: 25; right: max(16px, 3vw); top: calc(84px + env(safe-area-inset-top, 0px)); bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  width: min(470px, calc(100vw - 32px)); display: flex; flex-direction: column;
  background: linear-gradient(160deg, rgba(14, 6, 6, .82), rgba(5, 8, 15, .8) 45%);
  border: 1px solid rgba(255, 106, 58, .32); backdrop-filter: blur(18px) saturate(1.2); -webkit-backdrop-filter: blur(18px) saturate(1.2);
  animation: open .7s cubic-bezier(.2, .7, .2, 1);
  overflow: hidden; pointer-events: auto;
}
@keyframes open { 0% { clip-path: inset(50% 0 50% 0); opacity: 0; } 40% { clip-path: inset(49% 0 49% 0); opacity: 1; } 100% { clip-path: inset(0 0 0 0); } }
.cn { position: absolute; width: 18px; height: 18px; border: 2px solid var(--hot); pointer-events: none; }
.cn.a { left: -1px; top: -1px; border-right: 0; border-bottom: 0; }
.cn.b { right: -1px; top: -1px; border-left: 0; border-bottom: 0; }
.cn.c { left: -1px; bottom: -1px; border-right: 0; border-top: 0; }
.cn.d { right: -1px; bottom: -1px; border-left: 0; border-top: 0; }
.scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(to bottom, rgba(255, 255, 255, .025) 0 1px, transparent 1px 3px); mix-blend-mode: screen; }
.scan::after { content: ""; position: absolute; left: 0; right: 0; height: 30%; background: linear-gradient(to bottom, transparent, rgba(255, 106, 58, .06), transparent); animation: sweep 5s linear infinite; }
@keyframes sweep { from { top: -30%; } to { top: 100%; } }

header { display: flex; align-items: center; gap: 14px; padding: 16px 18px 14px 22px; border-bottom: 1px solid rgba(255, 106, 58, .2); font-family: var(--f-mono); font-size: 12px; letter-spacing: .2em; }
.rec { display: flex; align-items: center; gap: 9px; color: #ffb39a; }
.rec i { width: 8px; height: 8px; border-radius: 50%; background: var(--hot); box-shadow: 0 0 10px var(--hot); animation: blinkrec 1.2s steps(2) infinite; }
@keyframes blinkrec { 50% { opacity: .2; } }
.trk { color: var(--ink-3); font-variant-numeric: tabular-nums; }
.x { margin-left: auto; appearance: none; width: 34px; height: 34px; border: 1px solid var(--line); background: transparent; color: var(--ink); font-size: 20px; line-height: 1; border-radius: 2px; cursor: pointer; }
.x:hover { border-color: var(--hot); }

.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px 8px; display: flex; flex-direction: column; gap: 18px; }
.lbl { font-family: var(--f-mono); font-size: 11.5px; letter-spacing: .2em; color: #ff9a74; }
.target h2 { font-weight: 900; font-size: 40px; line-height: 1.05; margin: 8px 0 4px; letter-spacing: .04em; }
.en { font-family: var(--f-display); font-weight: 700; font-size: 15px; letter-spacing: .32em; color: var(--ink-3); }
.log { margin: 0; border-top: 1px solid var(--line); }
.log div { display: grid; grid-template-columns: 58px 1fr; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.log dt { font-family: var(--f-display); font-weight: 700; font-size: 20px; color: #ffb39a; font-variant-numeric: tabular-nums; }
.log dd { margin: 0; font-size: 14.5px; line-height: 1.6; color: #d3dae6; }
.note { margin: 0; font-size: 13.5px; line-height: 1.7; color: var(--ink-2); }
.decode { padding: 14px 16px; background: rgba(255, 106, 58, .06); border: 1px solid rgba(255, 106, 58, .18); }
.type { margin: 8px 0 0; font-family: var(--f-mono); font-size: 14px; line-height: 1.7; color: #ffe1d6; word-break: break-all; }
.caret { display: inline-block; width: 8px; height: 15px; margin-left: 2px; vertical-align: -2px; background: #ffb39a; animation: blinkrec .8s steps(2) infinite; }
.sender { padding: 4px 0 6px; }
.who b { display: block; font-size: 30px; font-weight: 900; letter-spacing: .03em; }
.who span { font-family: var(--f-mono); font-size: 13px; letter-spacing: .2em; color: var(--frost); }
.tagline { margin: 8px 0 14px; font-size: 15px; color: var(--ink-2); }
.links { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.links li { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: baseline; padding: 11px 0; border-bottom: 1px solid var(--line); }
.links span { font-family: var(--f-mono); font-size: 11.5px; letter-spacing: .18em; color: var(--ink-3); }
.links a { color: var(--ink); font-size: 15.5px; text-decoration: none; border-bottom: 1px solid rgba(156, 201, 255, .4); justify-self: start; word-break: break-all; }
.links a:hover { color: var(--frost); border-color: var(--frost); }
.sender-enter-active { transition: opacity .6s ease, transform .6s ease; }
.sender-enter-from { opacity: 0; transform: translateY(10px); }

footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px 18px 22px; border-top: 1px solid rgba(255, 106, 58, .2); }
.ghost { appearance: none; background: none; border: 0; color: var(--ink-2); font: 500 14px/1 var(--f-zh); letter-spacing: .12em; cursor: pointer; padding: 8px 0; }
.ghost:hover { color: var(--ink); }
.contact { display: inline-flex; align-items: center; gap: 10px; padding: 14px 22px; background: var(--hot); color: #160604; font: 700 14px/1 var(--f-mono); letter-spacing: .22em; text-decoration: none; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); transition: filter .2s; }
.contact:hover { filter: brightness(1.15); }
.contact span { font-size: 16px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--frost); outline-offset: 2px; }

@media (max-width: 760px) {
  .obs { top: auto; height: min(70vh, 560px); left: 16px; right: 16px; width: auto; }
  .target h2 { font-size: 30px; }
}
@media (prefers-reduced-motion: reduce) {
  .obs, .scan::after, .rec i, .caret { animation: none; }
}
</style>
