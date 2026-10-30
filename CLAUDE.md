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
npm run update-issue-template [-- --check]  # regenerate the issue form's organisation dropdown from src/content/orgs
bash scripts/list-orgs.sh        # list valid org IDs
bash scripts/find-event-urls.sh  # list every rsvpButtonUrl already in content (check for duplicates before adding)
```

CI, the devcontainer and `.nvmrc` use Node 24 (`engines` requires >=24).

The parser tests hit live event URLs (Meetup/Luma/Eventbrite) via `PageScraper.getPage`, so they need network access and can break when the remote page changes or the event is removed.

## Content model

Defined in `src/content.config.ts` (two collections, glob-loaded):

- **orgs**: `src/content/orgs/<org_id>/index.md`. The folder name is the org ID.
- **events**: `src/content/events/<org_id>/<YYYYMMDD-slug>/index.md`. `org` frontmatter is a `reference("orgs")` and must match an existing org folder name; the event's parent folder uses the same org ID.
- `startDate` must be `YYYY-MM-DD`, `startTime` `HH:MM` (24h), strings not dates. `timezone` defaults to `Asia/Singapore`.
- `heroImage` is required and goes through Astro's `image()` — use a file colocated in the event/org folder, or `../../../../public/org-placeholder.png`.
- Templates: `docs/event_template.md`, `docs/org_template.md`.

An event with `hidden: true` is not built or listed anywhere (use `getEvents()` from `src/utils/getEvents.ts`, never `getCollection("events")`). Keep the file rather than deleting it, so discovery still sees its `rsvpButtonUrl` and does not add it again.

Schema violations fail `npm run build`, so build after adding/editing content.

"Upcoming vs past" is decided against the current date at build time (midnight in Singapore), in several places: `src/utils/events.ts` (`upcomingEvents`, `pastEvents`, used by `events/index.astro`, `events/past/index.astro` and both search indexes), `orgs/[...slug].astro`, and `rss.xml.js`. That's why a nightly workflow rebuilds and redeploys daily. Change all of them together.

The events list (`/events/`, also the home page, and `/events/past/`) is one layout, `src/layouts/EventsListPage.astro`, with an Upcoming | Past tab switch and a search box. Each page has its own search index (`events/search-index.json`, `events/past/search-index.json`, built by `buildSearchIndex` with organiser, venue and description), the search reads `?q=` so searches can be linked, and a search shows a link to run the same words on the other tab. Both lists are paginated in the browser (`PAGE_SIZE` = 12 in `src/utils/pagination.ts`): every card is in the page, the server renders only the first page visible, and the script shows one page of the matches at a time, so search covers all pages. The page and search are kept in the address bar (`?q=…&page=2`); changing page adds a history entry, so Back works.

## Event scraper CLI (`cli/`)

- `cli/index.ts` parses args (yargs); when both `--eventURL` and `--orgID` are given it runs in auto mode with no prompts. In auto mode, if `--orgID` doesn't match an existing org folder, it **creates the org** by scraping an org page (`EventCLI.autoCreateNewOrg`). For Meetup this is the group page inferred from the event URL; for other hosts it scrapes the event URL itself. A typo in the org ID therefore produces a new org, not an error.
- `EventCLI` drives prompts (inquirer) → `PageScraper` fetches the page into cheerio and picks a parser by URL host → `EventWriter` writes `src/content/events/<org>/<YYYYMMDD-slug>/index.md` (slug from start date + title, capped at 100 chars) and copies the downloaded hero image alongside. `OrgWriter` does the same for orgs.
- Parsers in `cli/parsers/` extend `BaseParser` (shared Turndown HTML→Markdown conversion, image download). Supported: Meetup, Luma (`lu.ma`/`luma.com`), Eventbrite. To add a platform, add a parser and a case in `PageScraper.getParser`.
- Raw HTML and downloaded images go to `scraper-output/` (gitignored except `.gitkeep`).
- Meetup API (`cli/MeetupApi.ts`, GraphQL at `api.meetup.com/gql-ext`): when `MEETUP_CLIENT_ID`, `MEETUP_SIGNING_KEY_ID`, `MEETUP_PRIVATE_KEY` and `MEETUP_MEMBER_ID` are set (JWT flow; see `.env.example`, loaded from `.env` by the npm scripts, repo secrets in CI), discovery lists Meetup groups' events and `PageScraper` reads Meetup events through the API instead of scraping. The API returns the same event shape as the page's `__NEXT_DATA__`, so both go through `MeetupParser.scrapeEventDataFromEvent`. Without the variables everything falls back to scraping; setting only some of them is an error.

## Site structure

- `src/pages/` — routes: `events/[...slug]`, `events/tag/[tag]`, `orgs/[...slug]`, plus JSON search indexes (`*/search-index.json.ts`), `orgs/list-orgs.txt.ts`, and `rss.xml.js`.
- JSON feeds for other sites: `/events.json` (upcoming events) and `/events/past.json`, built from `src/utils/eventsFeed.ts` (rebuilt with every build, so daily). One object `{ version, generatedAt, events[] }`, soonest first, each event with `id`, `title`, `description`, absolute `url`, `rsvpUrl`, `start`/`end` as ISO 8601 with the UTC offset, `timezone`, `venue`, `venueAddress`, `org {id,title,url}`, `tags`, `updatedAt`; missing values are `null`, never empty strings. Engineers.SG builds its iCal feed from `/events.json`, so keep `version` at 1 unless the shape changes incompatibly (adding fields is fine), and keep event IDs stable: `id` is the event's folder (`<org_id>/<YYYYMMDD-slug>`), which becomes the iCal UID. Rescheduling an event means editing `startDate`/`startTime`, not renaming its folder.
- `src/layouts/` — `EventPost`, `OrgPage`, `Theme`. React islands in `src/components/*.tsx` (add-to-calendar button, OneMap).
- `src/consts.ts` — site title, default timezone, theme, GTM ID.

## CI / deployment (`.github/workflows/`)

Deploys to Cloudflare Pages via reusable `build-template.yml` + `deploy-template.yml`:

- PRs to `main` → preview deploy (same-repo PRs only).
- Push to `main` → production.
- Nightly cron (00:01 SGT) → rebuild + production deploy so past events drop off.
- `event-discovery.yml` (daily 06:00 SGT, or manual) runs `cli/discover.ts`: reads each org's `meetup`/`website` frontmatter, lists upcoming events from Meetup group `/events/` pages and Luma calendar pages (`__NEXT_DATA__`; Luma events outside `Asia/Singapore` are skipped), drops ones whose `rsvpButtonUrl` already exists (`eventKey` normalises lu.ma/luma.com and Meetup IDs), leaves out non-tech events (below), scrapes the rest with the normal parsers, builds, and opens/refreshes one PR on the fixed branch `event-discovery/auto`, then merges it via the API and redeploys production from the same workflow (merges made with `GITHUB_TOKEN` don't trigger `production-workflow.yml`). Manual runs can untick `auto_merge`; if the merge is refused the PR stays open. The branch is regenerated from `main` on every run, so edits pushed to it are overwritten — fix events on `main`. When the PR is created, updated or merged (or the merge fails), `scripts/notify-telegram.sh` posts the event list to Telegram (repo secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; skipped with a warning if unset; `DRY_RUN=1` prints the message locally).
- Discovery leaves out non-tech events silently (logged in the run, not in the PR or Telegram; `cli/EventFilter.ts`). An org can list `skipEvents: ["yoga", "dinner"]` in its frontmatter to skip events whose title has any of the words, and any event whose Luma categories or Meetup topics include a non-tech one (Wellness, Fitness, Arts & Culture, Food & Drink, Sports, Music, Nightlife, Social) and no tech one (AI, Tech, software…) is skipped after it's scraped. Untagged events are kept. Skipped events are looked at again every run, and aren't filtered when added by hand or from the issue forms.
- `notify-new-pr.yml` posts to Telegram (same secrets) when anyone opens a PR to `main` (`pull_request_target`, so fork PRs get the secrets; it never checks out PR code). It skips bots, drafts (notifying when they become ready) and our `event-discovery/*`, `event-scrapper/*`, `event-issue/*` and `org-issue/*` branches. `scripts/notify-telegram-pr.sh` builds the message and supports `DRY_RUN=1`.
- `notify-workflow-failure.yml` posts a Telegram alert (`scripts/notify-telegram-failure.sh`, `DRY_RUN=1` supported) when discovery, the nightly or production builds, the event scraper or the Google Form webhook fails, times out or can't start, naming the failed jobs. It uses `workflow_run`, so it only takes effect from `main`, and the list of watched workflows is by name: update it when renaming or adding a workflow. `create-event-from-issue.yml` alerts on its own failures; PR preview builds aren't watched.
- `create-event-from-issue.yml` handles two issue forms, then builds, opens or updates a PR on `event-issue/<issue>` that closes the issue, replies on the issue and notifies Telegram (also on failure). Validation problems are replied on the issue; editing the issue re-runs it. Issue text only reaches the shell via env vars or a file.
  - "Submit an event" (`.github/ISSUE_TEMPLATE/new-event.yml`, label `new-event`): validates the URL and org (`cli/check-event-request.ts` → `cli/EventRequest.ts`; Meetup, Luma or Eventbrite only, an org from the dropdown or a typed "New organisation ID" for a Meetup event, no duplicates) and runs `create-event` to scrape it.
  - "Submit an event (other websites)" (`.github/ISSUE_TEMPLATE/new-event-details.yml`, label `new-event-details`): no scraping; `cli/create-event-from-details.ts` validates the submitted fields (`cli/EventDetails.ts`) and writes the event from them, downloading the image dropped into the form (GitHub attachments only) and creating a basic org from "New organisation name" if needed. HTML in the description is escaped, since Astro renders raw HTML in Markdown.
- `create-org-from-issue.yml` handles the "Submit an organisation" form (`.github/ISSUE_TEMPLATE/new-org.yml`, label `new-org`): `cli/create-org-from-issue.ts` validates the fields (`cli/OrgDetails.ts`: name → org ID with no loose duplicate such as `ios dev scout` vs `ios-dev-scout`, a description of up to 160 characters, tags, GitHub-hosted logo and cover images) and writes the org with `OrgWriter`, then builds and opens or updates a PR on `org-issue/<issue>` that closes the issue, replies and notifies Telegram (also on failure), like the event workflow. The "Links" box takes one link per line and sorts them into org fields by host (Meetup → `meetup`; a Luma calendar, else the first other site → `website`, which daily discovery reads; Instagram → handle; the rest are listed under "More links" in the org's text).
- The forms' organisation dropdowns are generated between marker comments (`cli/IssueTemplate.ts`): `OrgWriter` and `make create-org` regenerate it when they create an org, the daily discovery PR syncs it for orgs added by hand, and a test fails when it's out of date. Run `npm run update-issue-template` after adding, renaming or removing an org.
- `event-scrapper.yml` runs the CLI in auto mode and opens a PR on branch `event-scrapper/<run_id>-<attempt>`. It's triggered manually or via `google-form-webhook.yml` (`repository_dispatch` from a Google Form; see `scripts/Code.gs`, `docs/webhook.http`).
