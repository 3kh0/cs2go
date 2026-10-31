"""Extract the pinned Dust II ball's native sphere and surface inputs.
Requires cached Steam depot 4758919807587010422 and Source2Viewer 20.
Run: python3 scripts/import-world-ball.py --cli artifacts/source2viewer/Source2Viewer-CLI
Original archives remain untouched; missing archives must be fetched from the pinned depot.
"""
import argparse, hashlib, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--cli', required=True)
a = p.parse_args()
vpk = ROOT/'artifacts/c4-import/depot/game/csgo/pak01_dir.vpk'
assert hashlib.sha256(vpk.read_bytes()).hexdigest() == '48018be3f8da306ce9b48bf746bce08ceff19fe4dff15c9d5e2e53b3c3e9bbad'
cache = ROOT/'artifacts/ball-physics'; cache.mkdir(parents=True,exist_ok=True)
resources = ['models/props/de_dust/hr_dust/dust_soccerball/dust_soccer_ball001.vmdl_c', 'surfaceproperties/surfaceproperties.vsurf_c']
texts=[]; hashes={}
for resource in resources:
 subprocess.run([a.cli,'-i',str(vpk),'--vpk_filepath',resource,'-o',str(cache)],check=True,capture_output=True)
 path=cache/resource
 hashes[resource]=hashlib.sha256(path.read_bytes()).hexdigest()
 texts.append(subprocess.check_output([a.cli,'-i',str(path),'-a'],text=True))
physics=texts[0].split('--- Data for block "PHYS" ---')[1].split('--- Data for block')[0]
assert physics.count('m_flRadius =')==1 and 'm_hulls = [  ]' in physics and 'm_capsules = [  ]' in physics
assert re.search(r'm_vCenter = \[ 0.0, 0.0, 0.0 \]',physics)
def value(text, key):return float(re.search(r'\b'+key+r' = ([\d.]+)',text)[1])
surface=texts[1].split('surfacePropertyName = "soccerball"')[1].split('surfacePropertyName =')[0]
surface_hash=int(value(surface,'m_nameHash'))
assert f'm_surfacePropertyHashes = [ {surface_hash} ]' in physics
out={'source':{'depot':2347770,'manifest':'4758919807587010422','generator':'scripts/import-world-ball.py','decoder':'Source2Viewer 20','resources':hashes},'sphereRadiusSource':value(physics,'m_flRadius'),'mass':value(physics,'m_flMass'),'linearDamping':value(physics,'m_flLinearDamping'),'angularDamping':value(physics,'m_flAngularDamping'),'surface':{'name':'soccerball','hash':surface_hash,**{k:value(surface,k) for k in ['density','elasticity','friction','dampening']}}}
(ROOT/'apps/game/src/data/world-ball.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
