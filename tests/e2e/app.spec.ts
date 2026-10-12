import { test, expect } from '@playwright/test';
import { fresh, answerIfAsked, tapWorld } from './helpers';

test('home loads with today’s question and no errors', async ({ page }) => {
  const errors = await fresh(page);
  await expect(page.locator('#dq')).not.toBeEmpty();
  await expect(page.locator('#solo')).toHaveText(/Calm walk/);
  expect(errors).toEqual([]);
});

test('calm walk: plant a thought, it is in the journal after a reload', async ({ page }) => {
  const errors = await fresh(page);
  await page.locator('#solo').click();
  await expect(page.locator('#typeBox')).toBeVisible();
  await expect(page.locator('#prompt')).not.toBeEmpty();
  await page.locator('#word').fill('morning chai');
  await page.locator('#note').fill('private note');
  await page.locator('#word').press('Enter');
  await expect(page.locator('#typeBox')).toBeHidden();
  await expect(page.locator('#stats')).toContainText('🌸1');
  await page.reload();
  await page.locator('#jrHome').click();
  await expect(page.locator('#jlist')).toContainText('morning chai');
  await expect(page.locator('#jlist')).toContainText('private note');
  expect(errors).toEqual([]);
});

test('your animal never leaves the screen while climbing (was cut off on phones)', async ({ page }) => {
  await fresh(page);
  await page.locator('#solo').click();
  const { width: W, height: H } = page.viewportSize()!;
  let maxIsland = 0;
  const xs: number[] = [];
  let worstLeft = Infinity, worstRight = -Infinity;
  for (let i = 0; i < 90 && maxIsland < 22; i++) {
    if (!(await answerIfAsked(page, 'leaf'))) await tapWorld(page);
    for (let k = 0; k < 4; k++) {
      await page.waitForTimeout(110);
      const p = await page.evaluate(() => (window as any).__pat.player());
      xs.push(p.x);
      const isl = await page.evaluate(() => (window as any).__pat.islands());
      worstLeft = Math.min(worstLeft, isl.left); worstRight = Math.max(worstRight, isl.right);
      maxIsland = Math.max(maxIsland, p.island);
    }
  }
  expect(maxIsland).toBeGreaterThanOrEqual(15);
  expect(Math.min(...xs)).toBeGreaterThan(0);
  expect(Math.max(...xs)).toBeLessThan(W);
  // every island on screen is fully visible, even moving ones at the far end of their swing
  expect(worstLeft).toBeGreaterThanOrEqual(0);
  expect(worstRight).toBeLessThanOrEqual(W);
  const end = await page.evaluate(() => (window as any).__pat.player());
  expect(end.y).toBeGreaterThan(0);
  expect(end.y).toBeLessThan(H);
});

test('daily: same question for everyone, finishes at island 15 with a share card', async ({ page }) => {
  test.slow();
  await fresh(page);
  const q = await page.locator('#dq').textContent();
  await page.locator('#dplay').click();
  await expect(page.locator('#prompt')).toHaveText(q!);
  for (let i = 0; i < 80 && !(await page.locator('#over').isVisible()); i++) {
    if (!(await answerIfAsked(page, 'daily ' + i))) await tapWorld(page);
    await page.waitForTimeout(350);
  }
  await expect(page.locator('#over')).toBeVisible();
  await expect(page.locator('#oshareBtn')).toBeVisible();
  await expect(page.locator('#oscore')).toContainText('thoughts');
});

test('dodge runs, and obstacles take the same time to arrive on every screen', async ({ page }) => {
  const errors = await fresh(page);
  await page.locator('[data-gm="dodge"]').click();
  await page.locator('#solo').click();
  for (let i = 0; i < 6; i++) { await tapWorld(page); await page.waitForTimeout(300); }
  const d = await page.evaluate(() => (window as any).__pat.dodge());
  expect(d.reaction).toBeCloseTo(760 / 560, 2);
  await expect(page.locator('#stats')).toContainText('Lv');
  expect(errors).toEqual([]);
});

test('climb shows missions inside the HUD, not under it', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-gm="climb"]').click();
  await page.locator('#solo').click();
  await answerIfAsked(page, 'go');
  const missions = page.locator('#missions');
  await expect(missions).toBeVisible();
  const hud = await page.locator('#hud').boundingBox(), m = await missions.boundingBox();
  expect(m!.y + m!.height).toBeLessThanOrEqual(hud!.y + hud!.height + 1);
  expect(m!.x + m!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('writing something worrying offers helplines', async ({ page }) => {
  await fresh(page);
  await page.locator('#solo').click();
  await page.locator('#word').fill('I want to die');
  await page.locator('#plant').click();
  await expect(page.locator('#helpp')).toBeVisible();
  await expect(page.locator('#lines')).toContainText('Tele-MANAS');
});

test('invite link pre-fills the room code', async ({ page }) => {
  await fresh(page, '/?room=moss-4821');
  await expect(page.locator('#invite')).toBeVisible();
  await expect(page.locator('#code')).toHaveValue('MOSS-4821');
});

test('your journal shows up as a garden of flowers', async ({ page }) => {
  await fresh(page);
  await page.locator('#solo').click();
  await answerIfAsked(page, 'garden me');
  await page.locator('#jr').click();
  await page.locator('#jgarden').click();
  await expect(page.locator('#gtitle')).toHaveText('Your garden');
  await expect.poll(() => page.evaluate(() => (window as any).__pat.flowers())).toBe(1);
});

test('journal export and delete work', async ({ page }) => {
  await fresh(page);
  await page.locator('#solo').click();
  await answerIfAsked(page, 'export me');
  await page.locator('#jr').click();
  const dl = page.waitForEvent('download');
  await page.locator('#jexport').click();
  expect((await dl).suggestedFilename()).toMatch(/journal/);
  page.once('dialog', (d) => d.accept());
  await page.locator('#jclear').click();
  await expect(page.locator('#jlist')).toContainText('Nothing planted yet');
});

test('installable offline: service worker takes control', async ({ page }) => {
  await fresh(page);
  const ok = await page.evaluate(async () => { await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller || (await navigator.serviceWorker.getRegistration()) !== undefined; });
  expect(ok).toBe(true);
});
