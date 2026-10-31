"""Export world player-clip brushes and solid tool faces from the pinned Dust II BSP.

Usage: python3 scripts/extract-dust-collision.py new_map/csgo/maps/de_dust2.bsp
Reads brush planes, not render faces (VBSP removes invisible render faces).
Format/masks: ValveSoftware/source-sdk-2013, src/packages/assets/public/{bspfile,bspflags}.h.
Only world-model brushes are used; entity triggers and dynamic models are excluded.
"""
import argparse
import gzip
import hashlib
import json
import math
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
PLAYERCLIP = 0x10000
PLAYER_SOLID = 0x1 | 0x2 | 0x8 | 0x4000 | PLAYERCLIP


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def face_polygon(plane, planes):
    """Intersect a large outward-facing plane polygon with the brush half-spaces."""
    n, distance = plane[:3], plane[3]
    axis = (1, 0, 0) if abs(n[0]) < .9 else (0, 1, 0)
    u = cross(axis, n)
    length = math.sqrt(dot(u, u))
    u = tuple(x / length for x in u)
    v = cross(n, u)
    center = tuple(x * distance for x in n)
    polygon = [tuple(center[i] + 131072*(a*u[i]+b*v[i]) for i in range(3))
               for a, b in [(-1,-1), (1,-1), (1,1), (-1,1)]]
    for p in planes:
        if not polygon:
            break
        output = []
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
            da, db = dot(p[:3], a)-p[3], dot(p[:3], b)-p[3]
            if da <= 1e-5:
                output.append(a)
            if (da < -1e-5 and db > 1e-5) or (db < -1e-5 and da > 1e-5):
                t = da / (da-db)
                output.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(3)))
        polygon = output
    return polygon


def extract(raw):
    if raw[:4] != b'VBSP' or struct.unpack_from('<I', raw, 4)[0] != 21:
        raise ValueError('Expected the final CS:GO BSP v21')

    def lump(i):
        offset, size, version, compressed = struct.unpack_from('<4I', raw, 8 + i*16)
        if compressed:
            raise ValueError(f'Compressed lump {i} is not supported')
        if offset + size > len(raw):
            raise ValueError(f'Truncated lump {i}')
        return raw[offset:offset+size]

    def records(i, fmt):
        return list(struct.iter_unpack('<'+fmt, lump(i)))

    planes = records(1, '4fi')
    nodes = records(5, '3i6h2H2h')
    leaves = records(10, 'ihH6h4H2h')
    leafbrushes = [x[0] for x in records(17, 'H')]
    brushes = records(18, '3i')
    sides = records(19, 'HhhBB')  # CS:GO stores bevel and thin as individual bytes.
    models = records(14, '9f3i')
    texinfo = records(6, '16f2i')
    texdata = records(2, '3f5i')
    strings = lump(43)
    names = [strings[o[0]:].split(b'\0', 1)[0].decode() for o in records(44, 'i')]
    world = set()
    pending = [models[0][9]]
    seen = set()
    while pending:
        node = pending.pop()
        if node in seen:
            continue
        seen.add(node)
        if node >= 0:
            pending.extend(nodes[node][1:3])
        else:
            leaf = leaves[-node-1]
            first, count = leaf[11:13]
            world.update(leafbrushes[first:first+count])
    positions, exported, materials = [], [], set()
    for index in sorted(world):
        first, count, contents = brushes[index]
        if not contents & PLAYER_SOLID:
            continue
        brush_sides = sides[first:first+count]
        halfspaces = [planes[s[0]][:4] for s in brush_sides]
        start = len(positions)//3
        for side in brush_sides:
            plane_index, texture, displacement, bevel, thin = side
            if bevel:
                continue
            material, flags = '', 0
            if texture >= 0:
                info = texinfo[texture]
                flags = info[16]
                material = names[texdata[info[17]][3]].lower()
            if not contents & PLAYERCLIP and not (flags & 0x80 or material.startswith('tools/')):
                continue
            polygon = face_polygon(planes[plane_index], halfspaces)
            for i in range(1, len(polygon)-1):
                a, b, c = polygon[0], polygon[i], polygon[i+1]
                area = cross(tuple(b[j]-a[j] for j in range(3)), tuple(c[j]-a[j] for j in range(3)))
                if dot(area, area) < 1e-8:
                    continue
                for x, y, z in (a, b, c):
                    positions.extend([round(x*.0254, 6), round(z*.0254, 6), round(-y*.0254, 6)])
                materials.add(material)
        if len(positions)//3 > start:
            exported.append({'id': index, 'contents': contents, 'start': start, 'count': len(positions)//3-start})
    return {'version': 1, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'brushes': exported, 'materials': sorted(materials), 'positions': positions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bsp', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, default=ROOT/'packages/assets/public/models/maps/dust2-collision.json.gz')
    args = parser.parse_args()
    raw = args.bsp.read_bytes()
    expected = json.loads((ROOT/'packages/assets/public/models/maps/source-manifest.json').read_text())['files']['maps/de_dust2.bsp']
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('BSP checksum does not match the bundled Dust II map')
    data = extract(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(json.dumps(data, separators=(',', ':')).encode(), 9, mtime=0))
    print(f"Exported {len(data['brushes'])} brushes, {len(data['positions'])//9} triangles, {args.output.stat().st_size} bytes")


if __name__ == '__main__':
    main()
