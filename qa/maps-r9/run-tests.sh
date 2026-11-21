#!/usr/bin/env bash
set -euo pipefail
for test in qa/maps-r9/tests/*.mjs; do node "$test"; done
