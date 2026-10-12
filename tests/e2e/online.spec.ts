import { test, expect } from '@playwright/test';
import { fresh } from './helpers';

// These talk to the real Supabase project, so they run once (phone profile) rather than per screen size.
test.beforeEach(({}, info) => test.skip(info.project.name !== 'phone', 'online tests run once'));

// Needs websockets to Supabase Realtime. Some sandboxes and corporate proxies block them, so opt in with E2E_REALTIME=1.
test('two devices play live together over the internet', async ({ browser }) => {
  test.skip(!process.env.E2E_REALTIME, 'set E2E_REALTIME=1 where websockets are allowed');
  const a = await (await browser.newContext()).newPage(), b = await (await browser.newContext()).newPage();
  await fresh(a); await fresh(b);
  await a.locator('#host').click();
  await expect(a.locator('#lobby')).toBeVisible({ timeout: 15000 });
  const code = (await a.locator('#big').textContent())!;
  expect(code).toMatch(/^[A-Z]{4}-\d{4}$/);
  await b.locator('#code').fill(code);
  await b.locator('#join').click();
  await expect(a.locator('#who')).toContainText('is here', { timeout: 15000 });
  await expect(b.locator('#who')).toContainText('is here', { timeout: 15000 });
  // a third person is turned away
  const c = await (await browser.newContext()).newPage();
  await fresh(c);
  await c.locator('#code').fill(code);
  await c.locator('#join').click();
  await expect(c.locator('#msg')).toContainText(/already has two players|No room is open/, { timeout: 15000 });
});

test('shared garden: create, plant, a friend sees it live, waters, host closes it', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  await host.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await fresh(host);
  await host.locator('#gardens').click();
  await host.locator('#gname').fill('E2E test garden');
  await host.locator('[data-k="circle"]').click();
  await host.locator('#gcreate').click();
  await expect(host.locator('#gtop')).toBeVisible({ timeout: 15000 });
  const url = host.url();
  expect(url).toMatch(/\?g=/);
  await host.locator('#gword').fill('first light');
  await host.locator('#gplant').click();
  await expect(host.locator('#gsub')).toContainText('1 thoughts', { timeout: 10000 });

  const friend = await (await browser.newContext()).newPage();
  await friend.goto(url.replace(/^https?:\/\/[^/]+/, ''));
  await expect(friend.locator('#gsub')).toContainText('1 thoughts', { timeout: 15000 });
  await expect(friend.locator('#gadmin')).toBeHidden();
  await friend.locator('#gword').fill('second bloom');
  await friend.locator('#gplant').click();
  await expect(friend.locator('#gsub')).toContainText('2 thoughts', { timeout: 10000 });
  // Arrives by live nudge, by the 15-second refresh, or when the host's tab becomes visible again.
  await host.bringToFront();
  await expect(host.locator('#gsub')).toContainText('2 thoughts', { timeout: 25000 });
  await expect(host.locator('#gsub')).toContainText('2 people');

  // host sets the question for everyone; friend sees it
  await host.locator('#gadmin').click();
  await host.locator('#gacustom').fill('What are you proud of this week?');
  await host.locator('#gaset').click();
  await host.locator('#gadone').click();
  await friend.bringToFront();
  await expect(friend.locator('#gq')).toContainText('proud of this week', { timeout: 25000 });

  await host.bringToFront();
  host.once('dialog', (d) => d.accept());
  await host.locator('#gadmin').click();
  await host.locator('#gaclose').click();
  await expect(host.locator('#home')).toBeVisible({ timeout: 10000 });
  await friend.reload();
  await expect(friend.locator('#gmsg')).toContainText('doesn’t exist', { timeout: 10000 });
});
