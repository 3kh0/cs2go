import { expect, it } from "vitest";
import { Vector3 } from "three";
import {
  canCarryGrenade,
  emptyGrenades,
  flashExposure,
  grenadeAvailable,
  heDamage,
  segmentNearSphere,
} from "./utility";
it("limits utility to four, two flashes, and a single shared fire slot", () => {
  const inventory = emptyGrenades();
  inventory.flash = 1;
  expect(canCarryGrenade(inventory, "flash")).toBe(true);
  inventory.flash = 2;
  expect(canCarryGrenade(inventory, "flash")).toBe(false);
  inventory.molotov = 1;
  expect(canCarryGrenade(inventory, "incendiary")).toBe(false);
  inventory.smoke = 1;
  expect(canCarryGrenade(inventory, "he")).toBe(false);
});
it("keeps faction fire grenades separate", () => {
  expect(grenadeAvailable("molotov", "ct")).toBe(false);
  expect(grenadeAvailable("incendiary", "t")).toBe(false);
  expect(grenadeAvailable("smoke", "ct")).toBe(true);
});
it("does not occlude a target in front of smoke, but occludes crossing and inside rays", () => {
  const from = new Vector3(0, 1, 0),
    smoke = new Vector3(0, 1, 5);
  expect(segmentNearSphere(from, new Vector3(0, 1, 2), smoke, 1)).toBe(false);
  expect(segmentNearSphere(from, new Vector3(0, 1, 8), smoke, 1)).toBe(true);
  expect(segmentNearSphere(smoke, smoke, smoke, 1)).toBe(true);
  expect(segmentNearSphere(from, new Vector3(5, 1, 5), smoke, 1)).toBe(false);
});
it("turning away reduces a flash and blast damage falls off to zero", () => {
  expect(flashExposure(3, -1)).toBeLessThan(flashExposure(3, 1) / 3);
  expect(flashExposure(35, 1)).toBe(0);
  expect(heDamage(0)).toBeGreaterThan(100);
  expect(heDamage(4)).toBeLessThan(heDamage(2));
  expect(heDamage(9)).toBe(0);
});

it("casual limits total utility to three and a single flash", () => {
  const inventory = emptyGrenades();
  inventory.flash = 1;
  expect(canCarryGrenade(inventory, "flash", false)).toBe(false);
  inventory.smoke = 1;
  inventory.he = 1;
  expect(canCarryGrenade(inventory, "decoy", false)).toBe(false);
});

it("uses the shipped 30-degree ignition slope, rejecting walls and steeper ground", async () => {
  const { fireImpactAllowed } = await import("./utility");
  expect(fireImpactAllowed(1)).toBe(true);
  expect(fireImpactAllowed(Math.cos(Math.PI / 6))).toBe(true);
  expect(fireImpactAllowed(Math.cos((31 * Math.PI) / 180))).toBe(false);
  expect(fireImpactAllowed(0.8)).toBe(false);
  expect(fireImpactAllowed(0)).toBe(false);
});

it("keeps blast, self-blast, and inferno friendly damage separate", async () => {
  const { utilityDamageScale } = await import("./utility");
  expect(utilityDamageScale("competitive", "he", false, true)).toBe(0.85);
  expect(utilityDamageScale("competitive", "molotov", false, true)).toBe(0.4);
  expect(utilityDamageScale("competitive", "decoy", false, true)).toBe(0);
  expect(utilityDamageScale("competitive", "decoy", false, false)).toBe(1);
  expect(utilityDamageScale("competitive", "he", true, true)).toBe(1);
  expect(utilityDamageScale("casual", "he", true, true)).toBe(0);
  expect(utilityDamageScale("casual", "he", false, true)).toBe(0);
  expect(utilityDamageScale("casual", "he", false, false)).toBe(1);
});

it("keeps candidate fire nodes separated and within their faction-specific spread bound", async () => {
  const { fireCellCandidates, fireParameters, grenadeData } = await import("./utility");
  for (const kind of ["molotov", "incendiary"] as const) {
    const cells = fireCellCandidates(kind);
    expect(cells[0].x).toBe(0);
    expect(cells[0].z).toBe(0);
    for (let i = 0; i < cells.length; i++) {
      expect(Math.hypot(cells[i].x, cells[i].z)).toBeLessThanOrEqual(grenadeData[kind].radius);
      for (let j = i + 1; j < cells.length; j++)
        expect(cells[i].distanceTo(cells[j])).toBeGreaterThanOrEqual(
          fireParameters.spacing - 1e-10,
        );
    }
  }
  expect(grenadeData.incendiary.radius).toBeLessThan(grenadeData.molotov.radius);
});
