#!/usr/bin/env python3
"""Extract shipped CS2 weapon values without dependencies. Run with python3."""
import hashlib
import json
import re
from pathlib import Path
from subprocess import check_output

COMMIT = "5278de99318192d682ec7f0e1cc3ea9449f10c6e"
BASE = f"https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/{COMMIT}/"
SLUGS = "ak47 m4a1_silencer usp_silencer awp knife knife knife glock deagle m4a1 nova mp9 hkp2000 p250 fiveseven tec9 cz75a revolver elite famas galilar aug sg556 ssg08 scar20 g3sg1 mac10 mp7 mp5sd ump45 p90 bizon xm1014 mag7 sawedoff m249 negev".split()
NAMES = ["AK-47", "M4A1-S", "USP-S", "AWP", "Bayonet", "Butterfly Knife", "Karambit", "Glock-18", "Desert Eagle", "M4A4", "Nova", "MP9", "P2000", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "R8 Revolver", "Dual Berettas", "FAMAS", "Galil AR", "AUG", "SG 553", "SSG 08", "SCAR-20", "G3SG1", "MAC-10", "MP7", "MP5-SD", "UMP-45", "P90", "PP-Bizon", "XM1014", "MAG-7", "Sawed-Off", "M249", "Negev"]
CT = {1, 2, 9, 11, 12, 14, 19, 21, 24, 33}
T = {0, 7, 15, 20, 22, 25, 26, 34}
KEYS = {"price":"m_nPrice", "killAward":"m_nKillAward", "damage":"m_nDamage", "mag":"m_iMaxClip1", "reserveCount":"m_nPrimaryReserveAmmoMax", "reserveAsClips":"m_bReserveAmmoAsClips", "head":"m_flHeadshotMultiplier", "armorRatio":"m_flArmorRatio", "power":"m_flPenetration", "range":"m_flRange", "modifier":"m_flRangeModifier", "auto":"m_bIsFullAuto", "pellets":"m_nNumBullets", "delay":"m_flCycleTime", "maxSpeed":"m_flMaxSpeed", "spread":"m_flSpread", "reload":"m_flDisallowAttackAfterReloadStartDuration", "deploy":"m_flDeployDuration", "burstCycle":"m_flCycleTimeWhenInBurstMode", "burstSpacing":"m_flTimeBetweenBurstShots", "zoomTime0":"m_flZoomTime0", "zoomTime1":"m_flZoomTime1", "zoomTime2":"m_flZoomTime2", "zoomLevels":"m_nZoomLevels", "zoomFov1":"m_nZoomFOV1", "zoomFov2":"m_nZoomFOV2", "unzoomsAfterShot":"m_bUnzoomsAfterShot"}

def extract_block(source, name):
    match = re.search(r'^\t'+re.escape(name)+r' =\s*\{', source, re.M)
    if not match:
        raise ValueError(name)
    start = i = match.end()
    depth = 1
    while depth:
        depth += (source[i] == '{') - (source[i] == '}')
        i += 1
    return source[start:i-1]

def main():
    source_path = "game/csgo/pak01_dir/scripts/weapons.vdata"
    source = check_output(["curl", "--fail", "--silent", "--show-error", "--location", BASE+source_path], text=True)
    weapons = []
    for index, slug in enumerate(SLUGS):
        block = extract_block(source, "weapon_"+slug)
        fields = dict(re.findall(r'^\t\t(m_\w+) = ([^\n]+)', block, re.M))
        weapon = {"id":index, "slug":slug, "name":NAMES[index], "team":"ct" if index in CT else "t" if index in T else "both"}
        for key, field in KEYS.items():
            weapon[key] = json.loads(fields.get(field, 'false' if key == 'reserveAsClips' else '0'))
        weapons.append(weapon)
    root = Path(__file__).resolve().parent.parent
    out = root / 'apps/game/src/data/weapon-stats.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"source":BASE+source_path,"commit":COMMIT,"sha256":hashlib.sha256(source.encode()).hexdigest(),"weapons":weapons}, indent=2)+'\n')
    print(f"Extracted {len(weapons)} stable inventory entries to {out}")

if __name__ == '__main__':
    main()
