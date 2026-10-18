#!/usr/bin/env python3
"""Ordnet jedem Index-Eintrag einen Bereich zu (tools/areas.json) und schreibt die Bereichsliste in den Index.
Aufruf: assign-areas.py <index.json>  (ändert die Datei in place)"""
import json, sys
idx = json.load(open(sys.argv[1], encoding="utf-8"))
cfg = json.load(open(__file__.rsplit("/", 1)[0] + "/areas.json", encoding="utf-8"))
by = {i["id"]: i for i in idx["items"]}
def path(it):
    p, cur = [], it
    while cur:
        p.insert(0, cur["name"]); cur = by.get(cur.get("parent")) if cur.get("parent") else None
    return it["source"] + ":/" + "/".join(p)
rules = sorted(cfg["rules"], key=lambda r: -len(r["prefix"]))
for it in idx["items"]:
    p = path(it); it["area"] = cfg["default"]
    for r in rules:
        if p == r["prefix"] or p.startswith(r["prefix"].rstrip("/") + "/"): it["area"] = r["area"]; break
used = {i["area"] for i in idx["items"]}
idx["areas"] = [a for a in cfg["areas"] if a["id"] in used]
json.dump(idx, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter; print(Counter(i["area"] for i in idx["items"]))
