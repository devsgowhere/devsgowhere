# DevsGoWhere

Discover events for engineers in Singapore!

## To make changes

1. Fork this GitHub repository.
2. Make the changes you need in a new branch.
3. Make a Pull Request to this repo.
4. Once your Pull Request has been merged, you will see the event on the website.

## To Add an Organisation

1. Create a new folder for your org. Use underscore ("_") instad of spaces (" ").

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

