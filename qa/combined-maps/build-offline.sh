#!/usr/bin/env bash
# CI-only staging, no production calls and no publication.
set -euo pipefail
[[ "$(tail -n +3 /proc/net/dev | cut -d: -f1 | xargs)" == lo ]]
[[ -z "$(tail -n +2 /proc/net/route)" ]]
root="$(pwd -P)"
cfg="$root/qa/combined-maps"
app="$root/combined-source"
iso="$root/combined-isolation"
out="$root/combined-work"
base=bcf984f7b4a6d370e5ec6786639e51e169ff6b5b
test "$(git -C "$app" rev-parse HEAD)" = "$base"
test "$(git -C "$iso" rev-parse HEAD)" = c486b246f79d80d01320c915ec6fcb458c1ea153
(
  cd "$app"
  git apply --check "$out/input/english.patch"
  git apply "$out/input/english.patch"
  git apply --check "$out/input/chinese.source.patch"
  git apply "$out/input/chinese.source.patch"
  git apply --check "$out/input/chinese.lifecycle.patch"
  git apply "$out/input/chinese.lifecycle.patch"
  npm rebuild --offline
  mv node_modules/.bin/vitest node_modules/.bin/vitest.original
  printf '%s\n' '#!/bin/sh' 'exec node "$(dirname "$0")/../vitest/vitest.mjs" "$@" --maxWorkers=2 --no-file-parallelism' > node_modules/.bin/vitest
  chmod +x node_modules/.bin/vitest
  python3 scripts/patch-ipad-ux.py
  python3 scripts/pack-nature-assets.py --verify-manifest
  node --test tests/chinese-planet.check.mjs tests/english-original/exploration.check.mjs
  npm run test:chinese-practice
  npm run build:chinese-practice
  echo 'd36d93b07980565776001ece5447586b4ac00a61c70f381f07a69b97483f4bc6  modules/chinese-practice/chinese-practice.js' | sha256sum -c -
  npm run check
)
python3 "$cfg/tools/stage-complete.py" "$app" "$out/complete" --expect-rev "$base"
python3 "$cfg/tools/two-pages-stage.py" "$out/complete" "$out/two-sites"
python3 "$cfg/tools/asset-fingerprint.py" "$out/two-sites" "$cfg/inputs/EXPECTED-ASSET-INVENTORY-SHA256" | tee "$out/verification/parity.json"
python3 "$cfg/tools/candidate.py" "$out/two-sites/app" "$iso/isolation-ci" "$out/vendor" "$out/candidate-app" "$out/verification/isolation.json"
python3 "$cfg/tools/map-links.py" "$out/candidate-app" "$out/verification/map-links.json"
python3 "$cfg/tools/receipt.py" "$out/candidate-app" "$out/verification" "$out/verification/isolation.json" "$out/verification/parity.json" "$cfg/inputs/EXPECTED-APP-TREE-SHA256"
tar --sort=name --mtime='@0' --numeric-owner --owner=0 --group=0 -cf "$out/candidate-app-NOT-DEPLOYED.tar" -C "$out/candidate-app" .
(
  cd "$out"
  sha256sum candidate-app-NOT-DEPLOYED.tar > verification/candidate-tar.sha256
)
