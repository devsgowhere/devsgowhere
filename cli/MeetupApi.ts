import { createSign } from "crypto"

/**
 * Client for Meetup's GraphQL API (https://www.meetup.com/api/guide/), authenticated with the JWT Flow
 * (https://www.meetup.com/api/authentication/#p04-jwt-flow-section): each run signs a short-lived JWT with the
 * OAuth client's RSA key and exchanges it for an access token. Nothing to store or rotate between runs.
 */

export const MEETUP_API_URL = "https://api.meetup.com/gql-ext"
export const MEETUP_TOKEN_URL = "https://secure.meetup.com/oauth2/access"

const ENV_VARS = {
  clientId: "MEETUP_CLIENT_ID",
  signingKeyId: "MEETUP_SIGNING_KEY_ID",
  privateKey: "MEETUP_PRIVATE_KEY",
  memberId: "MEETUP_MEMBER_ID",
} as const

export type MeetupCredentials = Record<keyof typeof ENV_VARS, string>

/**
 * Reads the JWT Flow credentials from the environment. Returns null when none are set (callers fall back to
 * scraping) and throws when only some are, so a half-configured secret doesn't silently disable the API.
 */
export function meetupCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): MeetupCredentials | null {
  const entries = Object.entries(ENV_VARS).map(([key, name]) => [key, env[name]?.trim() ?? ""] as const)
  const missing = entries.filter(([, value]) => !value).map(([key]) => ENV_VARS[key as keyof typeof ENV_VARS])
  if (missing.length === entries.length) return null
  if (missing.length) throw new Error(`Meetup API credentials incomplete, missing: ${missing.join(", ")}`)

  const credentials = Object.fromEntries(entries) as MeetupCredentials
  // secrets and .env files often hold the PEM on one line with literal "\n"s
  credentials.privateKey = credentials.privateKey.replace(/\\n/g, "\n")
  return credentials
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url")

/** Builds the RS256-signed assertion Meetup exchanges for an access token. */
export function createMeetupJwt(credentials: MeetupCredentials, now = new Date(), lifetimeSeconds = 120): string {
  const header = { kid: credentials.signingKeyId, typ: "JWT", alg: "RS256" }
  const claims = {
    sub: credentials.memberId,
    iss: credentials.clientId,
    aud: "api.meetup.com",
    exp: Math.floor(now.getTime() / 1000) + lifetimeSeconds,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.privateKey)
  return `${unsigned}.${base64url(signature)}`
}

export class MeetupApi {
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0

  /** @param credentials null sends unauthenticated requests (enough for public groups and events, but undocumented) */
  constructor(
    private credentials: MeetupCredentials | null,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  /** Returns a client when Meetup credentials are configured, otherwise null. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): MeetupApi | null {
    const credentials = meetupCredentialsFromEnv(env)
    return credentials ? new MeetupApi(credentials) : null
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.credentials) return null
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) return this.accessToken

    const response = await this.fetchImpl(MEETUP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: createMeetupJwt(this.credentials),
      }),
    })
    const body: any = await response.json().catch(() => ({}))
    if (!response.ok || !body.access_token) {
      throw new Error(`Meetup token request failed (${response.status}): ${body.error ?? response.statusText}`)
    }
    this.accessToken = body.access_token as string
    // refresh a minute early; Meetup issues tokens for an hour
    this.accessTokenExpiresAt = Date.now() + ((body.expires_in ?? 3600) - 60) * 1000
    return this.accessToken
  }

  async query<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const token = await this.getAccessToken()
    const response = await this.fetchImpl(MEETUP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ query, variables }),
    })
    const body: any = await response.json().catch(() => ({}))
    if (!response.ok || body.errors?.length) {
      const message = body.errors?.map((error: any) => error.message).join("; ") || response.statusText
      throw new Error(`Meetup API request failed (${response.status}): ${message}`)
    }
    return body.data as T
  }

  /** Upcoming events of a group (by its URL name, e.g. "aws-sg"). */
  async getUpcomingEvents(urlname: string): Promise<MeetupEvent[]> {
    const data = await this.query(UPCOMING_EVENTS_QUERY, { urlname })
    if (!data.groupByUrlname) throw new Error(`Meetup group not found: ${urlname}`)
    return data.groupByUrlname.events.edges.map((edge: any) => edge.node)
  }

  async getEvent(id: string): Promise<MeetupEvent> {
    const data = await this.query(EVENT_QUERY, { id })
    if (!data.event) throw new Error(`Meetup event not found: ${id}`)
    return data.event
  }
}

/** The event fields we use; the same shape Meetup embeds in its event pages, except for the photo fields. */
export interface MeetupEvent {
  id: string
  title: string
  eventUrl: string
  dateTime: string
  endTime?: string | null
  eventType?: "PHYSICAL" | "ONLINE" | "HYBRID"
  status: string
  description?: string | null
  featuredEventPhoto?: { highResUrl?: string | null } | null
  venue?: { name?: string; address?: string; city?: string; state?: string; country?: string } | null
  topics?: { edges: { node: { name: string } }[] } | null
  group?: { urlname: string; name: string; keyGroupPhoto?: { highResUrl?: string | null } | null } | null
}

const EVENT_FIELDS = `
  id title eventUrl dateTime endTime eventType status description
  featuredEventPhoto { highResUrl }
  venue { name address city state country }
  topics { edges { node { name } } }
  group { urlname name keyGroupPhoto { highResUrl } }
`

// a group's `events` defaults to upcoming ones, soonest first
const UPCOMING_EVENTS_QUERY = `
  query ($urlname: String!) {
    groupByUrlname(urlname: $urlname) {
      events(first: 20) { edges { node { ${EVENT_FIELDS} } } }
    }
  }
`

const EVENT_QUERY = `
  query ($id: ID!) {
    event(id: $id) { ${EVENT_FIELDS} }
  }
`
