#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { EventCLI } from './EventCLI';
import type { EventCLIOptions } from './types';

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
	.option('eventURL', {
		type: 'string',
		description: 'Event URL to scrape data from'
	})
	.option('orgID', {
		type: 'string',
		description: 'Organization ID for the event'
	})
	.option('headless', {
		alias: 'H',
		type: 'boolean',
		default: true,
		description: 'Run browser in headless mode'
	})
    .option('sandbox', {
        type: 'boolean',
        default: true,
		description: 'Run browser in sandbox mode (should be disabled for CI environments)'
    })
	.option('output-dir', {
		type: 'string',
		default: 'scraper-output',
		description: 'Directory for scraper output files'
	})
	.help()
	.alias('help', 'h')
	.parseSync();

const cliOptions: EventCLIOptions = {
	eventURL: argv.eventURL as string | undefined,
	orgID: argv.orgID as string | undefined,
	headlessMode: argv.headless as boolean,
	noSandbox: argv.sandbox as boolean,
	outputDir: argv['output-dir'] as string
}

// Check if we are in auto-scrape mode?
cliOptions.autoScrapeMode = !!cliOptions.eventURL && !!cliOptions.orgID; // true if both eventUrl and orgId are provided

console.log(`Headless mode: ${cliOptions.headlessMode}`);
console.log(`No sandbox mode: ${cliOptions.noSandbox}`);
console.log(`Output directory: ${cliOptions.outputDir}`);

// configure location for scraper output
const SCRAPER_OUTPUT_DIR = path.join(process.cwd(), cliOptions.outputDir!);
// ensure the output directory exists
fs.mkdir(SCRAPER_OUTPUT_DIR, { recursive: true })
	.catch(err => {
		console.error('Error creating scraper output directory:', err);
		process.exit(1);
	}
	);

cliOptions.outputDir = SCRAPER_OUTPUT_DIR

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	const cli = new EventCLI();
	cli.run(cliOptions).catch(console.error);
}

export default EventCLI;
