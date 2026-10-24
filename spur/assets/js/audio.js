// Spur — Aufnahme, Klanganalyse, Spracherkennung, Sprachausgabe.
// Robust für iOS: Bildschirm bleibt wach, Erkennung startet sich selbst neu, ein Wachhund erkennt Hänger,
// Zwischentext geht nie verloren, und wenn sich Mikrofon und Erkennung blockieren, hat der Text Vorrang.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = !!SR;
export const ttsSupported = 'speechSynthesis' in window;
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function pickMime() {
  if (!window.MediaRecorder) return '';
  for (const m of ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { }
  }
  return '';
}

// Gemeinsamer Zustand, den die Klangkugel jedes Frame liest.
export const signal = {
  level: 0, bands: new Float32Array(8), centroid: 0.35, pitch: 0, active: false, speaking: 0,
  pulses: [], flash: 0, silence: 0, synthetic: false,
  status: { mic: 'aus', speech: 'aus', reason: '' }
};

function setStatus(patch, cb) { Object.assign(signal.status, patch); cb && cb({ ...signal.status }); }

// Grundfrequenz per Autokorrelation (halbe Abtastrate, 70–500 Hz)
function detectPitch(buf, sampleRate) {
  const n = buf.length >> 1, x = new Float32Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) { const v = (buf[i * 2] - 128) / 128; x[i] = v; energy += v * v; }
  if (energy < 0.5) return 0;
  const sr = sampleRate / 2, minLag = Math.floor(sr / 500), maxLag = Math.min(n - 1, Math.ceil(sr / 70));
  let best = 0, bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let i = 0; i < n - lag; i++) s += x[i] * x[i + lag];
    s /= (n - lag);
    if (s > best) { best = s; bestLag = lag; }
  }
  const norm = best / (energy / n);
  return norm > 0.45 && bestLag ? sr / bestLag : 0;
}

export class Session {
  constructor({ lang = 'de-DE', onInterim, onFinal, onState, keepAudio = true, protectRecording = false } = {}) {
    Object.assign(this, { lang, onInterim, onFinal, onState, keepAudio, protectRecording });
    this.segments = []; this.chunks = []; this.running = false; this.recognizing = false;
    this.paused = false; this.lastVoiceAt = 0; this.heardSince = 0; this.srBroken = false;
    this.pending = ''; this.lastSR = 0; this.stalls = 0; this.netErrors = 0; this.micYielded = false;
    this.floor = 0.004; this.peak = 0.05; this.fast = 0; this.slow = 0; this.lastOnset = 0; this.pitchHist = []; this.frame = 0;
  }

  async start() {
    signal.pulses = []; signal.flash = 0; signal.pitch = 0; signal.synthetic = false;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    setStatus({ mic: 'an', speech: SR ? 'startet' : 'fehlt', reason: SR ? '' : 'Dieser Browser hat keine Spracherkennung.' }, this.onState);
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC(); if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.6;
    this.src.connect(this.analyser);
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
    await this._wake();
    this._onVis = () => { if (!document.hidden && this.running) { this._wake(); if (this.ctx.state === 'suspended') this.ctx.resume(); if (!this.recognizing) this._startRecognition(); } };
    document.addEventListener('visibilitychange', this._onVis);
    this._tick();
    this._startRecognition();
    this.watch = setInterval(() => this._watchdog(), 1000);
  }

  // Bildschirm wach halten — sonst pausiert iOS Seite und Mikrofon, sobald das Telefon liegt.
  async _wake() {
    try { if ('wakeLock' in navigator && !this.lock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } } catch { }
  }

  elapsed() { return Math.round(performance.now() - this.t0); }

