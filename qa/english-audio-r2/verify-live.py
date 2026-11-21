import concurrent.futures,hashlib,json,re,sys,time,urllib.request
base,commit=sys.argv[1:]
assert base=='https://pc007ya.github.io/Learning_Planet_Preview'
assert re.fullmatch('[0-9a-f]{40}',commit)
manifest='v2/english-original-audio-r2/release-manifest.json'
def fetch(path):
    url=base+'/'+path+'?v='+commit
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url,timeout=25) as r:
                assert r.geturl()==url
                return r.read()
        except (OSError,AssertionError):
            if attempt==4:raise
            time.sleep(attempt+1)
files=json.loads(fetch(manifest))
assert len(files)==15
def verify(item):
    path,digest=item
    assert re.fullmatch(r'v2/english-original-audio-r2/[A-Za-z0-9_.\-/]+',path)
    assert '..' not in path.split('/')
    assert hashlib.sha256(fetch(path)).hexdigest()==digest,path
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(verify,files.items()))
print('Exact public byte match for all 15 English audio files')
