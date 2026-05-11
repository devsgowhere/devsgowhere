import fs from "fs"
import path from "path"
import type { EventData } from "./types"

export class EventWriter {
  createEventFile(eventData: EventData): void {
    const eventSlug = this.generateEventSlug(eventData)
    const eventDir = path.join(process.cwd(), "src", "content", "events", eventData.org, eventSlug)
    const eventFile = path.join(eventDir, "index.md")

    try {
      // Create directory if it doesn't exist
      fs.mkdirSync(eventDir, { recursive: true })

      // Generate markdown content
      const fileContent = this.generateEventFile(eventData)

      // Write the file
      fs.writeFileSync(eventFile, fileContent, "utf8")

      // if got hero image, copy it to the event directory
      if (eventData.heroImage && !eventData.heroImage.startsWith("http") && eventData.heroImage !== "../public/org-placeholder.png") {
        const heroImageFilename = path.basename(eventData.heroImage)
        const heroImageDest = path.join(eventDir, heroImageFilename)
        fs.copyFileSync(eventData.heroImage, heroImageDest)
        console.log(`Hero image copied to: ${heroImageDest}`)
      }

      console.log("\n✅ Event created successfully!")
      console.log(`📁 Location: ${eventFile}`)
      console.log(`🔗 Event slug: ${eventSlug}`)
      console.log("\n🎉 Your event is ready to be committed to the repository!")
    } catch (error) {
      console.error("Error creating event file:", error)
      throw error
    }
  }

  private generateEventSlug(eventData: EventData): string {
    // generate slug from event start date + title
    // e.g. "2023-10-01_my-awesome-event"
    let title = eventData.title || "untitled-event"

    // prepend the start date to the title if it exists
    const datePart = eventData.startDate ? eventData.startDate.replace(/-/g, "") : ""
    if (datePart) {
      title = `${datePart}-${title}`
    }

    // replace spaces and special characters with hyphens, and convert to lowercase
    title = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // remove special characters
      .replace(/\s+/g, "-") // replace spaces with hyphens
      .replace(/-+/g, "-") // replace multiple hyphens with a single hyphen
      .replace(/^-|-$/g, "") // trim leading and trailing hyphens

    // ensure the slug is not too long
    if (title.length > 100) {
      title = title.substring(0, 100)
      console.warn(`Event slug is too long, truncating to 100 characters: ${title}`)
    }

    // ensure the slug is not empty
    if (!title) {
      console.warn(`Event title is empty, using default slug "untitled-event"`)
      title = "untitled-event"
    }

    return title
  }

  private generateEventFile(eventData: EventData): string {
    let content = ""

    // start of front matter
    content += "---\n"
    content += `org: "${eventData.org}"\n`
    content += `title: "${eventData.title}"\n`

    // description is used for SEO and card preview, truncate to 160 characters
    if (eventData.description) {
      // replace newlines with spaces
      const seoDescription = eventData.description.replace(/\n/g, " ").substring(0, 160)
      content += `description: "${seoDescription}"\n`
    } else {
      content += `description: ""\n`
    }

    // venue and address (reuired)
    content += `venue: "${eventData.venue}"\n`
    content += `venueAddress: "${eventData.venueAddress}"\n`

    // start date and time are required
    content += `startDate: "${eventData.startDate}"\n`
    content += `startTime: "${eventData.startTime}"\n`

    // end date and time are optional
    if (eventData.endDate) {
      content += `endDate: "${eventData.endDate}"\n`
    }

    if (eventData.endTime) {
      content += `endTime: "${eventData.endTime}"\n`
    }

    // if hero image is a file path, use only the filename
    if (eventData.heroImage.startsWith("http")) {
      content += `heroImage: "${eventData.heroImage}"\n`
    } else {
      const heroImageFilename = path.basename(eventData.heroImage)
      content += `heroImage: "${heroImageFilename}"\n`
    }

    // event tags
    if (eventData.tags && eventData.tags.length > 0) {
      content += `tags: [${eventData.tags.map((tag) => `"${tag}"`).join(", ")}]\n`
    } else {
      content += `tags: []\n`
    }

    // event rsvp button
    if (eventData.rsvpButtonUrl) {
      content += `rsvpButtonUrl: "${eventData.rsvpButtonUrl}"\n`
      content += `rsvpButtonText: "${eventData.rsvpButtonText}"\n`
    }

    // end of front matter
    content += "---\n\n"

    // add event content
    content += eventData.content ? eventData.content : ""

    return content
  }
}
