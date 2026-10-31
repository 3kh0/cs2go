import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("leaving a flashed match clears utility and live overlays for menu and results", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toBeHidden({ timeout: 10000 });
  const state = await page.evaluate(() => {
    const g = window.__game;
    const prime = () => {
      g.start("practice");
      g.utility.blind.set("player", 4);
      const position = g.position.clone();
      position.y += 0.2;
      g.utility.launch(
        "smoke",
        "player",
        g.team,
        position,
        position.clone().set(0, 0, 0),
        g.selected,
      );
      g.utility.detonate(g.utility.projectiles[0]);
      g.utility.renderEffects();
      g.groundInventory.showLoadout();
      for (const id of ["settings", "skin-menu", "loadout", "scoreboard", "pause"])
        document.getElementById(id)!.classList.remove("hidden");
      document.body.classList.add("match-menu-open");
      return g.utility.overlay!.style.opacity === "1";
    };
    const initiallyFlashed = prime();
    g.menu();
    g.utility.renderEffects();
    const menuClean =
      g.utility.overlay!.style.opacity === "0" &&
      !g.utility.effects.length &&
      !g.utility.projectiles.length &&
      !document.getElementById("loadout-editor");
    prime();
    g.finish();
    g.utility.renderEffects();
    const finishClean =
      g.utility.overlay!.style.opacity === "0" &&
      !g.utility.effects.length &&
      !g.utility.projectiles.length;
    const overlaysClosed =
      ["settings", "skin-menu", "loadout", "scoreboard", "pause"].every((id) =>
        document.getElementById(id)!.classList.contains("hidden"),
      ) &&
      !document.getElementById("loadout-editor") &&
      !document.body.classList.contains("match-menu-open");
    const resultVisible = !document.getElementById("result")!.classList.contains("hidden");
    return { initiallyFlashed, menuClean: !!menuClean, finishClean, overlaysClosed, resultVisible };
  });
  expect(state).toEqual({
    initiallyFlashed: true,
    menuClean: true,
    finishClean: true,
    overlaysClosed: true,
    resultVisible: true,
  });
  await expect(page.locator("#result")).toBeVisible();
  expect(errors).toEqual([]);
});
