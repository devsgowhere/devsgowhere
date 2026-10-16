# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DevsGoWhere (https://devsgowhere.com) — a static Astro 5 site listing tech events in Singapore. Most changes are content (Markdown files for orgs and events); the code side is the Astro site plus a TypeScript CLI that scrapes event pages into content files.

## Commands

```bash
npm install
npm run dev            # astro dev --host
npm run build          # astro build → dist/ (also validates all content frontmatter against the schemas)
npm run preview
npm test               # vitest run (CLI parser tests)
npx vitest run cli/parsers/LumaParser.test.ts   # single test file
npx vitest run -t "GeekBrunchSG"                # single test by name
npm run format         # prettier --write (120 cols, no semicolons, double quotes)

npm run create-event   # interactive CLI (manual entry or scrape from URL)
npm run create-event -- --eventURL=<url> --orgID=<org_folder>   # non-interactive scrape (used by CI)
npm run discover-events -- --dry-run [--org=<org_id>] [--days=60]  # list new events from orgs' Meetup/Luma pages (drop --dry-run to write them)
make create-org        # interactive org creation (scripts/create-org.sh)
bash scripts/list-orgs.sh        # list valid org IDs
bash scripts/find-event-urls.sh  # list every rsvpButtonUrl already in content (check for duplicates before adding)
```

CI and the devcontainer use Node 22.

The parser tests hit live event URLs (Meetup/Luma/Eventbrite) via `PageScraper.getPage`, so they need network access and can break when the remote page changes or the event is removed.

## Content model

Defined in `src/content.config.ts` (two collections, glob-loaded):

- **orgs**: `src/content/orgs/<org_id>/index.md`. The folder name is the org ID.
- **events**: `src/content/events/<org_id>/<YYYYMMDD-slug>/index.md`. `org` frontmatter is a `reference("orgs")` and must match an existing org folder name; the event's parent folder uses the same org ID.
- `startDate` must be `YYYY-MM-DD`, `startTime` `HH:MM` (24h), strings not dates. `timezone` defaults to `Asia/Singapore`.
- `heroImage` is required and goes through Astro's `image()` — use a file colocated in the event/org folder, or `../../../../public/org-placeholder.png`.
- Templates: `docs/event_template.md`, `docs/org_template.md`.

Schema violations fail `npm run build`, so build after adding/editing content.

"Upcoming vs past" is decided against the current date at build time, in several places: `src/pages/events/index.astro`, `events/search-index.json.ts`, `orgs/[...slug].astro`, and `rss.xml.js`. That's why a nightly workflow rebuilds and redeploys daily. Change all of them together.

## Event scraper CLI (`cli/`)

- `cli/index.ts` parses args (yargs); when both `--eventURL` and `--orgID` are given it runs in auto mode with no prompts. In auto mode, if `--orgID` doesn't match an existing org folder, it **creates the org** by scraping an org page (`EventCLI.autoCreateNewOrg`). For Meetup this is the group page inferred from the event URL; for other hosts it scrapes the event URL itself. A typo in the org ID therefore produces a new org, not an error.
- `EventCLI` drives prompts (inquirer) → `PageScraper` fetches the page into cheerio and picks a parser by URL host → `EventWriter` writes `src/content/events/<org>/<YYYYMMDD-slug>/index.md` (slug from start date + title, capped at 100 chars) and copies the downloaded hero image alongside. `OrgWriter` does the same for orgs.
- Parsers in `cli/parsers/` extend `BaseParser` (shared Turndown HTML→Markdown conversion, image download). Supported: Meetup, Luma (`lu.ma`/`luma.com`), Eventbrite. To add a platform, add a parser and a case in `PageScraper.getParser`.
- Raw HTML and downloaded images go to `scraper-output/` (gitignored except `.gitkeep`).

## Site structure

- `src/pages/` — routes: `events/[...slug]`, `events/tag/[tag]`, `orgs/[...slug]`, plus JSON search indexes (`*/search-index.json.ts`), `orgs/list-orgs.txt.ts`, and `rss.xml.js`.
- `src/layouts/` — `EventPost`, `OrgPage`, `Theme`. React islands in `src/components/*.tsx` (add-to-calendar button, OneMap).
- `src/consts.ts` — site title, default timezone, theme, GTM ID.

## CI / deployment (`.github/workflows/`)

Deploys to Cloudflare Pages via reusable `build-template.yml` + `deploy-template.yml`:

- PRs to `main` → preview deploy (same-repo PRs only).
- Push to `main` → production.
- Nightly cron (00:01 SGT) → rebuild + production deploy so past events drop off.
- `event-discovery.yml` (daily 06:00 SGT, or manual) runs `cli/discover.ts`: reads each org's `meetup`/`website` frontmatter, lists upcoming events from Meetup group `/events/` pages and Luma calendar pages (`__NEXT_DATA__`; Luma events outside `Asia/Singapore` are skipped), drops ones whose `rsvpButtonUrl` already exists (`eventKey` normalises lu.ma/luma.com and Meetup IDs), scrapes the rest with the normal parsers, builds, and opens/refreshes one PR on the fixed branch `event-discovery/auto`. That branch is regenerated from `main` on every run, so edits pushed to it are overwritten — merge or fix on `main`. When the PR is created or its events change, `scripts/notify-telegram.sh` posts the event list to Telegram (repo secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; skipped with a warning if unset; `DRY_RUN=1` prints the message locally).
- `event-scrapper.yml` runs the CLI in auto mode and opens a PR on branch `event-scrapper/<run_id>-<attempt>`. It's triggered manually or via `google-form-webhook.yml` (`repository_dispatch` from a Google Form; see `scripts/Code.gs`, `docs/webhook.http`).
