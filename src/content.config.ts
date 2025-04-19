import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const events = defineCollection({
  loader: glob({ base: "./src/content/events", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      startDate: z.coerce.date(),
      startTime: z.string(),
      endDate: z.coerce.date().optional(),
      endTime: z.string().optional(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image(),
      rsvpButtonUrl: z.string().url().optional(),
      rsvpButtonText: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
});

const orgs = defineCollection({
  loader: glob({ base: "./src/content/orgs", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      heroImage: image(),
      tags: z.array(z.string()).optional(),
    }),
});

export const collections = { events, orgs };
