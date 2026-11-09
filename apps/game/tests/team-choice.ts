import type { Page } from "@playwright/test";

/** Native match preparation may yield before showing its chooser. Legacy
 * isolated fixtures start directly and acquire pointer lock instead. Wait for
 * either completed entry path before deciding whether a team click is needed. */
export async function teamChoiceVisible(page: Page) {
  await page.waitForFunction(() => {
    const selector = document.getElementById("team-select");
    return (
      window.__game?.locked ||
      !!(
        selector &&
        selector.getClientRects().length &&
        getComputedStyle(selector).visibility !== "hidden"
      )
    );
  });
  return page.locator("#team-select").isVisible();
}
