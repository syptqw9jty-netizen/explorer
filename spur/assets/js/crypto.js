// Spur — Verschlüsselung. Alles, was gespeichert wird, ist AES-GCM-256 verschlüsselt.
// Der Schlüssel entsteht aus dem Passcode (PBKDF2-SHA-256) und lebt nur im Arbeitsspeicher.

const enc = new TextEncoder();
const dec = new TextDecoder();
export const KDF_ITERATIONS = 310000;

export function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

export function b64(bytes) {
  let s = ''; const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) { const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }

export async function deriveKey(passcode, salt, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

// Bytes verschlüsseln → { iv, ct } (ArrayBuffer, direkt in IndexedDB speicherbar)
export async function sealBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv, ct };
}
export async function openBytes(key, box) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, key, box.ct));
}
export async function sealJSON(key, obj) { return sealBytes(key, enc.encode(JSON.stringify(obj))); }
export async function openJSON(key, box) { return JSON.parse(dec.decode(await openBytes(key, box))); }

export const VERIFIER = 'spur:ok:v1';
