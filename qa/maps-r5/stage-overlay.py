#!/usr/bin/env python3
"""Add a bounded, read-only map QA slice to an already verified Pages tree."""
from pathlib import Path
import re
import sys
import shutil
import hashlib
import json

base, overlay = map(lambda s: Path(s).resolve(strict=True), sys.argv[1:3])
expectedBase = int(sys.argv[3]) if len(sys.argv)>3 else 995483815
allowed = re.compile(r"v2/(maps-preview-r5/[a-z0-9-]+\.(?:css|html|json|mjs)|modules/(?:english-original|chinese-planet)/[a-z0-9-]+-r5\.mjs)")
deny = re.compile(r"(?:https?:|https?['\"]\s*\+|\bfetch\s*\(\s*['\"]//|firebase|firestore|navigator\.serviceWorker|indexedDB|localStorage)", re.I)
entries = [p for p in overlay.rglob("*") if not p.is_dir()]
if not 8 <= len(entries) <= 24:
    raise ValueError("Unexpected R5 overlay size")
all_files = {p.relative_to(overlay).as_posix() for p in entries}
expected = {"v2/maps-preview-r5/index.html","v2/maps-preview-r5/viewer.css","v2/maps-preview-r5/viewer.mjs","v2/maps-preview-r5/english-map-titles.json","v2/maps-preview-r5/chinese-map-titles.json","v2/modules/english-original/english-exploration-r5.mjs","v2/modules/english-original/english-garden-world-r5.mjs","v2/modules/chinese-planet/map-r5.mjs","v2/modules/chinese-planet/world-r5.mjs","v2/modules/chinese-planet/river-crossing-r5.mjs"}
if not expected <= all_files:
    raise ValueError(f"Missing expected R5 inputs: {expected - all_files}")
added = {}
for path in entries:
    rel = path.relative_to(overlay).as_posix()
    target = base / rel
    if path.is_symlink() or not path.is_file() or not allowed.fullmatch(rel) or target.exists():
        raise ValueError(f"Disallowed or conflicting path: {rel}")
    data = path.read_bytes()
    if len(data) > 75000 or deny.search(data.decode("utf-8")):
        raise ValueError(f"Disallowed URL/storage use or file size: {rel}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    added[rel] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
html = (base / "v2/maps-preview-r5/index.html").read_text()
assert "worker-src 'none'" in html and "connect-src 'self' blob:" in html and "form-action 'none'" in html
before = expectedBase
total = sum(p.stat().st_size for p in base.rglob("*") if p.is_file())
if total != before + sum(e["bytes"] for e in added.values()) or not total < 1_000_000_000:
    raise ValueError(f"Unexpected staged size: {total}")
print(json.dumps({"total":total,"unchanged_base":before,"added":added},sort_keys=True))
