import { test, expect } from "@playwright/test";
import { knifeDefinitions } from "@cs2go/protocol";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("native buy poses preview every firearm and utility on both agents without equipping", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(baseURL!))
      external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.health = 1_000_000;
  });
  await page.keyboard.press("b");
  const inventory = await page.evaluate(() => ({
    selected: window.__game.selected,
    inventory: window.__game.inventory(),
    ammo: window.__game.ammo,
    reserve: window.__game.reserve,
  }));
  // The extracted Source 2 pose layer is shared by both teams (see the buy
  // source.json provenance); CT's model must not imply a CT-prefixed clip.
  // Pin each firearm's actual native clip, including authored variant suffixes.
  const firearmClips: Record<string, string> = {
    0: "ak_03",
    1: "m4a1",
    2: "usp_silencer",
    3: "awp_03",
    7: "glock18_03",
    8: "deagle_03",
    9: "m4a4",
    10: "nova_02",
    11: "mp9_03",
    12: "hkp2000",
    13: "p250_03",
    14: "fiveseven",
    15: "tec9_03",
    16: "cz75",
    17: "revolver_03",
    18: "elite",
    19: "famas",
    20: "galilar_03",
    21: "aug",
    22: "sg556_03",
    23: "ssg08_03",
    24: "scar20",
    25: "g3sg1_03",
    26: "mac10_03",
    27: "mp7_03",
    28: "mp5sd_03",
    29: "ump45_03",
    30: "p90_03",
    31: "bizon_03",
    32: "xm1014_02",
    33: "mag7_02",
    34: "sawedoff_02",
    35: "m249_02",
    36: "negev_02",
  };
  for (const team of ["t", "ct"] as const) {
    await page.evaluate((side) => {
      window.__game.team = side;
      window.__game.updateBuyMenu();
    }, team);
    const weapons = await page
      .locator("#loadout [data-weapon]:visible")
      .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.weapon!));
    expect(weapons).toHaveLength(34);
    for (const id of weapons) {
      const card = page.locator(`#loadout [data-weapon="${id}"]`);
      await card.hover();
      await expect(page.locator("#buy-preview-name")).toHaveText(
        (await card.locator("b").textContent())!,
      );
      await expect(page.locator("#buy-preview-stage")).toHaveAttribute(
        "data-pose",
        `t_buymenu_${firearmClips[id]}`,
      );
      await expect(page.locator("#buy-preview-stage")).toHaveAttribute(
        "data-agent",
        `default-${team}`,
      );
      if (team === "ct")
        await expect(page.locator("#buy-preview-stage")).toHaveAttribute(
          "data-agent-model",
          "/models/agents/roster/ctm-sas.glb",
        );
      if (id === "18") await page.screenshot({ path: `artifacts/buy-pose-${team}-dual.png` });
      if (id === (team === "t" ? "7" : "2"))
        await page.screenshot({ path: `artifacts/buy-pose-${team}-pistol.png` });
    }
    const utility = await page
      .locator("#loadout [data-grenade]:visible")
      .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.grenade!));
    for (const kind of utility) {
      await page.locator(`#loadout [data-grenade="${kind}"]`).hover();
      await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-pose", /^sh_buymenu_/);
      const alignment = await page.evaluate(async () => {
        const path = "/src/buy-poses.ts";
        const { metricAttachment, metricBuyGrip } = (await import(
          path
        )) as typeof import("../src/buy-poses");
        const preview = window.__game.buyPreview as unknown as {
          item: import("three").Group;
          attachment: { hand: import("three").Object3D; matrix: import("three").Matrix4 };
        };
        const root = preview.item.getObjectByName("weapon")!;
        const actual = metricAttachment(root);
        const expected = metricBuyGrip(
          preview.attachment.hand,
          preview.attachment.matrix,
          actual.clone(),
        );
        const local = root.matrixWorld.clone().invert().multiply(expected);
        return (
          actual.elements
            .map((value, index) => Math.abs(value - expected.elements[index]))
            .reduce((a, b) => Math.max(a, b), 0) +
          (local.elements.every(Number.isFinite) ? 0 : Infinity)
        );
      });
      expect(alignment, `${team}/${kind} must cancel its posed weapon root`).toBeLessThan(0.0001);
      if (kind === "molotov") {
        const distance = await page.evaluate(() => {
          const preview = window.__game.buyPreview as unknown as {
            item: import("three").Group;
            attachment: { hand: import("three").Object3D };
          };
          return preview.item
            .getObjectByName("molotov")!
            .getWorldPosition(window.__game.position.clone())
            .distanceTo(preview.attachment.hand.getWorldPosition(window.__game.position.clone()));
        });
        expect(distance).toBeLessThan(0.25);
      }
      if (kind === "flash" || kind === "smoke" || kind === "molotov")
        await page.screenshot({ path: `artifacts/buy-pose-${team}-${kind}.png` });
    }
  }
  expect(
    await page.evaluate(() => ({
      selected: window.__game.selected,
      inventory: window.__game.inventory(),
      ammo: window.__game.ammo,
      reserve: window.__game.reserve,
    })),
  ).toEqual(inventory);
  await page.evaluate(async () => {
    const path = "/src/skins.ts";
    const { setSkin, skinCatalog } = (await import(path)) as typeof import("../src/skins");
    // The real Inventory selector loads names and rarity before applying a finish.
    await skinCatalog();
    await setSkin(22, { id: "39_287", wear: 0.1, seed: 1 });
  });
  await page.locator('#loadout [data-weapon="22"]').hover();
  await expect(page.locator("#buy-preview-name")).toHaveText("SG 553 | Pulse");
  await expect(page.locator("#buy-preview-name")).toHaveCSS("color", "rgb(136, 71, 255)");
  await page.screenshot({ path: "artifacts/buy-preview-sg553-pulse.png" });
  for (const { id: knife } of knifeDefinitions) {
    await page.locator("#close-loadout").click();
    await page.waitForFunction(() => window.__game.locked);
    await page.evaluate((index) => {
      window.__game.buy(index);
    }, knife);
    await page.keyboard.press("b");
    await expect(page.locator("#buy-preview-stage")).toHaveAttribute(
      "data-pose",
      knife === 46 ? "sh_buymenu_push" : "sh_buymenu_knife",
    );
    await page.screenshot({ path: `artifacts/buy-pose-knife-${knife}.png` });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
