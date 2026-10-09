import { expect, test } from '@playwright/test';

test('home to post, tag and search retains root URLs and public origin', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: '예시: Markdown 글쓰기', exact: true }).getByRole('link').click();
  await expect(page).toHaveURL(/\/posts\/example-markdown\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://example.com/posts/example-markdown/');
  const image = page.getByRole('img', { name: '검증용 배치 도식' });
  expect((await request.get(await image.getAttribute('src') as string)).ok()).toBe(true);
  await page.locator('.post-tags').getByRole('link', { name: '예시', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#예시', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '검색', exact: true }).click();
  await page.getByLabel('검색어', { exact: true }).fill('코드 예시');
  await page.locator('#search-results a').click();
  await expect(page).toHaveURL(/\/posts\/example-markdown\/$/);
  const rss = await request.get('/rss.xml');
  expect(rss.ok()).toBe(true);
  expect(await rss.text()).toContain('https://example.com/posts/example-markdown/');
  expect((await request.get('/posts/example-draft-hidden/')).status()).toBe(404);
});
