#!/usr/bin/env bash
set -euo pipefail
here=qa/lessons-r1
marker=$(mktemp)
trap 'rm -f "$marker"' EXIT
python3 "$here/manifest.py" before "$marker"
python3 "$here/stage-english.py" pages
for kind in chinese-grade6-preview math-quiz-preview; do
  source="$here/overlay/v2/$kind"
  if [[ -d "$source" ]]; then test ! -e "pages/v2/$kind"; cp -r "$source" "pages/v2/$kind"; fi
done
mkdir -p pages/v2/lesson-preview-r1
cp "$here/index.html" pages/v2/lesson-preview-r1/index.html
for t in "$here"/test-*.mjs; do
  node --test "$t"
done
for dest in english-original-preview chinese-grade6-preview math-quiz-preview; do
  test -s "pages/v2/$dest/index.html"
  while IFS= read -r -d '' script; do
    node --check "$script"
  done < <(find "pages/v2/$dest" -type f \( -name '*.mjs' -o -name '*.js' \) -print0)
done
python3 "$here/manifest.py" after "$marker"
