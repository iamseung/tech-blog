import { expect, test } from '@playwright/test';
test('searches Korean body, tags and English; safely displays empty results', async ({ page }) => {
  await page.goto('/search/');
  const query = page.getByLabel('검색어', { exact: true });
  await query.fill('ASTRO');
  await expect(page.locator('#search-results a').first()).toBeVisible();
  await query.fill('코드 예시');
  await expect(page.locator('#search-results')).toContainText('Markdown 글쓰기');
  await query.fill('PRIVATE_DRAFT_CANARY');
  await expect(page.getByRole('status')).toHaveText('검색 결과가 없습니다.');
  await query.fill('<img src=x onerror=alert(1)>');
  await expect(page.getByRole('status')).toHaveText('검색 결과가 없습니다.');
  await expect(page.locator('#search-results img')).toHaveCount(0);
  await query.fill('');
  await expect(page.getByRole('status')).toHaveText('검색어를 입력해 주세요.');
});
test('renders search document titles as text', async ({ page }) => {
  await page.route('**/search-index.json', route => route.fulfill({ json: [{ slug: 'safe', title: '<img src=x onerror=alert(1)>', description: '<script>alert(1)</script>', tags: [], text: 'canary', url: '/posts/example-markdown/' }] }));
  await page.goto('/search/');
  await page.getByLabel('검색어', { exact: true }).fill('canary');
  await expect(page.locator('#search-results a')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#search-results img, #search-results script')).toHaveCount(0);
});
test('publishes public posts to search, RSS and sitemap and excludes drafts', async ({ request }) => {
  for (const path of ['/search-index.json', '/rss.xml', '/sitemap.xml']) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const text = await response.text();
    expect(text).toContain('example-markdown');
    expect(text).not.toContain('PRIVATE_DRAFT_CANARY');
    expect(text).not.toContain('example-draft-hidden');
  }
});
