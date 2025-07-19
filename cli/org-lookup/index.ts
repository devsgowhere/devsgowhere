import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Glob } from 'glob';
import { pathToFileURL } from 'url';
import { z } from "zod";

import { parseFrontmatter } from '../../src/utils/fileUtils';

// Default path to save the lookup data
const DEFAULT_PATH = 'cli/org-lookup/lookup_data.tsv';

// Schema for parsing the raw frontmatter data
const FRONTMATTER_SCHEMA = z.object({ meetup: z.string().url().optional().nullable() });

/**
 * Regex for parsing event urls that:
 * - Start with https://
 * - Domain may or may not start with 'www.'
 * 
 * It extracts the domain and one optional path segment
 * 
 * Examples:
 *  - "https://www.meetup.com/r-user-group-sg/" -> "meetup.com/r-user-group-sg"
 *  - "https://www.meetup.com/wordpress-singapore/?utm_medium=referral&utm_campaign=groupHome&utm_source=twitter" -> "meetup.com/wordpress-singapore"
*/
const URL_REGEX = /https:\/\/(?:www\.)?([^\/\s"']+(\/[^\/\s"']+)?)/;

function getOrgUrl(url: string): string | undefined {
  return url.match(URL_REGEX)?.[1]
}

export function generateOrgLookupMap(): Map<string, string> {
  const lookup = new Map<string, string>();
  // search through all org pages
  const files = new Glob('src/content/orgs/**/*.{md,mdx}', {});
  for (const file of files.iterateSync()) {
    // get meetup url from frontmatter
    const rawData = parseFrontmatter(file);
    const { meetup: meetupUrl } = FRONTMATTER_SCHEMA.parse(rawData);
    if (meetupUrl) {
      // extract domain and optional path segment from meetup url
      const orgUrl = getOrgUrl(meetupUrl);
      if (orgUrl && !lookup.has(orgUrl)) {
        // add org url and id to lookup
        const orgId = file.split("/")[3];
        lookup.set(orgUrl, orgId);
      }
    }
  }
  return lookup;
}

export function writeOrgLookupTsv(lookup: Map<string, string>, path = DEFAULT_PATH): void {
  if (!path.endsWith('.tsv')) {
    throw new Error('The path must end with a .tsv extension');
  }
  const entries = Array.from(lookup.entries());
  // combine all entries into a single string with tab-separated key-values on each line
  const tsvString = entries.reduce((acc, [url, org_id]) => `${acc}\n${url}\t${org_id}`, 'url\torg_id');
  writeFileSync(path, tsvString, 'utf-8');
}

export function readOrgLookupTsv(path = DEFAULT_PATH): Map<string, string> {
  if (!path.endsWith('.tsv')) {
    throw new Error('The path must end with a .tsv extension');
  }
  if (!existsSync(path)) {
    throw new Error("Lookup file not found");
  }
  const tsvString = readFileSync(path, 'utf-8');
  // split tab-separated entries on every line
  const entries = tsvString.split("\n").slice(1).map(line => line.split("\t", 2) as [string, string]);
  return new Map(entries);
}

export function lookupOrgId(url: string): string | null {
  const lookup = readOrgLookupTsv();
  const orgUrl = getOrgUrl(url);
  if (orgUrl) {
    const orgId = lookup.get(orgUrl);
    if (orgId) {
      return orgId;
    }
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const yargs = (await import('yargs')).default;
    const { hideBin } = await import('yargs/helpers');

    yargs(hideBin(process.argv))
      .scriptName('org-lookup')
      .usage('$0 <command>')
      .option('path', {
        alias: 'p',
        type: 'string',
        describe: 'Path to the TSV file for org lookup data',
        default: DEFAULT_PATH,
        coerce: (path) => {
          if (!path.endsWith('.tsv')) {
            throw new Error('The path must end with a .tsv extension');
          }
          return path;
        },
      })
      .command(
        "lookup <url>",
        "Lookup an org id from an event url",
        (yargs) => {
          return yargs.positional("url", {
            describe: "Event url to lookup",
            type: "string",
            demandOption: true,
          })
        },
        argv => {
          const orgId = lookupOrgId(argv.url)
          if (!orgId) {
            console.log("🧐 Org not found")
          } else {
            console.log(`🔍 The org id for that url is: ${orgId}`)
          }
        }
      )
      .command(
        'generate',
        'Generate a new org lookup map and save it',
        () => {},
        argv => {
          const lookup = generateOrgLookupMap();
          writeOrgLookupTsv(lookup, argv.path);
          console.log(`✅ New org lookup map saved to ${argv.path}`);
        }
      )
      .command(
        'print',
        'Print out the current org lookup map',
        () => {},
        argv => {
          const lookup = readOrgLookupTsv(argv.path);
          console.log(`🔎 Org lookup map @ ${argv.path}:`);

          const maxLen = Math.max(...Array.from(lookup.keys(), k => k.length));
          for (const [key, value] of lookup) {
            console.log(`${key.padEnd(maxLen)} : ${value}`);
          }
        }
      )
      .demandCommand(1, 'You must provide a valid command')
      .version(false)
      .strict()
      .help()
      .argv;
  })();
}
