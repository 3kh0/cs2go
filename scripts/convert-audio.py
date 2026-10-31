"""Convert the selected user-supplied weapon WAVs to browser-ready Opus."""
from pathlib import Path
import subprocess
import sys

names = ['ak47-1', 'ak47-1-distant', 'ak47_clipout', 'ak47_clipin', 'ak47_boltpull', 'ak47_draw', 'm4a1-1-single', 'm4a1_clipout', 'm4a1_clipin', 'm4a1_silencer_boltback', 'm4a1_silencer_boltforward', 'm4a1_draw', 'usp1', 'usp_clipout', 'usp_clipin', 'usp_slideback', 'usp_sliderelease', 'awp1', 'awp_clipout', 'awp_clipin', 'awp_boltback', 'awp_boltforward', 'zoom']
source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / "packages/assets/public/audio"
out.mkdir(exist_ok=True)
for name in names:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source / f"{name}.wav"), "-map_metadata", "-1", "-ac", "1", "-c:a", "libopus", "-b:a", "96k", str(out / f"{name}.ogg")], check=True)
