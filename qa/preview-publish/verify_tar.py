"""Read-only verification of a Pages tar against independently pinned receipts."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile

HEX = re.compile(r'[0-9a-f]{64}\Z')
MAX_SITE_BYTES = 1_000_000_000
MAX_TAR_BYTES = 1_015_000_000

def unique_object(pairs):
    out={}
    for key,value in pairs:
        if key in out:
            raise ValueError(f'duplicate inventory key: {key}')
        out[key]=value
    return out

def safe_name(name, tar=False):
    if tar and name.startswith('./'):
        name=name[2:]
    path=PurePosixPath(name)
    if (not name or path.is_absolute() or str(path) != name or name == '.'
            or '..' in path.parts or '\\' in name or any(ord(c)<32 for c in name)):
        raise ValueError(f'invalid site path: {name!r}')
    return name

def sha_file(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()

def verify(bundle, inventory, expected_tar_sha, expected_tree_sha):
    if not HEX.fullmatch(expected_tar_sha) or not HEX.fullmatch(expected_tree_sha):
        raise ValueError('Expected SHA-256 pins are required for tar and inventory.')
    if bundle.stat().st_size > MAX_TAR_BYTES:
        raise ValueError('Tar exceeds upper guard.')
    if sha_file(bundle) != expected_tar_sha:
        raise ValueError('Tar SHA-256 mismatch.')
    encoded=inventory.read_bytes()
    if hashlib.sha256(encoded).hexdigest()!=expected_tree_sha:
        raise ValueError('Inventory SHA-256 mismatch.')
    rows=json.loads(encoded,object_pairs_hook=unique_object)
    if not isinstance(rows,dict) or not rows:
        raise ValueError('Inventory must be a nonempty object.')
    for k,row in rows.items():
        safe_name(k)
        if (not isinstance(row,dict) or set(row)!={'bytes','sha256'}
                or type(row['bytes']) is not int or row['bytes']<0
                or not isinstance(row['sha256'],str) or not HEX.fullmatch(row['sha256'])):
            raise ValueError(f'invalid inventory entry: {k}')
    total=sum(x['bytes'] for x in rows.values())
    if not 0<total<MAX_SITE_BYTES:
        raise ValueError('Pages site payload is not strictly below 1 GB.')
    seen={}
    allowed_dirs={'./','.'}
    for k in rows:
        allowed_dirs.update(str(d) for d in PurePosixPath(k).parents)
    with tarfile.open(bundle,'r:') as tar:
        for m in tar:
            if m.name in ('.','./') and m.isdir():
                key='.'
            else:
                key=safe_name(m.name,tar=True)
            if key in seen:
                raise ValueError(f'duplicate tar entry: {key}')
            if m.isdir() and key in allowed_dirs:
                seen[key]='dir'
                continue
            if m.type not in (tarfile.REGTYPE,tarfile.AREGTYPE) or key not in rows:
                raise ValueError(f'unexpected tar entry or link: {key}')
            if m.size != rows[key]['bytes']:
                raise ValueError(f'file size mismatch: {key}')
            with tar.extractfile(m) as f:
                if hashlib.file_digest(f,'sha256').hexdigest()!=rows[key]['sha256']:
                    raise ValueError(f'file content mismatch: {key}')
            seen[key]='file'
    if {k for k,v in seen.items() if v=='file'} != set(rows):
        raise ValueError('Tar is missing inventoried files.')
    return {'app_files':len(rows),'app_bytes':total,'inventory_sha256':expected_tree_sha,
            'tar_sha256':expected_tar_sha,'browser_qa':'NOT_RUN','deploy':'NOT_DEPLOYED'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('tar',type=Path); p.add_argument('inventory',type=Path)
    p.add_argument('--tar-sha256',required=True); p.add_argument('--tree-sha256',required=True)
    a=p.parse_args()
    print(json.dumps(verify(a.tar,a.inventory,a.tar_sha256,a.tree_sha256),indent=2))
