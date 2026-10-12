<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

// 自由觀察模式的提示層：操作說明、偵測到不明物體的訊號提示、滑過黑騎士時的準星
defineProps({
  reticle: { type: Object, required: true }, // { x, y, on, hover }
});
const emit = defineEmits(['back']);

// 進入後過幾秒才出現訊號提示，讓人先自己玩一下
const signal = ref(false);
let timer = 0;
onMounted(() => { timer = setTimeout(() => (signal.value = true), 3500); });
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="free">
    <Transition name="sig">
      <div v-if="signal" class="signal" role="status">
        <i></i>
        <div>
          <b>訊號：偵測到未登錄的軌道物體</b>
          <span>方位不明 · 持續發出週期性脈衝</span>
        </div>
      </div>
    </Transition>

    <div v-if="reticle.hover && reticle.on" class="reticle" :style="{ left: reticle.x + 'px', top: reticle.y + 'px' }">
      <span class="br tl"></span><span class="br tr"></span><span class="br bl"></span><span class="br bk"></span>
      <div class="tag"><b>UNKNOWN OBJECT</b><span>點擊觀測</span></div>
    </div>

    <div class="pill">
      <span class="mode">自由觀察</span>
      <span class="how">拖曳旋轉 · 滾輪或雙指縮放 · 點擊太空船回到任務摘要</span>
      <button type="button" @click="emit('back')">回到摘要</button>
    </div>
  </div>
</template>

<style scoped>
.free { position: fixed; inset: 0; z-index: 18; pointer-events: none; }
.pill { position: absolute; left: 50%; bottom: calc(26px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 10px 10px 10px 18px; background: rgba(5, 8, 15, .7); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid var(--line); border-radius: 999px; max-width: calc(100vw - 32px); }
.mode { font-family: var(--f-mono); font-size: 12px; letter-spacing: .2em; color: var(--frost); white-space: nowrap; }
.how { font-size: 14px; color: var(--ink-2); }
.pill button { pointer-events: auto; appearance: none; border: 1px solid var(--line); background: rgba(232, 237, 245, .08); color: var(--ink); font: 500 13px/1 var(--f-zh); letter-spacing: .12em; padding: 10px 16px; border-radius: 999px; cursor: pointer; white-space: nowrap; }
.pill button:hover { background: rgba(232, 237, 245, .16); }

.signal { position: absolute; right: max(16px, 2.4vw); top: calc(86px + env(safe-area-inset-top, 0px)); display: flex; gap: 12px; align-items: flex-start; padding: 14px 18px; background: rgba(20, 6, 4, .55); border: 1px solid rgba(255, 90, 38, .4); border-radius: 3px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.signal i { width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: #ff5a26; box-shadow: 0 0 12px #ff5a26; animation: ping 1.4s ease-in-out infinite; }
.signal b { display: block; font-size: 15px; color: #ffd2c2; letter-spacing: .04em; }
.signal span { font-family: var(--f-mono); font-size: 11.5px; letter-spacing: .14em; color: rgba(255, 210, 194, .65); }
@keyframes ping { 50% { opacity: .2; } }
.sig-enter-active { transition: opacity .6s ease, transform .6s ease; }
.sig-enter-from { opacity: 0; transform: translateY(-8px); }

.reticle { position: absolute; width: 92px; height: 92px; transform: translate(-50%, -50%); }
.br { position: absolute; width: 16px; height: 16px; border: 1.5px solid #ff7a4a; }
.br.tl { left: 0; top: 0; border-right: 0; border-bottom: 0; }
.br.tr { right: 0; top: 0; border-left: 0; border-bottom: 0; }
.br.bl { left: 0; bottom: 0; border-right: 0; border-top: 0; }
.br.bk { right: 0; bottom: 0; border-left: 0; border-top: 0; }
.reticle { animation: lock .5s cubic-bezier(.2, .7, .2, 1); }
@keyframes lock { from { width: 150px; height: 150px; opacity: 0; } }
.tag { position: absolute; left: calc(100% + 10px); top: 0; white-space: nowrap; font-family: var(--f-mono); }
.tag b { display: block; font-size: 12px; letter-spacing: .2em; color: #ff9a74; font-weight: 500; }
.tag span { font-size: 12px; letter-spacing: .1em; color: var(--ink-2); }

@media (max-width: 760px) {
  .how { display: none; }
  .signal { left: 16px; right: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .signal i, .reticle { animation: none; }
}
</style>
