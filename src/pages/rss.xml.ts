import { getPublishedPosts } from '../lib/posts';
import { postUrl, withBase } from '../lib/urls';
import { escapeXml } from '../lib/xml';
import { siteConfig } from '../config/site';
import type { APIContext } from 'astro';
export async function GET({ site }: APIContext) {
  if (!site) throw new Error('RSS 생성을 위한 SITE_URL이 필요합니다.');
  const posts = await getPublishedPosts();
  const absolute = (path: string) => escapeXml(new URL(path, site).href);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(siteConfig.title)}</title><description>${escapeXml(siteConfig.description)}</description><link>${absolute(withBase('/'))}</link><language>ko</language>${posts.map(({ data }) => `<item><title>${escapeXml(data.title)}</title><description>${escapeXml(data.description)}</description><link>${absolute(postUrl(data.slug))}</link><guid isPermaLink="true">${absolute(postUrl(data.slug))}</guid><pubDate>${new Date(data.publishedAt).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