  _tick = () => {
    if (!this.running) return;
    const now = performance.now();
    if (!this.micYielded) {
      const a = this.analyser; a.getByteFrequencyData(this.freq); a.getByteTimeDomainData(this.time);
      let sum = 0; for (let i = 0; i < this.time.length; i++) { const v = (this.time[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / this.time.length);
      // adaptive Empfindlichkeit: Grundrauschen und Spitzen werden mitgeführt, leise Stimmen im Raum reichen
      this.floor += (rms - this.floor) * (rms < this.floor ? 0.25 : 0.0015);
      this.peak = Math.max(rms, this.peak * 0.997, this.floor + 0.025);
      const adaptive = Math.max(0, Math.min(1, (rms - this.floor * 1.3) / (this.peak - this.floor)));
      const lvl = Math.max(adaptive * 0.9, Math.min(1, rms * 4));
      signal.level += (lvl - signal.level) * (lvl > signal.level ? 0.5 : 0.09);
      // Silben: schnelle Hüllkurve steigt über die langsame
      this.fast += (lvl - this.fast) * 0.55; this.slow += (lvl - this.slow) * 0.06;
      if (this.fast - this.slow > 0.11 && now - this.lastOnset > 110) {
        this.lastOnset = now; signal.pulses.push({ t: now, s: Math.min(1, (this.fast - this.slow) * 2.2), pitch: signal.pitch });
        if (signal.pulses.length > 24) signal.pulses.shift();
      }
      const ny = this.ctx.sampleRate / 2, n = this.freq.length;
      let wsum = 0, esum = 0;
      for (let b = 0; b < 8; b++) {
        const f0 = 80 * Math.pow(75, b / 8), f1 = 80 * Math.pow(75, (b + 1) / 8);
        const i0 = Math.max(1, Math.floor(f0 / ny * n)), i1 = Math.min(n - 1, Math.ceil(f1 / ny * n));
        let m = 0; for (let i = i0; i <= i1; i++) m += this.freq[i];
        m = m / Math.max(1, i1 - i0 + 1) / 255;
        signal.bands[b] += (Math.min(1, m * 1.6) - signal.bands[b]) * 0.35;
        wsum += m * b; esum += m;
      }
      if (esum > 0.4) { const c = (wsum / esum) / 7; signal.centroid += (c - signal.centroid) * 0.04; }
      if (lvl > 0.14 && (this.frame++ & 1) === 0) {
        const f = detectPitch(this.time, this.ctx.sampleRate);
        if (f) { this.pitchHist.push(f); if (this.pitchHist.length > 7) this.pitchHist.shift(); const s = [...this.pitchHist].sort((a, b) => a - b); signal.pitch = s[s.length >> 1]; }
      }
      if (lvl > 0.12) { if (!this.heardSince) this.heardSince = now; this.lastVoiceAt = now; }
    } else {
      // Mikrofon der Erkennung überlassen: Kugel folgt den Erkennungsereignissen
      signal.level *= 0.94;
      if (now - this.lastSR < 300) this.lastVoiceAt = now;
    }
    signal.silence = now - this.lastVoiceAt;
    signal.flash *= 0.94;
    this.raf = requestAnimationFrame(this._tick);
  };

  silenceMs() { return performance.now() - this.lastVoiceAt; }
  heardSomething() { return this.heardSince > 0; }
  resetHeard() { this.heardSince = 0; this.lastVoiceAt = performance.now(); }

  _startRecognition() {
    if (!SR || this.srBroken || this.paused || !this.running || this.recognizing) return;
    clearTimeout(this.restartT);
    const r = new SR(); this.sr = r;
    r.lang = this.lang; r.interimResults = true; r.maxAlternatives = 1;
    r.continuous = !isIOS; // iOS: kurze Sitzungen mit Neustart sind stabiler
    r.onstart = () => { this.lastSR = performance.now(); setStatus({ speech: 'hört', reason: '' }, this.onState); };
    r.onaudiostart = r.onspeechstart = () => { this.lastSR = performance.now(); };
    r.onresult = e => {
      this.lastSR = performance.now(); this.stalls = 0; this.netErrors = 0;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; const txt = res[0].transcript.trim();
        if (!txt) continue;
        if (res.isFinal) { this.pending = ''; this.addSegment(txt, 'voice'); }
        else interim += (interim ? ' ' : '') + txt;
      }
      this.pending = interim;
      if (this.micYielded && interim) { signal.level = Math.min(1, signal.level + 0.35); signal.pulses.push({ t: performance.now(), s: 0.6, pitch: 0 }); }
      this.onInterim && this.onInterim(interim);
    };
    r.onerror = e => {
      const err = e.error;
      if (err === 'no-speech' || err === 'aborted') return;
      if (err === 'audio-capture') { this._yieldMic(); return; }
      if (err === 'network') { if (++this.netErrors >= 4) this._broken('Keine Verbindung zur Spracherkennung.'); return; }
      if (err === 'not-allowed' || err === 'service-not-allowed') return this._broken(isIOS && isStandalone ? 'iOS erlaubt die Spracherkennung hier nicht. Tipp: Spur in Safari öffnen, oder später verschriftlichen.' : 'Spracherkennung wurde nicht erlaubt.');
      if (err === 'language-not-supported') return this._broken('Deutsch wird hier nicht erkannt.');
    };
    r.onend = () => {
      this.recognizing = false;
      if (this.pending) { const p = this.pending; this.pending = ''; this.addSegment(p, 'voice'); }
      if (this.running && !this.paused && !this.srBroken) this.restartT = setTimeout(() => this._startRecognition(), isIOS ? 120 : 250);
    };
    try { r.start(); this.recognizing = true; this.lastSR = performance.now(); }
    catch (e) { this.recognizing = false; this.restartT = setTimeout(() => this._startRecognition(), 600); }
  }

  _broken(reason) {
    this.srBroken = true; try { this.sr && this.sr.abort(); } catch { }
    setStatus({ speech: 'aus', reason }, this.onState);
  }

  // Wenn Mikrofon und Erkennung sich gegenseitig blockieren: Text geht vor, Aufnahme endet hier.
  _yieldMic() {
    if (this.micYielded) return;
    if (this.protectRecording) { setStatus({ reason: '' , speech: 'Vorschau pausiert' }, this.onState); return; }
    this.micYielded = true; signal.synthetic = true;
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } catch { }
    this.stream.getTracks().forEach(t => t.stop());
    setStatus({ mic: 'frei', reason: 'Mikrofon für die Erkennung freigegeben. Die Stimme wird ab jetzt nicht mitgeschnitten.' }, this.onState);
    try { this.sr && this.sr.abort(); } catch { }
    this.recognizing = false; setTimeout(() => this._startRecognition(), 300);
  }

