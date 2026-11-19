#!/usr/bin/env python3
"""Fetch or verify only the three pinned public JS runtime dependencies."""
import argparse
import base64
import hashlib
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, build_opener

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def verify(src, directory, *, download=False):
    support = src.read_text(encoding='utf-8')
    for name in ('REACT', 'REACT_DOM', 'BABEL'):
        url = re.search(r'var '+name+r'_URL = "([^"]+)"', support)[1]
        sri = re.search(r'var '+name+r'_SRI = "([^"]+)"', support)[1]
        u = urlparse(url)
        if u.scheme != 'https' or u.netloc != 'unpkg.com' or u.query or u.fragment:
            raise ValueError(f'Unexpected runtime host for {name}')
        local = name.lower() + '.js'
        path = directory / local
        if download:
            with build_opener(NoRedirect).open(url, timeout=30) as response:
                data = response.read(5_000_001)
        else:
            data = path.read_bytes()
        if len(data) > 5_000_000 or 'sha384-'+base64.b64encode(hashlib.sha384(data).digest()).decode()!=sri:
            raise ValueError(f'Runtime verification failed: {name}')
        if download:
            path.write_bytes(data)
        support = support.replace(url, './qa-vendor/'+local)
    return support

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source', type=Path)
    p.add_argument('directory', type=Path)
    p.add_argument('--download', action='store_true')
    a = p.parse_args()
    verify(a.source/'support.js', a.directory, download=a.download)
    print('All three public runtime files match the SHA-384 in checked source')
