"""Consolidate identical paint resources and UI icons; run after asset imports."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def deduplicate():
    public = ROOT / 'packages/assets/public'
    groups = {}
    for directory in ['skins/textures', 'skins/shaders', 'skins/gloves/textures', 'skins/gloves/shaders', 'ui/match']:
        for path in sorted((public / directory).rglob('*')):
            if path.is_file() and path.name.endswith(('.rgba.gz', '.ktx2.gz', '.wgsl', '.svg')):
                groups.setdefault(hashlib.sha256(path.read_bytes()).digest(), []).append(path)
    aliases = {}
    for paths in groups.values():
        # Shared weapon/glove resources belong in the common skins directory.
        paths.sort(key=lambda p: ('/gloves/' in str(p), str(p)))
        for path in paths[1:]:
            assert path.read_bytes() == paths[0].read_bytes()
            aliases['/' + path.relative_to(public).as_posix()] = '/' + paths[0].relative_to(public).as_posix()
    changed = 0
    for directory in [public, ROOT / 'apps/game/src', ROOT / 'packages/simulation/src', ROOT / 'scripts']:
        for path in directory.rglob('*'):
            if path.suffix not in ['.json', '.ts', '.css', '.mjs', '.js', '.py', '.html']:
                continue
            before = path.read_text()
            after = before
            for old, new in aliases.items():
                after = after.replace(old, new)
            if path.name == 'source.json' and public in path.parents:
                data = json.loads(after)
                rows = data.get('files', [])
                if isinstance(rows, list):
                    updated = False
                    for row in rows:
                        name = row.get('file') if isinstance(row, dict) else None
                        if isinstance(name, str) and '/' not in name:
                            old = '/' + (path.parent / name).relative_to(public).as_posix()
                            if old in aliases:
                                row['file'] = os.path.relpath(public / aliases[old].lstrip('/'), path.parent)
                                updated = True
                    if updated:
                        data['files'] = [row for i, row in enumerate(rows) if row not in rows[:i]]
                        after = json.dumps(data, indent=2) + '\n'
            if after != before:
                path.write_text(after)
                changed += 1
    saved = 0
    for old in aliases:
        path = public / old.lstrip('/')
        saved += path.stat().st_size
        path.unlink()
    print(f'Consolidated {len(aliases)} duplicate assets; updated {changed} files; removed {saved:,} bytes')


if __name__ == '__main__':
    deduplicate()
