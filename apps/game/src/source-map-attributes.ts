import * as T from "three";

// Reinterpret the importer's RGBA8 UV bytes as normalized uint16 UVs without copying
export function bindSourceMapAttributes(geometry: T.BufferGeometry) {
  const uv = geometry.getAttribute("color_1");
  const probe = geometry.getAttribute("color_2");
  const count = geometry.getAttribute("position").count;
  for (const attribute of [uv, probe]) {
    if (
      !(attribute instanceof T.BufferAttribute) ||
      !(attribute.array instanceof Uint8Array) ||
      !attribute.normalized ||
      attribute.itemSize !== 4 ||
      attribute.count !== count
    )
      throw new Error(
        "Dust II native lighting attributes are missing or invalid; regenerate the map",
      );
  }
  const bytes = (uv as T.BufferAttribute).array as Uint8Array;
  if (bytes.byteOffset % 2) throw new Error("Dust II native UV bytes are not aligned");
  geometry.setAttribute(
    "sourceUv",
    new T.BufferAttribute(new Uint16Array(bytes.buffer, bytes.byteOffset, count * 2), 2, true),
  );
  geometry.setAttribute("sourceProbe", probe);
  const backProbe = geometry.getAttribute("color_3");
  if (backProbe) {
    if (
      !(backProbe instanceof T.BufferAttribute) ||
      !(backProbe.array instanceof Uint8Array) ||
      !backProbe.normalized ||
      backProbe.itemSize !== 4 ||
      backProbe.count !== count
    )
      throw new Error("Dust II foliage back-probe attributes are invalid; regenerate the map");
    geometry.setAttribute("sourceBackProbe", backProbe);
    geometry.deleteAttribute("color_3");
  }
  geometry.deleteAttribute("color_1");
  geometry.deleteAttribute("color_2");
  const blend = geometry.getAttribute("color_4");
  if (blend) {
    if (
      !(blend instanceof T.BufferAttribute) ||
      !(blend.array instanceof Uint8Array) ||
      !blend.normalized ||
      blend.itemSize !== 4 ||
      blend.count !== count
    )
      throw new Error("Dust II native layer weights are invalid; regenerate the map");
    geometry.setAttribute("sourceBlend", blend);
    geometry.deleteAttribute("color_4");
  }
}
