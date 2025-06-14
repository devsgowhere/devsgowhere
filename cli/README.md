# DevSGoWhere Event Creator CLI

A command-line interface tool for creating events on the DevSGoWhere website. This CLI supports two methods for creating events:

1. **Manual Input** - Enter event details manually through interactive prompts
2. **URL Scraping** - Extract event details from an event URL using Puppeteer

## Installation

The CLI dependencies are already installed with the project. Make sure you have run:

```bash
npm install
```

## Usage

### Method 1: Using npm script (Recommended)

```bash
npm run create-event
```

### Method 2: Direct execution

```bash
npx tsx cli/index.ts
```

### Method 3: Node execution

```bash
node --loader tsx/esm cli/index.ts
```

## How it Works

### Manual Input Mode

1. Select "Manual Input" from the main menu
2. Choose an organization from the list or enter a new one
3. Fill in all the required event details.

### URL Scraping Mode

1. Select "URL Scraping" from the main menu
2. Enter the event URL (e.g. https://www.meetup.com/...)
3. The CLI will attempt to extract event details.
4. Review and complete the extracted information
5. Fill in any missing details

## Supported Event Platforms

The scraper is designed to work with the following event platforms:
- **Meetup.com**
