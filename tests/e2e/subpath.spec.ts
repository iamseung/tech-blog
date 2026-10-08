import { expect, test } from '@playwright/test';
test('Markdown images and internal links work beneath a deployed base', async ({ page }) => {
  await page.goto('/tech-blog/posts/example-markdown/');
  const image = page.getByRole('img', { name: '검증용 배치 도식' });
  await expect(image).toHaveAttribute('src', '/tech-blog/images/posts/example-markdown/layout.svg');
  expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: '본문 내부 링크 예시' })).toHaveAttribute('href', '/tech-blog/posts/example-markdown/#%EC%BD%94%EB%93%9C-%EC%98%88%EC%8B%9C');
  await expect(page.getByRole('link', { name: 'Astro 공식 문서' })).toHaveAttribute('href', 'https://docs.astro.build/');
});
