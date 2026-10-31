"""Convert VRF's native Dust II EXR to a small, linear HDR panorama.
Usage: python3 scripts/prepare-dust2-sky.py INPUT.exr OUTPUT.hdr
Requires FFmpeg and numpy. Retains HDR radiance; no exposure/tone-map baked in.
"""
import pathlib
import subprocess
import sys
import numpy as np

width, height = 1024, 512
raw = subprocess.check_output([
    'ffmpeg', '-v', 'error', '-i', sys.argv[1], '-vf', f'scale={width}:{height}:flags=lanczos',
    '-f', 'rawvideo', '-pix_fmt', 'gbrpf32le', '-frames:v', '1', '-'
])
rgb = np.frombuffer(raw, '<f4').reshape(3, height, width)[[2, 0, 1]].transpose(1, 2, 0)
rgb = np.maximum(np.nan_to_num(rgb), 0)
maximum = rgb.max(axis=2)
_, exponent = np.frexp(maximum)
scale = np.exp2(8 - exponent.astype(float))
rgbe = np.zeros((height, width, 4), dtype=np.uint8)
rgbe[:, :, :3] = np.minimum(rgb * scale[:, :, None], 255).astype(np.uint8)
rgbe[:, :, 3] = np.where(maximum > 1e-32, exponent + 128, 0).astype(np.uint8)
output = bytearray(f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {height} +X {width}\n'.encode())
for row in rgbe:
    output.extend((2, 2, width >> 8, width & 255))
    for channel in row.T:
        values = channel.tobytes()
        i = 0
        while i < width:
            run = 1
            while i + run < width and run < 127 and values[i + run] == values[i]:
                run += 1
            if run >= 4:
                output.extend((128 + run, values[i]))
                i += run
            else:
                start = i
                i += run
                while i < width and i - start < 128:
                    if i + 3 < width and len(set(values[i:i + 4])) == 1:
                        break
                    i += 1
                i = min(i, start + 128)
                output.append(i - start)
                output.extend(values[start:i])
pathlib.Path(sys.argv[2]).write_bytes(output)
print(f'{len(output):,} bytes; peak radiance {rgb.max():.3f}')
