import { createVerify, generateKeyPairSync } from "crypto"
import { describe, expect, test } from "vitest"
import { meetupApiEvents } from "./EventDiscovery"
import {
  createMeetupJwt,
  MEETUP_API_URL,
  MEETUP_TOKEN_URL,
  MeetupApi,
  meetupCredentialsFromEnv,
  type MeetupCredentials,
  type MeetupEvent,
} from "./MeetupApi"
import { MeetupParser } from "./parsers/MeetupParser"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString()

const CREDENTIALS: MeetupCredentials = {
  clientId: "client-123",
  signingKeyId: "key-456",
  privateKey: PRIVATE_KEY_PEM,
  memberId: "789",
}

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString())

const EVENT: MeetupEvent = {
  id: "316763609",
  title: "AWS User Group Meetup October 2026",
  eventUrl: "https://www.meetup.com/aws-sg/events/316763609/",
  dateTime: "2026-10-28T19:00:00+08:00",
  endTime: "2026-10-28T21:00:00+08:00",
  eventType: "PHYSICAL",
  status: "ACTIVE",
  description: "Join us at the **AWS Singapore Office**!",
  featuredEventPhoto: null,
  venue: {
    name: "Amazon Web Services Singapore",
    address: "2 Central Blvd, Level 5",
    city: "Singapore",
    state: "",
    country: "sg",
  },
  topics: { edges: [{ node: { name: "Amazon Web Services" } }, { node: { name: "Cloud Computing" } }] },
  group: { urlname: "aws-sg", name: "AWS User Group Singapore", keyGroupPhoto: null },
}

interface Call {
  url: string
  init: RequestInit
}

/** A fetch stand-in that records calls and answers token and GraphQL requests from the given handlers. */
function fakeFetch(graphql: (body: any) => object, token: () => object = () => ({ access_token: "token-1" })) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const json = url === MEETUP_TOKEN_URL ? token() : graphql(JSON.parse(init.body as string))
    const status = "error" in json ? 400 : 200
    return new Response(JSON.stringify(json), { status })
  }) as unknown as typeof fetch
  return { calls, impl }
}

describe("meetupCredentialsFromEnv", () => {
  const env = {
    MEETUP_CLIENT_ID: "client-123",
    MEETUP_SIGNING_KEY_ID: "key-456",
    MEETUP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    MEETUP_MEMBER_ID: "789",
  }

  test("returns null when no credentials are set", () => {
    expect(meetupCredentialsFromEnv({})).toBeNull()
    expect(meetupCredentialsFromEnv({ MEETUP_CLIENT_ID: " " })).toBeNull()
  })

  test("reads all four values and unescapes newlines in the private key", () => {
    expect(meetupCredentialsFromEnv(env)).toEqual({
      clientId: "client-123",
      signingKeyId: "key-456",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      memberId: "789",
    })
  })

  test("throws when only some are set", () => {
    expect(() => meetupCredentialsFromEnv({ ...env, MEETUP_MEMBER_ID: "", MEETUP_SIGNING_KEY_ID: "" })).toThrow(
      "missing: MEETUP_SIGNING_KEY_ID, MEETUP_MEMBER_ID",
    )
  })
})

describe("createMeetupJwt", () => {
  test("builds an RS256 JWT with Meetup's claims", () => {
    const now = new Date("2026-10-19T00:00:00Z")
    const [header, claims, signature] = createMeetupJwt(CREDENTIALS, now).split(".")

    expect(decode(header)).toEqual({ kid: "key-456", typ: "JWT", alg: "RS256" })
    expect(decode(claims)).toEqual({
      sub: "789",
      iss: "client-123",
      aud: "api.meetup.com",
      exp: now.getTime() / 1000 + 120,
    })
    const verified = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, "base64url"))
    expect(verified).toBe(true)
  })
})

describe("MeetupApi", () => {
  const upcoming = () => ({ data: { groupByUrlname: { events: { edges: [{ node: EVENT }] } } } })

  test("exchanges a JWT for an access token and reuses it", async () => {
    const { calls, impl } = fakeFetch(upcoming)
    const api = new MeetupApi(CREDENTIALS, impl)

    expect(await api.getUpcomingEvents("aws-sg")).toEqual([EVENT])
    await api.getUpcomingEvents("aws-sg")

    expect(calls.map((call) => call.url)).toEqual([MEETUP_TOKEN_URL, MEETUP_API_URL, MEETUP_API_URL])
    const tokenRequest = new URLSearchParams(calls[0].init.body as URLSearchParams)
    expect(tokenRequest.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer")
    expect(decode(tokenRequest.get("assertion")!.split(".")[1]).iss).toBe("client-123")
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer token-1")
    expect(JSON.parse(calls[1].init.body as string).variables).toEqual({ urlname: "aws-sg" })
  })

  test("sends unauthenticated requests without credentials", async () => {
    const { calls, impl } = fakeFetch(upcoming)
    await new MeetupApi(null, impl).getUpcomingEvents("aws-sg")

    expect(calls.map((call) => call.url)).toEqual([MEETUP_API_URL])
    expect(calls[0].init.headers).not.toHaveProperty("Authorization")
  })

  test("reports token, GraphQL and not-found errors", async () => {
    const badToken = fakeFetch(upcoming, () => ({ error: "invalid_grant" }))
    await expect(new MeetupApi(CREDENTIALS, badToken.impl).getEvent("1")).rejects.toThrow(
      "Meetup token request failed (400): invalid_grant",
    )

    const rateLimited = fakeFetch(() => ({ errors: [{ message: "Too many requests" }] }))
    await expect(new MeetupApi(null, rateLimited.impl).getEvent("1")).rejects.toThrow("Too many requests")

    const missing = fakeFetch(() => ({ data: { groupByUrlname: null } }))
    await expect(new MeetupApi(null, missing.impl).getUpcomingEvents("gone")).rejects.toThrow(
      "Meetup group not found: gone",
    )
  })
})

describe("meetupApiEvents", () => {
  test("keeps active, upcoming events", () => {
    const events = [
      EVENT,
      { ...EVENT, id: "2", eventUrl: "https://www.meetup.com/aws-sg/events/2/", status: "CANCELLED" },
      { ...EVENT, id: "3", eventUrl: "https://www.meetup.com/aws-sg/events/3/", dateTime: "2026-10-01T19:00:00+08:00" },
    ]
    expect(meetupApiEvents(events, "aws", new Date("2026-10-19T00:00:00Z"))).toEqual([
      {
        orgId: "aws",
        url: "https://www.meetup.com/aws-sg/events/316763609",
        title: "AWS User Group Meetup October 2026",
        startAt: "2026-10-28T19:00:00+08:00",
      },
    ])
  })
})

describe("MeetupParser.scrapeEventDataFromEvent", () => {
  test("maps an API event without needing the page", async () => {
    const url = "https://www.meetup.com/aws-sg/events/316763609/"
    expect(await new MeetupParser().scrapeEventDataFromEvent(EVENT, url)).toEqual({
      title: "AWS User Group Meetup October 2026",
      startDate: "2026-10-28",
      startTime: "19:00",
      endDate: "2026-10-28",
      endTime: "21:00",
      venue: "Amazon Web Services Singapore",
      venueAddress: "2 Central Blvd, Level 5 · Singapore",
      description: "AWS User Group Meetup October 2026",
      content: "Join us at the **AWS Singapore Office**!",
      tags: ["Events in Singapore, SG", "Amazon Web Services", "Cloud Computing"],
      heroImage: "",
      rsvpButtonText: "RSVP on Meetup",
      rsvpButtonUrl: url,
    })
  })
})
