/** Normalize a public Steam Community inventory page on either client or server. */
export function steamInventoryPage(data) {
  if (
    !data ||
    typeof data !== "object" ||
    data.success !== 1 ||
    !Array.isArray(data.assets) ||
    !Array.isArray(data.descriptions)
  ) {
    // Steam represents a genuinely empty inventory without asset arrays.
    if (data?.success === 1 && data.total_inventory_count === 0 && !data.more_items)
      return { items: [], reportedTotal: 0, cursor: null };
    throw new Error("Steam inventory is unavailable, private, or incomplete.");
  }
  if (data.assets.length > 100000 || data.descriptions.length > 100000)
    throw new Error("Steam inventory page is too large.");
  const items = new Map();
  const descriptions = new Map(
    (data.descriptions || []).map((d) => [`${d.classid}:${d.instanceid}`, d]),
  );
  const properties = new Map(
    (data.asset_properties || []).map((p) => [p.assetid, p.asset_properties]),
  );
  for (const asset of data.assets || []) {
    if (!/^\d+$/.test(asset.assetid || "")) throw new Error("Invalid Steam inventory asset.");
    const d = descriptions.get(`${asset.classid}:${asset.instanceid}`);
    if (!d) throw new Error("Steam returned an incomplete inventory. Please sync again later.");
    const props = properties.get(asset.assetid) || [];
    const rawWear = props.find((p) => p.propertyid === 2)?.float_value;
    const rawSeed = props.find((p) => p.propertyid === 1)?.int_value;
    const wear = rawWear === undefined ? null : Number(rawWear);
    const seed = rawSeed === undefined ? null : Number(rawSeed);
    const rarityColor = d.tags?.find((t) => t.category === "Rarity")?.color || d.name_color;
    items.set(asset.assetid, {
      assetId: asset.assetid,
      name: d.market_hash_name || d.name,
      image:
        typeof d.icon_url === "string" && /^[a-zA-Z0-9_\-/=]{1,8192}$/.test(d.icon_url)
          ? `https://community.fastly.steamstatic.com/economy/image/${d.icon_url}/360fx240f`
          : "",
      type: d.tags?.find((t) => t.category === "Type")?.localized_tag_name || d.type || "",
      rarity: d.tags?.find((t) => t.category === "Rarity")?.localized_tag_name || "",
      color: /^[a-fA-F0-9]{6}$/.test(rarityColor || "") ? `#${rarityColor}` : "#b0c3d9",
      weaponName: d.tags?.find((t) => t.category === "Weapon")?.localized_tag_name || "",
      finish:
        (d.market_hash_name || "")
          .split(" | ")[1]
          ?.replace(
            / \((?:Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/,
            "",
          ) || "",
      wear: Number.isFinite(wear) && wear >= 0 && wear <= 1 ? wear : null,
      seed: Number.isInteger(seed) && seed >= 0 && seed <= 1000 ? seed : null,
    });
  }
  const cursor = data.more_items ? data.last_assetid : null;
  if (cursor !== null && !/^\d+$/.test(cursor || ""))
    throw new Error("Incomplete Steam inventory pagination.");
  return {
    items: [...items.values()],
    reportedTotal: Number.isFinite(data.total_inventory_count)
      ? data.total_inventory_count
      : items.size,
    cursor,
  };
}

/** Refuse partial snapshots, including a file saved before the final page. */
export function importSteamInventory(pages, syncedAt = Date.now()) {
  if (!Array.isArray(pages) || !pages.length || pages.length > 50)
    throw new Error("Select every inventory page (up to 50 JSON files).");
  const items = new Map(),
    cursors = new Set();
  let reportedTotal = 0;
  for (let i = 0; i < pages.length; i++) {
    const page = steamInventoryPage(pages[i]);
    if ((i < pages.length - 1 && !page.cursor) || (i === pages.length - 1 && page.cursor))
      throw new Error(
        "Incomplete inventory. Import all pages together, ending with the final page.",
      );
    if (page.cursor && cursors.has(page.cursor)) throw new Error("Repeated Steam inventory page.");
    if (page.cursor) cursors.add(page.cursor);
    for (const item of page.items) {
      if (items.has(item.assetId)) throw new Error("Duplicate Steam inventory page.");
      items.set(item.assetId, item);
    }
    reportedTotal = Math.max(reportedTotal, page.reportedTotal);
  }
  return { items: [...items.values()], reportedTotal, syncedAt };
}
