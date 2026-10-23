// Spur — die Klangkugel. Fünf geschlossene Linien, verformt durch Obertöne (2, 3, 5, 7).
// Lautstärke öffnet die Formen, die Tonhöhe färbt sie: tiefe Stimmen warm, hohe Stimmen kühl.
import { signal } from './audio.js';

const HARM = [2, 3, 5, 7];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function hueFor(c) { // 0 = bernstein, 1 = violett, über Rosé
  const stops = [[0, 32], [0.45, 352], [1, 268]];
  for (let i = 1; i < stops.length; i++) if (c <= stops[i][0]) {
    const [a0, h0] = stops[i - 1], [a1, h1] = stops[i]; let d = h1 - h0; if (d > 180) d -= 360; if (d < -180) d += 360;
    return (h0 + d * (c - a0) / (a1 - a0) + 360) % 360;
  }
  return 268;
}

export function createOrb(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, raf = 0, t = 0, last = performance.now();
  let state = 'idle', energy = 0, think = 0, hue = hueFor(signal.centroid);
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
    t += dt * slow;
    const live = state === 'listening' ? signal.level : 0;
    const spk = state === 'speaking' ? signal.speaking * 0.7 : 0;
    const target = Math.max(live, spk);
    energy += (target - energy) * (target > energy ? 0.35 : 0.06);
    think += ((state === 'thinking' ? 1 : 0) - think) * 0.05;
    const targetHue = state === 'listening' ? hueFor(signal.centroid) : state === 'speaking' ? 205 : hueFor(0.35);
    let dh = targetHue - hue; if (dh > 180) dh -= 360; if (dh < -180) dh += 360; hue = (hue + dh * 0.03 + 360) % 360;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;

    // innerer Kern
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.55 + energy * 0.25));
    core.addColorStop(0, `hsla(${hue},90%,72%,${0.22 + energy * 0.35})`);
    core.addColorStop(1, `hsla(${hue},90%,60%,0)`);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9);
    for (let k = 0; k < 5; k++) {
      const base = R * (0.30 + k * 0.105) * (1 + energy * 0.06);
      const ringHue = (hue + k * 9 - think * 30 * Math.sin(t + k)) % 360;
      ctx.strokeStyle = `hsla(${ringHue},85%,${68 + k * 3}%,${0.32 + 0.1 * (4 - k) / 4 + energy * 0.3})`;
      ctx.lineWidth = 1.1 + energy * 1.4;
      ctx.shadowColor = `hsla(${ringHue},90%,65%,0.8)`; ctx.shadowBlur = 8 + energy * 18;
      ctx.beginPath();
      const steps = 160;
      for (let i = 0; i <= steps; i++) {
        const th = i / steps * Math.PI * 2;
        let d = 0;
        for (let j = 0; j < HARM.length; j++) {
          const hm = HARM[j];
          const band = state === 'listening' ? signal.bands[(k + j * 2) % 8] : 0;
          const amp = 0.010 + breath * 0.006 + energy * (0.05 + band * 0.11) + think * 0.02;
          d += amp / (1 + j * 0.6) * Math.sin(hm * th + phase[j] + t * (0.35 + j * 0.17) * (k % 2 ? 1 : -1) + think * t * 0.8);
        }
        const r = base * (1 + d);
        const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    canvas.style.setProperty('--orb-hue', Math.round(hue));
    canvas.parentElement && canvas.parentElement.style.setProperty('--orb-hue', Math.round(hue));
    canvas.parentElement && canvas.parentElement.style.setProperty('--orb-energy', energy.toFixed(3));
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
