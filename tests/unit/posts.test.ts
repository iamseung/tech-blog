import { describe, expect, it } from 'vitest';
import { postSchema } from '../../src/lib/post-schema';
import { selectPublished, validatePostSet } from '../../src/lib/posts';
import { validateMarkdown } from '../../src/lib/markdown-policy';

const post = (overrides = {}) => ({ title: '예시 글', description: '공개 계약 검증용 예시', slug: 'example-post', publishedAt: '2026-10-08', tags: ['예시'], draft: false, ...overrides });

describe('공개 글 계약', () => {
  it('draft_is_excluded', () => {
    expect(selectPublished([{ data: post({ slug: 'hidden', draft: true }) }, { data: post() }]).map((entry) => entry.data.slug)).toEqual(['example-post']);
  });
  it('published_posts_are_sorted_without_mutation', () => {
    const entries = [{ data: post({ slug: 'z-post' }) }, { data: post({ slug: 'old-post', publishedAt: '2025-01-01' }) }, { data: post({ slug: 'a-post' }) }];
    expect(selectPublished(entries).map((entry) => entry.data.slug)).toEqual(['a-post', 'z-post', 'old-post']);
    expect(entries[0].data.slug).toBe('z-post');
  });
  it('duplicate_slug_fails', () => { expect(() => validatePostSet([post(), post({ draft: true })])).toThrow(); });
  it('duplicate_series_order_fails', () => {
    expect(() => validatePostSet([post({ series: 'example-series', seriesOrder: 1 }), post({ slug: 'second-post', series: 'example-series', seriesOrder: 1 })])).toThrow();
  });
  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01', '0000-01-01', '2026-2-01'])('invalid_calendar_date_fails: %s', (publishedAt) => { expect(postSchema.safeParse(post({ publishedAt })).success).toBe(false); });
  it('leap_day_is_valid', () => { expect(postSchema.safeParse(post({ publishedAt: '2024-02-29' })).success).toBe(true); });
  it('updated_at_is_validated', () => { expect(postSchema.safeParse(post({ updatedAt: '2026-02-30' })).success).toBe(false); });
  it.each(['Bad-Slug', 'two words', '-prefix', 'suffix-', '한글'])('invalid_slug_fails: %s', (slug) => { expect(postSchema.safeParse(post({ slug })).success).toBe(false); });
  it('series_requires_order', () => { expect(postSchema.safeParse(post({ series: 'example-series' })).success).toBe(false); });
  it.each([0, -1, 1.5])('series_order_is_positive_integer: %s', (seriesOrder) => { expect(postSchema.safeParse(post({ series: 'example-series', seriesOrder })).success).toBe(false); });
  it('series_identifier_is_kebab_case', () => { expect(postSchema.safeParse(post({ series: 'Bad Series', seriesOrder: 1 })).success).toBe(false); });
  it('order_requires_series', () => { expect(postSchema.safeParse(post({ seriesOrder: 1 })).success).toBe(false); });
  it('cover_and_series_may_be_omitted', () => { expect(postSchema.safeParse(post()).success).toBe(true); });
  it('draft_is_required_boolean', () => {
    const { draft: _draft, ...withoutDraft } = post();
    expect(postSchema.safeParse(withoutDraft).success).toBe(false);
    expect(postSchema.safeParse(post({ draft: 'false' })).success).toBe(false);
  });
  it('cover_is_scoped_to_its_post_and_requires_alt', () => {
    expect(postSchema.safeParse(post({ cover: { src: '/images/posts/example-post/cover.png', alt: '예시 표지' } })).success).toBe(true);
    for (const src of ['/images/posts/another-post/cover.png', '/images/posts/example-post/../secret.png', 'https://example.com/image.png']) {
      expect(postSchema.safeParse(post({ cover: { src, alt: '표지' } })).success).toBe(false);
    }
    expect(postSchema.safeParse(post({ cover: { src: '/images/posts/example-post/cover.png', alt: '' } })).success).toBe(false);
  });
  it('empty_collection_is_valid', () => { expect(() => validatePostSet([])).not.toThrow(); expect(selectPublished([])).toEqual([]); });
});

describe('Markdown 공개 정책', () => {
  it('wikilink_in_prose_fails', () => { expect(() => validateMarkdown('문장 안 [[비공개 노트|별칭]]')).toThrow(); });
  it('wikilink_in_code_is_allowed', () => { expect(() => validateMarkdown('`[[예시]]`\n\n```md\n[[예시]]\n```')).not.toThrow(); });
  it('raw_html_fails', () => { expect(() => validateMarkdown('<script>alert(1)</script>')).toThrow(); });
  it('html_in_code_is_allowed', () => { expect(() => validateMarkdown('```html\n<div>예시</div>\n```')).not.toThrow(); });
  it('standard_markdown_is_allowed', () => { expect(() => validateMarkdown('# 예시\n\n[공개 문서](https://example.com)')).not.toThrow(); });
  it('wikilink_with_inline_formatting_fails', () => { expect(() => validateMarkdown('[[**비공개 노트**]]')).toThrow(); });
  it('wikilink_in_image_alt_fails', () => {
    expect(() => validateMarkdown('![[[비공개 노트]]](/images/posts/example-post/image.png)', 'example-post')).toThrow(/비공개 위키링크/);
  });
  it('body_images_are_scoped_to_the_post', () => {
    expect(() => validateMarkdown('![예시](/images/posts/example-post/image.png)', 'example-post')).not.toThrow();
    expect(() => validateMarkdown('![예시](/images/posts/other-post/image.png)', 'example-post')).toThrow();
    expect(() => validateMarkdown('![예시](https://example.com/image.png)', 'example-post')).toThrow();
  });
  it('body_images_require_alt', () => { expect(() => validateMarkdown('![](/images/posts/example-post/image.png)', 'example-post')).toThrow(); });
  it('reference_images_are_scoped_to_the_post', () => {
    expect(() => validateMarkdown('![예시][img]\n\n[img]: /images/posts/other-post/image.png', 'example-post')).toThrow();
    expect(() => validateMarkdown('![예시][img]\n\n[img]: /images/posts/example-post/image.png', 'example-post')).not.toThrow();
  });
  it('first_reference_definition_controls_image_policy', () => {
    expect(() => validateMarkdown('![예시][img]\n\n[img]: https://example.com/private.png\n[img]: /images/posts/example-post/image.png', 'example-post')).toThrow(/본문 이미지/);
  });
  it.each(['> [img]: /images/posts/example-post/image.png', '- [img]: /images/posts/example-post/image.png'])('nested_valid_reference_definition_is_allowed: %s', (definition) => {
    expect(() => validateMarkdown(`![예시][img]\n\n${definition}`, 'example-post')).not.toThrow();
  });
});
