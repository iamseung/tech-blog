import { getPublishedPosts } from '../lib/posts';
import { markdownText } from '../lib/markdown-text';
import { postUrl } from '../lib/urls';
export async function GET() {
  const posts = await getPublishedPosts();
  return Response.json(posts.map(({ data, body }) => ({ slug: data.slug, title: data.title, description: data.description, tags: data.tags, text: markdownText(body ?? ''), url: postUrl(data.slug) })));
}
