import type { WeaponInstance } from "./weapon-instance";
import { assetFetch } from "./asset-url";
import * as T from "three";
import type { Paint } from "./skin-paint";
import { bakeSkin, skinTextureBytes } from "./skin-baker";
import { weapons } from "./physics";
import { textureCoordinateKey, withTextureCoordinates } from "./skin-texture";

export type Skin = {
  id: string;
  weapon: number;
  paint: number;
  name: string;
  rarity: string;
  body: "hd" | "legacy";
  image: string;
};
export type SkinChoice = { id: string; wear: number; seed: number };
const KEY = "cs2go-skins-v1";
const defaults = (): SkinChoice => ({ id: "", wear: 0.01, seed: 1 });
export function sanitizeChoice(raw: Partial<SkinChoice> | null | undefined): SkinChoice {
  return {
    id: typeof raw?.id === "string" ? raw.id : "",
    wear: Number.isFinite(raw?.wear) ? T.MathUtils.clamp(raw!.wear!, 0, 1) : 0.01,
    seed: Number.isFinite(raw?.seed) ? T.MathUtils.clamp(Math.round(raw!.seed!), 0, 1000) : 1,
  };
}
function read(): SkinChoice[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.from({ length: weapons.length }, (_, i) => sanitizeChoice(raw?.[i]));
  } catch {
    return Array.from({ length: weapons.length }, defaults);
  }
}
export const skinChoices = read();
let catalog: Promise<Skin[]> | undefined;
let catalogItems: Skin[] = [];
export const skinImage = (id: string) => catalogItems.find((skin) => skin.id === id)?.image ?? "";
export const skinName = (id: string) => catalogItems.find((skin) => skin.id === id)?.name ?? "";
export function skinRarityColor(id: string) {
  const rarity = catalogItems.find((skin) => skin.id === id)?.rarity;
  return (
    (
      {
        "Consumer Grade": "#b0c3d9",
        "Industrial Grade": "#5e98d9",
        "Mil-Spec Grade": "#4b69ff",
        Restricted: "#8847ff",
        Classified: "#d32ce6",
        Covert: "#eb4b4b",
        Contraband: "#e4ae39",
        Extraordinary: "#e4ae39",
      } as Record<string, string>
    )[rarity ?? ""] ?? ""
  );
}
export function skinCatalog() {
  catalog ??= assetFetch("/skins/catalog.json")
    .then(async (r) => {
      if (!r.ok) throw new Error("Skin catalog could not load");
      catalogItems = (await r.json()) as Skin[];
      return catalogItems;
    })
    .catch((e) => {
      catalog = undefined;
      throw e;
    });
  return catalog;
}
type Maps = {
  map: T.Texture | null;
  roughnessMap: T.Texture | null;
  metalnessMap: T.Texture | null;
  normalMap: T.Texture | null;
};
type Model = {
  root: T.Group;
  index: number;
  original: Map<T.MeshStandardMaterial, Maps>;
  loadHD?: () => Promise<T.Group>;
  loadLegacy?: () => Promise<T.Group>;
  loadingLegacy?: Promise<void>;
  loadingHD?: Promise<void>;
  instance?: WeaponInstance | null;
  finish?: Finish;
  bindingVersion: number;
  defaultHD: boolean;
  pendingKey?: string;
  retryAt?: number;
};
const models: Model[] = [];
type Finish = {
  body: Skin["body"];
  key: string;
  disposed?: boolean;
  materials: Map<string, Maps>;
  views: Map<string, Maps>;
  textures: T.Texture[];
};
const finishes = new Map<number, Finish>();
const versions = weapons.map(() => 0);
const pending = new Map<number, Promise<void>>();
const instanceFinishes = new Map<string, Finish>();
const instanceLoads = new Map<string, Promise<Finish | undefined>>();
const finishKey = (index: number, choice: Readonly<SkinChoice>) =>
  `${index}:${choice.id}:${choice.wear}:${choice.seed}`;
function collectFinish(finish?: Finish) {
  if (
    !finish ||
    finish.disposed ||
    [...finishes.values()].includes(finish) ||
    models.some((model) => model.finish === finish || model.pendingKey === finish.key)
  )
    return;
  if (instanceFinishes.get(finish.key) === finish) instanceFinishes.delete(finish.key);
  finish.disposed = true;
  for (const texture of finish.textures) texture.dispose();
}
function modelFinish(model: Model) {
  return model.instance === undefined ? finishes.get(model.index) : model.finish;
}

