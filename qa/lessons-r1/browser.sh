#!/usr/bin/env bash
set -euo pipefail
log=$(mktemp)
server=
cleanup(){ if [[ -n "$server" ]]; then kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; fi; rm -f "$log"; }
trap cleanup EXIT
python3 -m http.server 8272 --bind 127.0.0.1 --directory pages >"$log" 2>&1 &
server=$!
export BASE_URL=http://127.0.0.1:8272
for n in {1..25}; do
  if curl -fsS "$BASE_URL/v2/lesson-preview-r1/" >/dev/null; then break; fi
  sleep .2
done
curl -fsS "$BASE_URL/v2/lesson-preview-r1/" >/dev/null
for t in qa/lessons-r1/test-*.browser.cjs; do node "$t"; done
