import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, WarningCircle } from '@phosphor-icons/react';
import { locateOnce } from '../lib/hooks';
import { peso } from '../lib/format';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const DEFAULT_CENTER = { lat: 13.411, lng: 121.18 };

const icon = (html, size, anchor) => L.divIcon({ className: '', html, iconSize: size, iconAnchor: anchor });
const pin = (kind, label, extra = '') => icon(`<div class="map-pin map-pin--${kind}${extra}"><span>${label}</span></div>`, [36, 44], [18, 42]);
const PICKUP = pin('pickup', 'A');
const PICKUP_SEARCHING = pin('pickup', 'A', ' map-pin--pulse');
const DROPOFF = pin('dropoff', 'B');
const PICKUP_FADED = pin('pickup', 'A', ' map-pin--faded');
const DROPOFF_FADED = pin('dropoff', 'B', ' map-pin--faded');
const RIDER = icon('<div class="map-rider"><i></i></div>', [30, 30], [15, 15]);
const ME = icon('<div class="map-rider map-rider--me"><i></i></div>', [30, 30], [15, 15]);
const pricePin = (amount) => icon(`<div class="price-pin"><span>${peso(amount)}</span></div>`, [72, 40], [36, 38]);
const jobDot = (tone) => icon(`<div class="job-dot job-dot--${tone}"></div>`, [18, 18], [9, 9]);
const riderDot = (busy) => icon(`<div class="rider-dot${busy ? ' rider-dot--busy' : ''}"></div>`, [16, 16], [8, 8]);

const ok = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** A gentle arc from a to b (the route is a straight-line guide, not roads). */
const arc = (a, b, steps = 28) => {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const bend = Math.sin(Math.PI * t) * 0.16;
    pts.push([a.lat + dy * t + dx * bend, a.lng + dx * t - dy * bend]);
  }
  return pts;
};

function RouteLine({ a, b }) {
  const pts = useMemo(() => arc(a, b), [a.lat, a.lng, b.lat, b.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Polyline positions={pts} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9, lineCap: 'round' }} />
      <Polyline positions={pts} pathOptions={{ color: '#059669', weight: 4, dashArray: '2 9', lineCap: 'round' }} />
    </>
  );
}

function Base({ center, zoom, children, className = '' }) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} className={`map ${className}`} zoomControl={false} scrollWheelZoom>
      <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
      <ZoomControl position="bottomright" />
      {children}
    </MapContainer>
  );
}

function ClickToPlace({ onPlace }) {
  useMapEvents({ click: (e) => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], zoom ?? map.getZoom());
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function FitAll({ points, padding = 48, maxZoom = 16 }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], Math.min(maxZoom, 16));
    else if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [padding, padding], maxZoom });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Leaflet measures its box once; a box that changes size (sheet, sidebar) needs a nudge. */
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const box = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(box);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * Drop a pin: tap the map, drag the pin, or use the phone's location. Fills
 * its box. `other` is the stop already set, shown faded for context.
 */
export function MapPicker({ center, value, onChange, kind = 'pickup', other, error }) {
  const [locating, setLocating] = useState('');
  const [focus, setFocus] = useState(null);
  const start = value || center;

  const useMine = async () => {
    setLocating('Finding you…');
    try {
      const p = await locateOnce();
      onChange(p);
      setFocus(p);
      setLocating('');
    } catch (err) {
      setLocating(err.message);
    }
  };

  const marker = useMemo(() => ({
    dragend: (e) => {
      const ll = e.target.getLatLng();
      onChange({ lat: ll.lat, lng: ll.lng });
    },
  }), [onChange]);

  const what = kind === 'pickup' ? 'pickup' : 'drop-off';
  const hint = error || locating || (value ? 'Drag the pin to the exact spot' : `Tap the map to set the ${what}`);
  return (
    <div className={`map-picker${error ? ' map-picker--error' : ''}`}>
      <Base center={start} zoom={value ? 16 : 14}>
        <KeepSized />
        <ClickToPlace onPlace={onChange} />
        <Recenter center={focus || (!value ? center : null)} zoom={focus ? 17 : 14} />
        {ok(other) && <Marker position={[other.lat, other.lng]} icon={kind === 'pickup' ? DROPOFF_FADED : PICKUP_FADED} interactive={false} />}
        {ok(other) && value && <RouteLine a={kind === 'pickup' ? value : other} b={kind === 'pickup' ? other : value} />}
        {value && <Marker position={[value.lat, value.lng]} icon={kind === 'pickup' ? PICKUP : DROPOFF} draggable eventHandlers={marker} />}
      </Base>
      <p className={`map-hint${error ? ' map-hint--error' : ''}`} role={error ? 'alert' : undefined}>
        {error && <WarningCircle size={16} weight="fill" />}{hint}
      </p>
      <button type="button" className="map-locate" onClick={useMine} aria-label="Use my location" title="Use my location">
        <Crosshair size={22} weight="bold" />
      </button>
    </div>
  );
}

