<script setup>
defineProps({
  chapter: { type: Number, default: 0 },
  soundOn: { type: Boolean, default: false },
});
const emit = defineEmits(['go', 'toggle-sound']);
const chapters = [
  { id: 'pad', name: '發射台' },
  { id: 'ascent', name: '穿越大氣' },
  { id: 'space', name: '太空' },
];
</script>

<template>
<header class="topbar">
    <div class="brand">Ascent<small>升空計畫</small></div>
    <nav class="chapters" aria-label="章節">
      <button v-for="(c, i) in chapters" :key="c.id" :class="{ on: chapter === i }" @click="emit('go', i)">
        <b>0{{ i + 1 }}</b><span>{{ c.name }}</span>
      </button>
    </nav>
    <button class="sound" :class="{ on: soundOn }" :aria-pressed="soundOn" @click="emit('toggle-sound')">
      <i aria-hidden="true"><span></span><span></span><span></span></i>{{ soundOn ? '聲音開' : '聲音關' }}
    </button>
  </header>
</template>

<style scoped>
.topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 20; display: flex; align-items: center; gap: 24px; padding: calc(14px + env(safe-area-inset-top, 0px)) 24px 14px; pointer-events: none; }
.topbar > * { pointer-events: auto; }
.brand { display: flex; align-items: baseline; gap: 10px; font-family: var(--f-display); font-weight: 900; font-size: 22px; letter-spacing: .16em; text-transform: uppercase; }
.brand small { font-family: var(--f-zh); font-weight: 500; font-size: 12px; letter-spacing: .3em; color: var(--ink-2); }
.chapters { display: flex; gap: 4px; margin-left: auto; }
.chapters button, .sound { appearance: none; border: 1px solid transparent; background: none; color: var(--ink-2); font: 500 12px/1 var(--f-zh); letter-spacing: .12em; padding: 9px 12px; border-radius: 999px; cursor: pointer; transition: color .3s, border-color .3s, background .3s; }
.chapters button b { font-family: var(--f-mono); font-weight: 500; margin-right: 6px; color: var(--ink-3); }
.chapters button.on { color: var(--ink); border-color: var(--line); background: var(--glass); }
.chapters button.on b { color: var(--flame); }
.chapters button:hover, .sound:hover { color: var(--ink); }
.sound { border-color: var(--line); display: inline-flex; align-items: center; gap: 8px; }
.sound i { width: 14px; height: 10px; display: inline-flex; align-items: flex-end; gap: 2px; }
.sound i span { width: 2px; background: currentColor; height: 3px; transition: height .2s; }
.sound.on i span { animation: eq 0.9s ease-in-out infinite alternate; }
.sound.on i span:nth-child(2) { animation-delay: -.3s; }
.sound.on i span:nth-child(3) { animation-delay: -.6s; }
@keyframes eq { from { height: 2px; } to { height: 10px; } }
@media (max-width: 760px) {
  .chapters button span { display: none; }
  .chapters button b { margin: 0; }
  .brand small { display: none; }
  .topbar { gap: 10px; padding-inline: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .sound.on i span { animation: none; }
}
</style>
