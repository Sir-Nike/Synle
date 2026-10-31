import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile, readFile } from 'node:fs/promises';
test.beforeEach(async ({ context }, info) => {
  if (!info.title.includes('guest access')) {
    const state = JSON.parse(
      await readFile('test-results/browser-auth.json', 'utf8'),
    );
    await context.addCookies(state.cookies);
  }
});

test('URLs, back navigation, demo scoring, restore and completion', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Just exploring/ }).click();
  await expect(page).toHaveURL(/\/demo$/);
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await input.fill('colourful');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /colourful/ }),
  ).toBeVisible();
  await input.fill('colorful');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /already counts/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('4 attempts remaining')).toBeVisible();
  await input.fill('luminouus');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /Accepted as luminous/ }),
  ).toBeVisible();
  await input.fill('potato');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.getByText('All attempts', { exact: false }).click();
  await page
    .getByRole('button', { name: 'Report potato as a valid answer' })
    .click();
  await expect(
    page.getByText('Reported for review.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'End this round' }).click();
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(input).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'End this round' }).click();
    await page.getByRole('button', { name: 'End round', exact: true }).click();
    await page
      .getByRole('button', {
        name: i === 2 ? 'See your results' : 'Next word',
        exact: true,
      })
      .click();
  }
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole('button', { name: 'Copy your results' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(
    page.getByRole('heading', { name: 'Good words add up.' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole('button', { name: 'Copy your results' }),
  ).toBeVisible();
});

test('offline submission preserves input; retry restores service without a second attempt', async ({
  page,
  context,
}) => {
  await page.goto('/demo');
  await expect(
    page.getByRole('textbox', { name: 'Your answer' }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Your answer' }).fill('clever');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('connect');
  await expect(page.getByRole('textbox')).toHaveValue('clever');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('4 attempts remaining')).toBeVisible();
});

test('history renders private-account statistics, breakdowns, pagination, and expired session state', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({
      json: { enabled: true, user: { id: 'fixture', name: 'Test explorer' } },
    }),
  );
  await page.route('**/api/history?*', (r) =>
    r.fulfill({
      json: {
        entries: [
          {
            challengeId: 'test',
            date: '2026-10-30',
            number: 1,
            version: 'v1',
            total: 450,
            rounds: [
              { word: 'bright', score: 200 },
              { word: 'light', score: 150 },
              { word: 'calm', score: 100 },
            ],
          },
        ],
        days: 1,
        best: 450,
        hasMore: false,
      },
    }),
  );
  await page.goto('/history');
  await expect(page.getByText('Test explorer', { exact: true })).toBeVisible();
  await page.locator('.score-history summary').click();
  await expect(page.getByText('200 / 300')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Older' })).toBeDisabled();
  await page.route('**/api/history?*', (r) =>
    r.fulfill({ status: 401, json: { error: 'Session expired' } }),
  );
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue with Google' }),
  ).toBeVisible();
});

for (const theme of ['light', 'dark'] as const)
  for (const path of ['/', '/demo', '/history', '/about', '/login'])
    test(`axe WCAG A/AA ${theme} ${path}`, async ({ page }, info) => {
      await page.addInitScript(
        (t) => localStorage.setItem('synle:theme', t),
        theme,
      );
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      await writeFile(
        info.outputPath('axe.json'),
        JSON.stringify(result, null, 2),
      );
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    });

test('mobile layout, keyboard skip link, theme dialog focus and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to main content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/history-mobile.png',
    fullPage: true,
  });
});

test('guest access: home and daily stay open; demo and history ask for sign-in', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Just exploring/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Sign in to explore the demo' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Sign in to see your history' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Welcome to your next discovery.' }),
  ).toBeVisible();
  expect(
    await page.request
      .post('/api/start', { data: { mode: 'demo' } })
      .then((r) => r.status()),
  ).toBe(401);
  expect(await page.request.get('/api/history').then((r) => r.status())).toBe(
    401,
  );
  const c = await page.request.get('/api/challenge').then((r) => r.json());
  if (c.available)
    expect(
      await page.request
        .post('/api/start', { data: { mode: 'daily' } })
        .then((r) => r.status()),
    ).toBe(200);
  await page.goto('/demo');
  await expect(
    page.getByRole('dialog', { name: 'Sign in to explore the demo' }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: 'test-results/login-popup.png',
    fullPage: true,
  });
});

for (const theme of ['light', 'dark'] as const)
  test(`guest access: sign-in page accessibility ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (t) => localStorage.setItem('synle:theme', t),
      theme,
    );
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Welcome to your next discovery.',
    );
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
