import fs from "fs"
import path from "path"
import type { OrgData } from "./types"

export class OrgWriter {
  createOrgFile(orgData: OrgData): void {
    const orgDir = path.join(process.cwd(), "src", "content", "orgs", orgData.org)
    const orgFile = path.join(orgDir, "index.md")

    try {
      // Create directory if it doesn't exist
      fs.mkdirSync(orgDir, { recursive: true })

      // Generate markdown content
      const fileContent = this.generateOrgFile(orgData)

      // Write the file
      fs.writeFileSync(orgFile, fileContent, "utf8")

      // if got hero image, copy it to the orgs directory
      if (orgData.heroImage && !orgData.heroImage.startsWith("http")) {
        const heroImageFilename = path.basename(orgData.heroImage)
        const heroImageDest = path.join(orgDir, heroImageFilename)
        fs.copyFileSync(orgData.heroImage, heroImageDest)
        console.log(`Hero image copied to: ${heroImageDest}`)
      }

      // if got logo image, copy it to the orgs directory
      if (orgData.logoImage && !orgData.logoImage.startsWith("http")) {
        const logoImageFilename = path.basename(orgData.logoImage)
        const logoImageDest = path.join(orgDir, logoImageFilename)
        fs.copyFileSync(orgData.logoImage, logoImageDest)
        console.log(`Logo image copied to: ${logoImageDest}`)
      }

      console.log("\n✅ Org created successfully!")
      console.log(`📁 Location: ${orgFile}`)
      console.log("\n🎉 Your org is ready to be committed to the repository!")
    } catch (error) {
      console.error("Error creating org file:", error)
      throw error
    }
  }

  private generateOrgFile(orgData: OrgData): string {
    let content = ""

    // start of front matter
    content += "---\n"
    content += `title: "${orgData.title}"\n`

    // description is used for SEO and card preview, truncate to 160 characters
    if (orgData.description) {
      // replace newlines with spaces
      const seoDescription = orgData.description.replace(/\n/g, " ").substring(0, 160)
      content += `description: "${seoDescription}"\n`
    } else {
      content += `description: ""\n`
    }

    // if hero image is a file path, use only the filename
    if (orgData.heroImage.startsWith("http")) {
      content += `heroImage: "${orgData.heroImage}"\n`
    } else {
      const heroImageFilename = path.basename(orgData.heroImage)
      content += `heroImage: "${heroImageFilename}"\n`
    }

    // if logo image is a file path, use only the filename
    if (orgData.logoImage.startsWith("http")) {
      content += `logoImage: "${orgData.logoImage}"\n`
    } else {
      const logoImageFilename = path.basename(orgData.logoImage)
      content += `logoImage: "${logoImageFilename}"\n`
    }

    // event tags
    content += "# Add up to 10 tags for your organisation"
    if (orgData.tags && orgData.tags.length > 0) {
      content += `tags: [${orgData.tags.map((tag) => `"${tag}"`).join(", ")}]\n`
    } else {
      content += `tags: []\n`
    }

    // links
    content += "# (Optional) Links ----------------------------------"
    content += orgData.website ? `website: ${orgData.website}` : "# website: <url>"
    content += orgData.twitter ? `twitter: ${orgData.twitter}` : "# twitter: <url>"
    content += orgData.facebook ? `facebook: ${orgData.facebook}` : "# facebook: <url>"
    content += orgData.instagram ? `instagram: ${orgData.instagram}` : "# instagram: <handle_without_@>"
    content += orgData.linkedin ? `linkedin: ${orgData.linkedin}` : "# linkedin: <url>"
    content += orgData.youtube ? `youtube: ${orgData.youtube}` : "# youtube: <url>"
    content += orgData.tiktok ? `tiktok: ${orgData.tiktok}` : "# tiktok: <url>"
    content += orgData.discord ? `discord: ${orgData.discord}` : "# discord: <url>"
    content += orgData.github ? `github: ${orgData.github}` : "# github: <url>"
    content += orgData.telegram ? `telegram: ${orgData.telegram}` : "# telegram: <url>"
    content += orgData.meetup ? `meetup: ${orgData.meetup}` : "# meetup: <url>"

    // end of front matter
    content += "---\n\n"

    // add event content
    content += orgData.content ? orgData.content : ""

    return content
  }
}
