import unittest
import numpy as np
from native_lightmap import NativeChart,repair_boundary_endpoints,EncodedLighting

class NativeTransferTests(unittest.TestCase):
 def setUp(self):
  self.p=np.array([[0,0,0],[1,0,0],[1,1,0],[0,1,0]],dtype=float)
  self.uv=self.p[:,:2]*.1+.2
  self.triangles=np.array([[0,1,2],[0,2,3]])
  self.runtime=np.array([[[.1,.2,0],[.9,.2,0],[.5,.9,0]]])
  self.normal=np.array([[0.,0.,1.]])
 def test_simplified_triangle_spans_continuous_native_chart(self):
  uv,valid=NativeChart(self.p,self.uv,self.triangles).project(self.runtime,self.normal)
  self.assertTrue(valid[0]);np.testing.assert_allclose(uv,self.runtime[:,:,:2]*.1+.2,atol=1e-7)
 def test_coplanar_discontinuous_chart_is_rejected(self):
  points=self.p[self.triangles].reshape(-1,3);uv=self.uv[self.triangles].reshape(-1,2);uv[3:]+=.3
  _,valid=NativeChart(points,uv,np.arange(6).reshape(-1,3)).project(self.runtime,self.normal)
  self.assertFalse(valid[0])
 def test_nearby_parallel_wall_is_not_a_match(self):
  _,valid=NativeChart(self.p,self.uv,self.triangles).project(self.runtime+[0,0,.025],self.normal)
  self.assertFalse(valid[0])
 def test_opposite_face_is_not_a_match(self):
  _,valid=NativeChart(self.p,self.uv,self.triangles).project(self.runtime,-self.normal)
  self.assertFalse(valid[0])
 def test_matching_corner_value_with_different_derivative_is_rejected(self):
  points=self.p[self.triangles].reshape(-1,3);uv=self.uv[self.triangles].reshape(-1,2);uv[3:]=uv[3:]*2-.2
  _,valid=NativeChart(points,uv,np.arange(6).reshape(-1,3)).project(self.runtime,self.normal)
  self.assertFalse(valid[0])

 def test_zero_uv_chart_has_no_lightmap(self):
  _,valid=NativeChart(self.p,np.zeros_like(self.uv),self.triangles).project(self.runtime,self.normal)
  self.assertFalse(valid[0])
 def test_nonfinite_geometry_or_uv_is_rejected(self):
  for positions,uv in [(self.p*np.nan,self.uv),(self.p,self.uv*np.nan)]:
   _,valid=NativeChart(positions,uv,self.triangles).project(self.runtime,self.normal)
   self.assertFalse(valid[0])
 def test_degenerate_geometry_is_rejected(self):
  _,valid=NativeChart(np.zeros_like(self.p),self.uv,self.triangles).project(self.runtime,self.normal)
  self.assertFalse(valid[0])

 def test_native_endpoint_is_shared_only_by_compatible_faces(self):
  vertices=np.array([[0,0,0,0,0,1],[0,0,0,0,0,1],[0,0,0,1,0,0],[3,0,0,0,0,1]],dtype=float)
  fallback=np.zeros((4,4),dtype='u1');weld=np.array([0,0,0,1]);ids=np.array([0]);samples=np.array([[.5,.4,.3,.8]]);uv=np.array([[.2,.3]])
  result,count=repair_boundary_endpoints(vertices,weld,ids,samples,fallback,uv)
  self.assertEqual(count,2);np.testing.assert_array_equal(result[0],result[1]);self.assertGreater(result[0,0],0);np.testing.assert_array_equal(result[2:],fallback[2:])
 def test_disagreeing_native_charts_do_not_overwrite_fallback(self):
  vertices=np.array([[0,0,0,0,0,1],[0,0,0,0,0,1]],dtype=float);fallback=np.full((2,4),13,dtype='u1')
  result,count=repair_boundary_endpoints(vertices,np.array([0,0]),np.array([0,1]),np.ones((2,4)),fallback,np.array([[.1,.2],[.4,.5]]))
  self.assertEqual(count,0);np.testing.assert_array_equal(result,fallback)

 def test_coincident_surfaces_with_conflicting_uv_islands_are_rejected(self):
  points=np.concatenate([self.p,self.p]);uv=np.concatenate([self.uv,self.uv+.4]);triangles=np.concatenate([self.triangles,self.triangles+4])
  _,valid=NativeChart(points,uv,triangles).project(self.runtime,self.normal)
  self.assertFalse(valid[0])

 def test_crossing_angled_neighbor_is_not_a_duplicate_chart(self):
  angled=self.p.copy();angled[:,2]=(angled[:,0]-.5)*.02
  points=np.concatenate([self.p,angled]);uv=np.concatenate([self.uv,self.uv+.4]);triangles=np.concatenate([self.triangles,self.triangles+4])
  mapped,valid=NativeChart(points,uv,triangles).project(self.runtime,self.normal)
  self.assertTrue(valid[0]);np.testing.assert_allclose(mapped,self.runtime[:,:,:2]*.1+.2,atol=1e-7)

 def test_quantized_vertex_near_long_chart_edge_is_not_interior_overlap(self):
  # A 0.14mm position rounding error at a long, narrow triangle's edge must
  # not be multiplied by its long edge and mistaken for a deep overlap.
  left=np.array([[0,0,0],[.01,0,0],[.01,10,0]],float)
  right=np.array([[.01,0,0],[1,0,0],[.01,10,0]],float)
  points=np.concatenate([left,right]);uv=np.concatenate([left[:,:2]*.01+.1,right[:,:2]*.01+.5])
  runtime=np.array([[[.00986,1,0],[.5,1,0],[.02,2,0]]]);chart=NativeChart(points,uv,np.array([[0,1,2],[3,4,5]]));chart.project(runtime,self.normal)
  self.assertFalse(chart.last_ambiguous[0])

class EquivalentBakeTests(unittest.TestCase):
 setUp=NativeTransferTests.setUp
 def duplicate(self,lighting):
  points=np.concatenate([self.p,self.p]);uv=np.concatenate([self.uv,self.uv+.4]);triangles=np.concatenate([self.triangles,self.triangles+4])
  return NativeChart(points,uv,triangles).project(self.runtime,self.normal,lighting.equivalent)[1][0]
 def test_identically_baked_duplicate_chart_is_accepted(self):
  lighting=EncodedLighting(np.full((128,128,3),80),np.zeros((128,128,1)))
  self.assertTrue(self.duplicate(lighting))
 def test_duplicate_with_different_shadow_is_rejected(self):
  shadow=np.zeros((128,128,1));shadow[64:]=30
  self.assertFalse(self.duplicate(EncodedLighting(np.full((128,128,3),80),shadow)))
 def test_duplicate_with_different_irradiance_is_rejected(self):
  light=np.full((128,128,3),80);light[64:]=85
  self.assertFalse(self.duplicate(EncodedLighting(light,np.zeros((128,128,1)))))
 def test_neighborhood_gradient_difference_is_rejected(self):
  light=np.full((128,128,3),80)
  # Matching central pixels must not conceal incompatible adjacent lighting.
  light[85,85]=110
  first=np.array([[[.27,.27],[.27+.01,.27+.01]]]);second=first+.4
  self.assertFalse(EncodedLighting(light,np.zeros((128,128,1))).equivalent(first,second)[0])

if __name__=='__main__'     :unittest.main()
