// Spur — Aufnahme, Klanganalyse für die Visualisierung, Spracherkennung, Sprachausgabe.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = !!SR;
export const ttsSupported = 'speechSynthesis' in window;

function pickMime() {
  if (!window.MediaRecorder) return '';
  for (const m of ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { }
  }
  return '';
}

// Gemeinsamer Analysezustand, den die Klangkugel jedes Frame liest.
export const signal = { level: 0, bands: new Float32Array(8), centroid: 0.35, active: false, speaking: 0 };

export class Session {
  constructor({ lang = 'de-DE', onInterim, onFinal, onState, keepAudio = true } = {}) {
    Object.assign(this, { lang, onInterim, onFinal, onState, keepAudio });
    this.segments = []; this.chunks = []; this.running = false; this.recognizing = false;
    this.paused = false; this.lastVoiceAt = 0; this.heardSince = 0; this.srBroken = false;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC(); if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.7;
    src.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount); this.time = new Uint8Array(this.analyser.fftSize);

    if (this.keepAudio && window.MediaRecorder) {
      const mimeType = pickMime();
      try {
        this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined);
        this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
        this.rec.start(1000);
      } catch (e) { console.warn('MediaRecorder', e); this.rec = null; }
    }
    this.t0 = performance.now(); this.running = true; this.lastVoiceAt = this.t0; signal.active = true;
    this._tick();
    this._startRecognition();
  }

  elapsed() { return Math.round(performance.now() - this.t0); }

  _tick = () => {
    if (!this.running) return;
    const a = this.analyser; a.getByteFrequencyData(this.freq); a.getByteTimeDomainData(this.time);
    let sum = 0; for (let i = 0; i < this.time.length; i++) { const v = (this.time[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / this.time.length);
    const lvl = Math.min(1, rms * 4.2);
    signal.level += (lvl - signal.level) * (lvl > signal.level ? 0.45 : 0.08);
    // 8 logarithmische Bänder von ~80 Hz bis ~6 kHz, Schwerpunkt für die Farbe (tiefe Stimme warm, hohe Stimme kühl)
    const ny = this.ctx.sampleRate / 2, n = this.freq.length;
    let wsum = 0, esum = 0;
    for (let b = 0; b < 8; b++) {
      const f0 = 80 * Math.pow(75, b / 8), f1 = 80 * Math.pow(75, (b + 1) / 8);
      const i0 = Math.max(1, Math.floor(f0 / ny * n)), i1 = Math.min(n - 1, Math.ceil(f1 / ny * n));
      let m = 0; for (let i = i0; i <= i1; i++) m += this.freq[i];
      m = m / Math.max(1, i1 - i0 + 1) / 255;
      signal.bands[b] += (m - signal.bands[b]) * 0.3;
      wsum += m * b; esum += m;
    }
    if (esum > 0.4) { const c = (wsum / esum) / 7; signal.centroid += (c - signal.centroid) * 0.04; }
    const now = performance.now();
    if (lvl > 0.09) { if (!this.heardSince) this.heardSince = now; this.lastVoiceAt = now; }
    this.raf = requestAnimationFrame(this._tick);
  };

  silenceMs() { return performance.now() - this.lastVoiceAt; }
  heardSomething() { return this.heardSince > 0; }
  resetHeard() { this.heardSince = 0; this.lastVoiceAt = performance.now(); }

  _startRecognition() {
    if (!SR || this.srBroken || this.paused || !this.running) return;
    const r = new SR(); this.sr = r;
    r.lang = this.lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; const txt = res[0].transcript.trim();
        if (!txt) continue;
        if (res.isFinal) this.addSegment(txt, 'voice'); else interim += txt + ' ';
      }
      this.onInterim && this.onInterim(interim.trim());
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture' || e.error === 'language-not-supported') {
        this.srBroken = true; this.onState && this.onState({ speech: 'unavailable', reason: e.error });
      }
    };
    r.onend = () => {
      this.recognizing = false;
      if (this.running && !this.paused && !this.srBroken) setTimeout(() => this._startRecognition(), 250);
    };
    try { r.start(); this.recognizing = true; this.onState && this.onState({ speech: 'on' }); }
    catch (e) { console.warn('SR start', e); }
  }

  addSegment(text, speaker = 'voice') {
    const seg = { id: 's' + (this.segments.length + 1), t: this.elapsed(), text, speaker };
    this.segments.push(seg); this.onFinal && this.onFinal(seg);
    return seg;
  }

  pauseRecognition() { this.paused = true; try { this.sr && this.sr.stop(); } catch { } }
  resumeRecognition() { this.paused = false; if (!this.recognizing) this._startRecognition(); }

  async stop() {
    this.running = false; signal.active = false;
    cancelAnimationFrame(this.raf);
    try { this.sr && this.sr.stop(); } catch { }
    const durationMs = this.elapsed();
    let blob = null;
    if (this.rec && this.rec.state !== 'inactive') {
      await new Promise(res => { this.rec.onstop = res; try { this.rec.requestData(); } catch { } this.rec.stop(); });
      if (this.chunks.length) blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/mp4' });
    }
    this.stream && this.stream.getTracks().forEach(t => t.stop());
    try { await this.ctx.close(); } catch { }
    // letzte Zwischenergebnisse kurz abwarten
    await new Promise(r => setTimeout(r, 350));
    return { blob, segments: this.segments, durationMs, speechAvailable: !!SR && !this.srBroken };
  }
}

// Sprachausgabe für den Interviewmodus — ruhig, deutsch.
let voice = null;
function pickVoice() {
  if (!ttsSupported) return null;
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('de'));
  return vs.find(v => /Anna|Helena|Petra|Markus|Yannick/i.test(v.name) && v.localService) || vs.find(v => v.localService) || vs[0] || null;
}
if (ttsSupported) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };

export function speak(text) {
  return new Promise(res => {
    if (!ttsSupported) return res();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice = voice || pickVoice(); if (voice) u.voice = voice;
    u.lang = 'de-DE'; u.rate = 0.96; u.pitch = 1;
    let pulse;
    u.onstart = () => { pulse = setInterval(() => { signal.speaking = 0.55 + Math.random() * 0.45; }, 90); };
    const done = () => { clearInterval(pulse); signal.speaking = 0; res(); };
    u.onend = done; u.onerror = done;
    u.onboundary = () => { signal.speaking = 1; };
    speechSynthesis.speak(u);
    setTimeout(done, 15000);
  });
}
