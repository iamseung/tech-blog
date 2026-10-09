import { expect, test } from '@playwright/test';

test('Unicode and space filenames load as cover and body images at root', async ({ page, request }) => {
  await page.goto('/posts/example-markdown/');
  const src = '/images/posts/example-markdown/%ED%95%9C%EA%B8%80%20diagram.svg';
  for (const name of ['한글 파일명 표지 도식', '한글 파일명 본문 도식']) {
    const image = page.getByRole('img', { name, exact: true });
    await expect(image).toHaveAttribute('src', src);
    await expect(image).toBeVisible();
    expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  expect((await request.get(src)).ok()).toBe(true);
});

for (const width of [390, 1440]) {
  test(`post remains readable at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/posts/example-markdown/');
    await expect(page.getByRole('heading', { name: '예시: Markdown 글쓰기', exact: true })).toBeVisible();
    const toc = page.getByRole('navigation', { name: '글 목차' }).filter({ visible: true });
    if (width === 390) await page.locator('.mobile-toc summary').click();
    await toc.getByRole('link', { name: '코드 예시' }).click();
    await expect(page).toHaveURL((url) => decodeURIComponent(url.hash) === '#코드-예시');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: '코드 복사' }).click();
    await expect(page.getByRole('status')).toContainText('복사했습니다');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("const message = '안녕하세요';");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '어두운 테마로 전환' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ path: `test-results/post-${width}-dark.png`, fullPage: true });
    await page.getByRole('button', { name: '밝은 테마로 전환' }).click();
    expect(await page.locator('.post-body pre code span.line').last().evaluate((line) => {
      const colors = [...line.querySelectorAll('span')].map((token) => getComputedStyle(token).color.match(/\d+/g)!.map(Number));
      return colors.every(([red, green, blue]) => (red + green + blue) / 3 < 180);
    })).toBe(true);
    await page.screenshot({ path: `test-results/post-${width}-light.png`, fullPage: true });
  });
}
test('system theme is used before a saved preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/posts/example-markdown/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('clipboard failure is explained', async ({ page }) => {
  await page.goto('/posts/example-markdown/');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } }));
  await page.getByRole('button', { name: '코드 복사' }).click();
  await expect(page.getByRole('status')).toContainText('복사하지 못했습니다');
});
