#!/usr/bin/env python3
import concurrent.futures
import hashlib
import json
import re
import sys
import time
import urllib.request

base,commit,file=sys.argv[1:]
assert base=='https://pc007ya.github.io/Learning_Planet_Preview'
assert re.fullmatch('[0-9a-f]{40}',commit)
files=json.load(open(file,encoding='utf-8'))['files']
def verified(item):
    path,expected=item
    assert re.fullmatch(r'v2/(?:lesson-preview-r1|english-original-preview|chinese-grade6-preview|math-quiz-preview)/[A-Za-z0-9_.\-/]+',path)
    assert '..' not in path.split('/')
    for attempt in range(5):
        try:
            with urllib.request.urlopen(base+'/'+path+'?v='+commit,timeout=25) as r:
                assert r.geturl().startswith(base+'/')
                body=r.read()
            assert len(body)==expected['bytes']
            assert hashlib.sha256(body).hexdigest()==expected['sha256']
            return path
        except (AssertionError,OSError):
            if attempt==4:
                raise
            time.sleep(attempt+1)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results=list(pool.map(verified,files.items()))
print(f'Exact public byte match for {len(results)} lesson files.')
