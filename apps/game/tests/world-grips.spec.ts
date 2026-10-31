import { expect, test } from "@playwright/test";

for (const custom of [false, true])
  test(`gameplay grips keep every firearm at the hands through crouch and movement (${custom ? "native roster" : "original rigs"})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
    const samples = await page.evaluate(async (custom) => {
      // Resolve Vite's actual Three module so instanceof checks share its constructors.
      const source = await (await fetch("/src/soldier.ts")).text();
      const path = source.match(/from "([^"]*three\.js[^"]*)"/)![1];
      const T = await import(/* @vite-ignore */ path);
      const soldiers = await import("../src/soldier");
      const { isKnife, weapons } = await import("../src/physics");
      await soldiers.loadSoldierModels();
      const roster = custom ? await import("../src/agent-roster") : undefined;
      const catalog = await roster?.loadAgentCatalog();
      const results = [];
      for (const team of ["t", "ct"] as const) {
        const choice = catalog?.find(
          (agent) =>
            agent.team === team &&
            agent.model.includes(team === "t" ? "tm-professional-varf" : "ctm-fbi-variantb"),
        );
        if (custom && !choice) throw new Error(`Missing representative native agent for ${team}`);
        const appearance = choice ? await roster!.acquireAgentAppearance(choice.id) : undefined;
        const soldier = soldiers.createSoldier(0, team, appearance);
        soldier.group.visible = true;
        for (let index = 0; index < weapons.length; index++) {
          if (isKnife(index)) continue;
          soldiers.setSoldierWeapon(soldier, index);
          soldier.drawTime = 0;
          for (const crouch of [0, 1]) {
            soldier.crouch = crouch;
            soldier.moveX = 1;
            soldier.moveZ = 1;
            for (let frame = 0; frame < 4; frame++)
              soldiers.animateSoldier(soldier, frame ? 3.5 : 0, 1 / 60, true);
            soldier.group.updateMatrixWorld(true);
            const box = new T.Box3().setFromObject(soldier.weapon, true);
            const hand = soldier.rightHand.getWorldPosition(new T.Vector3());
            const support = soldier.leftHand.getWorldPosition(new T.Vector3());
            results.push({
              team,
              index,
              crouch,
              right: box.distanceToPoint(hand),
              left: box.distanceToPoint(support),
              size: box.getSize(new T.Vector3()).length(),
              finite: soldier.weapon.matrixWorld.elements.every(Number.isFinite),
            });
          }
        }
        soldiers.disposeSoldier(soldier);
      }
      return results;
    }, custom);
    expect(samples).toHaveLength(34 * 2 * 2);
    for (const sample of samples) {
      expect(sample.finite, JSON.stringify(sample)).toBe(true);
      expect(sample.right, JSON.stringify(sample)).toBeLessThan(0.25);
      expect(sample.left, JSON.stringify(sample)).toBeLessThan(0.4);
      expect(sample.size, JSON.stringify(sample)).toBeGreaterThan(0.12);
      expect(sample.size, JSON.stringify(sample)).toBeLessThan(2);
    }
    expect(errors).toEqual([]);
  });
