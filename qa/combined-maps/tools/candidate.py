#!/usr/bin/env python3
"""Build a preview-only candidate from checked split staging. No network or publish."""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from read_vendor import verify as verify_vendor

ALLOWED = {'support.js', 'src/firebase-config.js', 'auth-v2/firebase-client.js', 'auth-v2/page-access.mjs',
           'auth-v2/page-script-loader.mjs', 'modules/story-entry.mjs', 'entry-image-cache-sw.js'}
REQUIRED_CHANGED = ALLOWED - {'auth-v2/page-script-loader.mjs'}
LIMIT = 1_000_000_000
BOOTSTRAP_START = '<script>// Insert synchronously before every other script in EVERY preview HTML entry.'
PATTERNS = [r'\binitializeApp\s*\(', r'firebase\.initializeApp',
    r'https://[^\s"\x27<>]*(?:firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com)',
    r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|gh[pousr]_[A-Za-z0-9]{30,}']

def manifest(root):
    rows = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Symlink rejected: {path}')
        if path.is_file():
            with path.open('rb') as f:
                rows[path.relative_to(root).as_posix()] = {
                    'sha256': hashlib.file_digest(f, 'sha256').hexdigest(),
                    'bytes': path.stat().st_size,
                }
    return rows

def audit(before, after, dest):
    changed = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
    errors = []
    if before.keys() - after.keys():
        errors.append('unexpected deletion')
    if any(not (k.endswith('.html') or k in ALLOWED or re.fullmatch(r'qa-vendor/(react|react_dom|babel)\.js', k)) for k in changed):
        errors.append('unexpected scope expansion')
    if not REQUIRED_CHANGED <= set(changed):
        errors.append('missing required isolation overlays')
    total = sum(x['bytes'] for x in after.values())
    if not 0 < total < LIMIT:
        errors.append('app budget exceeded')
    checks = {'html_bootstrap_first': 0, 'analytics_blocks_removed': 0}
    matches = []
    for rel in after:
        p = dest / rel
        if p.suffix in {'.js','.mjs','.html','.json','.md','.txt'}:
            text = p.read_text(encoding='utf-8', errors='replace')
            for pattern in (PATTERNS if p.suffix in {'.js','.mjs','.html'} else PATTERNS[-1:]):
                if re.search(pattern, text):
                    matches.append({'path':rel, 'pattern':pattern})
            if p.suffix == '.html':
                first = re.search(r'<script(?=[\s>])', text, re.I)
                csp = text.find('http-equiv="Content-Security-Policy"')
                if first is None or not text.startswith(BOOTSTRAP_START, first.start()) or not 0 <= csp < first.start():
                    errors.append(f'first-script isolation missing: {rel}')
                else:
                    checks['html_bootstrap_first'] += 1
    if matches:
        errors.append('potential live backend SDK/URL or private credentials')
    return {'deployed':False, 'browser_qa':'NOT_RUN', 'app_bytes':total,
            'headroom':LIMIT-total, 'app_files':len(after), 'isolation_checks':checks,
            'changes':changed, 'findings':matches, 'errors':errors}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('raw_app', type=Path)
    p.add_argument('isolation_ci', type=Path)
    p.add_argument('vendor', type=Path)
    p.add_argument('candidate', type=Path)
    p.add_argument('report', type=Path)
    a = p.parse_args()
    raw_app, isolation_ci, vendor = (x.resolve(strict=True) for x in (a.raw_app,a.isolation_ci,a.vendor))
    dest, report = (x.resolve() for x in (a.candidate,a.report))
    if dest.exists() or report.exists() or dest == report or dest in report.parents or report in dest.parents:
        raise SystemExit('Need fresh disjoint candidate and report destinations')
    if any(r in dest.parents or dest in r.parents or dest == r
           or r in report.parents or report == r for r in (raw_app,isolation_ci,vendor)):
        raise SystemExit('Do not output to an input tree')
    before = manifest(raw_app)
    if not before:
        raise SystemExit('Empty application stage')
    support = verify_vendor(raw_app/'support.js', vendor)
    with tempfile.TemporaryDirectory(dir=dest.parent, prefix='assemble-') as work:
        work = Path(work)
        src = work/'isolation'
        shutil.copytree(isolation_ci,src)
        subprocess.run([sys.executable,str(src/'build-overlay.py'),str(raw_app)],check=True)
        overlay = src/'overlay'
        shutil.copytree(raw_app,dest)
        overlay_rows = manifest(overlay)
        for rel in overlay_rows:
            q = dest/rel
            q.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(overlay/rel,q)
    (dest/'qa-vendor').mkdir(exist_ok=True)
    for name in ('react.js','react_dom.js','babel.js'):
        shutil.copyfile(vendor/name,dest/'qa-vendor'/name)
    (dest/'support.js').write_text(support,encoding='utf-8')
    root_html = dest/'index.html'
    html, removed = re.subn(r'<!-- Cloudflare Web Analytics -->.*?<!-- End Cloudflare Web Analytics -->','',
                            root_html.read_text(encoding='utf-8'),flags=re.S)
    if removed:
        root_html.write_text(html,encoding='utf-8')
    after = manifest(dest)
    result = audit(before, after, dest)
    overlay_diff = [rel for rel, row in overlay_rows.items() if after.get(rel) != row and rel != 'index.html']
    if not ALLOWED - {'support.js'} <= overlay_rows.keys() or overlay_diff:
        result['errors'].append('required source overlay missing or content differs: ' + str(overlay_diff))
    result['isolation_checks']['overlay_files_verified'] = len(overlay_rows) - ('index.html' in overlay_rows)
    result['isolation_checks']['analytics_blocks_removed'] = removed
    report.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='changes'},ensure_ascii=False,indent=2))
    return 1 if result['errors'] else 0

if __name__ == '__main__':
    raise SystemExit(main())
