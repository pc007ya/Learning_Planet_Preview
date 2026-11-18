#!/usr/bin/env python3
# Produces only changed files; copy over a SEPARATE staged preview, never production.
from pathlib import Path
import re,sys,json
source=Path(sys.argv[1]).resolve()
out=Path(__file__).parent/'overlay'
bootstrap=(Path(__file__).parent/'preview-bootstrap.js').read_text()
# Deny Firebase / Google API requests, even from an accidentally retained SDK.
# Script/image/style sources remain unchanged; API/network connect is allowlisted.
csp="<meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'self' https://pc007ya.github.io https://cdn.jsdelivr.net https://unpkg.com https://www.gstatic.com data: blob:; form-action 'none'\">"
insert='<meta charset="utf-8">'+csp+'<script>'+bootstrap+'</script>'
count=0
learning_pages=[]
story_pages=[]
for p in source.rglob('*.html'):
    rel=p.relative_to(source)
    if any(x in rel.parts for x in ['.git','node_modules']): continue
    text=p.read_text(errors='strict')
    if rel.as_posix()=='index.html':
        text=text.replace('      if (authV2 && authV2.signOut && authV2.auth) authV2.signOut(authV2.auth).catch(() => {});','      // DEMO never signs out an existing real session.')
        text=text.replace('  async syncBoundStudentProfiles(options = {}) {','  async syncBoundStudentProfiles(options = {}) {\n    if (window.LP_PREVIEW_ONLY) return;')
        text=text.replace('      if (!student) return;\n      const profile = this.cloudSafeProfile(student.profile);','      if (!student || student.id === "demo-local" || !student.profile || student.profile.demoAccount || student.profile.cloudUid !== uid) return;\n      const profile = this.cloudSafeProfile(student.profile);')
    if 'modules/story-entry.mjs' in text: story_pages.append(rel.as_posix())
    if 'data-page-access' in text and rel.parts[0] not in ('admin','teacher'):
        learning_pages.append(rel.as_posix())
    if rel.parts[0] in ('admin','teacher'):
        text='<!doctype html><html lang="zh-Hant"><head><title>預覽管理功能已停用</title></head><body><h1>預覽站只開放 DEMO 學習</h1><p>教師、管理帳號與雲端功能已停用。</p><a href="../">返回預覽入口</a></body></html>'
    if rel.as_posix()=='index.html':
        text=text.replace('      // DEMO never signs out an existing real session.', '      localStorage.setItem("preview-demo-active", "yes");\n      // DEMO never signs out an existing real session.')
        text=text.replace('      logout: () => {', '      logout: () => {\n        localStorage.removeItem("preview-demo-active");')
    # Must precede executable scripts, including files with no explicit head.
    if re.search(r'<head\b[^>]*>',text,re.I): text=re.sub(r'(<head\b[^>]*>)',lambda m:m[0]+insert,text,count=1,flags=re.I)
    else: text=insert+text
    target=out/rel; target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text);count+=1
sw=(source/'entry-image-cache-sw.js').read_text().replace("const DB_NAME = 'learning-planet-entry-images';", "const DB_NAME = 'learning-planet-preview-entry-images.v1:' + self.registration.scope;")
(out/'entry-image-cache-sw.js').write_text(sw)
print(f'Created {count} HTML overlays with early preview isolation; no deployment.')
legacy=(source/'src/firebase-config.js').read_text()
legacy=legacy[legacy.index('function installMobileViewportGuard()'):]
preamble='''// PREVIEW ONLY: preserve viewport behavior, disable legacy Firebase entirely.
const blocked = () => { throw new Error('預覽站只開放 DEMO，雲端功能已停用。'); };
export const initFirebase = () => false, isFirebaseReady = () => false;
export const signInWithGoogle = blocked, saveProfileToFirestore = blocked,
  saveRosterToFirestore = blocked, saveCustomConfig = blocked;
export const logoutUser = async () => {};
export const loadProfileFromFirestore = async () => null,
  loadRosterFromFirestore = async () => null, getStoredConfig = () => null;
export const watchRosterFromFirestore = () => () => {};
export function onAuthUserChanged(callback) { let active=true; queueMicrotask(() => {if(active) callback(null)}); return () => {active=false}; }
'''
(out/'src').mkdir(exist_ok=True)
(out/'src/firebase-config.js').write_text(preamble+legacy)

guard=(Path(__file__).parent/"preview-page-access.mjs").read_text().replace("__LEARNING_PAGE_ALLOWLIST__",json.dumps(sorted(learning_pages)))
(out/"auth-v2/page-access.mjs").write_text(guard)
print(f"Preview DEMO guard allowlists {len(learning_pages)} learning pages; admin/teacher disabled.")

(out/"modules").mkdir(exist_ok=True)
(out/"modules/story-entry.mjs").write_text((Path(__file__).parent/"preview-story-entry.mjs").read_text().replace("__STORY_PAGE_ALLOWLIST__",json.dumps(sorted(story_pages))))
print(f"Preview story guard covers {len(story_pages)} story entries.")
