// Offline NAV decoder backed by the same pinned library as Source 2 Viewer.
using ValveResourceFormat.NavMesh;
using System.Text.Json;
using System.Numerics;
var nav = new NavMeshFile();
nav.Read(args[0]);
static double[] Point(Vector3 v) => new[]{Math.Round(v.X*.0254,5),Math.Round(v.Z*.0254,5),Math.Round(-v.Y*.0254,5)};
var areas=nav.Areas.Values.Where(a=>a.HullIndex==0).Select(a=>new {
    id=a.AreaId, flags=(long)a.AttributeFlags, corners=a.Corners.Select(Point).ToArray(),
    links=a.Connections.SelectMany(x=>x).Select(x=>x.AreaId).Distinct().ToArray(),
    portals=a.Connections.SelectMany((links,edge)=>links.Select(link=>new {link.AreaId,point=Point((a.Corners[edge]+a.Corners[(edge+1)%a.Corners.Length])/2)})).GroupBy(p=>p.AreaId).ToDictionary(g=>g.Key,g=>g.First().point),
    cover=Array.Empty<double[]>()
});
File.WriteAllText(args[1],JsonSerializer.Serialize(new{version=nav.Version,areas}));
if (args.Length > 2) {
    using var resource = new ValveResourceFormat.Resource();
    resource.Read(args[2]);
    File.WriteAllText(args[3], ((ValveResourceFormat.ResourceTypes.EntityLump)resource.DataBlock!).ToEntityDumpString());
}
