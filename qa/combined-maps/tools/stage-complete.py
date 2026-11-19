#!/usr/bin/env python3
"""Materialize the checked source using the existing Pages staging exclusions."""
import argparse
import fnmatch
import shutil
import subprocess
from pathlib import Path

EXCLUDED = ('_site', 'node_modules', '.git', '.github', 'functions',
    'firebase-debug.log', 'src', 'tests', 'modules/math-mission-map/v11/qa',
    'docs', 'qa', 'science-curriculum-preview.html', 'nature-planet-preview.html',
    '*.check.mjs', '*.test.mjs')

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('source', type=Path)
p.add_argument('destination', type=Path)
p.add_argument('--expect-rev', required=True)
a = p.parse_args()
src, dst = a.source.resolve(strict=True), a.destination.resolve()
if src == dst or src in dst.parents or dst in src.parents or dst.exists():
    raise SystemExit('Need a fresh output disjoint from source')
rev = subprocess.check_output(['git', '-C', str(src), 'rev-parse', 'HEAD'], text=True).strip()
if rev != a.expect_rev:
    raise SystemExit(f'Expected {a.expect_rev}; got {rev}')

def ignore(base, names):
    retained = set()
    for name in names:
        path = Path(base) / name
        rel = path.relative_to(src).as_posix()
        if any(fnmatch.fnmatchcase(rel if '/' in glob else name, glob) for glob in EXCLUDED):
            retained.add(name)
        elif not path.is_file() and not path.is_dir() or path.is_symlink():
            raise ValueError(f'Invalid staged entry: {rel}')
    return retained

shutil.copytree(src, dst, ignore=ignore)
runtime = src / 'src/firebase-config.js'
if runtime.is_symlink() or not runtime.is_file():
    raise SystemExit('Invalid source runtime config')
(dst / 'src').mkdir()
shutil.copy2(runtime, dst / 'src/firebase-config.js')
# Raw staging is NEVER published. No analytics injection in this acceptance build.
print(f'Staged exact source HEAD {rev} (plus local checked build products): {dst}')
