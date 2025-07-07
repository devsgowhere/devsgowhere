# DevsGoWhere

Discover events for engineers in Singapore!

## Contributing

### To make changes

1. Fork this GitHub repository.
2. Make the changes you need in a new branch.
3. Make a Pull Request to this repo.
4. Once your Pull Request has been merged, you will see the event on the website.

## To add an Organisation

### Running a script

Run this command in the main folder and follow the prompts:

```bash
make new-org
```

To abort or exit the script, press `Ctrl`+`C`.

> **Note:** If you don't have Make installed, you can run the bash script directly `bash scripts/create-org.sh`.

### Manual Steps

1. Create a new folder for your org. Use underscore ("_") instead of spaces (" ").

    ```bash
    mkdir src/content/orgs/<name_of_org>
    ```

2. Copy the template into the new folder.

    ```bash
    cp docs/org_template.md src/content/orgs/<name_of_org>/index.md
    ```

3. Edit the new markdown file with your content.
4. You can also put the image files in your org folder.

## To Add an Event

### Running a script

Run this command in the main folder and follow the prompts:

```bash
make new-event
```

To abort or exit the script, press `Ctrl`+`C`.

> **Note:** If you don't have Make installed, you can run the bash script directly `bash scripts/create-event.sh`.


### Manual Steps

1. Create a new folder for your org in the events folder. Use underscore ("_") instad of spaces (" ").

    ```bash
    mkdir src/content/events/<name_of_org>
    ```

    > **Important**: Use the same folder name as your org.

2. Create a new event folder with the event name. Use underscore ("_") instad of spaces (" ").

    ```bash
    mkdir src/content/events/<name_of_org>/<event_name>
    ```

3. Copy the template into the new folder.

    ```bash
    cp docs/event_template.md src/content/events/<name_of_org>/<event_name>/index.md
    ```

4. Edit the new markdown file with your event details.
5. You can also put the image files in your event folder.

## Developing

### To run the app locally

1. Install dependencies

    ```bash
    npm install
    ```

2. Start the app:

    ```bash
    npm run dev
    ```

    To stop the app, just press `Ctrl`+`C`.

3. To test the compilation and build of the website:

    ```bash
    npm run build
    ```

### Deployment of the Website

This repository is connected to [CloudFlare Pages](https://pages.cloudflare.com/). Any changes made to the `main` branch will be deployed to the website.
