import { describe, expect, it } from 'vitest';
import { searchPosts, type SearchDocument } from '../../src/lib/search';
import { markdownImageUrls, markdownText } from '../../src/lib/markdown-text';
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
  it('preserves contiguous inline emphasis, links and code as searchable words', () => {
    const text = markdownText('데이터**베이스**\n\n트랜[잭션](https://example.com)\n\n캐`싱`');
    expect(text).toBe('데이터베이스 트랜잭션 캐싱');
    for (const query of ['데이터베이스', '트랜잭션', '캐싱']) expect(searchPosts([{ ...docs[0], text }], query)).toHaveLength(1);
  });
  it('extracts inline and referenced article images for the public allowlist', () => {
    expect(markdownImageUrls('![cover](/images/posts/example/cover.svg)\n\n![body][diagram]\n\n[diagram]: /images/posts/example/body.svg')).toEqual(['/images/posts/example/cover.svg', '/images/posts/example/body.svg']);
  });
});
