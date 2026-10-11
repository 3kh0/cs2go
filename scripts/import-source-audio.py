"""Import selected original CS:GO cues as local Opus assets, pinned to a repository commit."""
from pathlib import Path
import json, subprocess, tempfile, concurrent.futures
ROOT = Path(__file__).resolve().parents[1]
commit = '08f1bd6835d4f510d2ccaedeab6bb9f637b388ab'
files = {}
for i in range(1,5):
    files[f'step-sand-{i}'] = f'sound/player/footsteps/sand{i}.wav'
    files[f'step-concrete-{i}'] = f'sound/player/footsteps/concrete{i}.wav'
for i in range(1,4):
    files[f'damage-{i}'] = f'sound/player/damage{i}.wav'
    files[f'death-{i}'] = f'sound/player/death{i}.wav'
    files[f'gear-{i}'] = f'sound/player/kevlar{i}.wav'
files.update({'land':'sound/player/land.wav', 'jump':'sound/player/jumplanding.wav',
'click':'sound/ui/buttonclick.wav','hover':'sound/ui/buttonrollover.wav',
'buy':'sound/ui/panorama/radial_menu_buy_01.wav','ready':'sound/ui/panorama/game_ready_01.wav'})
for name, source in {'menu':'mainmenu','start':'startround_01','deathcam':'deathcam','win':'wonround','lose':'lostround','mvp':'roundmvpanthem_01','countdown':'roundtenseccount'}.items():
    files['music-'+name] = f'sound/music/valve_csgo_01/{source}.mp3'
target = ROOT / 'public/audio/source'; target.mkdir(parents=True,exist_ok=True)
def convert(item):
    name,path = item
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp)/Path(path).name
        subprocess.run(['curl','-fLs',f'https://raw.githubusercontent.com/sourcesounds/csgo/{commit}/{path}','-o',str(source)],check=True)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(source),'-map_metadata','-1','-ac','2' if name.startswith('music-') else '1','-c:a','libopus','-b:a','80k' if name.startswith('music-') else '64k',str(target/(name+'.ogg'))],check=True)
    return {'name':name, 'source':path,'bytes':(target/(name+'.ogg')).stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: imported=list(pool.map(convert,files.items()))
(target/'manifest.json').write_text(json.dumps({'repository':'https://github.com/sourcesounds/csgo','commit':commit,'clips':imported},indent=2)+'\n')
print(len(imported),'clips;',sum(c['bytes'] for c in imported),'bytes; commit',commit)
