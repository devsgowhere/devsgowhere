#!/bin/bash

read -p "Enter the org name: " org_name
read -p "Enter the org description: " org_description

sanitized_name=$(echo "$org_name" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '_' | sed 's/[^a-z0-9_-]//g')

folder_name="./src/content/orgs/${sanitized_name}"
mkdir -p "$folder_name"

event_folder_name="./src/content/events/${sanitized_name}"
mkdir -p "$event_folder_name"

template_file="docs/org_template.md"
if [[ ! -f "$template_file" ]]; then
  echo "Template file '$template_file' not found!"
  exit 1
fi

export org_name org_description
envsubst < "$template_file" > "$folder_name/index.md"

echo "Org file created at $folder_name/index.md. Do open the file to edit it."
