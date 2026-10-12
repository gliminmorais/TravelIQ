import { test, expect } from '@playwright/test';
import { demoBookings } from '../../src/lib/demo';
test('dashboard, filters, navigation, mobile layout and dark mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('Your business, in focus.')).toBeVisible();
  await expect(page.getByText('Loading your workspace…')).toBeHidden();
  await expect(page.locator('.kpi').first()).toContainText('Total revenue');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  for (const name of [
    'Bookings',
    'Customers',
    'Financials',
    'Analytics & insights',
    'Forecasting',
    'What-if simulator',
    'Documents',
    'Settings',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/dashboard.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('PDF review requires manual financial entry and explicit verification', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import ticket', exact: true }).click();
  await page
    .getByLabel('Upload ticket PDF')
    .setInputFiles('public/samples/agency-table-ticket.pdf');
  await expect(page.getByLabel('PNR / booking reference')).toHaveValue('DEMO04');
  await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue('DEV FICTION');
  await expect(page.getByLabel('Contact number', { exact: true })).toHaveValue('0000010004');
  await expect(page.getByLabel('Email (optional)', { exact: true })).toHaveValue('');
  await expect(page.getByRole('img', { name: 'Original ticket PDF page 1' })).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await page.screenshot({ path: 'docs/screenshots/pdf-review.png', fullPage: true });
  await expect(page.getByLabel('Agency cost (₹)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Customer charged (₹)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Passenger 1', { exact: true })).toHaveValue('DEV FICTION');
  await expect(page.getByText('Segment 2', { exact: true })).toBeVisible();
  await page.getByLabel('Customer name', { exact: true }).fill('Portfolio Test');
  await page.getByLabel('Contact number', { exact: true }).fill('+91 00000 99999');
  await page.getByLabel('Agency cost (₹)', { exact: true }).fill('100.10');
  await page.getByLabel('Customer charged (₹)', { exact: true }).fill('150.30');
  await page
    .getByText('I have verified the extracted details against the original ticket.')
    .click();
  await page.getByRole('button', { name: 'Create booking', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Bookings', exact: true }).click();
  await page.getByLabel('Search bookings').fill('Portfolio Test');
  await expect(page.getByRole('button', { name: 'Portfolio Test', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Portfolio Test', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('₹50.20');
  await page.getByRole('button', { name: 'Record financial entry', exact: true }).click();
  await page.getByLabel('Amount (₹)', { exact: true }).fill('50');
  await page.getByLabel('Reason / payment reference').fill('Fictional test payment');
  await page.getByRole('button', { name: 'Record entry', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('₹100.30');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.getByLabel('Search bookings').fill('Portfolio Test');
  await expect(page.getByRole('button', { name: 'Portfolio Test', exact: true })).toBeVisible();
  const isolated = await browser.newContext();
  const visitor = await isolated.newPage();
  await visitor.goto('http://localhost:3000/?view=bookings');
  await visitor.getByLabel('Search bookings').fill('Portfolio Test');
  await expect(visitor.getByRole('button', { name: 'Portfolio Test', exact: true })).toHaveCount(0);
  await isolated.close();
});
test('public source has no account or database endpoints', async ({ request }) => {
  for (const path of [
    '/api/bookings',
    '/api/documents',
    '/api/auth',
    '/api/audit',
    '/auth/callback',
    '/reset-password',
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
test('reset starts empty, stays empty after reload, and only changes this browser', async ({
  page,
  context,
  browser,
}) => {
  await page.goto('/');
  await expect(page.getByText('Loading your workspace…')).toBeHidden();
  const sibling = await context.newPage();
  await sibling.goto('/');
  await expect(sibling.getByText('Loading your workspace…')).toBeHidden();
  const otherContext = await browser.newContext();
  const visitor = await otherContext.newPage();
  await visitor.goto('http://localhost:3000/');
  const otherTotal = visitor
    .locator('.kpi')
    .filter({ hasText: 'Total bookings' })
    .locator('strong');
  await expect(otherTotal).not.toHaveText('0');
  const originalCount = await otherTotal.innerText();
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).not.toHaveText('0');
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).toHaveText('0');
  await expect(
    sibling.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).toHaveText('0');
  expect(await page.evaluate(() => localStorage.getItem('traveliq-demo-v1'))).toBe('[]');
  await page.reload();
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).toHaveText('0');
  await expect(page.locator('.recharts-area')).toHaveCount(0);
  await visitor.reload();
  await expect(otherTotal).toHaveText(originalCount);
  await otherContext.close();
  await sibling.close();
});
test('IndiGo import creates a booking; delete removes it from charts, cash and customers', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Import ticket', exact: true }).click();
  await page
    .getByLabel('Upload ticket PDF')
    .setInputFiles('public/samples/indigo-itinerary-ticket.pdf');
  await expect(page.getByLabel('PNR / booking reference')).toHaveValue('DEMO06');
  await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue('MAYA EXAMPLE');
  await expect(page.getByLabel('Passenger 3', { exact: true })).toHaveValue('TARA EXAMPLE');
  await expect(page.getByLabel('Contact number', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Email (optional)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Origin (IATA)')).toHaveValue('BOM');
  await expect(page.getByLabel('Destination (IATA)')).toHaveValue('DXB');
  await expect(page.getByLabel('Departure · local time', { exact: true })).toHaveValue(
    '2026-11-15T01:20',
  );
  await expect(page.getByRole('img', { name: 'Original ticket PDF page 1' })).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await page.getByLabel('Contact number', { exact: true }).fill('0000012345');
  await page.getByLabel('Agency cost (₹)', { exact: true }).fill('100');
  await page.getByLabel('Customer charged (₹)', { exact: true }).fill('150');
  await page
    .getByText('I have verified the extracted details against the original ticket.')
    .click();
  await page.getByRole('button', { name: 'Create booking', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).toHaveText('1');
  await page.getByRole('button', { name: 'Bookings', exact: true }).click();
  await page.getByRole('button', { name: 'MAYA EXAMPLE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record financial entry', exact: true }).click();
  await page.getByLabel('Amount (₹)', { exact: true }).fill('50');
  await page.getByLabel('Reason / payment reference').fill('Fictional partial payment');
  await page.getByRole('button', { name: 'Record entry', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('MAYA EXAMPLE');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete booking', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('traveliq-demo-v1'))).toBe('[]');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total revenue' }).locator('strong'),
  ).toHaveText('₹0.00');
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).toHaveText('0');
  await expect(page.locator('.recharts-area')).toHaveCount(0);
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await expect(page.getByText('MAYA EXAMPLE', { exact: true })).toHaveCount(0);
  await expect(page.locator('.recharts-area')).toHaveCount(0);
  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  await expect(page.getByText('MAYA EXAMPLE', { exact: true })).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('traveliq-demo-v1'))).toBe('[]');
});
test('legacy archives are excluded from graphs and can be deleted in Settings', async ({
  page,
}) => {
  const legacy = {
    ...demoBookings()[0],
    archived: true,
    bookedOn: '2026-10-01',
    customerName: 'Legacy Example',
  };
  await page.goto('/');
  await page.evaluate(
    (booking) => localStorage.setItem('traveliq-demo-v1', JSON.stringify([booking])),
    legacy,
  );
  await page.reload();
  await expect(
    page.locator('.kpi').filter({ hasText: 'Total bookings' }).locator('strong'),
  ).toHaveText('0');
  await expect(page.locator('.recharts-area')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Legacy Example', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete booking', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('traveliq-demo-v1'))).toBe('[]');
});