/** Pickup (A), drop-off (B) and, when known, the rider. Fills its box when `fill`. */
export function RouteMap({ pickup, dropoff, rider, height = 220, fill = false, searching = false, me }) {
  const points = [pickup, dropoff, rider, me].filter(ok);
  if (!points.length) return null;
  return (
    <div className={`route-map${fill ? ' route-map--fill' : ''}`} style={fill ? undefined : { height }}>
      <Base center={points[0]} zoom={14}>
        <KeepSized />
        <FitAll points={points} padding={fill ? 64 : 40} />
        {ok(pickup) && ok(dropoff) && <RouteLine a={pickup} b={dropoff} />}
        {ok(pickup) && <Marker position={[pickup.lat, pickup.lng]} icon={searching ? PICKUP_SEARCHING : PICKUP} />}
        {ok(dropoff) && <Marker position={[dropoff.lat, dropoff.lng]} icon={DROPOFF} />}
        {ok(rider) && <Marker position={[rider.lat, rider.lng]} icon={RIDER} />}
        {ok(me) && <Marker position={[me.lat, me.lng]} icon={ME} />}
      </Base>
    </div>
  );
}

/** The rider's home map: where they are, and what each open delivery pays at its pickup. */
export function RiderMap({ me, offers = [], center, onOpen }) {
  const points = [me, ...offers.map((o) => o.pickup)].filter(ok);
  const start = points[0] || center || DEFAULT_CENTER;
  return (
    <div className="route-map route-map--fill">
      <Base center={start} zoom={14}>
        <KeepSized />
        {points.length > 0 && <FitAll points={points} padding={70} maxZoom={15} />}
        {!points.length && <Recenter center={start} zoom={14} />}
        {offers.filter((o) => ok(o.pickup)).map((o) => (
          <Marker key={o.id} position={[o.pickup.lat, o.pickup.lng]} icon={pricePin(o.riderEarning)} eventHandlers={{ click: () => onOpen?.(o) }} />
        ))}
        {ok(me) && <Marker position={[me.lat, me.lng]} icon={ME} />}
      </Base>
    </div>
  );
}

const LIVE_TONE = { SEARCHING: 'amber', ACCEPTED: 'blue', AT_PICKUP: 'blue', PICKED_UP: 'blue', AT_DROPOFF: 'blue' };

/** The admin's live map: open deliveries at their pickups, and riders online. */
export function LiveMap({ jobs = [], riders = [], onOpenJob }) {
  const points = [...jobs.map((j) => j.pickup), ...riders].filter(ok);
  return (
    <div className="route-map route-map--fill">
      <Base center={points[0] || DEFAULT_CENTER} zoom={13}>
        <KeepSized />
        {points.length > 0 && <FitAll points={points} padding={50} maxZoom={15} />}
        {riders.filter(ok).map((r) => (
          <Marker key={`r${r.id}`} position={[r.lat, r.lng]} icon={riderDot(r.busy)}>
            <Tooltip direction="top" offset={[0, -8]}>{r.name}{r.busy ? ' · on a delivery' : ' · free'}</Tooltip>
          </Marker>
        ))}
        {jobs.filter((j) => ok(j.pickup)).map((j) => (
          <Marker key={j.id} position={[j.pickup.lat, j.pickup.lng]} icon={jobDot(LIVE_TONE[j.status] || 'blue')} eventHandlers={{ click: () => onOpenJob?.(j) }}>
            <Tooltip direction="top" offset={[0, -8]}>{j.code} · {j.pickupBarangay} → {j.dropoffBarangay}</Tooltip>
          </Marker>
        ))}
      </Base>
    </div>
  );
}
