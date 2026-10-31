import type { Wall } from "./physics";
export type YardMaterial = "sand" | "plaster" | "wood";
// x, base y, z, width, height, depth, material. Shared by rendering and authority.
export const yardBoxes: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  YardMaterial,
])[] = [
  [-22, 0, 0, 2, 7, 46, "sand"],
  [22, 0, 0, 2, 7, 46, "sand"],
  [0, 0, -22, 46, 7, 2, "sand"],
  [0, 0, 22, 46, 7, 2, "sand"],
  [-9, 0, -3, 8, 6, 13, "plaster"],
  [8, 0, 8, 9, 6, 10, "sand"],
  [8, 0, -14, 9, 6, 5, "plaster"],
  [-9, 0, 14, 8, 5, 4, "sand"],
  [-17, 3, -8, 7, 0.6, 4, "sand"],
  [-17, 0, -8, 0.7, 3, 4, "sand"],
  [1, 0, -5, 3, 2.5, 3, "wood"],
  [-1, 0, 4, 3, 2.5, 3, "wood"],
  [15, 0, -3, 3, 2.5, 3, "wood"],
  [-15, 0, 6, 3, 2, 3, "wood"],
  [1, 2.5, -5, 2.6, 2.2, 2.6, "wood"],
  [15, 2.5, -3, 2.6, 2.2, 2.6, "wood"],
];
export const yardWalls: Wall[] = yardBoxes.map(([x, y, z, w, height, d]) => ({
  x,
  y,
  z,
  w,
  h: y + height,
  d,
}));
export const yardSpawns = [
  { x: -17, y: 0, z: 17, yaw: 0 },
  { x: 17, y: 0, z: -17, yaw: Math.PI },
  { x: -17, y: 0, z: -17, yaw: Math.PI },
  { x: 17, y: 0, z: 17, yaw: 0 },
  { x: 0, y: 0, z: 17, yaw: 0 },
  { x: 0, y: 0, z: -17, yaw: Math.PI },
];
