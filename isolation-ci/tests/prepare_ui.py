"""Prepare public static assets only; no account, API or application execution."""
import base64,hashlib,re,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=Path('/source') if Path('/source').exists() else Path('source')
support=(source/'support.js').read_text()
out=root/'overlay';(out/'qa-vendor').mkdir(exist_ok=True)
for name in ['REACT','REACT_DOM','BABEL']:
 url=re.search(r'var '+name+r'_URL = "([^"]+)"',support)[1]
 sri=re.search(r'var '+name+r'_SRI = "([^"]+)"',support)[1]
 assert url.startswith('https://unpkg.com/')
 with urllib.request.urlopen(url,timeout=60) as r:data=r.read()
 assert 'sha384-'+base64.b64encode(hashlib.sha384(data).digest()).decode()==sri, 'Public dependency integrity mismatch'
 local='qa-vendor/'+name.lower()+'.js';(out/local).write_bytes(data)
 support=support.replace(url,'./'+local)
(out/'support.js').write_text(support)
print('Verified three pinned public runtime assets; no application execution')
