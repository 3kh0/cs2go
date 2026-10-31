"""Importer geometry regressions. Run: python3 scripts/test-dust-collision.py"""
import importlib.util
import pathlib
import struct
import unittest

spec = importlib.util.spec_from_file_location('extract', pathlib.Path(__file__).with_name('extract-dust-collision.py'))
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)


class Brushes(unittest.TestCase):
    def test_sloped_brush_preserves_all_halfspaces_and_outward_winding(self):
        # Unit wedge: -1<=x,z<=1, -1<=y<=x/2+1. No decimation or AABB replacement.
        import math
        n = math.sqrt(1.25)
        planes = [(1,0,0,1), (-1,0,0,1), (0,-1,0,1),
                  (-.5/n,1/n,0,1/n), (0,0,1,1), (0,0,-1,1)]
        for plane in planes:
            polygon = extract.face_polygon(plane, planes)
            self.assertGreaterEqual(len(polygon), 3)
            for point in polygon:
                self.assertAlmostEqual(extract.dot(plane[:3], point), plane[3], places=5)
                for boundary in planes:
                    self.assertLessEqual(extract.dot(boundary[:3], point), boundary[3]+1e-5)
            a,b,c = polygon[:3]
            normal = extract.cross([b[i]-a[i] for i in range(3)], [c[i]-a[i] for i in range(3)])
            self.assertGreater(extract.dot(normal, plane[:3]), 0)

    def test_only_world_player_solids_are_exported(self):
        lumps = {}
        def put(i, fmt, records):
            lumps[i] = b''.join(struct.pack('<'+fmt, *r) for r in records)
        put(1,'4fi',[(1,0,0,1,0),(-1,0,0,1,0),(0,1,0,1,1),(0,-1,0,1,1),(0,0,1,1,2),(0,0,-1,1,2)])
        put(5,'3i6h2H2h',[(0,-1,-1,*([0]*10))])
        put(10,'ihH6h4H2h',[(0,0,0,*([0]*6),0,0,0,3,-1,0)])
        put(14,'9f3i',[(*([0]*9),0,0,0)])
        put(17,'H',[(0,),(1,),(2,)])
        # Trigger/npc-only and a playerclip not referenced by the world are excluded.
        put(18,'3i',[(0,6,0x10000),(0,6,0x40000000),(0,6,0x20000),(0,6,0x10000)])
        put(19,'HhhBB',[(i,0,0,0,0) for i in range(6)])
        put(6,'16f2i',[(*([0]*16),0,0)])
        put(2,'3f5i',[(0,0,0,0,1,1,1,1)])
        lumps[43] = b'tools/toolsclip\0'
        put(44,'i',[(0,)])
        raw=bytearray(1036)
        struct.pack_into('<4sI',raw,0,b'VBSP',21)
        for i,data in lumps.items():
            struct.pack_into('<4I',raw,8+i*16,len(raw),len(data),1 if i==10 else 0,0)
            raw.extend(data)
        result=extract.extract(raw)
        self.assertEqual([b['id'] for b in result['brushes']], [0])
        self.assertEqual(len(result['positions'])//9,12)
        self.assertAlmostEqual(max(result['positions']),.0254)


if __name__ == '__main__':
    unittest.main()
