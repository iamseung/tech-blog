import { expect, test } from '@playwright/test';
test('reserved characters in tag names retain a single route segment', async ({ page }) => {
  await page.goto('/tags/');
  await page.getByRole('link', { name: 'C/C++ 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#C/C++', exact: true })).toBeVisible();
  await expect(page.locator('.post-card')).toHaveCount(1);
  await page.getByRole('heading', { name: '예시: 기록을 연결하는 방법', exact: true }).getByRole('link').click();
  await page.locator('.post-tags').getByRole('link', { name: 'C/C++', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#C/C++', exact: true })).toBeVisible();
});
test('home cards, Korean tags, ordered series and related articles connect', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '지식과 문제 해결의 기록' })).toBeVisible();
  await expect(page.locator('.post-card')).toHaveCount(3);
  await expect(page.locator('.post-card').first().getByRole('heading')).toHaveText('예시: 기록을 연결하는 방법');
  await expect(page.locator('.post-card').filter({ hasText: '예시: Markdown 글쓰기' }).locator('img')).toHaveCount(0);
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '태그', exact: true }).click();
  await page.getByRole('link', { name: '예시 3' }).click();
  await expect(page.getByRole('heading', { name: '#예시' })).toBeVisible();
  await expect(page.locator('.post-card')).toHaveCount(3);
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '시리즈' }).click();
  await page.getByRole('link', { name: /example-writing/ }).click();
  await expect(page.locator('.post-card h2')).toHaveText(['예시: Markdown 글쓰기', '예시: 읽기 좋은 글의 구조']);
  await page.locator('.post-card').first().getByRole('heading').getByRole('link').click();
  await expect(page.getByRole('heading', { name: '함께 읽기' })).toBeVisible();
  expect((await request.get('/tags/초안검증/')).status()).toBe(404);
  expect((await request.get('/series/secret/')).status()).toBe(404);
});
for (const width of [390, 1440]) {
  test(`home layout fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.goto('/');
    await expect(page.getByRole('heading', { name: '최신 글', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}-light.png`, fullPage: true });
    await page.getByRole('button', { name: '어두운 테마로 전환' }).click();
    await page.screenshot({ path: `test-results/home-${width}-dark.png`, fullPage: true });
  });
}
