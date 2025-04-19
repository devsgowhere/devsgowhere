import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const events = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/events", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Transform string to Date object
      eventDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image(),
      rsvpButtonUrl: z.string().url().optional(),
      rsvpButtonText: z.string().optional(),
    }),
});

export const collections = { events };
