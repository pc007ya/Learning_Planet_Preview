"""Fail closed on drift from the pinned asset site and the locally staged app."""
import hashlib
import json
from pathlib import Path
import sys

def hash_file(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()
def rows(root):
    return {p.relative_to(root).as_posix():{
        'bytes':p.stat().st_size,'sha256':hash_file(p)
    } for p in sorted(root.rglob('*')) if p.is_file()}
def canonical(data):
    return (json.dumps(data,sort_keys=True,separators=(',',':'))+'\n').encode()

app = Path(sys.argv[1]).resolve(strict=True)
out = Path(sys.argv[2])
size = json.loads(Path(sys.argv[3]).read_text())
parity = json.loads(Path(sys.argv[4]).read_text())
files = rows(app)
manifest = canonical(files)
actual = hashlib.sha256(manifest).hexdigest()
expected = Path(sys.argv[5]).read_text().strip()
total = sum(v['bytes'] for v in files.values())
(out/'candidate-app-inventory.json').write_bytes(manifest)
(out/'combined-receipt.json').write_bytes(canonical({
    'app_tree_sha256':actual,'expected_app_tree_sha256':expected,'app_bytes':total,
    'app_files':len(files),'assets_bytes':parity['assets_bytes'],'asset_count':parity['asset_count'],
    'assets_equal':parity['match'], 'browser_qa':'NOT_RUN','deploy':'NOT_DEPLOYED',
    'source_commit':'bcf984f7b4a6d370e5ec6786639e51e169ff6b5b',
    'isolation_source_commit':'c486b246f79d80d01320c915ec6fcb458c1ea153',
}))
if (actual != expected or total != 995_167_904 or total != size['app_bytes']
        or len(files) != 5496 or size['errors'] or parity['match'] is not True
        or parity['assets_bytes'] != 989_471_212 or parity['asset_count'] != 2141):
    raise SystemExit('Combined preview drifted from the exact known local package or asset site')
print('Candidate matches exact prior staged app tree; no browser or Pages approval implied.')
