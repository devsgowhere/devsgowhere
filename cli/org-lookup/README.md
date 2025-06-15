# DevsGoWhere Org Lookup Tool

A utility/command-line interface (CLI) tool for creating and reading organisation ID lookup data based on the RSVP URLs of all events on the DevsGoWhere website.

## Installation

This tool uses the `glob` package. Make sure to install it with:

```bash
npm install
```

## Usage

This tool can be used in two different ways: run it as a script from the command line, or import and use it as a utility module.

### CLI program

There are two available commands: `read` and `create`.

#### `read`: Read org lookup data

The `read` command reads the existing lookup data and prints it to the console.

Run it with the `org-lookup` script:

```bash
npm run org-lookup
```

Use this for a quick check to see which URLs map to which org IDs.

#### `create`: Create new org lookup data

The `create` command generates a new copy of the lookup data and saves it to the given path.

Run it with the `org-lookup:create` script:

```bash
npm run org-lookup:create
```

Probably useful if a new event has been added under an organization for the first time, or if the event uses a different URL path from previous events.

#### `--path`: Change the lookup data path

By default, the lookup data is saved to `cli/org-lookup/lookup_data.tsv`.

You probably won't need this, but it's customisable anyway: you can provide the `--path` or `-p` argument to set a custom lookup data path if you wish to do so.

### Utility module

There are three available functions: `generateOrgLookupMap`, `writeOrgLookupTsv`, and `readOrgLookupTsv`.

#### `generateOrgLookupMap`: The core functionality

`generateOrgLookupMap()` contains the core logic which is used to generate the org lookup data. It takes no arguments and returns a `Map<string, string>` of URL paths to organisation IDs.

Pseudocode is as follows:

1. Search through all event pages in `src/contents/events`
2. For each event page
   1. Extract the rsvpButtonUrl from the frontmatter
   2. If the rsvpButtonUrl is absent, skip the remaining steps
   3. Extract the URL path (domain + optional path) from the rsvpButtonUrl
   4. Extract the organization ID from the event page path
   5. If the URL path is absent in the lookup data, store `url => orgId` as a new entry

Use this function to generate a fresh copy of the org lookup data based on all existing events in `src/contents/events`.

#### `writeOrgLookupTsv`: Store a copy of lookup data

`writeOrgLookupTsv(lookup, file?)` saves a copy of the `Map<string, string>` lookup data to the given `string` file path.

For ease of storage, the lookup data is stored as a *tab-separated values* (`.tsv`) file.

`file` is optional and defaults to `cli/org-lookup/lookup_data.tsv`.

#### `readOrgLookupTsv`: Read existing lookup data

`readOrgLookupTsv(file?)` reads the given `string` file path, parses it as a lookup data `.tsv` file, and returns the data as a `Map<string, string>`.

Once again, `file` is optional and defaults to `cli/org-lookup/lookup_data.tsv`.

Use this function to get a copy of the lookup data from the filesystem instead of generating it from scratch.