function materialName(path: string) {
  return path
    .split("/")
    .at(-1)!
    .replace(/\.vmat$/, "");
}
function apply(model: Model, finish?: Finish) {
  const hd = model.root.getObjectByName("skin-hd");
  const legacy = model.root.getObjectByName("skin-legacy");
  const missingBody = finish?.body === "legacy" ? "legacy" : "hd";
  if (
    finish &&
    !(missingBody === "hd" ? hd : legacy) &&
    (missingBody === "hd" ? model.loadHD : model.loadLegacy)
  ) {
    void ensureBody(model, missingBody)
      .then(() => {
        if (models.includes(model)) apply(model, modelFinish(model));
      })
      .catch(() => {
        /* Keep the native fallback visible; selecting again retries the load. */
      });
    finish = undefined;
  }
  const useHD = finish ? finish.body === "hd" : model.defaultHD;
  if (hd) hd.visible = useHD;
  if (legacy) legacy.visible = !useHD || !hd;
  for (const [material, original] of model.original) {
    const painted = finish?.materials.get(material.name);
    let maps = original;
    if (painted && finish) {
      const references = {
        map: original.map,
        roughnessMap: original.roughnessMap ?? original.map,
        metalnessMap: original.metalnessMap ?? original.map,
        normalMap: original.normalMap ?? original.map,
      };
      const key = `${material.name}:${Object.values(references).map(textureCoordinateKey).join(":")}`;
      let views = finish.views.get(key);
      if (!views) {
        views = { map: null, roughnessMap: null, metalnessMap: null, normalMap: null };
        // Roughness and metalness normally share both pixels and UVs. Reuse the
        // same texture view in that case without conflating distinct transforms.
        const local = new Map<string, T.Texture>();
        for (const name of Object.keys(views) as (keyof Maps)[]) {
          const texture = painted[name];
          if (!texture) continue;
          const reference = references[name];
          const coordinate = `${texture.uuid}:${textureCoordinateKey(reference)}`;
          let view = local.get(coordinate);
          if (!view) {
            view = withTextureCoordinates(texture, reference);
            local.set(coordinate, view);
            finish.textures.push(view);
          }
          views[name] = view;
        }
        finish.views.set(key, views);
      }
      maps = views;
    }
    Object.assign(material, maps, { normalMap: maps.normalMap ?? original.normalMap });
    material.needsUpdate = true;
  }
}
function rememberMaterials(root: T.Group, original: Model["original"]) {
  root.traverse((o) => {
    if (o instanceof T.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m instanceof T.MeshStandardMaterial)
          original.set(m, {
            map: m.map,
            roughnessMap: m.roughnessMap,
            metalnessMap: m.metalnessMap,
            normalMap: m.normalMap,
          });
  });
}
function ensureBody(model: Model, variant: "hd" | "legacy" = "hd"): Promise<void> {
  const loader = variant === "hd" ? model.loadHD : model.loadLegacy;
  const loading = variant === "hd" ? "loadingHD" : "loadingLegacy";
  if (model.root.getObjectByName(`skin-${variant}`) || !loader) return Promise.resolve();
  model[loading] ??= loader()
    .then((body) => {
      if (!models.includes(model)) {
        // Factories return owned geometry/material/skeleton clones. Their
        // texture maps remain shared with the cached native template.
        body.removeFromParent();
        const skeletons = new Set<T.Skeleton>();
        body.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
          if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
        });
        skeletons.forEach((skeleton) => skeleton.dispose());
        return;
      }
      body.name = `skin-${variant}`;
      body.visible = false;
      model.root.add(body);
      rememberMaterials(body, model.original);
    })
    .finally(() => {
      model[loading] = undefined;
    });
  return model[loading];
}
export function registerSkinModel(
  root: T.Group,
  index: number,
  loadHD?: () => Promise<T.Group>,
  defaultHD = false,
  loadLegacy?: () => Promise<T.Group>,
) {
  const original = new Map<T.MeshStandardMaterial, Maps>();
  rememberMaterials(root, original);
  const model: Model = { root, index, original, loadHD, loadLegacy, defaultHD, bindingVersion: 0 };
  models.push(model);
  apply(model, modelFinish(model));
  if (skinChoices[index].id && !finishes.has(index) && !pending.has(index))
    void setSkin(index, skinChoices[index]).catch(() => {
      /* Customizer displays retryable errors. Default stays playable. */
    });
}
export function unregisterSkinModel(root: T.Group) {
  const index = models.findIndex((model) => model.root === root);
  if (index >= 0) {
    const [model] = models.splice(index, 1);
    model.bindingVersion++;
    collectFinish(model.finish);
  }
}
function dataTexture(bytes: Uint8Array, color = false) {
  const texture = new T.DataTexture(bytes, 1024, 1024, T.RGBAFormat);
  texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
type NormalPixels = { data: Uint8Array; width: number; height: number };
const NORMAL_BUDGET = 16 * 1024 * 1024;
const normals = new Map<string, NormalPixels>();
const loadingNormals = new Map<string, Promise<NormalPixels>>();
let normalBytes = 0;
async function normalPixels(url: string): Promise<NormalPixels> {
  const cached = normals.get(url);
  if (cached) {
    normals.delete(url);
    normals.set(url, cached);
    return cached;
  }
  const pending = loadingNormals.get(url);
  if (pending) return pending;
  const work = decodeNormal(url).then((pixels) => {
    normals.set(url, pixels);
    normalBytes += pixels.data.byteLength;
    for (const [key, old] of normals) {
      if (normalBytes <= NORMAL_BUDGET) break;
      normalBytes -= old.data.byteLength;
      normals.delete(key);
    }
    return pixels;
  });
  loadingNormals.set(url, work);
  try {
    return await work;
  } finally {
    loadingNormals.delete(url);
  }
}
async function decodeNormal(url: string): Promise<NormalPixels> {
  const bytes = await skinTextureBytes(url),
    header = new DataView(bytes);
  const width = header.getUint32(0, true),
    height = header.getUint32(4, true);
  const pixels = { data: new Uint8Array(bytes, 8) };
  for (let i = 0; i < pixels.data.length; i += 4) {
    const x = (pixels.data[i] + pixels.data[i + 1]) / 255 - 1.003922,
      y = (pixels.data[i] - pixels.data[i + 1]) / 255,
      z = 1 - Math.abs(x) - Math.abs(y),
      length = Math.hypot(x, y, z) || 1;
    pixels.data[i] = ((x / length) * 0.5 + 0.5) * 255;
    pixels.data[i + 1] = ((y / length) * 0.5 + 0.5) * 255;
    pixels.data[i + 2] = ((z / length) * 0.5 + 0.5) * 255;
    pixels.data[i + 3] = 255;
  }
  return { data: pixels.data, width, height };
}
async function normalTexture(url: string) {
  // Immutable pixels are shared; each finish still owns/disposes its GPU texture.
  const { data, width, height } = await normalPixels(url);
  const t = new T.DataTexture(data, width, height);
  t.flipY = false;
  t.generateMipmaps = true;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.LinearFilter;
  t.needsUpdate = true;
  return t;
}
const paints = new Map<string, Promise<Paint>>();
function paintFor(id: string) {
  let paint = paints.get(id);
  if (paint) {
    paints.delete(id);
    paints.set(id, paint);
    return paint;
  }
  paint = assetFetch(`/skins/paints/${id}.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error("Skin paint could not load");
      return (await response.json()) as Paint;
    })
    .catch((error: unknown) => {
      paints.delete(id);
      throw error;
    });
  paints.set(id, paint);
  if (paints.size > 16) paints.delete(paints.keys().next().value!);
  return paint;
}
async function buildFinish(
  index: number,
  choice: Readonly<SkinChoice>,
  valid: () => boolean,
): Promise<Finish | undefined> {
  const cached = instanceFinishes.get(finishKey(index, choice));
  if (cached) return cached;
  const skin = (await skinCatalog()).find((s) => s.id === choice.id && s.weapon === index);
  if (!skin) throw new Error("This skin does not belong to this weapon");
  const paint = await paintFor(skin.id);
  const baked = await bakeSkin(paint, choice.seed, choice.wear, valid);
  if (!valid()) return;
  const finish: Finish = {
    key: finishKey(index, choice),
    body: skin.body,
    materials: new Map(),
    views: new Map(),
    textures: [],
  };
  try {
    for (const target of baked) {
      const map = dataTexture(target.maps.g_tColor, true),
        packed = target.maps.g_tMetalness;
      // Native outputs use R roughness / G metalness. Repack to glTF G/B.
      const orm = new Uint8Array(packed.length);
      for (let i = 0; i < packed.length; i += 4) {
        orm[i] = 255;
        orm[i + 1] = packed[i];
        orm[i + 2] = packed[i + 1];
        orm[i + 3] = 255;
      }
      const roughnessMap = dataTexture(orm);
      finish.textures.push(map, roughnessMap);
      const normalMap = target.direct.g_tNormal
        ? await normalTexture(target.direct.g_tNormal)
        : null;
      if (normalMap) finish.textures.push(normalMap);
      finish.materials.set(materialName(target.material), {
        map,
        roughnessMap,
        metalnessMap: roughnessMap,
        normalMap,
      });
    }
  } catch (e) {
    for (const t of finish.textures) t.dispose();
    throw e;
  }
  return finish;
}
async function instanceFinish(instance: WeaponInstance) {
  if (!instance.skin.id) return;
  const key = finishKey(instance.weapon, instance.skin);
  const cached = instanceFinishes.get(key);
  if (cached) return cached;
  let loading = instanceLoads.get(key);
  if (!loading) {
    loading = (async () => {
      await pending.get(instance.weapon)?.catch(() => {});
      const existing = instanceFinishes.get(key);
      if (existing) return existing;
      const finish = await buildFinish(instance.weapon, instance.skin, () => true);
      if (finish) instanceFinishes.set(key, finish);
      return finish;
    })().finally(() => instanceLoads.delete(key));
    instanceLoads.set(key, loading);
  }
  return loading;
}
/** Bind cached first-person or owned world meshes to one immutable weapon. */
export function bindWeaponInstance(root: T.Group, instance: WeaponInstance | null) {
  for (const model of models) {
    let node: T.Object3D | null = model.root;
    while (node && node !== root) node = node.parent;
    if (!node) continue;
    if (model.instance === instance) {
      if (
        model.finish?.body === "hd" &&
        !model.root.getObjectByName("skin-hd") &&
        !model.loadingHD &&
        Date.now() >= (model.retryAt ?? 0)
      ) {
        model.retryAt = Date.now() + 10000;
        apply(model, model.finish);
      }
      if (
        !instance?.skin.id ||
        model.finish ||
        model.pendingKey ||
        Date.now() < (model.retryAt ?? 0)
      )
        continue;
    }
    const old = model.finish;
    model.instance = instance;
    model.finish = undefined;
    model.pendingKey = undefined;
    model.retryAt = Date.now() + 10000;
    const version = ++model.bindingVersion;
    if (instance?.skin.id)
      model.finish = instanceFinishes.get(finishKey(instance.weapon, instance.skin));
    if (instance?.skin.id && !model.finish)
      model.pendingKey = finishKey(instance.weapon, instance.skin);
    apply(model, model.finish);
    collectFinish(old);
    if (instance?.skin.id && !model.finish)
      void instanceFinish(instance)
        .then((finish) => {
          if (model.bindingVersion === version && models.includes(model)) {
            model.finish = finish;
            model.pendingKey = undefined;
            apply(model, finish);
          } else queueMicrotask(() => collectFinish(finish));
        })
        .catch(() => {
          if (model.bindingVersion === version) {
            model.pendingKey = undefined;
            model.retryAt = Date.now() + 10000;
          }
          /* Retain identity; explicit re-equip or a bounded spectator retry can recover. */
        });
  }
}
export async function setSkin(index: number, raw: SkinChoice) {
  if (!Number.isInteger(index) || index < 0 || index >= weapons.length)
    throw new Error("Unsupported skin weapon");
  const choice = sanitizeChoice(raw);
  const current = skinChoices[index];
  if (
    !pending.has(index) &&
    (!choice.id || finishes.has(index)) &&
    current.id === choice.id &&
    current.seed === choice.seed &&
    current.wear === choice.wear
  ) {
    if (finishes.has(index))
      for (const model of models)
        if (model.index === index && model.instance === undefined) {
          await ensureBody(model, finishes.get(index)!.body);
          if (models.includes(model)) apply(model, modelFinish(model));
        }
    return;
  }
  const version = ++versions[index];
  const work = (async () => {
    let finish: Finish | undefined;
    if (choice.id) {
      const skin = (await skinCatalog()).find((s) => s.id === choice.id && s.weapon === index);
      if (!skin) throw new Error("This skin does not belong to this weapon");
      if (versions[index] !== version) return;
      {
        try {
          await Promise.all(
            models
              .filter((m) => m.index === index && m.instance === undefined)
              .map((model) => ensureBody(model, skin.body)),
          );
        } catch (error) {
          if (versions[index] !== version) return;
          throw error;
        }
        if (versions[index] !== version) return;
      }
      finish = await buildFinish(index, choice, () => versions[index] === version);
    }
    if (versions[index] !== version) {
      collectFinish(finish);
      return;
    }
    const old = finishes.get(index);
    if (finish) {
      finishes.set(index, finish);
      instanceFinishes.set(finish.key, finish);
    } else finishes.delete(index);
    for (const model of models)
      if (model.index === index && model.instance === undefined) apply(model, finish);
    collectFinish(old);
    skinChoices[index] = choice;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("cs2go-skins-change"));
    try {
      localStorage.setItem(KEY, JSON.stringify(skinChoices));
    } catch {
      /* Session customization still works if storage is full. */
    }
  })();
  pending.set(index, work);
  try {
    await work;
  } finally {
    if (pending.get(index) === work) pending.delete(index);
  }
}
