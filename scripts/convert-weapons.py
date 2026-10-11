"""Convert user-supplied CS:GO OBJ templates to indexed, colored GLB meshes.
Run: python3 scripts/convert-weapons.py /path/to/csgo_skin_templates
Preserves UVs and extracts magazines, charging handles, slide and AWP bolt assembly.
"""
from pathlib import Path
import json, struct, sys
SOURCE = Path(sys.argv[1]) / 'OBJs'
TARGET = Path(__file__).resolve().parents[1] / 'public/models'
SPECS = [('ak-47', .95), ('m4a1_s', 1.08), ('usp-s', .55), ('awp', 1.25)]

def finish(name, group, x, y, z):
    steel = (.31, .34, .36); olive = (.39, .43, .28); wood = (.49, .29, .13)
    if name == 'awp':
        if group == 'Object001': return (.08, .16, .19)
        return olive if y < 7.6 and z < 17 and not (y < 4.2 and -1 < z < 5) else steel
    if name == 'ak-47':
        return wood if (z < -3 and y > -.8) or (9 < z < 18 and -.5 < y < 3.4) else steel
    if name == 'm4a1_s': return (.28, .32, .29) if y < -.4 and z < 19 else steel
    return (.19, .22, .23) if y < 2.5 else steel

def linear(value):
    return round(255 * (value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4))

