import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";

const events = defineCollection({
  loader: glob({ base: "./src/content/events", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      venue: z.string().optional().nullable(),
      venueAddress: z.string().optional().nullable(),
      startDate: z.coerce.date(),
      startTime: z.string(),
      endDate: z.coerce.date().optional(),
      endTime: z.string().optional(),
      updatedDate: z.coerce.date().optional().nullable(),
      heroImage: image(),
      rsvpButtonUrl: z.string().url().optional().nullable(),
      rsvpButtonText: z.string().optional().nullable(),
      tags: z.array(z.string()).optional(),
      org: reference("orgs"),
    }),
});

const orgs = defineCollection({
  loader: glob({ base: "./src/content/orgs", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional().nullable(),
      heroImage: image(),
      tags: z.array(z.string()).optional(),
    }),
});

export const collections = { events, orgs };
