/** Apply the Astro base once, preserving already encoded paths. */
export function withBase(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const base = `/${baseUrl.split('/').filter(Boolean).join('/')}`;
  const prefix = base === '/' ? '' : base;
  const normalized = `/${path.replace(/^\/+/, '')}`;
  const result = prefix && (normalized === prefix || normalized.startsWith(`${prefix}/`)) ? normalized : `${prefix}${normalized}`;
  return encodeURI(result).replace(/%25([0-9a-f]{2})/gi, '%$1');
}
export function postUrl(slug: string): string { return withBase(`/posts/${slug}/`); }
