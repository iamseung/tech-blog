import type { APIContext } from 'astro';
import { getPublishedPosts } from '../lib/posts';
import { groupByTag, groupBySeries, tagSegment } from '../lib/taxonomy';
import { withBase } from '../lib/urls';
import { escapeXml } from '../lib/xml';
export async function GET({ site }: APIContext) {
  if (!site) throw new Error('사이트맵 생성을 위한 SITE_URL이 필요합니다.');
  const posts = await getPublishedPosts();
  const paths = ['/', '/about/', '/search/', '/tags/', '/series/', ...posts.map(p => `/posts/${p.data.slug}/`), ...[...groupByTag(posts).keys()].map(tag => `/tags/${encodeURIComponent(tagSegment(tag))}/`), ...[...groupBySeries(posts).keys()].map(series => `/series/${series}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${escapeXml(new URL(withBase(path), site).href)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
