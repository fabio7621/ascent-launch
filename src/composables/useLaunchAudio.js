// 火箭聲音：WebAudio 合成（低頻轟鳴＋爆裂聲），音量隨外界氣壓下降，真空中聽不到
import { EV } from '../sim/flightData.js';

export function useLaunchAudio() {
  const audio = { ctx: null, gain: null, crackG: null, lp: null, on: false };
  function initAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const cbuf = ctx.createBuffer(1, len, ctx.sampleRate), cd = cbuf.getChannelData(0);
    for (let i = 0; i < len; i++) cd[i] = Math.random() < 0.002 ? (Math.random() * 2 - 1) : cd[i - 1] * 0.6 || 0;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const csrc = ctx.createBufferSource(); csrc.buffer = cbuf; csrc.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const crackG = ctx.createGain(); crackG.gain.value = 0;
    src.connect(lp).connect(gain).connect(ctx.destination);
    csrc.connect(bp).connect(crackG).connect(ctx.destination);
    src.start(); csrc.start();
    Object.assign(audio, { ctx, gain, crackG, lp });
  }
  function updateAudio(state, sm) {
    if (!audio.ctx || !audio.on) return;
    const t = state.t, st = state.st || {};
    const thrust = t < -3 ? 0 : t < 0 ? sm(-3, -1.5, t) : (t < EV.sep ? 1 : 0);
    const pr = state.pr ?? 1;
    const level = thrust * Math.sqrt(pr) * (t < 25 ? 1 : 0.7);
    const now = audio.ctx.currentTime;
    audio.gain.gain.setTargetAtTime(level * 0.85, now, 0.15);
    audio.crackG.gain.setTargetAtTime(level * 0.55 * (t > 0 ? 1 : 0.4), now, 0.15);
    audio.lp.frequency.setTargetAtTime(180 + 420 * pr, now, 0.3);
  }
  function toggle() {
    if (!audio.ctx) initAudio();
    audio.on = !audio.on;
    if (audio.on) audio.ctx.resume();
    else { audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1); audio.crackG.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1); }
    return audio.on;
  }
  function dispose() { if (audio.ctx) audio.ctx.close(); }
  return { toggle, update: updateAudio, dispose };
}
