import { expect, test } from "@playwright/test";

test("every agent body binds native capsules that follow standing, crouch and locomotion", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  const audit = await page.evaluate(async () => {
    window.__game.matchLoading = true;
    const module = "/tests/agent-hitbox-fixture.ts";
    const { auditAgents } = (await import(module)) as typeof import("./agent-hitbox-fixture");
    return auditAgents();
  });
  expect(audit.aliases).toBe(143);
  expect(audit.models).toBe(80);
  for (const agent of audit.results) {
    expect(agent.capsules, agent.id).toBe(19);
    for (const pose of agent.poses) {
      expect(pose.contained, `${agent.id} ${pose.pose}`).toBe(19);
      expect(pose.headHits.some(Boolean), `${agent.id} ${pose.pose} head`).toBe(true);
    }
    expect(agent.poses[1].headY, agent.id).toBeLessThan(agent.poses[0].headY - 0.3);
  }
  expect(errors).toEqual([]);
});
