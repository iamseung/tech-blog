import type { CollectionEntry } from 'astro:content';
import { postSchema, type PostMeta } from './post-schema';

export function validatePostSet(posts: PostMeta[]): void {
  const slugs = new Set<string>();
  const orders = new Set<string>();
  for (const input of posts) {
    const post = postSchema.parse(input);
    if (slugs.has(post.slug)) throw new Error(`중복 slug: ${post.slug}`);
    slugs.add(post.slug);
    if (post.series !== undefined) {
      const key = `${post.series}:${post.seriesOrder}`;
      if (orders.has(key)) throw new Error(`중복 시리즈 순서: ${key}`);
      orders.add(key);
    }
  }
}

export function selectPublished<T extends { data: PostMeta }>(posts: T[]): T[] {
  validatePostSet(posts.map((post) => post.data));
  return posts.filter((post) => !post.data.draft).sort((a, b) => {
    if (a.data.publishedAt !== b.data.publishedAt) return a.data.publishedAt > b.data.publishedAt ? -1 : 1;
    return a.data.slug < b.data.slug ? -1 : a.data.slug > b.data.slug ? 1 : 0;
  });
}

export async function getPublishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const { getCollection } = await import('astro:content');
  return selectPublished(await getCollection('posts'));
}
