"""Import supported round highlights from a read-only CS2 localization export.

python3 scripts/import-round-strings.py artifacts/agent-roster/windows/native/resource/csgo_english.txt
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("english", type=Path)
args = parser.parse_args()
raw = args.english.read_bytes()
tokens = dict(re.findall(r'^\s*"([^"\n]+)"\s+"(.*)"\s*$', raw.decode("utf-8-sig"), re.M))
keys = ["winpanel_mvp_award_kills", "winpanel_mvp_award_ace", "winpanel_mvp_award_bombplant", "winpanel_mvp_award_bombdefuse",
        "funfact_short_round:f", "funfact_ace:f", "funfact_killed_enemies:f", "funfact_kills_headshots:f", "funfact_knife_kills:f", "funfact_kills_grenades:f", "funfact_first_kill:f",
        "funfact_ct_win_no_kills:f", "funfact_t_win_no_kills:f", "funfact_t_win_no_casualties:f", "funfact_ct_win_no_casualties:f", "funfact_ct_win_time:f", "funfact_ter_win_time:f"]
strings = {}
for key in keys:
    text = tokens[key].replace("{g:player_name:oc:funfact-player-playerslot}", "{player}").replace("{d:funfact-d1}", "{d1}")
    plural = re.fullmatch(r'\{funfact-d1, plural, one\{(.*?)\} other\{(.*?)\}\}', text)
    strings[key] = dict(zip(["one", "other"], plural.groups())) if plural else text
output = Path(__file__).resolve().parent.parent / "apps/game/src/data/round-strings.json"
output.write_text(json.dumps({"source": {"file": "resource/csgo_english.txt", "build": "26144732", "sha256": hashlib.sha256(raw).hexdigest()}, "strings": strings}, ensure_ascii=False, indent=2) + "\n")