  _watchdog() {
    if (!this.running || this.paused || this.srBroken || !SR) return;
    const now = performance.now();
    if (!this.recognizing) { this._startRecognition(); return; }
    const voiceRecently = now - this.lastVoiceAt < 3000;
    // läuft, aber seit 8 s kein Lebenszeichen, obwohl gesprochen wird → hängt
    if (now - this.lastSR > (isIOS ? 5000 : 8000) && (voiceRecently || this.micYielded)) {
      this.stalls++;
      setStatus({ speech: 'startet neu' }, this.onState);
      try { this.sr.abort(); } catch { }
      this.recognizing = false; this._startRecognition();
      // iOS gibt das Mikrofon nach der ersten Sitzung oft nicht mehr frei → Text geht vor
      if (this.stalls >= 2 && !this.micYielded) this._yieldMic();
    }
  }

  addSegment(text, speaker = 'voice') {
    const last = this.segments[this.segments.length - 1];
    if (last && last.speaker === speaker && last.text === text) return last;
    // iOS liefert kurze Stücke: zusammenhängendes Sprechen zu einem Satz verbinden
    const now = this.elapsed();
    if (speaker === 'voice' && last && last.speaker === 'voice' && now - (last.tEnd || last.t) < 2500 && !/[.!?]$/.test(last.text) && last.text.length + text.length < 220) {
      last.text += ' ' + text; last.tEnd = now; signal.flash = Math.max(signal.flash, 0.6);
      this.onFinal && this.onFinal(last); return last;
    }
    const seg = { id: 's' + (this.segments.length + 1), t: now, tEnd: now, text, speaker };
    this.segments.push(seg);
    if (speaker === 'voice') signal.flash = 1;
    this.onFinal && this.onFinal(seg);
    return seg;
  }

  pauseRecognition() { this.paused = true; clearTimeout(this.restartT); try { this.sr && this.sr.abort(); } catch { } this.recognizing = false; }
  resumeRecognition() { this.paused = false; this.stalls = 0; setTimeout(() => this._startRecognition(), isIOS ? 350 : 50); }

  async stop() {
    this.running = false; clearInterval(this.watch); clearTimeout(this.restartT);
    document.removeEventListener('visibilitychange', this._onVis);
    const durationMs = this.elapsed();
    // Erkennung ordentlich beenden und auf das letzte Ergebnis warten
    if (this.sr && this.recognizing) {
      await new Promise(res => { const t = setTimeout(res, 1500); const old = this.sr.onend; this.sr.onend = () => { clearTimeout(t); old && old(); res(); }; try { this.sr.stop(); } catch { res(); } });
    }
    if (this.pending) { this.addSegment(this.pending, 'voice'); this.pending = ''; }
    signal.active = false; cancelAnimationFrame(this.raf);
    let blob = null;
    if (this.rec && this.rec.state !== 'inactive') {
      await new Promise(res => { this.rec.onstop = res; try { this.rec.requestData(); } catch { } this.rec.stop(); });
    }
    if (this.chunks.length) blob = new Blob(this.chunks, { type: (this.rec && this.rec.mimeType) || 'audio/mp4' });
    this.stream && this.stream.getTracks().forEach(t => t.stop());
    try { await this.ctx.close(); } catch { }
    try { this.lock && await this.lock.release(); } catch { }
    setStatus({ mic: 'aus', speech: 'aus' });
    return { blob, segments: this.segments, durationMs, speechAvailable: !!SR && !this.srBroken, reason: signal.status.reason };
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
    let pulse, finished = false;
    u.onstart = () => { pulse = setInterval(() => { signal.speaking = 0.55 + Math.random() * 0.45; if (Math.random() < 0.35) signal.pulses.push({ t: performance.now(), s: 0.5, pitch: 0, tts: true }); }, 110); };
    const done = () => { if (finished) return; finished = true; clearInterval(pulse); signal.speaking = 0; res(); };
    u.onend = done; u.onerror = done;
    speechSynthesis.speak(u);
    setTimeout(done, Math.max(4000, text.length * 110));
  });
}
