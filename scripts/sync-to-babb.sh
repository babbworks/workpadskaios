#!/usr/bin/env bash
# sync-to-babb.sh — check workpadskaios codec files against babb-codecs and propose version bumps.
# Run from the workpadskaios repo root.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BABB="$REPO_ROOT/../babb-codecs/scripts/sync-check.sh"

if [ ! -f "$BABB" ]; then
  echo "ERROR: babb-codecs not found at $REPO_ROOT/../babb-codecs"
  exit 1
fi

cd "$REPO_ROOT"

"$BABB" "js/lib/codec.js"               workpads/kaios
"$BABB" "js/lib/relational-codec.js"    workpads/relational
"$BABB" "js/lib/native-groups-table.js" workpads/bitpad/src
"$BABB" "js/lib/native-v1-split.js"     workpads/bitpad/src
"$BABB" "js/lib/pathc-native.js"        workpads/bitpad/src
"$BABB" "js/lib/pathc-v2.js"            workpads/bitpad/src
