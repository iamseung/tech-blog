import type { getPublishedPosts } from './posts';
export type PublishedPost = Awaited<ReturnType<typeof getPublishedPosts>>[number];
export const normalizedTags = (post: PublishedPost): string[] => [...new Set(post.data.tags.map(tag => tag.normalize('NFC')))];
export function groupByTag(posts: PublishedPost[]): Map<string, PublishedPost[]> {
  const groups = new Map<string, PublishedPost[]>();
  for (const post of posts) for (const tag of normalizedTags(post)) groups.set(tag, [...(groups.get(tag) ?? []), post]);
  return groups;
}
export function groupBySeries(posts: PublishedPost[]): Map<string, PublishedPost[]> {
  const groups = new Map<string, PublishedPost[]>();
  for (const post of posts) if (post.data.series) groups.set(post.data.series, [...(groups.get(post.data.series) ?? []), post]);
  for (const entries of groups.values()) entries.sort((a, b) => a.data.seriesOrder! - b.data.seriesOrder!);
  return groups;
}
export function featuredPosts(posts: PublishedPost[], slugs: string[]): PublishedPost[] {
  return [...new Set(slugs)].flatMap(slug => posts.filter(post => post.data.slug === slug));
}
export function relatedPosts(current: PublishedPost, posts: PublishedPost[]): PublishedPost[] {
  const tags = new Set(normalizedTags(current));
  const score = (post: PublishedPost) => normalizedTags(post).filter(tag => tags.has(tag)).length;
  return posts.filter(post => post.data.slug !== current.data.slug && score(post) > 0).sort((a, b) => score(b) - score(a) || b.data.publishedAt.localeCompare(a.data.publishedAt) || a.data.slug.localeCompare(b.data.slug)).slice(0, 3);
}
