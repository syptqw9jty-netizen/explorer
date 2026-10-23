// Spur — lokaler, verschlüsselter Speicher (IndexedDB). Klartext liegt nie auf der Platte.
import { deriveKey, sealJSON, openJSON, sealBytes, openBytes, randomBytes, b64, unb64, VERIFIER, KDF_ITERATIONS } from './crypto.js';

const DB = 'spur'; const VER = 1;
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      if (!d.objectStoreNames.contains('records')) d.createObjectStore('records', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(store, mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
const get = (store, key) => tx(store, 'readonly', s => s.get(key));
const put = (store, val, key) => tx(store, 'readwrite', s => key === undefined ? s.put(val) : s.put(val, key));
const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));
const all = (store) => tx(store, 'readonly', s => s.getAll());

export async function isSetUp() { return !!(await get('meta', 'salt')); }

export async function setup(passcode) {
  const salt = randomBytes(16);
  const key = await deriveKey(passcode, salt, KDF_ITERATIONS);
  await put('meta', salt, 'salt');
  await put('meta', KDF_ITERATIONS, 'iterations');
  await put('meta', await sealJSON(key, VERIFIER), 'verifier');
  await put('meta', Date.now(), 'createdAt');
  return key;
}

export async function unlock(passcode) {
  const salt = await get('meta', 'salt');
  const it = (await get('meta', 'iterations')) || KDF_ITERATIONS;
  const key = await deriveKey(passcode, salt, it);
  try { if ((await openJSON(key, await get('meta', 'verifier'))) !== VERIFIER) throw 0; }
  catch { throw new Error('Passcode stimmt nicht'); }
  return key;
}

export async function loadAll(key) {
  const recs = await all('records');
  let settings = null; const entries = [];
  for (const r of recs) {
    try {
      const v = await openJSON(key, r.box);
      if (r.kind === 'settings') settings = v; else if (r.kind === 'entry') entries.push(v);
    } catch (e) { console.warn('Eintrag nicht lesbar', r.id); }
  }
  entries.sort((a, b) => b.createdAt - a.createdAt);
  return { settings, entries };
}

export async function saveEntry(key, entry) { await put('records', { id: entry.id, kind: 'entry', box: await sealJSON(key, entry) }); }
export async function deleteEntry(id) { await del('records', id); await del('audio', id); }
export async function saveSettings(key, s) { await put('records', { id: 'settings', kind: 'settings', box: await sealJSON(key, s) }); }

export async function saveAudio(key, id, blob) {
  const box = await sealBytes(key, new Uint8Array(await blob.arrayBuffer()));
  await put('audio', { id, type: blob.type, box });
}
export async function loadAudio(key, id) {
  const r = await get('audio', id); if (!r) return null;
  return new Blob([await openBytes(key, r.box)], { type: r.type || 'audio/mp4' });
}
export async function hasAudio(id) { return !!(await get('audio', id)); }

// Sicherung: nur verschlüsselte Daten, mit demselben Passcode wiederherstellbar.
export async function exportBackup() {
  const pack = box => ({ iv: b64(box.iv), ct: b64(box.ct) });
  const recs = await all('records'); const aud = await all('audio');
  return JSON.stringify({
    format: 'spur-backup', version: 1, exportedAt: new Date().toISOString(),
    salt: b64(await get('meta', 'salt')), iterations: await get('meta', 'iterations'),
    verifier: pack(await get('meta', 'verifier')),
    records: recs.map(r => ({ id: r.id, kind: r.kind, box: pack(r.box) })),
    audio: aud.map(a => ({ id: a.id, type: a.type, box: pack(a.box) }))
  });
}
export async function importBackup(text) {
  const j = JSON.parse(text); if (j.format !== 'spur-backup') throw new Error('Keine Spur-Sicherung');
  const unpack = b => ({ iv: unb64(b.iv), ct: unb64(b.ct).buffer });
  await wipe();
  await put('meta', unb64(j.salt), 'salt'); await put('meta', j.iterations, 'iterations');
  await put('meta', unpack(j.verifier), 'verifier'); await put('meta', Date.now(), 'createdAt');
  for (const r of j.records) await put('records', { id: r.id, kind: r.kind, box: unpack(r.box) });
  for (const a of j.audio || []) await put('audio', { id: a.id, type: a.type, box: unpack(a.box) });
}

export async function wipe() {
  for (const s of ['meta', 'records', 'audio']) await tx(s, 'readwrite', x => x.clear());
}
