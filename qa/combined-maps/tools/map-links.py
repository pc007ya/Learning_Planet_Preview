#!/usr/bin/env python3
"""Inspect literal static module and data links reachable by the staged map modules."""
import json, re, sys
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT=Path(sys.argv[1]).resolve(strict=True)
SEEDS=(
    'modules/english-original/english-map-r26.js',
    'modules/english-original/vendor-r26/three.module.js',
    'modules/chinese-planet/map.mjs',
)
# Regex is intentionally only a focused check of literal references in authored modules,
# not a parser or evidence for dynamic routes/runtime requests.
LOCAL_PATTERNS=(
    r'(?m)^(?:import|export)[^;\n]{0,12000}?\bfrom\s*["\']([^"\']+)["\']',
    r'\bimport\(\s*["\']([^"\']+)["\']\s*\)',
    r'\bnew URL\(\s*["\']([^"\']+)["\']\s*,\s*import\.meta\.url\s*\)',
)
LINK_PATTERNS=tuple(map(re.compile,LOCAL_PATTERNS))
seen, edges, failures = set(), [], []
queue = list(SEEDS)
while queue:
    file=queue.pop()
    if file in seen: continue
    seen.add(file)
    p=ROOT/file
    if not p.is_file():
        failures.append({'missing':file}); continue
    if p.suffix not in {'.mjs','.js'}: continue
    text=p.read_text(encoding='utf-8')
    # Three vendor bundles have two or more declarations per physical line;
    # additionally find their minified same-folder static imports.
    local=[m for pattern in LINK_PATTERNS for m in pattern.findall(text)]
    if 'vendor' in file:
        local.extend(re.findall(r'\bfrom\s*["\'](\.[^"\']+)["\']',text))
    for ref in sorted(set(local)):
        u=urlsplit(ref)
        if u.scheme or u.netloc or not u.path.startswith(('./','../')):
            failures.append({'from':file,'unsupported_link':ref}); continue
        target=(p.parent/unquote(u.path)).resolve()
        if not target.is_relative_to(ROOT):
            failures.append({'from':file,'escapes_stage':ref}); continue
        rel=target.relative_to(ROOT).as_posix()
        edges.append([file,rel])
        queue.append(rel)
report={'scope':'Literal authored map JS/module-relative data references only; no browser or visual proof',
        'entries':SEEDS,'checked_paths':sorted(seen),'edges':edges,'failures':failures}
Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(f'{len(seen)} path checks, {len(edges)} edges, {len(failures)} failures.')
raise SystemExit(bool(failures))
