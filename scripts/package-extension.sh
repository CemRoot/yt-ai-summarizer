#!/usr/bin/env bash
# Build the same ZIP as CI (.github/workflows/ci.yml → Build & Package).
# Usage from repo root: bash scripts/package-extension.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/verify-no-debug-hosts.mjs

VERSION="$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")"
OUT_DIR="$ROOT/dist"
mkdir -p "$OUT_DIR"
ZIP="$OUT_DIR/youtube-ai-summarizer-v${VERSION}.zip"

rm -f "$ZIP"
zip -r "$ZIP" \
  manifest.json \
  service-worker.js \
  privacy-policy.html \
  privacy-policy.js \
  icons/ \
  content/ \
  popup/ \
  update/ \
  welcome/ \
  utils/ \
  _locales/ \
  -x "*.DS_Store" "*/.git/*" "*.test.js" "*/.*.swp"

echo "Created: $ZIP"
unzip -l "$ZIP" | tail -8
ls -lh "$ZIP"
