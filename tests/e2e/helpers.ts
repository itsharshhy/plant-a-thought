import { expect, type Page } from '@playwright/test';

export async function fresh(page: Page, path = '/') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_NETWORK_CHANGED/.test(m.text())) errors.push(m.text()); });
  await page.goto(path);
  await expect(page.locator('#home')).toBeVisible();
  return errors;
}

/** Answer the question box if it is open. Returns true if it answered. */
export async function answerIfAsked(page: Page, word: string) {
  if (await page.locator('#typeBox').isVisible()) {
    await page.locator('#word').fill(word);
    await page.locator('#plant').click();
    await expect(page.locator('#typeBox')).toBeHidden();
    return true;
  }
  return false;
}

export const tapWorld = (page: Page) => page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height * 0.45);
