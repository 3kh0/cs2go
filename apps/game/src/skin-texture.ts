import type { Texture } from "three";

export function textureCoordinateKey(reference: Texture | null) {
  if (!reference) return "identity";
  if (reference.matrixAutoUpdate) reference.updateMatrix();
  return JSON.stringify([reference.channel, reference.flipY, reference.matrix.elements]);
}

// gltfpack can quantize UVs and move their decoding into KHR_texture_transform.
// A replacement paint must retain that transform. Clone only the Texture view:
// its Source/pixel storage stays shared, while each material owns its UV matrix.
export function withTextureCoordinates(texture: Texture, reference: Texture | null) {
  const view = texture.clone();
  if (reference) {
    if (reference.matrixAutoUpdate) reference.updateMatrix();
    view.channel = reference.channel;
    view.flipY = reference.flipY;
    view.offset.copy(reference.offset);
    view.repeat.copy(reference.repeat);
    view.center.copy(reference.center);
    view.rotation = reference.rotation;
    view.matrix.copy(reference.matrix);
    view.matrixAutoUpdate = reference.matrixAutoUpdate;
  }
  return view;
}
