// Spur — Verschriftlichung direkt auf dem Gerät (Whisper über transformers.js).
// Läuft in einem eigenen Worker, damit die Oberfläche flüssig bleibt. Die Aufnahme verlässt das Gerät nicht.
// Nur das Modell wird einmalig geladen (danach aus dem Browser-Cache, auch offline).

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const MODELS = { schnell: 'onnx-community/whisper-base', genau: 'onnx-community/whisper-small' };
let lib = null, pipe = null, loadedKey = '';

async function load(quality) {
  const id = MODELS[quality] || MODELS.genau;
  if (pipe && loadedKey === id) return pipe;
  if (!lib) lib = await import(LIB);
  lib.env.allowLocalModels = false;
  const webgpu = !!(self.navigator && navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null));
  const files = {};
  pipe = await lib.pipeline('automatic-speech-recognition', id, {
    device: webgpu ? 'webgpu' : 'wasm',
    dtype: webgpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: p => {
      if (p.status === 'progress' && p.total) {
        files[p.file] = { loaded: p.loaded, total: p.total };
        const all = Object.values(files); const done = all.reduce((a, f) => a + f.loaded, 0), tot = all.reduce((a, f) => a + f.total, 0);
        postMessage({ type: 'progress', loaded: done, total: tot });
      }
    }
  });
  loadedKey = id;
  postMessage({ type: 'ready', device: webgpu ? 'webgpu' : 'wasm', model: id });
  return pipe;
}

self.onmessage = async e => {
  const { id, cmd, quality, audio } = e.data;
  try {
    const p = await load(quality);
    if (cmd === 'load') return postMessage({ id, type: 'done', result: null });
    postMessage({ id, type: 'working' });
    const out = await p(audio, { language: 'german', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    postMessage({ id, type: 'done', result: { text: out.text, chunks: (out.chunks || []).map(c => ({ text: c.text, start: c.timestamp[0], end: c.timestamp[1] })) } });
  } catch (err) {
    postMessage({ id, type: 'error', message: String(err && err.message || err) });
  }
};
