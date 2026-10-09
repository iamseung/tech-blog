import { expect, test } from '@playwright/test';
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
