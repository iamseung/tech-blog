import { describe, expect, it } from 'vitest';
import { markdownText, searchPosts, type SearchDocument } from '../../src/lib/search';
const docs: SearchDocument[] = [{ slug: 'one', title: '한글 검색', description: 'Astro 기록', tags: ['설계'], text: '본문 연결', url: '/posts/one/' }];
describe('search', () => {
  it('matches Korean title, body, tags and normalized English with every token', () => {
    for (const query of ['한글', '본문', '설계', 'ASTRO', ' 한글   astro ', '한글']) expect(searchPosts(docs, query)).toEqual(docs);
    expect(searchPosts(docs, '한글 없음')).toEqual([]);
    expect(searchPosts(docs, '  ')).toEqual([]);
  });
  it('extracts Markdown text without markup or HTML scripts', () => {
    expect(markdownText('# 제목\n\n[링크](https://example.com) **본문** `code`\n\n<script>secret</script>')).toBe('제목 링크 본문 code');
  });
});