for name, length in SPECS:
    positions = []; normals = []; uv = []; triangles = []; group = ''
    for line in (SOURCE / (name + '.obj')).read_text().splitlines():
        fields = line.split()
        if not fields: continue
        if fields[0] == 'v': positions.append(tuple(map(float, fields[1:4])))
        elif fields[0] == 'vn': normals.append(tuple(map(float, fields[1:4])))
        elif fields[0] == 'vt': uv.append(tuple(map(float, fields[1:3])))
        elif fields[0] == 'g': group = ' '.join(fields[1:])
        elif fields[0] == 'f':
            face = [tuple(int(s) if s else 0 for s in item.split('/')) for item in fields[1:]]
            for i in range(1, len(face) - 1): triangles.append(((face[0], face[i], face[i + 1]), group))
    low = [min(p[i] for p in positions) for i in range(3)]
    high = [max(p[i] for p in positions) for i in range(3)]
    scale = length / (high[2] - low[2]); center = [(a + b) / 2 for a, b in zip(low, high)]
    def transform(p): return (-(p[0] - center[0]) * scale, (p[1] - center[1]) * scale, .15 - (p[2] - low[2]) * scale)
    muzzle_points = [transform(p) for p in positions if p[2] > high[2] - .08]
    muzzle = [sum(p[i] for p in muzzle_points) / len(muzzle_points) for i in range(3)]
    # Weld position seams before selecting complete physical components. This
    # keeps magazine/slide surfaces intact instead of cutting by triangle bounds.
    parents = list(range(len(positions)))
    def root(i):
        while parents[i] != i: parents[i] = parents[parents[i]]; i = parents[i]
        return i
    def union(a, b): parents[root(a)] = root(b)
    seen = {}
    for i, p in enumerate(positions):
        key = tuple(round(n, 3) for n in p)
        if key in seen: union(i, seen[key])
        else: seen[key] = i
    for triangle, _ in triangles:
        for vertex in triangle[1:]: union(triangle[0][0] - 1, vertex[0] - 1)
    components = {}
    for i in range(len(positions)): components.setdefault(root(i), []).append(i)
    parts = {'receiver': set(), 'magazine': set(), 'bolt': set()}
    for ids in components.values():
        points = [positions[i] for i in ids]
        lo = [min(p[k] for p in points) for k in range(3)]
        hi = [max(p[k] for p in points) for k in range(3)]
        part = 'receiver'
        if name == 'ak-47':
            if lo[1] < -6 and lo[2] > 4: part = 'magazine'
            elif lo[0] < -1.8 and lo[1] > 2.3 and lo[2] > 8: part = 'bolt'
        elif name == 'm4a1_s':
            if lo[1] < -9.5 and lo[2] > 11: part = 'magazine'
            elif lo[0] < -5 and hi[0] < -4 and lo[2] > 5: part = 'bolt'
        elif name == 'usp-s':
            if len(ids) == 380: part = 'magazine'
            # Slide shell plus sights and extractor; suppressor/barrel remain fixed.
            elif len(ids) == 1307 or (lo[1] > 4.5 and hi[2] < 11) or len(ids) == 88 or len(ids) == 129 or len(ids) == 100: part = 'bolt'
        elif name == 'awp':
            if len(ids) == 342 and lo[2] > 6.7: part = 'magazine'
            elif (lo[0] < -1.5 and lo[2] > 4.9 and hi[2] < 6.3 and lo[1] > 7.5) or len(ids) == 26 and lo[1] > 8.5 and hi[2] > 11 or len(ids) == 98 and hi[2] < 5.7 and lo[1] > 8 or len(ids) == 49 and lo[1] > 8.5 and hi[2] < 6.3:
                part = 'bolt'
        parts[part].update(ids)
    # The AWP rotates about the bore axis, not the end of the handle stem.
    pivot = transform((-.03, 8.79, 5.3)) if name == 'awp' else (0, 0, 0)
    mag_points = [positions[i] for i in parts['magazine']]
    mag_pivot = transform(tuple(sum(p[k] for p in mag_points) / len(mag_points) for k in range(3)))
    binary = bytearray(); views = []; accessors = []; meshes = []; nodes = [{'name': name, 'children': [], 'extras': {'muzzle': muzzle}}]
    def accessor(data, fmt, kind, component, bounds=False):
        while len(binary) % 4: binary.append(0)
        start = len(binary)
        for value in data: binary.extend(struct.pack('<' + fmt, *(value if isinstance(value, tuple) else (value,))))
        views.append({'buffer': 0, 'byteOffset': start, 'byteLength': len(binary) - start})
        item = {'bufferView': len(views) - 1, 'componentType': component, 'count': len(data), 'type': kind}
        if component == 5121: item['normalized'] = True
        if bounds:
            item['min'] = [min(v[i] for v in data) for i in range(3)]
            item['max'] = [max(v[i] for v in data) for i in range(3)]
        accessors.append(item); return len(accessors) - 1
    for part in ['receiver', 'magazine', 'bolt']:
        vertices = []; colors = []; outnormals = []; outuv = []; indices = []; lookup = {}
        for triangle, source_group in triangles:
            if triangle[0][0] - 1 not in parts[part]: continue
            origin = pivot if part == 'bolt' else mag_pivot if part == 'magazine' else (0, 0, 0)
            centroid = [sum(positions[v[0] - 1][i] for v in triangle) / 3 for i in range(3)]
            color = tuple(linear(c) for c in finish(name, source_group, *centroid))
            for vertex in triangle:
                key = (vertex, color)
                if key not in lookup:
                    lookup[key] = len(vertices)
                    point = transform(positions[vertex[0] - 1])
                    vertices.append(tuple(point[i] - origin[i] for i in range(3)))
                    normal = normals[vertex[2] - 1] if len(vertex) > 2 and vertex[2] else (0, 1, 0)
                    outnormals.append((-normal[0], normal[1], -normal[2]))
                    outuv.append(uv[vertex[1] - 1] if len(vertex) > 1 and vertex[1] else (0, 0))
                    colors.append(color)
                indices.append(lookup[key])
        pos = accessor(vertices, 'fff', 'VEC3', 5126, True)
        normal = accessor(outnormals, 'fff', 'VEC3', 5126)
        tex = accessor(outuv, 'ff', 'VEC2', 5126)
        color = accessor(colors, 'BBB', 'VEC3', 5121)
        index = accessor(indices, 'H' if len(vertices) < 65536 else 'I', 'SCALAR', 5123 if len(vertices) < 65536 else 5125)
        meshes.append({'primitives': [{'attributes': {'POSITION': pos, 'NORMAL': normal, 'TEXCOORD_0': tex, 'COLOR_0': color}, 'indices': index, 'material': 0}]})
        node = {'mesh': len(meshes) - 1, 'name': part}
        if part == 'bolt': node['translation'] = pivot
        if part == 'magazine': node['translation'] = mag_pivot
        nodes[0]['children'].append(len(nodes)); nodes.append(node)
    doc = {'asset': {'version': '2.0', 'generator': 'CS2GO OBJ converter', 'extras': {'source': name + '.obj'}}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': meshes,
           'materials': [{'name': 'Tactical finish', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': .25, 'roughnessFactor': .58}}],
           'buffers': [{'byteLength': len(binary)}], 'bufferViews': views, 'accessors': accessors}
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    while len(encoded) % 4: encoded += b' '
    while len(binary) % 4: binary.append(0)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    result = struct.pack('<III', 0x46546c67, 2, total) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    (TARGET / (name + '.glb')).write_bytes(result)
    print(name, len(triangles), 'triangles', len(parts['bolt']), 'bolt vertices', len(result), 'bytes')
