#!/usr/bin/env python3
"""Prepare complete GitHub Pages preview with non-destructive old worker handoff."""
from pathlib import Path, PurePosixPath
from hashlib import sha256, file_digest
from html import escape
from urllib.parse import quote
import argparse
import json
import re
import shutil

BUNDLE = Path(__file__).resolve().parent
PREFIX = 'v2'
CANDIDATE_SHA = '7d4e8989d4aacf015a445eabab2ca40e24ecbebc1df0b7a70e32d4047212a06b'
MAX_BYTES = 1_000_000_000
REPLACEMENTS = ('entry-image-cache-sw.js', 'entry-image-progress.js')
LEGACY_ROOT = '/Learning_Planet_Preview/'
V2_ONLY_REFERENCE = re.compile(r"(?<![\w/])(?:/Learning_Planet_Preview/(?!v2/)|https?://pc007ya\.github\.io/Learning_Planet_Preview/(?!v2/))")
LEGACY_IMAGE_REF = re.compile(r"""['"`]\/images\/""")
WRAPPER_CSP = "default-src 'none'; script-src 'self'; style-src 'none'; img-src 'none'; connect-src 'none'; worker-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'"

def die(msg):
    raise ValueError(msg)

def inv(path):
    with path.open('rb') as f:
        h = file_digest(f, 'sha256').hexdigest()
    return {'bytes': path.stat().st_size, 'sha256': h}

def validate_old_source(base, manifest):
    blob = manifest.read_bytes()
    if sha256(blob).hexdigest() != CANDIDATE_SHA:
        die('Wrong pinned candidate manifest digest')
    expected = json.loads(blob)
    files = {q.relative_to(base).as_posix():q for q in base.rglob('*') if q.is_file()}
    if set(files) != set(expected):
        die('Candidate tree differs from exact published inventory')
    for rel, q in files.items():
        if q.is_symlink() or inv(q) != expected[rel]:
            die(f'Candidate file mismatch: {rel}')
        if q.suffix in ('.html', '.js', '.mjs', '.css'):
            s = q.read_text('utf-8')
            if V2_ONLY_REFERENCE.search(s) or LEGACY_IMAGE_REF.search(s):
                die(f'Needs an explicit v2 route rewrite: {rel}')
    if len(expected) != 5496 or sum(v['bytes'] for v in expected.values()) != 995167904:
        die('Unexpected candidate budget')
    return expected

def wrapper(path):
    depth = len(PurePosixPath(path).parts)-1
    up = '../' * depth or './'
    if path.endswith('index.html'):
        dest = quote(path.removesuffix('index.html'), safe='/')
    else:
        dest = quote(path, safe='/')
    href = up + PREFIX + '/' + dest
    return (
        '<!doctype html><html lang="zh-Hant"><meta charset="utf-8">'
        f'<meta http-equiv="Content-Security-Policy" content="{escape(WRAPPER_CSP, quote=True)}">'
        '<meta name="robots" content="noindex,nofollow"><title>學習星球驗收預覽</title>'
        f'<p><a data-preview-handoff href="{escape(href, quote=True)}">開啟學習星球新版驗收頁</a></p>'
        f'<script src="{up}preview-forward.js"></script></html>\n'
    )

def stage(base, manifest, out):
    if not base.is_dir() or out.exists() or base in out.parents or out in base.parents:
        die('Require exact input and fresh disjoint output')
    original = validate_old_source(base, manifest)
    out.mkdir()
    v2 = out / PREFIX
    shutil.copytree(base, v2, copy_function=shutil.copyfile)
    for fname, source in zip(REPLACEMENTS, ('retire-worker.js', 'v2-entry-image-progress.js')):
        shutil.copyfile(BUNDLE / source, v2 / fname)
    shutil.copytree(BUNDLE/'overlay/maps-preview', v2/'maps-preview')
    wrappers = sorted({p for p in original if p.endswith('.html')} | {'maps-preview/index.html'})
    for rel in wrappers:
        q = out / rel
        q.parent.mkdir(exist_ok=True, parents=True)
        q.write_text(wrapper(rel), encoding='utf-8')
    shutil.copyfile(BUNDLE/'retire-worker.js', out/'entry-image-cache-sw.js')
    shutil.copyfile(BUNDLE/'forward.js', out/'preview-forward.js')
    (out/'.nojekyll').write_bytes(b'')
    root_files = set(wrappers) | {'.nojekyll', 'preview-forward.js', 'entry-image-cache-sw.js'}
    root_files_observed = {q.relative_to(out).as_posix() for q in out.rglob('*') if q.is_file() and not q.is_relative_to(v2)}
    if root_files_observed != root_files or any(p.startswith('images/') for p in root_files):
        die('Unexpected legacy-scope payloads could trigger old worker')
    files = {}
    for q in sorted(p for p in out.rglob('*') if p.is_file()):
        rel = q.relative_to(out).as_posix()
        data = inv(q)
        if q.is_symlink():
            die(f'Unexpected output symlink: {rel}')
        if q.is_relative_to(v2) and (p := q.relative_to(v2).as_posix()) in original and p not in REPLACEMENTS and data != original[p]:
            die(f'Unexpected mutation of pinned candidate: {p}')
        files[rel] = data
    if len(files) != len(original)+len(root_files)+5:
        die('Unexpected staged inventory path count')
    total = sum(x['bytes'] for x in files.values())
    if not 0 < total < MAX_BYTES:
        die('Staged app exceeds decimal 1 GB')
    digest = sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'v2_components_rel': len(original), 'redirects': len(wrappers), 'files': len(files), 'bytes': total, 'inventory_sha256': digest,
            'legacy_allowlisted_images_served_at_root': 0, 'verified_original_files_unchanged_at_v2': len(original)-len(REPLACEMENTS),
            'assets_deployed': False, 'firebase_deployed': False, 'local_only': True}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('candidate', type=Path)
    ap.add_argument('inventory', type=Path)
    ap.add_argument('output', type=Path)
    a=ap.parse_args()
    print(json.dumps(stage(a.candidate.resolve(), a.inventory.resolve(), a.output.resolve()), sort_keys=True))
if __name__ == '__main__':
    main()
