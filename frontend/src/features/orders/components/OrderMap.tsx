import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const BRAZIL_CENTER: [number, number] = [-14.235, -51.9253]

const deliveryMarker = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function ResponsiveMapSize() {
  const map = useMap()
  const lastSize = useRef({ height: 0, width: 0 })

  useEffect(() => {
    const container = map.getContainer()
    let frame = 0
    const invalidateSize = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }))
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { height, width } = entry.contentRect
      if (height === lastSize.current.height && width === lastSize.current.width) return
      lastSize.current = { height, width }
      invalidateSize()
    })
    observer.observe(container)
    invalidateSize()

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [map])

  return null
}

function ManualSelection({
  onSelect,
}: {
  onSelect?: ((coordinates: { latitude: number; longitude: number }) => void) | undefined
}) {
  useMapEvents({
    click: ({ latlng }) => onSelect?.({ latitude: latlng.lat, longitude: latlng.lng }),
  })
  return null
}

type OrderMapProps = {
  latitude?: number | undefined
  longitude?: number | undefined
  markerLabel?: string | undefined
  onSelect?: ((coordinates: { latitude: number; longitude: number }) => void) | undefined
}

export function OrderMap({ latitude, longitude, markerLabel, onSelect }: OrderMapProps) {
  const hasMarker = latitude !== undefined && longitude !== undefined
  const center: [number, number] = hasMarker ? [latitude, longitude] : BRAZIL_CENTER

  return (
    <MapContainer
      center={center}
      zoom={hasMarker ? 16 : 4}
      fadeAnimation={false}
      zoomAnimation={false}
      scrollWheelZoom
      aria-label={
        onSelect
          ? 'Mapa para selecionar manualmente o ponto de entrega'
          : 'Mapa da localização do endereço de entrega'
      }
      style={{
        cursor: onSelect ? 'crosshair' : undefined,
        height: '100%',
        minHeight: 280,
        width: '100%',
      }}
    >
      <ResponsiveMapSize />
      <ManualSelection onSelect={onSelect} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasMarker && (
        <Marker position={[latitude, longitude]} icon={deliveryMarker}>
          <Popup>{markerLabel ?? 'Endereço geocodificado da entrega'}</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
