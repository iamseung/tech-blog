import { expect, it } from 'vitest';
import { groupByTag, groupBySeries, relatedPosts, featuredPosts, type PublishedPost } from '../../src/lib/taxonomy';
import { selectPublished } from '../../src/lib/posts';
const post = (slug: string, tags = ['예시'], publishedAt = '2026-10-08', extra = {}): PublishedPost => ({ id: slug, body: '', collection: 'posts', data: { slug, title: slug, description: '예시', tags, publishedAt, draft: false, ...extra } });
it('empty collections have no groups, related or featured posts', () => {
  expect(groupByTag([]).size).toBe(0); expect(groupBySeries([]).size).toBe(0);
  expect(featuredPosts([], ['missing'])).toEqual([]); expect(relatedPosts(post('a'), [])).toEqual([]);
});
it('normalizes Korean tags to NFC and deduplicates each post', () => {
  const a = post('a', ['한글', '한글'.normalize('NFD')]);
  expect([...groupByTag([a])]).toEqual([['한글', [a]]]);
});
it('series follow order without mutating date-sorted input', () => {
  const posts = [post('second', [], '2026-10-09', { series: 'writing', seriesOrder: 2 }), post('first', [], '2026-10-08', { series: 'writing', seriesOrder: 1 }), post('standalone')];
  expect(groupBySeries(posts).get('writing')?.map(p => p.data.slug)).toEqual(['first', 'second']);
  expect(posts[0].data.slug).toBe('second');
});
it('related posts rank distinct shared tags then date, exclude self and unrelated, limit three', () => {
  const current = post('current', ['예시', '한글']);
  const posts = [current, post('recent', ['예시'], '2026-10-09'), post('best', ['예시', '한글']), post('old', ['예시'], '2026-01-01'), post('older', ['예시'], '2025-01-01'), post('unrelated', ['기타'])];
  expect(relatedPosts(current, posts).map(p => p.data.slug)).toEqual(['best', 'recent', 'old']);
});
it('draft-only taxonomy and configured draft feature are absent from published input', () => {
  const published = selectPublished([post('public'), post('hidden', ['초안검증'], '2026-10-09', { draft: true, series: 'secret', seriesOrder: 1 })]);
  expect(groupByTag(published).has('초안검증')).toBe(false); expect(groupBySeries(published).has('secret')).toBe(false);
  expect(featuredPosts(published, ['hidden', 'public', 'public']).map(p => p.data.slug)).toEqual(['public']);
});
