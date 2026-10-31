import { expect, test } from "vitest";
import { importSteamInventory } from "../steam-inventory-data.mjs";
const page = (id = "1", more = false) => ({
  success: 1,
  assets: [{ assetid: id, classid: "4", instanceid: "0" }],
  descriptions: [
    {
      classid: "4",
      instanceid: "0",
      market_hash_name: "AK-47 | Case Hardened (Field-Tested)",
      tags: [{ category: "Weapon", localized_tag_name: "AK-47" }],
    },
  ],
  asset_properties: [
    {
      assetid: id,
      asset_properties: [
        { propertyid: 1, int_value: 661 },
        { propertyid: 2, float_value: 0.231234565 },
      ],
    },
  ],
  total_inventory_count: 2,
  more_items: more ? 1 : 0,
  last_assetid: id,
});
test("local JSON import preserves exact properties and rejects partial or repeated pages", () => {
  const data = importSteamInventory([page("1", true), page("2")], 1234);
  expect(data.items).toHaveLength(2);
  expect(data.items[0]).toMatchObject({ finish: "Case Hardened", wear: 0.231234565, seed: 661 });
  expect(data.syncedAt).toBe(1234);
  expect(() => importSteamInventory([page("1", true)])).toThrow("Incomplete inventory");
  expect(() => importSteamInventory([page("1", true), page("1")])).toThrow("Duplicate");
  expect(() => importSteamInventory([{ success: 1, total_inventory_count: 2000 }])).toThrow();
  expect(() => importSteamInventory([{ ...page(), descriptions: [] }])).toThrow("incomplete");
});
