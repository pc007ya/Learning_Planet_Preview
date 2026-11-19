"""Offline verifier for already staged Pages output. Never publishes or fetches."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

PREFIXES = ('images/story/', 'images/story-vocabulary/', 'images/science/', 'images/math-grade1/')
PAGES_LIMIT = 1_000_000_000
ASSET_INDEX = (b'<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">'
               b'<title>Learning Planet assets</title><p>Public learning assets. No sign-in here.</p>')
ASSET_META = {'.nojekyll': b'', 'index.html': ASSET_INDEX}


def row(path):
    with path.open('rb') as stream:
        return {'bytes': path.stat().st_size, 'sha256': hashlib.file_digest(stream, 'sha256').hexdigest()}


def valid_rows(rows, preview=False):
    if not isinstance(rows, dict):
        raise ValueError('Expected an asset inventory object')
    expected = {}
    for name, item in rows.items():
        if not isinstance(item, dict):
            raise ValueError(f'Invalid inventory row: {name!r}')
        if preview and item.get('unit') != 'assets':
            if item.get('unit') != 'app' or name.startswith(PREFIXES):
                raise ValueError(f'Invalid split classification: {name!r}')
            continue
        if (not name.startswith(PREFIXES) or '\\' in name
                or name != PurePosixPath(name).as_posix() or '..' in PurePosixPath(name).parts
                or type(item.get('bytes')) is not int or item['bytes'] < 0
                or not re.fullmatch(r'[0-9a-f]{64}', item.get('sha256', ''))):
            raise ValueError(f'Invalid asset record: {name!r}')
        expected[name] = {'bytes': item['bytes'], 'sha256': item['sha256']}
    if not expected:
        raise ValueError('Empty asset inventory')
    return expected


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f'Duplicate JSON key: {key!r}')
        out[key] = value
    return out


def read_inventory(path, preview=False):
    return valid_rows(json.loads(path.read_text(), object_pairs_hook=unique_object), preview)


def differences(expected, actual):
    return {
        'missing': sorted(expected.keys() - actual.keys()),
        'extra': sorted(actual.keys() - expected.keys()),
        'different': sorted(k for k in expected.keys() & actual.keys() if expected[k] != actual[k]),
    }


def inventory(folder):
    if folder.is_symlink() or not folder.is_dir():
        raise ValueError(f'Not a real directory: {folder}')
    found = {}
    for path in folder.rglob('*'):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError(f'Invalid staged entry: {path}')
        if path.is_file():
            found[path.relative_to(folder).as_posix()] = path
    return found


def verify(stage, expected):
    app, assets = (inventory(stage / unit) for unit in ('app', 'assets'))
    app_bytes = sum(p.stat().st_size for p in app.values())
    assets_bytes = sum(p.stat().st_size for p in assets.values())
    duplicates = sorted(k for k in app if k.startswith(PREFIXES))
    actual = {k: row(v) for k, v in assets.items() if k not in ASSET_META}
    diff = differences(expected, actual)
    meta_ok = all(k in assets and row(assets[k]) == {
        'bytes': len(v), 'sha256': hashlib.sha256(v).hexdigest()} for k, v in ASSET_META.items())
    within_budget = 0 < app_bytes < PAGES_LIMIT and 0 < assets_bytes < PAGES_LIMIT
    return {
        'app_bytes': app_bytes, 'assets_bytes': assets_bytes, 'asset_count': len(actual),
        'under_limit': within_budget, 'asset_meta_ok': meta_ok, 'asset_files_left_in_app': duplicates,
        **diff, 'match': within_budget and meta_ok and not duplicates and not any(diff.values()),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', type=Path)
    parser.add_argument('digest', type=Path)
    args = parser.parse_args()
    app, assets = (inventory(args.stage / unit) for unit in ('app', 'assets'))
    sizes = [sum(p.stat().st_size for p in files.values()) for files in (app, assets)]
    duplicates = sorted(k for k in app if k.startswith(PREFIXES))
    actual = {k:row(v) for k,v in assets.items() if k not in ASSET_META}
    valid_rows(actual)
    serialized = (json.dumps(actual,sort_keys=True,separators=(',',':'))+'\n').encode()
    digest = hashlib.sha256(serialized).hexdigest()
    expected = args.digest.read_text().strip()
    meta_ok = all(k in assets and row(assets[k]) == {
        'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()
    } for k,v in ASSET_META.items())
    match = (digest == expected and len(actual)==2141 and sizes[1]==989_471_212
             and all(0 < size < PAGES_LIMIT for size in sizes) and not duplicates and meta_ok)
    result = {'match':match,'app_bytes':sizes[0],'assets_bytes':sizes[1],'asset_count':len(actual),
              'asset_inventory_sha256':digest,'expected_asset_inventory_sha256':expected,
              'asset_meta_ok':meta_ok,'asset_files_left_in_app':duplicates}
    print(json.dumps(result,indent=2))
    return 0 if match else 1

if __name__ == '__main__':
    raise SystemExit(main())
