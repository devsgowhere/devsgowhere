# DevSGoWhere Event Creator CLI

A command-line interface tool for creating events on the DevSGoWhere website. This CLI supports three methods for creating events:

1. **Manual Input** - Enter event details manually through interactive prompts
2. **URL Scraping (Prompt)** - Extract event details from an event URL
3. **URL Scraping (Auto)** - Automated event creation for CI environments (no user input required)

## Installation

The CLI dependencies are already installed with the project. Make sure you have run:

```bash
npm install
```

## Supported Event Platforms

The scraper is designed to work with the following event platforms:

- **Meetup.com** - Full support for event details, venue, description, tags, and images

## How it Works

### Manual Input Mode

Run using without any arguments:

```bash
# using npm script
npm run create-event
# or direct execution
npx tsx cli/index.ts
```

1. Select "Manual Input" from the main menu
2. Choose an organization from the list or enter a new one
3. Fill in all the required event details

### URL Scraping Mode (With Manual Input)

Run using without any arguments:

```bash
# using npm script
npm run create-event
# or direct execution
npx tsx cli/index.ts
```

1. Select "URL Scraping" from the main menu
2. Enter the event URL (e.g. https://www.meetup.com/...)
3. The CLI will attempt to extract event details
4. Choose an organization from the list or enter a new one
5. Review and complete the extracted information
6. Fill in any missing details

### URL Scraping Mode (Fully Automated - CI Mode)

Run with `--eventURL` and `--orgID` parameters:

```bash
# using npm script
npm run create-event -- --eventURL=https://www.meetup.com/singapore-js/events/123456789/ --orgID=singaporejs
# or direct execution
npx tsx cli/index.ts --eventURL=https://www.meetup.com/singapore-js/events/123456789/ --orgID=singaporejs
```

The CLI will run the scrapper to pull event data from the web page and generate the event folder and content files.

## Usage

### Interactive Mode (Recommended for local development)

#### Method 1: Using npm script

```bash
npm run create-event
```

#### Method 2: Direct execution

```bash
npx tsx cli/index.ts
```

#### Method 3: Node execution

```bash
node --loader tsx/esm cli/index.ts
```

### Command Line Options

The CLI uses yargs for robust argument parsing and provides the following options:

```bash
npx tsx cli/index.ts [options]
```

**Available Options:**

- `--eventURL` (string): Event URL to scrape data from
- `--orgID` (string): Organization ID for the event (must match existing org folder)
- `--headless, -H` (boolean): Run browser in headless mode (default: true)
- `--output-dir` (string): Directory for scraper output files (default: "scraper-output")
- `--help, -h`: Show help information
- `--version`: Show version number

**Examples:**

```bash
# Create an event for an org by scraping from an URL
npx tsx cli/index.ts --eventURL=https://www.meetup.com/singapore-js/events/123456789/ --orgID=singaporejs

# Show help
npx tsx cli/index.ts --help
```
