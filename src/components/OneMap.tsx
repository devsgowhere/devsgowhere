import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    L?: any;
  }
}

type OneMapProps = {
  height?: string;
  zoom?: number;
  // optional address to geocode and focus the map on (string)
  address?: string | null;
  // zoom level to use when focusing on the geocoded address
  zoomOnAddress?: number;
};

function ensureCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      // if already present, assume it's loaded
      return resolve()
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = (e) => reject(e)
    document.body.appendChild(s)
  })
}

export default function OneMap({ height = '300px', zoom = 16, address = null, zoomOnAddress }: OneMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<any>(null)
  const [showMap, setShowMap] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false

    const cssUrl = 'https://www.onemap.gov.sg/web-assets/libs/leaflet/leaflet.css'
    const scriptUrl = 'https://www.onemap.gov.sg/web-assets/libs/leaflet/onemap-leaflet.js'

    // helper: initialize map once we have leaflet loaded and an optional center
    const initMap = (centerLatLng?: [number, number]) => {
      if (cancelled) return
      const L = window.L
      if (!L || !mapRef.current) return

      // set bounds for Singapore area
      const sw = L.latLng(1.144, 103.535)
      const ne = L.latLng(1.494, 104.502)
      const bounds = L.latLngBounds(sw, ne)

      const center = centerLatLng ? L.latLng(centerLatLng[0], centerLatLng[1]) : L.latLng(1.2868108, 103.8545349)

      mapInstance.current = L.map(mapRef.current, {
        center,
        zoom,
      })
      mapInstance.current.setMaxBounds(bounds)

      const basemap = L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
        detectRetina: true,
        maxZoom: 19,
        minZoom: 14,
        attribution:
          '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/>&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>',
      })

      basemap.addTo(mapInstance.current)

      // Add marker at the location if coordinates were provided
      if (centerLatLng) {
        const marker = L.marker(centerLatLng).addTo(mapInstance.current)
        if (address) {
          marker.bindPopup(address)
        }
      }
    }

    // If an address/postalcode is provided, geocode first; otherwise initialize immediately
    const shouldGeocode = address && typeof address === 'string' && address.trim().length > 0

    if (shouldGeocode) {
      // sanitize simple special chars that break the query (middle dot etc.)
      const q = address.replace(/\u00B7/g, "").replace(/\s+/g, " ").trim()

      const geocodeAndInit = async () => {
        try {
          const endpoint = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
          const resp = await fetch(endpoint)
          const json = await resp.json()
          const first = json && (json.results) && (json.results[0])
          if (!first) {
            // no match -> hide map
            setShowMap(false)
            return
          }
          const latRaw = first.LATITUDE ?? first.Y
          const lonRaw = first.LONGITUDE ?? first.LONGTITUDE ?? first.X
          const lat = latRaw ? parseFloat(latRaw) : NaN
          const lon = lonRaw ? parseFloat(lonRaw) : NaN
          if (isNaN(lat) || isNaN(lon)) {
            setShowMap(false)
            return
          }

          // load CSS/script then init map centered on coords
          ensureCss(cssUrl)
          await loadScript(scriptUrl)
          if (cancelled) return
          initMap([lat, lon])
        } catch (err) {
          console.warn('Geocode failed', err)
          setShowMap(false)
        }
      }

      geocodeAndInit()
    } else {
      // no geocode requested — load assets and init with default center
      ensureCss(cssUrl)
      loadScript(scriptUrl)
        .then(() => {
          if (cancelled) return
          initMap()
        })
        .catch((err) => console.error('Failed to load OneMap script', err))
    }

    return () => {
      cancelled = true
      if (mapInstance.current) {
        mapInstance.current.remove()
      }
    }
  }, [address, zoom, zoomOnAddress])

  if (!showMap) return null

  return <div ref={mapRef} style={{ width: '100%', height }} />
}
