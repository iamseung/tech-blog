import { z } from 'astro/zod';

const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requiredText = z.string().trim().min(1);
const calendarDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '실제 달력의 YYYY-MM-DD 날짜를 입력하세요.');

export function isPostImagePath(src: string, slug: string): boolean {
  const prefix = `/images/posts/${slug}/`;
  if (!src.startsWith(prefix)) return false;
  return src.slice(prefix.length).split('/').every((segment) => {
    try {
      // Decode each segment independently so escaped separators cannot create new directories.
      const decoded = decodeURIComponent(segment);
      return decoded.length > 0 && decoded !== '.' && decoded !== '..' &&
        !/[\/\\%?#\u0000-\u001f\u007f]/.test(decoded);
    } catch { return false; }
  });
}

export const postSchema = z.object({
  title: requiredText,
  description: requiredText,
  slug: z.string().regex(kebabCase),
  publishedAt: calendarDate,
  updatedAt: calendarDate.optional(),
  tags: z.array(requiredText),
  series: z.string().regex(kebabCase).optional(),
  seriesOrder: z.number().int().positive().optional(),
  draft: z.boolean(),
  cover: z.object({ src: requiredText, alt: requiredText }).strict().optional(),
}).strict().superRefine((post, context) => {
  if ((post.series !== undefined) !== (post.seriesOrder !== undefined)) {
    context.addIssue({ code: 'custom', path: ['seriesOrder'], message: '시리즈와 양의 정수 순서를 함께 입력하세요.' });
  }
  if (post.cover && !isPostImagePath(post.cover.src, post.slug)) {
    context.addIssue({ code: 'custom', path: ['cover', 'src'], message: '이미지는 /images/posts/<slug>/ 아래에 있어야 합니다.' });
  }
});

export type PostMeta = z.infer<typeof postSchema>;
