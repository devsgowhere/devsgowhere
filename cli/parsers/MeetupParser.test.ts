import { describe, expect, test } from "vitest"
import { PageScraper } from "../PageScraper"
import { saveAsHtml } from "../utils"
import { MeetupParser } from "./MeetupParser"

describe("MeetupParser", () => {
  describe("single day event", () => {
    test("GeekBrunchSG 2025", async () => {
      const parser = new MeetupParser()

      const url = "https://www.meetup.com/junior-developers-singapore/events/310333625"
      const $ = await PageScraper.getPage(url)
      saveAsHtml($, url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Developer's Gym - Architectural Kata (Let's Practice System Design)",
        startDate: "2025-08-23", // YYYY-MM-DD
        startTime: "10:00", // HH:MM
        // endDate: '2025-08-23', // YYYY-MM-DD
        endTime: "13:00", // HH:MM
        venue: "SMU - Singapore Management University",
        venueAddress: "School of Economics & Social Sciences, 14 Orchard Road, Singapore 238827 · Singapore",
        // description: '',
        // content: '',
        tags: ["Events in Singapore, SG", "Software Architecture", "Courses and Workshops", "Open Source"],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "RSVP on Meetup",
        rsvpButtonUrl: url,
      })

      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })
  })

  describe("meetup org page", () => {
    test("junior devs sg", async () => {
      const parser = new MeetupParser()

      const url = "https://www.meetup.com/junior-developers-singapore"
      const $ = await PageScraper.getPage(url)
      saveAsHtml($, url)

      const result = await parser.scrapeOrgDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Junior Developers Singapore",
        // description: '',
        // content: '',
        tags: [
          "Linux",
          "PHP",
          "Open Source",
          "Web Design",
          "Ruby",
          "System Administration",
          "Web Development",
          "Mobile Technology",
          "Mobile Development",
          "Agile Project Management",
          "Computer Programming",
          "HTML5",
          "Infrastructure as Code",
          "Technology",
        ],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1758637881193/clean_467617759.webp',
        website: "https://linktr.ee/juniordevsg",
        twitter: "https://twitter.com/juniordevsg",
        facebook: "https://www.facebook.com/groups/juniorDevSG/",
        instagram: "juniordevsingapore",
        linkedin: "https://www.linkedin.com/groups/10438405/",
        meetup: "https://www.meetup.com/junior-developers-singapore",
      })

      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })
  })
})
