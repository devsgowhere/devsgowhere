#!/bin/bash

read -p "Which org is this for (use the org code): " org_name
read -p "Enter the event name: " event_name
read -p "Enter the event summary: " event_summary
read -p "Enter the event start date (Format: d-MMM-YYYY): " event_start_date
read -p "Enter the event start time (Format: HH:MM:SS): " event_start_time
read -p "Enter the event end date (Format: d-MMM-YYYY): " event_end_date
read -p "Enter the event end time (Format: HH:MM:SS): " event_end_time
read -p "Enter the event venue name: " event_venue_name
read -p "Enter the event venue address: " event_venue_address
read -p "Enter the event URL: " event_url

sanitized_name=$(echo "$event_name" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '_' | sed 's/[^a-z0-9_-]//g')

event_folder_name="./src/content/events/${org_name}/${sanitized_name}"
mkdir -p "$event_folder_name"

template_file="docs/event_template.md"
if [[ ! -f "$template_file" ]]; then
  echo "Template file '$template_file' not found!"
  exit 1
fi


export org_name event_name event_summary event_start_date event_start_time event_end_date event_end_time event_venue_name event_venue_address event_url

envsubst < "$template_file" > "$event_folder_name/index.md"

echo "Event file created at $event_folder_name/index.md. Do open the file to edit it."
