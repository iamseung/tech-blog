import { getPublishedPosts } from '../lib/posts';
import { markdownImageUrls } from '../lib/markdown-text';
import { withBase } from '../lib/urls';

/** Publishing allowlist derived exclusively from public article bodies and cover metadata. */
export async function GET() {
  const posts = await getPublishedPosts();
  const images = posts.flatMap(post => [...markdownImageUrls(post.body ?? ''), ...(post.data.cover ? [post.data.cover.src] : [])]);
  return Response.json([...new Set(images.map(src => withBase(src)))].sort());
}
