"""Import mechanical knife/revolver cues from the pinned sound archive. Requires ffmpeg."""
import json, subprocess, tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'packages/assets/public/audio/source'
manifest = json.loads((root / 'manifest.json').read_text())
clips = {'revolver-prepare': 'revolver/revolver_prepare', 'knife-deploy': 'knife/knife_deploy', 'knife-stab': 'knife/knife_stab', 'butterfly-draw': 'bknife/bknife_draw01'}
for variant in range(1, 4):
    for phase in ['a', 'b']:
        clips[f'butterfly-look{variant}-{phase}'] = f'bknife/bknife_look0{variant}_{phase}'
with tempfile.TemporaryDirectory() as temporary:
    for name, source in clips.items():
        relative = f'sound/weapons/{source}.wav'
        wav = Path(temporary) / 'source.wav'
        subprocess.run(["curl", "-fLsS", f"https://raw.githubusercontent.com/sourcesounds/csgo/{manifest['commit']}/{relative}", "-o", str(wav)], check=True)
        output = root / f'{name}.ogg'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libopus', '-b:a', '96k', str(output)], check=True)
        manifest['clips'] = [clip for clip in manifest['clips'] if clip['name'] != name]
        manifest['clips'].append({'name': name, 'source': relative, 'bytes': output.stat().st_size})
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
