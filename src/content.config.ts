import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";
import { DEFAULT_TIMEZONE } from "./consts";

const events = defineCollection({
  loader: glob({ base: "./src/content/events", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => {
    return z.object({
      title: z.string(),
      description: z.string(),
      venue: z.string().optional().nullable(),
      venueAddress: z.string().optional().nullable(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD."),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format. Use HH:MM in 24-hour format."),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD.").optional().nullable(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format. Use HH:MM in 24-hour format.").optional().nullable(),
      timezone: z.string().optional().default(DEFAULT_TIMEZONE), 
      updatedDate: z.coerce.date().optional().nullable(),
      heroImage: image(),
      rsvpButtonUrl: z.string().url().optional().nullable(),
      rsvpButtonText: z.string().optional().nullable(),
      tags: z.array(z.string()).optional(),
      org: reference("orgs"),
    })
  }
});


const orgs = defineCollection({
  loader: glob({ base: "./src/content/orgs", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional().nullable(),
      heroImage: image(),
      logoImage: image().optional().nullable(),
      tags: z.array(z.string()).optional(),
      // links
      website: z.string().url().optional().nullable(),
      twitter: z.string().url().optional().nullable(),
      facebook: z.string().url().optional().nullable(),
      instagram: z.string().optional().nullable(), // collect instagram handle instead of url
      linkedin: z.string().url().optional().nullable(),
      youtube: z.string().url().optional().nullable(),
      tiktok: z.string().url().optional().nullable(),
      discord: z.string().url().optional().nullable(),
      github: z.string().url().optional().nullable(),
      telegram: z.string().url().optional().nullable(),
      meetup: z.string().url().optional().nullable(),
    }),
});

export const collections = { events, orgs };
