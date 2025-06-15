import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Glob } from 'glob';
import { pathToFileURL } from 'url';

const DEFAULT_PATH = 'cli/org-lookup/lookup_data.tsv';

export function generateOrgLookupMap(): Map<string, string> {
  const lookup = new Map<string, string>();
  // search through all event pages
  const files = new Glob('src/content/events/**/*.{md,mdx}', {});
  for (const file of files.iterateSync()) {
    const content = readFileSync(file, { encoding: 'utf8' });
    // extract domain and optional path from rsvpButtonUrl
    const match = content.match(/rsvpButtonUrl:\s*["']https:\/\/(?:www\.)?([^\/\s"']+(\/[^\/\s"']+)?)/);
    if (match) {
      const orgSlug = file.split("/")[3];
      const orgUrl = match[1];
      if (!lookup.has(orgUrl)) {
        lookup.set(orgUrl, orgSlug);
      }
    }
  }
  return lookup;
}

export function writeOrgLookupTsv(lookup: Map<string, string>, file = DEFAULT_PATH): void {
  const entries = Array.from(lookup.entries());
  const tsvString = entries.reduce((acc, [url, orgid]) => `${acc}\n${url}\t${orgid}`, 'url\torgid');
  writeFileSync(file, tsvString, 'utf-8');
}

export function readOrgLookupTsv(file = DEFAULT_PATH): Map<string, string> {
  if (!existsSync(file)) {
    throw new Error("Lookup file not found")
  }
  const tsvString = readFileSync(file, 'utf-8');
  const entries = tsvString.split("\n").slice(1).map(line => line.split("\t", 2) as [string, string])
  return new Map(entries);
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
        'create',
        'Create a new org lookup map and write it to the filesystem',
        () => {},
        argv => {
          const lookup = generateOrgLookupMap();
          writeOrgLookupTsv(lookup, argv.path);
          console.log(`✅ New org lookup map saved to ${argv.path}`);
        }
      )
      .command(
        'read',
        'Read the org lookup map from the filesystem',
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
