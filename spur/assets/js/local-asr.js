// Spur — Verschriftlichung auf dem Gerät: Audio dekodieren, an den Whisper-Worker geben,
// Ergebnis in Segmente verwandeln und Stimmen anhand der aufgezeichneten Tonhöhe trennen.

let worker = null, seq = 0;
const waiting = new Map();
let progressCb = null;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'progress') { progressCb && progressCb({ phase: 'download', ratio: m.total ? m.loaded / m.total : 0, mb: Math.round(m.total / 1e6) }); return; }
    if (m.type === 'ready') { progressCb && progressCb({ phase: 'ready', device: m.device }); return; }
    if (m.type === 'working') { progressCb && progressCb({ phase: 'working' }); return; }
    const w = waiting.get(m.id); if (!w) return;
    waiting.delete(m.id);
    m.type === 'error' ? w.reject(new Error(m.message)) : w.resolve(m.result);
  };
  worker.onerror = e => { waiting.forEach(w => w.reject(new Error('Sprachmodell konnte nicht starten'))); waiting.clear(); worker = null; };
  return worker;
}
function call(msg, transfer) {
  return new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); getWorker().postMessage({ id, ...msg }, transfer || []); });
}

export function onProgress(cb) { progressCb = cb; }
export const MODEL_SIZE = { schnell: 80, genau: 250 };

export async function preload(quality) { await call({ cmd: 'load', quality }); }

async function to16k(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  try { await ctx.close(); } catch { }
  const len = Math.ceil(buf.duration * 16000);
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }

// Stimmen trennen: mittlere Tonhöhe je Abschnitt, dann zwei Gruppen (tief / hoch)
export function labelVoices(parts, pitchLog = []) {
  if (!pitchLog.length || parts.length < 2) return parts;
  parts.forEach(p => { p.f0 = median(pitchLog.filter(x => x.t >= p.t - 200 && x.t <= p.tEnd + 200).map(x => x.f)); });
  const f = parts.map(p => p.f0).filter(Boolean);
  if (f.length < 2) return parts;
  let lo = Math.min(...f), hi = Math.max(...f);
  if (hi - lo < 55) return parts; // eine Stimme
  for (let i = 0; i < 8; i++) { // 2-Means
    const a = f.filter(x => Math.abs(x - lo) <= Math.abs(x - hi)), b = f.filter(x => Math.abs(x - lo) > Math.abs(x - hi));
    if (!a.length || !b.length) return parts;
    lo = a.reduce((s, x) => s + x, 0) / a.length; hi = b.reduce((s, x) => s + x, 0) / b.length;
  }
  if (hi - lo < 55) return parts;
  parts.forEach(p => { if (p.f0) p.who = Math.abs(p.f0 - lo) <= Math.abs(p.f0 - hi) ? 'Tiefe Stimme' : 'Hohe Stimme'; });
  return parts;
}

export async function transcribeLocal(blob, { quality = 'genau', pitchLog = [], keep = [] } = {}) {
  const audio = await to16k(blob);
  const res = await call({ cmd: 'run', quality, audio }, [audio.buffer]);
  let parts = (res.chunks && res.chunks.length ? res.chunks : [{ text: res.text, start: 0, end: audio.length / 16000 }])
    .map(c => ({ text: String(c.text || '').trim(), t: Math.round((c.start || 0) * 1000), tEnd: Math.round(((c.end ?? c.start) || 0) * 1000) }))
    .filter(p => p.text && !/^\[.*\]$|^\(.*\)$/.test(p.text)); // Whisper-Platzhalter wie [Musik] weglassen
  parts = labelVoices(parts, pitchLog);
  const merged = [];
  parts.forEach(p => {
    const last = merged[merged.length - 1];
    if (last && last.who === p.who && p.t - last.tEnd < 1500 && last.text.length < 240) { last.text += ' ' + p.text; last.tEnd = p.tEnd; }
    else merged.push({ ...p });
  });
  const all = merged.map(p => ({ ...p, speaker: 'voice' })).concat(keep.map(k => ({ ...k }))).sort((a, b) => a.t - b.t);
  const hasWho = merged.some(p => p.who);
  return all.map((p, i) => { const o = { id: 's' + (i + 1), t: p.t, text: p.text, speaker: p.speaker }; if (hasWho && p.who) o.who = p.who; return o; });
}
