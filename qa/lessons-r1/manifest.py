#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT=Path('pages')
MANIFEST='v2/lesson-preview-r1/release-manifest.json'
ACCEPTED=re.compile(r'v2/(?:lesson-preview-r1|english-original-preview|chinese-grade6-preview|math-quiz-preview)/[A-Za-z0-9_.\-/]+')
MAX=1_000_000_000

def records():
    data={}
    for f in ROOT.rglob('*'):
        if f.is_symlink():
            raise ValueError(f'Unexpected symlink: {f}')
        if f.is_file():
            with f.open('rb') as h:
                digest=hashlib.file_digest(h,'sha256').hexdigest()
            data[f.relative_to(ROOT).as_posix()]={'bytes':f.stat().st_size,'sha256':digest}
    return data

before_file=Path(sys.argv[2])
if sys.argv[1]=='before':
    before=records()
    assert sum(x['bytes'] for x in before.values())==996114280, 'unexpected R9 baseline'
    before_file.write_text(json.dumps(before,sort_keys=True))
else:
    before=json.loads(before_file.read_text())
    after=records()
    bad=[path for path,x in before.items() if after.get(path)!=x]
    assert not bad, f'Existing R9 file changed or removed: {bad[:8]}'
    added={path:x for path,x in after.items() if path not in before}
    assert MANIFEST not in added
    assert added and len(added)<200 and all(ACCEPTED.fullmatch(p) for p in added), sorted(added)
    assert 'v2/lesson-preview-r1/index.html' in added
    output=json.dumps({'files':added},ensure_ascii=True,sort_keys=True,separators=(',',':'))+'\n'
    total=sum(x['bytes'] for x in after.values())+len(output)
    assert total<MAX, total
    (ROOT/MANIFEST).write_text(output)
    print(json.dumps({'new_files':len(added)+1,'total_bytes':total,'remaining_bytes':MAX-total},sort_keys=True))
