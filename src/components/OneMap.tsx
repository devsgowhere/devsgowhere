import { useEffect, useState } from "react"

type OneMapProps = {
  height?: string
  zoom?: number
  // address to geocode and show on the map; nothing is rendered without one, or when it can't be found
  address?: string | null
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// OneMap's minimap takes the popup's HTML, URI-encoded then base64-encoded, in `ewt`
const popupParam = (address: string) => btoa(encodeURIComponent(escapeHtml(address)))

export default function OneMap({ height = "300px", zoom = 17, address = null }: OneMapProps) {
  const [latLng, setLatLng] = useState<string | null>(null)

  useEffect(() => {
    // the middle dot some Meetup addresses use breaks the search
    const query = address
      ?.replace(/\u00B7/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!query) return

    // the postal code finds a place far more reliably than a full address ("Rd," finds nothing)
    const searches = [query.match(/\b\d{6}\b/)?.[0], query].filter((search): search is string => !!search)
    let cancelled = false
    ;(async () => {
      for (const search of searches) {
        const response = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(search)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,
        )
        const first = (await response.json())?.results?.[0]
        const lat = parseFloat(first?.LATITUDE)
        const lng = parseFloat(first?.LONGITUDE)
        if (!isNaN(lat) && !isNaN(lng)) return !cancelled && setLatLng(`${lat},${lng}`)
      }
    })().catch((error) => console.warn("OneMap geocode failed", error))
    return () => {
      cancelled = true
    }
  }, [address])

  if (!latLng || !address) return null

  const params = new URLSearchParams({
    mapStyle: "Default",
    zoomLevel: String(zoom),
    latLng,
    ewt: popupParam(address),
    popupWidth: "200",
    showPopup: "true",
  })
  return (
    <iframe
      title={`Map of ${address}`}
      src={`https://www.onemap.gov.sg/minimap/minimap.html?${params}`}
      loading="lazy"
      style={{ width: "100%", height, border: 0 }}
    />
  )
}
