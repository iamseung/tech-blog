import { expect, test } from '@playwright/test';
test('search and publishing metadata retain deployment base', async ({ page, request }) => {
  await page.goto('/tech-blog/search/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://example.com/tech-blog/search/');
  await page.getByLabel('검색어', { exact: true }).fill('코드 예시');
  await expect(page.locator('#search-results a')).toHaveAttribute('href', '/tech-blog/posts/example-markdown/');
  for (const path of ['rss.xml', 'sitemap.xml']) {
    const text = await (await request.get(`/tech-blog/${path}`)).text();
    expect(text).toContain('https://example.com/tech-blog/posts/example-markdown/');
  }
});
test('Markdown images and internal links work beneath a deployed base', async ({ page }) => {
  await page.goto('/tech-blog/posts/example-markdown/');
  const image = page.getByRole('img', { name: '검증용 배치 도식' });
  await expect(image).toHaveAttribute('src', '/tech-blog/images/posts/example-markdown/layout.svg');
  expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: '본문 내부 링크 예시' })).toHaveAttribute('href', '/tech-blog/posts/example-markdown/#%EC%BD%94%EB%93%9C-%EC%98%88%EC%8B%9C');
  await expect(page.getByRole('link', { name: 'Astro 공식 문서' })).toHaveAttribute('href', 'https://docs.astro.build/');
});
test('discovery links and cover retain deployment base', async ({ page }) => {
  await page.goto('/tech-blog/');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '태그', exact: true }).click();
  await page.getByRole('link', { name: '예시 3' }).click();
  await expect(page).toHaveURL(/\/tech-blog\/tags\/%EC%98%88%EC%8B%9C\//);
  await page.getByRole('heading', { name: '예시: 읽기 좋은 글의 구조', exact: true }).getByRole('link').click();
  await expect(page).toHaveURL(/\/tech-blog\/posts\/example-structure\//);
  const cover = page.getByRole('img', { name: '검증용 글 구조 도식' });
  await expect(cover).toHaveAttribute('src', '/tech-blog/images/posts/example-structure/cover.svg');
  expect(await cover.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
test('post to tag and search navigation plus slash tags work under base', async ({ page, request }) => {
  await page.goto('/tech-blog/');
  await page.getByRole('heading', { name: '예시: Markdown 글쓰기', exact: true }).getByRole('link').click();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://example.com/tech-blog/posts/example-markdown/');
  await page.locator('.post-tags').getByRole('link', { name: '예시', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#예시', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '검색', exact: true }).click();
  await page.getByLabel('검색어', { exact: true }).fill('코드 예시');
  await page.locator('#search-results a').click();
  await expect(page).toHaveURL(/\/tech-blog\/posts\/example-markdown\/$/);
  await page.goto('/tech-blog/tags/');
  await page.getByRole('link', { name: 'C/C++ 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#C/C++', exact: true })).toBeVisible();
  expect((await request.get('/tech-blog/posts/example-draft-hidden/')).status()).toBe(404);
  expect((await request.get('/tech-blog/tags/초안검증/')).status()).toBe(404);
  for (const path of ['search-index.json', 'rss.xml', 'sitemap.xml']) {
    const response = await request.get(`/tech-blog/${path}`);
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).not.toContain('PRIVATE_DRAFT_CANARY');
    expect(body).not.toContain('example-draft-hidden');
  }
});
