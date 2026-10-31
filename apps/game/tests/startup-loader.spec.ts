import { expect, test } from "@playwright/test";

test("startup shows filenames and percentage before revealing the menu", async ({ page }) => {
  test.setTimeout(120_000);
  const filenames: string[] = [];
  const errors: string[] = [];
  const percentages: number[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("recordLoadingFile", (filename: string) => filenames.push(filename));
  await page.exposeFunction("recordLoadingPercent", (value: number) => percentages.push(value));
  await page.addInitScript(() => {
    let previous = "";
    let lastPercent = "";
    new MutationObserver(() => {
      const percent = document.querySelector(".startup-percent")?.textContent;
      if (percent && percent !== lastPercent) {
        lastPercent = percent;
        void (
          window as unknown as { recordLoadingPercent: (value: number) => Promise<void> }
        ).recordLoadingPercent(Number.parseInt(percent));
      }
      const name = document.querySelector(".startup-label")?.textContent;
      if (!name || name === previous) return;
      previous = name;
      void (
        window as unknown as { recordLoadingFile: (name: string) => Promise<void> }
      ).recordLoadingFile(name);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto("/");
  const file = /\.(?:json|bin|glb|png|webp|hdr|ogg|woff2)(?:\.gz)?$/;
  await expect
    .poll(() => new Set(filenames.filter((name) => file.test(name))).size)
    .toBeGreaterThan(3);
  await expect(page.locator(".startup-label")).toHaveText(file);
  await expect(page.getByRole("progressbar", { name: "Loading progress" })).toBeVisible();
  await expect(page.locator(".startup-percent")).toHaveText(/^\d{1,3}%$/);
  await expect(page.locator(".startup-percent")).toHaveAttribute("aria-valuenow", /^\d{1,3}$/);
  expect(filenames.some((name) => name.includes(" · "))).toBe(false);
  const line = await page.locator(".startup-loading").evaluate((node) => {
    const label = node.querySelector(".startup-label")!.getBoundingClientRect();
    const percent = node.querySelector(".startup-percent")!.getBoundingClientRect();
    return { text: node.textContent, aligned: Math.abs(label.bottom - percent.bottom) < 5 };
  });
  expect(line.text).toMatch(/\S+ - \d+%$/);
  expect(line.aligned).toBe(true);
  await page.screenshot({ path: "artifacts/startup-filename.png" });
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 10_000 });
  expect(new Set(percentages).size).toBeGreaterThan(15);
  expect(percentages.some((value) => value > 0 && value % 10 !== 0)).toBe(true);
  expect(percentages.at(-1)).toBe(100);
  expect(percentages).toEqual([...percentages].sort((a, b) => a - b));
  expect(errors).toEqual([]);
});
