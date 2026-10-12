import { test, expect } from '@playwright/test';
import { fresh, answerIfAsked, tapWorld } from './helpers';

// Uses the build without Supabase (port 4174): two tabs in one browser talk over BroadcastChannel,
// which exercises the exact same room protocol as online play.
test.use({ baseURL: 'http://localhost:4174' });
test.beforeEach(({}, info) => test.skip(info.project.name === 'small-phone', 'one phone profile is enough'));

test('live room: join, see each other, share words, private deep answers stay private, leave', async ({ context }) => {
  const a = await context.newPage(), b = await context.newPage();
  await fresh(a); await fresh(b);
  await a.locator('#host').click();
  await expect(a.locator('#lobby')).toBeVisible();
  const code = (await a.locator('#big').textContent())!;
  expect(code).toMatch(/^[A-Z]{4}-\d{4}$/);
  await b.locator('#code').fill(code.toLowerCase().replace('-', ' '));
  await b.locator('#join').click();
  await expect(a.locator('#who')).toContainText('is here');
  await expect(b.locator('#who')).toContainText('is here');
  // both get a question on island 0, with a share toggle that defaults on for light questions
  await expect(a.locator('#shareRow')).toBeVisible();
  await expect(a.locator('#shareWord')).toBeChecked();
  await answerIfAsked(a, 'shared hello');
  await answerIfAsked(b, 'hi back');
  for (let i = 0; i < 3; i++) { await tapWorld(a); await a.waitForTimeout(400); }
  await expect(b.locator('#who')).toContainText('is here');
  await a.locator('#menu').click();
  await expect(b.locator('#toast')).toContainText('left the game');
});

test('wrong room code explains what went wrong', async ({ page }) => {
  await fresh(page);
  await page.locator('#code').fill('MOSS-42');
  await page.locator('#join').click();
  await expect(page.locator('#msg')).toContainText('four letters, four numbers');
});
