"""Decode the pinned Dust2 VPK using Source2Viewer CLI 20.0.6980.
Run from repo root; originals remain intact. Override paths with CLI arguments.
Then run extract-lighting-vertices.mjs, prepare-source-lighting.py, and
link-source-lighting.py in that order (see README for offline Python packages).
"""
import argparse
import pathlib
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cli', default='artifacts/source2viewer/Source2Viewer-CLI')
parser.add_argument('--vpk', default='artifacts/dust-lighting/depot/game/csgo/maps/de_dust2.vpk')
args = parser.parse_args()
cache = pathlib.Path('artifacts/parity-lighting')
extracted = cache / 'extracted'
cache.mkdir(parents=True, exist_ok=True)

def run(*arguments, stdout=None):
    subprocess.run([args.cli, *map(str, arguments)], check=True, stdout=stdout)

run('-i', args.vpk, '-o', extracted, '--vpk_filepath',
    'maps/de_dust2/lightmaps/,maps/de_dust2/cubemaps/,maps/de_dust2/world.vwrld_c,maps/de_dust2/entities/default_ents.vents_c')
for name in ('irradiance', 'env_light_probe_volume_atlas', 'env_light_probe_volume_atlas_dlshd', 'direct_light_shadows'):
    extension = '.png' if name in ('env_light_probe_volume_atlas_dlshd', 'direct_light_shadows') else '.exr'
    run('-i', extracted / f'maps/de_dust2/lightmaps/{name}.vtex_c', '-o', cache / (name + extension), '--decompile')
run('-i', extracted / 'maps/de_dust2/cubemaps/env_cubemap_array.vtex_c', '-o', cache / 'env_cubemap_array.exr', '--decompile')
# Standalone binary KV3 is printed to stdout by VRF, even with --output.
with (cache / 'query.txt').open('w') as output:
    run('-i', extracted / 'maps/de_dust2/lightmaps/lightmap_query_data.kv3', stdout=output)
for source, destination in [('world.vwrld_c', 'world.txt'), ('entities/default_ents.vents_c', 'entities.txt')]:
    with (cache / destination).open('w') as output:
        run('-i', extracted / ('maps/de_dust2/' + source), '--block', 'DATA', stdout=output)
