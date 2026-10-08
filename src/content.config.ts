import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema, type PostMeta } from './lib/post-schema';
import { validatePostSet } from './lib/posts';

const fixtureMode = import.meta.env.MODE === 'test' || import.meta.env.MODE === 'demo';
const fileLoader = glob({
  pattern: '**/*.md',
  base: fixtureMode ? './tests/fixtures/posts' : './src/content/posts',
  // Keep source IDs distinct so duplicate frontmatter slugs cannot overwrite entries.
  generateId: ({ entry }) => entry.replace(/\.md$/, ''),
});

const posts = defineCollection({
  loader: {
    ...fileLoader,
    async load(context) {
      await fileLoader.load(context);
      validatePostSet([...context.store.values()].map((entry) => postSchema.parse(entry.data) as PostMeta));
    },
  },
  schema: postSchema,
});

export const collections = { posts };
