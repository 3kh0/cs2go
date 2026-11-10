#!/usr/bin/env bash
set -euo pipefail
asset_checkout=${CS2GO_ASSET_CHECKOUT:-/opt/cs2go-assets/work/cs2go/cs2go}
asset_state=${CS2GO_ASSET_STATE:-/var/cache/cs2go-assets}
asset_python=/opt/cs2go-assets/python/bin/python
asset_bun=/home/cs2go-assets/.bun/bin/bun
mkdir -p "$asset_state/transport"
exec 9>"$asset_state/sync.lock"
flock -n 9 || exit 0
cd "$asset_checkout"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo 'Asset checkout has tracked modifications; refusing to overwrite them.' >&2
  exit 1
fi
git fetch --depth=2 --filter=blob:none origin main
git checkout --detach FETCH_HEAD
asset_sha=$(git rev-parse HEAD)
export ASSET_TREE
ASSET_TREE=$(git rev-parse HEAD:packages/assets)
asset_status=$(mktemp "$asset_state/status.XXXXXX")
trap 'rm -f "$asset_status"' EXIT
GITHUB_OUTPUT="$asset_status" "$asset_python" packages/assets/sync.py status
if ! grep -qx 'complete=true' "$asset_status"; then
  if [ ! -e packages/assets/.cache ]; then
    ln -s "$asset_state/transport" packages/assets/.cache
  fi
  if [ "$(readlink -f packages/assets/.cache)" != "$(readlink -f "$asset_state/transport")" ]; then
    echo 'Unexpected compression cache location' >&2
    exit 1
  fi
  "$asset_python" packages/assets/sync.py seed
  echo "Verifying assets at $asset_sha"
  "$asset_bun" run assets:verify
  echo "Publishing verified assets at $asset_sha"
  "$asset_python" packages/assets/sync.py publish
  "$asset_python" - "$asset_state" <<'PYTHON'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
manifest = json.loads(Path('packages/assets/manifest.json').read_text())
keep = set()
for entry in manifest['files'].values():
    keep.add(entry['sha256'] + '.q11.br')
    if 'inputSha256' in entry:
        keep.add(entry['inputSha256'] + '.glb.gz')
for cached in (root / 'transport').iterdir():
    if cached.is_file() and cached.name not in keep:
        cached.unlink()
PYTHON
fi
"$asset_python" - "$asset_state" "$asset_sha" "$ASSET_TREE" <<'PYTHON'
import json, sys
from datetime import datetime, timezone
from pathlib import Path
root = Path(sys.argv[1])
manifest = json.loads(Path('packages/assets/manifest.json').read_text())
status = dict(sha=sys.argv[2], assetTree=sys.argv[3], release=manifest['release'],
              published=True, checkedAt=datetime.now(timezone.utc).isoformat())
temporary = root / 'last-sync.tmp'
temporary.write_text(json.dumps(status, indent=2) + '\n')
temporary.replace(root / 'last-sync.json')
print(json.dumps(status))
PYTHON
