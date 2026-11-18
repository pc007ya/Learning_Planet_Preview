"""Verify only public deployment artifacts; never deploy or invoke app code."""
import hashlib,json,tarfile,shutil,re,sys,subprocess
from pathlib import Path
ROOT=Path.cwd()
OUT=ROOT/'verification';OUT.mkdir(exist_ok=True)
def manifest(root):
 result={}
 for p in sorted(root.rglob('*')):
  if p.is_symlink():raise RuntimeError('Symlink rejected: '+str(p))
  if p.is_file():result[p.relative_to(root).as_posix()]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 return result
def write(name,data):(OUT/name).write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,indent=2))
phase=sys.argv[1]
if phase=='baseline':
 tar=next(Path('rollback-download').rglob('*.tar'))
 dest=Path('rollback-site');dest.mkdir()
 with tarfile.open(tar) as t:
  for m in t:
   rel=Path(m.name)
   assert not rel.is_absolute() and '..' not in rel.parts and (m.isfile() or m.isdir()),'Unsafe archive member'
  t.extractall(dest,filter='data')
 old=manifest(dest);current=manifest(Path('work/two-sites/app'))
 write('rollback-manifest.json',old);write('baseline-manifest.json',current)
 assert old==current,'Rebuilt Pages baseline differs from deployed artifact; STOP'
 inventory=json.loads(Path('prior-integrity/split-manifest.json').read_text())
 for rel,v in inventory.items():
  p=Path('work/two-sites')/v['unit']/rel
  assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==v['sha256'],'Prior split inventory mismatch: '+rel
 write('baseline-verdict.json',{'status':'EXACT_MATCH','source':'0e39222ba892fbc823a884bad636cfb484501169','deployment':'7882746757','rollbackFiles':len(old),'rollbackBytes':sum(v['bytes'] for v in old.values()),'oldArtifactId':14425577558,'notADeploy':True})
elif phase=='candidate':
 base=Path('work/two-sites/app');dest=Path('candidate-site')
 shutil.copytree(base,dest)
 # Generate from already-built/split app. Thus moved asset URLs and public maps remain intact.
 subprocess.run([sys.executable,'isolation-ci/build-overlay.py',str(base)],check=True)
 # prepare_ui.py reads "source"; point its source selection at exact staged baseline.
 prep=Path('isolation-ci/tests/prepare_ui.py').read_text()
 prep=prep.replace("else Path('source')","else Path('work/two-sites/app')")
 exec(compile(prep,'prepare_ui.py','exec'),{'__file__':str((ROOT/'isolation-ci/tests/prepare_ui.py').resolve())})
 overlay=Path('isolation-ci/overlay')
 for p in overlay.rglob('*'):
  if p.is_file():
   q=dest/p.relative_to(overlay);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
 # No analytics request in this isolated acceptance build.
 p=dest/'index.html';html=p.read_text()
 html,n=re.subn(r'<!-- Cloudflare Web Analytics -->.*?<!-- End Cloudflare Web Analytics -->','',html,flags=re.S)
 assert n==1,'Expected exactly the existing injected analytics block'
 p.write_text(html)
 before=manifest(base);after=manifest(dest)
 changes={k:{'before':before.get(k),'after':after.get(k)} for k in sorted(before.keys()|after.keys()) if before.get(k)!=after.get(k)}
 write('candidate-manifest.json',after);write('candidate-changes.json',changes)
 allowed={'support.js','src/firebase-config.js','auth-v2/firebase-client.js','auth-v2/page-access.mjs','auth-v2/page-script-loader.mjs','modules/story-entry.mjs','entry-image-cache-sw.js'}
 assert all(k.endswith('.html') or k in allowed or k.startswith('qa-vendor/') for k in changes),'Unexpected non-isolation change'
 assert not (before.keys()-after.keys()),'Unexpected deletion'
 total=sum(v['bytes'] for v in after.values())
 findings=[]
 for rel in after:
  p=dest/rel
  if p.suffix in {'.html','.js','.mjs'}:
   s=p.read_text(errors='replace')
   for pattern in [r'\binitializeApp\s*\(',r'firebase\.initializeApp',r'https://[^\s"\x27<>]*(?:firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com)']:
    if re.search(pattern,s):findings.append({'path':rel,'pattern':pattern})
 write('backend-scan.json',{'findings':findings,'scope':'All artifact HTML/JS/MJS; conservative static blockers, not full reachability proof'})
 write('candidate-verdict.json',{'bytes':total,'headroom':1000000000-total,'changedFiles':len(changes),'analyticsRemoved':n,'mapNonHTMLChanges':[],'assetsModified':False,'deployed':False})
 assert total<1000000000,'Candidate >=1GB'
 assert not findings,'Potential true Firebase initialization/API reference; STOP for independent review'
else:raise ValueError(phase)
