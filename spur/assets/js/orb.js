// Spur — die Klangkugel.
// Fünf geschlossene Linien, verformt durch Obertöne (2, 3, 5, 7).
// · Lautstärke öffnet die Formen · jede Silbe schickt eine Welle von innen nach außen
// · die Tonhöhe färbt die Welle: tiefe Stimmen warm, mittlere rosé, Kinderstimmen kühl
// · jeder Ring behält die Farbe der letzten Stimme — ein Gespräch wird mehrfarbig
// · in Pausen atmet die Kugel ruhiger · ein erkannter Satz lässt den Kern kurz aufleuchten
import { signal } from './audio.js';

const HARM = [2, 3, 5, 7];
const RINGS = 5;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

// Erdtöne: tiefe Stimmen Umbra/Terrakotta, mittlere Ocker, hohe Salbei bis Tintenblau
const PITCH_HUES = [[80, 14], [140, 24], [190, 40], [240, 80], [300, 150], [420, 212]];
const dark = matchMedia('(prefers-color-scheme: dark)');
export function hueForPitch(f) {
  if (f <= PITCH_HUES[0][0]) return PITCH_HUES[0][1];
  for (let i = 1; i < PITCH_HUES.length; i++) if (f <= PITCH_HUES[i][0]) {
    const [f0, h0] = PITCH_HUES[i - 1], [f1, h1] = PITCH_HUES[i];
    let d = h1 - h0; if (d > 180) d -= 360; if (d < -180) d += 360;
    return (h0 + d * (f - f0) / (f1 - f0) + 360) % 360;
  }
  return PITCH_HUES[PITCH_HUES.length - 1][1];
}
function hueForCentroid(c) { return hueForPitch(90 + c * 260); }
function mixHue(a, b, t) { let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360; return (a + d * t + 360) % 360; }

export function createOrb(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, raf = 0, t = 0, last = performance.now();
  let state = 'idle', energy = 0, think = 0, calm = 0;
  const idleHue = hueForCentroid(0.35);
  const ringHue = new Array(RINGS).fill(idleHue);
  const ringKick = new Float32Array(RINGS);
  const phase = HARM.map(() => Math.random() * Math.PI * 2);

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const slow = reduce.matches ? 0.35 : 1;
    const listening = state === 'listening', speaking = state === 'speaking';
    // Ruhe: nach ~1,5 s Stille atmet die Kugel langsamer und flacher
    const calmTarget = listening ? Math.min(1, Math.max(0, (signal.silence - 1500) / 4000)) : 0;
    calm += (calmTarget - calm) * 0.02;
    t += dt * slow * (1 - calm * 0.55);
    const target = listening ? signal.level : speaking ? signal.speaking * 0.7 : 0;
    energy += (target - energy) * (target > energy ? 0.4 : 0.07);
    think += ((state === 'thinking' ? 1 : 0) - think) * 0.05;

    // Farbe der aktuellen Stimme
    const voiceHue = speaking ? 200 : (signal.pitch ? hueForPitch(signal.pitch) : hueForCentroid(signal.centroid));
    // Silbenwellen wandern von innen nach außen und färben die Ringe, die sie passieren
    const WAVE_MS = 520;
    ringKick.fill(0);
    if (listening || speaking) {
      signal.pulses = signal.pulses.filter(p => now - p.t < WAVE_MS * 1.4);
      for (const p of signal.pulses) {
        const pos = (now - p.t) / WAVE_MS * RINGS; // Ringindex, an dem die Welle gerade ist
        const hue = p.tts ? 200 : (p.pitch ? hueForPitch(p.pitch) : voiceHue);
        for (let k = 0; k < RINGS; k++) {
          const d = Math.abs(pos - k);
          if (d < 1) { const a = (1 - d) * p.s; ringKick[k] += a; ringHue[k] = mixHue(ringHue[k], hue, 0.25 * a); }
        }
      }
    }
    for (let k = 0; k < RINGS; k++) {
      const back = listening || speaking ? 0.004 : 0.03; // im Ruhezustand zurück zur Grundfarbe
      ringHue[k] = mixHue(ringHue[k], listening || speaking ? voiceHue : idleHue, back);
    }
    const coreHue = ringHue[0];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;

    // Kern, mit Aufleuchten bei erkanntem Satz
    const fl = signal.flash || 0;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.5 + energy * 0.25 + fl * 0.15));
    const D = dark.matches;
    core.addColorStop(0, `hsla(${coreHue},${D ? 45 : 40}%,${D ? 55 : 62}%,${0.10 + energy * 0.22 + fl * 0.25})`);
    core.addColorStop(1, `hsla(${coreHue},40%,60%,0)`);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    ctx.globalCompositeOperation = D ? 'screen' : 'multiply';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const breath = 0.5 + 0.5 * Math.sin(t * (0.9 - calm * 0.4));
    for (let k = 0; k < RINGS; k++) {
      const kick = Math.min(1.4, ringKick[k]);
      const base = R * (0.30 + k * 0.105) * (1 + energy * 0.05 + kick * 0.035);
      const hk = (ringHue[k] - think * 30 * Math.sin(t + k) + 360) % 360;
      const alpha = 0.42 + 0.12 * (4 - k) / 4 + energy * 0.25 + kick * 0.25 - calm * 0.1;
      const sat = 28 + energy * 25 + kick * 20, lig = D ? 68 + kick * 8 : 40 - kick * 6;
      ctx.strokeStyle = `hsla(${hk},${sat}%,${lig}%,${Math.max(0.2, Math.min(0.95, alpha))})`;
      ctx.lineWidth = 1.0 + energy * 1.3 + kick * 1.6;
      ctx.shadowColor = `hsla(${hk},40%,${D ? 60 : 45}%,${D ? 0.6 : 0.25})`; ctx.shadowBlur = D ? 6 + energy * 10 : 2 + kick * 4;
      ctx.beginPath();
      const steps = 168;
      for (let i = 0; i <= steps; i++) {
        const th = i / steps * Math.PI * 2;
        let d = 0;
        for (let j = 0; j < HARM.length; j++) {
          const band = listening ? signal.bands[(k + j * 2) % 8] : 0;
          const amp = (0.010 + breath * 0.006) * (1 - calm * 0.5) + energy * (0.04 + band * 0.1) + kick * 0.035 / (1 + j * 0.3) + think * 0.02;
          d += amp / (1 + j * 0.6) * Math.sin(HARM[j] * th + phase[j] + t * (0.35 + j * 0.17) * (k % 2 ? 1 : -1) + think * t * 0.8);
        }
        const r = base * (1 + d);
        const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    const host = canvas.parentElement;
    if (host) { host.style.setProperty('--orb-hue', Math.round(coreHue)); host.style.setProperty('--orb-energy', (energy + fl * 0.3).toFixed(3)); }
    raf = requestAnimationFrame(frame);
  }
  const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', vis);
  raf = requestAnimationFrame(frame);

  return {
    set(s) { state = s; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); }
  };
}
