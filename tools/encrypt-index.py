#!/usr/bin/env python3
"""Verschlüsselt einen Index (JSON) für die Explorer-App.
Aufruf: encrypt-index.py <input.json> <output.enc.json> <passphrase>
Format: PBKDF2-SHA256 (200k) -> AES-256-GCM, Felder base64. Entschlüsselung in app.js (WebCrypto)."""
import sys, json, os, base64, datetime
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
src, dst, pw = sys.argv[1], sys.argv[2], sys.argv[3].encode()
payload = json.load(open(src, encoding="utf-8"))
salt, iv, iters = os.urandom(16), os.urandom(12), 200000
key = PBKDF2HMAC(hashes.SHA256(), 32, salt, iters).derive(pw)
ct = AESGCM(key).encrypt(iv, json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(), None)
b = lambda x: base64.b64encode(x).decode()
json.dump({"v": 1, "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "items": len(payload.get("items", [])), "kdf": "PBKDF2-SHA256", "iterations": iters,
           "salt": b(salt), "iv": b(iv), "data": b(ct)}, open(dst, "w"))
print("ok", len(payload.get("items", [])), "Einträge")
