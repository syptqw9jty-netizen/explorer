"""Lädt Original-Cover für bibliothek/covers/quellen.json nach bibliothek/covers/<id>.jpg (läuft in GitHub Actions)."""
import json, io, sys, urllib.request, urllib.parse, pathlib
from PIL import Image
D = pathlib.Path("bibliothek/covers")
UA = {"User-Agent": "Mozilla/5.0 (GAUSS Bibliothek Cover-Abgleich)"}
def hol(url, t=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t) as r: return r.read()
def gb(q):
    try:
        j = json.loads(hol("https://www.googleapis.com/books/v1/volumes?q=" + urllib.parse.quote(q)))
        for it in j.get("items", [])[:3]:
            il = it.get("volumeInfo", {}).get("imageLinks", {})
            u = il.get("thumbnail") or il.get("smallThumbnail")
            if u: yield u.replace("http:", "https:").replace("&edge=curl", "").replace("zoom=1", "zoom=0")
            if u: yield u.replace("http:", "https:").replace("&edge=curl", "")
    except Exception as e: log.append(f"gb {type(e).__name__} {str(e)[:60]}")
def isbn10(i):
    if len(i) != 13 or not i.startswith("978"): return ""
    k = i[3:12]; p = sum((10 - n) * int(c) for n, c in enumerate(k)) % 11; p = (11 - p) % 11
    return k + ("X" if p == 10 else str(p))
def longitood(i):
    try:
        j = json.loads(hol(f"https://bookcover.longitood.com/bookcover/{i}"))
        if j.get("url"): yield j["url"]
    except Exception as e: log.append(f"longitood {type(e).__name__} {str(e)[:60]}")
def kandidaten(b):
    i = (b.get("isbn") or "").replace("-", "")
    if b.get("cover"): yield "verlag", b["cover"]
    for i in ([i] if i else []) + b.get("weitereIsbn", []):
        yield "dnb", f"https://portal.dnb.de/opac/mvb/cover?isbn={i}"
        yield "dnb-l", f"https://portal.dnb.de/opac/mvb/cover?isbn={i}&size=l"
        for u in longitood(i): yield "goodreads", u
        if isbn10(i): yield "amazon", f"https://images-na.ssl-images-amazon.com/images/P/{isbn10(i)}.01.LZZZZZZZ.jpg"
        yield "openlibrary", f"https://covers.openlibrary.org/b/isbn/{i}-L.jpg?default=false"
        for u in gb(f"isbn:{i}"): yield "googlebooks", u
    for u in gb(f'intitle:"{b["titel"]}" inauthor:{(b.get("autor") or "").split(",")[0].split(" ")[-1]}'): yield "googlebooks-suche", u
def gut(data):
    im = Image.open(io.BytesIO(data)); w, h = im.size
    return (w >= 120 and h >= 150 and 0.75 <= h / w <= 1.9 and len(data) > 4000), im
bericht = json.load(open(D / "bericht.json")) if (D / "bericht.json").exists() else {}
import hashlib
log = []
for b in json.load(open(D / "quellen.json")):
    if not b.get("titel") or b["id"] == "blau": continue
    ziel = D / f"{b['id']}.jpg"
    if ziel.exists() and bericht.get(b["id"]): continue
    for quelle, url in kandidaten(b):
        try:
            ok, im = gut(hol(url))
            if not ok: log.append(f'{b["id"]} {quelle} verworfen {im.size}'); continue
            im = im.convert("RGB"); im.thumbnail((480, 720))
            im.save(ziel, "JPEG", quality=84, optimize=True, progressive=True)
            bericht[b["id"]] = {"quelle": quelle, "url": url, "groesse": im.size}; print("OK", b["id"], quelle, im.size); break
        except Exception as e: log.append(f'{b["id"]} {quelle} {type(e).__name__} {str(e)[:80]}')
    else: bericht[b["id"]] = None; log.append("FEHLT " + b["id"])
json.dump(bericht, open(D / "bericht.json", "w"), ensure_ascii=False, indent=1)
(D / "log.txt").write_text("\n".join(log))
