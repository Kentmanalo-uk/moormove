import { useId } from 'react';
import {
  Bell, CheckCircle, Package, Truck, MapPin, MapTrifold, Receipt, ChartBar, Coins, TrendUp,
  CalendarBlank, MagnifyingGlass, ChatCircleDots, Star, Heart, UsersThree, IdentificationCard, AddressBook,
  Moped, ClockCountdown, WifiSlash, Moon, Images, Camera, Wallet, ShieldCheck, Storefront, House, NavigationArrow, Key, Gift, Tag, MapPinArea,
} from '@phosphor-icons/react';

/*
 * MoorMove's pictures, all drawn here in E-MOORM's style: soft blurred colour
 * behind frosted glass shapes, icons in a green gradient, a couple of faint
 * sparkles. Decorative: the text next to them says what they mean, so they
 * are hidden from screen readers.
 */

const G = {
  g200: '#a7f3d0', g300: '#6ee7b7', g500: '#10b981', g600: '#059669', g700: '#047857', g800: '#065f46', brand: '#055d07',
};

/** A four-point sparkle centred on (x, y). */
const sparklePath = (x, y, r) => {
  const k = r * 0.18;
  return `M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`;
};

/** Gradients and filters every picture shares; ids are made unique per picture. */
function Defs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-main`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={G.g300} />
        <stop offset="1" stopColor={G.g700} />
      </linearGradient>
      <linearGradient id={`${id}-blob`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={G.g200} />
        <stop offset="1" stopColor={G.g500} />
      </linearGradient>
      <linearGradient id={`${id}-teal`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#a5f3fc" />
        <stop offset="1" stopColor="#14b8a6" />
      </linearGradient>
      <linearGradient id={`${id}-pink`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f9a8d4" />
        <stop offset="1" stopColor="#db2777" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.92" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.42" />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
      </linearGradient>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#34d399" />
        <stop offset="1" stopColor={G.g600} />
      </linearGradient>
      <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={G.g600} />
        <stop offset="1" stopColor={G.g800} />
      </linearGradient>
      <linearGradient id={`${id}-brand`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={G.g700} />
        <stop offset="1" stopColor={G.brand} />
      </linearGradient>
      <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <filter id={`${id}-lift`} x="-40%" y="-40%" width="180%" height="190%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={G.g800} floodOpacity="0.16" />
      </filter>
    </defs>
  );
}

const useArtId = (prefix) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/* ── Vehicles ──────────────────────────────────────────────────────────── */

const wheel = (cx, cy, r) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#1f2937" />
    <circle cx={cx} cy={cy} r={r * 0.58} fill="#d1d5db" />
    <circle cx={cx} cy={cy} r={r * 0.22} fill="#6b7280" />
  </g>
);

/**
 * A vehicle drawn side-on, facing right, in a 160 × 100 box (ground at y≈90).
 * `url(part)` points at the picture's gradients.
 */
function drawVehicle(type, url) {
  if (type === 'TRICYCLE') {
    return (
      <g>
        {/* The motorcycle's front, ahead of the sidecar. */}
        {wheel(134, 76, 13)}
        <path d="M122 34L134 76" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" />
        <path d="M122 62C126 56 140 56 145 64" stroke={url('dark')} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M114 30L128 28" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <circle cx="127" cy="42" r="4" fill="#fde68a" />
        <path d="M104 48H122C127 48 128 52 126 56L120 66H104Z" fill={url('dark')} />
        {/* Sidecar wheel, then the cab over it. */}
        {wheel(62, 77, 13)}
        <rect x="117" y="20" width="4" height="30" rx="1" fill="#374151" />
        <path d="M18 24H100C106 24 109 28 109 34V66C109 70 106 72 102 72H24C20 72 18 70 18 66Z" fill={url('body')} />
        <rect x="26" y="30" width="30" height="20" rx="4" fill="#ecfeff" opacity="0.9" />
        <rect x="62" y="30" width="39" height="20" rx="4" fill="#ecfeff" opacity="0.9" />
        <path d="M31 46L41 33M68 46L78 33" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <rect x="18" y="56" width="91" height="5" fill="#ffffff" opacity="0.35" />
        <path d="M12 21C12 16 16 12 21 12H126C131 12 134 15 134 19V24H12Z" fill={url('brand')} />
        <path d="M22 16H90" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }
  if (type === 'BICYCLE') {
    return (
      <g>
        {[[38, 68], [122, 68]].map(([cx, cy]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r="21" fill="none" stroke="#1f2937" strokeWidth="5" />
            <circle cx={cx} cy={cy} r="15" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="3" fill="#6b7280" />
          </g>
        ))}
        <path d="M38 68L66 68L101 40M66 68L57 32M38 68L59 39L102 39" stroke={url('body')} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M102 34L122 68" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" />
        <path d="M100 36L104 22L115 22" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M47 29H65C68 29 68 33 65 33H50Z" fill="#1f2937" />
        <circle cx="66" cy="68" r="5" fill="#374151" />
        <path d="M108 27H140L135 45H112Z" fill={url('brand')} />
        <rect x="114" y="10" width="21" height="17" rx="3" fill="#fbbf24" />
        <rect x="122.5" y="10" width="4" height="17" fill="#ffffff" opacity="0.6" />
      </g>
    );
  }
  // Motorcycle: a scooter with a MoorMove box on the back.
  return (
    <g>
      {wheel(40, 74, 15)}
      {wheel(124, 74, 15)}
      <path d="M110 30L124 74" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" />
      <path d="M108 61C112 53 128 53 135 62" stroke={url('dark')} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M16 66C16 52 26 46 40 46H76C82 46 84 50 82 56L78 64H58C52 64 48 68 46 72H20Z" fill={url('body')} />
      <path d="M24 57C26 52 32 50 40 50H60" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M44 46C44 40 48 37 54 37H74C79 37 80 40 79 46Z" fill="#1f2937" />
      <path d="M56 64H98L96 72H52Z" fill={url('dark')} />
      <path d="M92 72L102 30C103 26 106 24 110 24H114L104 72Z" fill={url('body')} />
      <path d="M104 24L118 18" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
      <circle cx="113" cy="33" r="4" fill="#fde68a" />
      <rect x="22" y="42" width="30" height="4" rx="2" fill="#374151" />
      <rect x="17" y="11" width="38" height="31" rx="6" fill={url('brand')} />
      <rect x="17" y="11" width="38" height="8" rx="4" fill="#ffffff" opacity="0.18" />
      <path d="M28.5 34V24L36 30L43.5 24V34" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A tricycle, motorcycle or bicycle picture. `size` is its width. */
export function VehicleArt({ type = 'MOTORCYCLE', size = 120, className = '' }) {
  const id = useArtId('va');
  const url = (part) => `url(#${id}-${part})`;
  return (
    <svg viewBox="0 0 160 100" width={size} height={Math.round(size * 0.625)} className={`vehicle-art ${className}`.trim()} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <ellipse cx="80" cy="92" rx="64" ry="5" fill={G.g800} opacity="0.12" />
      {drawVehicle(type, url)}
    </svg>
  );
}

/* ── Hero: a map with a route, a rider and a parcel ─────────────────────── */

export function HeroArt({ className = '', vehicle = 'MOTORCYCLE' }) {
  const id = useArtId('ha');
  const url = (part) => `url(#${id}-${part})`;
  const glass = { fill: url('glass'), stroke: url('edge'), strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 360 260" className={`hero-art ${className}`.trim()} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <g filter={url('blur')}>
        <circle cx="130" cy="110" r="80" fill={url('blob')} opacity="0.6" />
        <circle cx="270" cy="170" r="62" fill={url('teal')} opacity="0.45" />
      </g>
      <ellipse cx="190" cy="246" rx="140" ry="9" fill={G.g800} opacity="0.1" />

      {/* The map card. */}
      <rect x="74" y="24" width="252" height="176" rx="28" {...glass} filter={url('lift')} />
      <g opacity="0.75">
        <path d="M74 122H326M214 24V200M96 200L190 70" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" />
        <rect x="236" y="138" width="62" height="40" rx="10" fill={G.g200} opacity="0.55" />
        <rect x="104" y="44" width="72" height="56" rx="12" fill={G.g200} opacity="0.45" />
        <rect x="236" y="44" width="66" height="54" rx="12" fill="#ffffff" opacity="0.5" />
      </g>

      {/* The route, from A to B. */}
      <path d="M118 166C150 166 152 120 186 118S246 104 262 74" fill="none" stroke={url('main')} strokeWidth="5" strokeLinecap="round" strokeDasharray="1 11" />
      <circle cx="118" cy="166" r="13" fill={url('main')} stroke="#ffffff" strokeWidth="4" />
      <circle cx="118" cy="166" r="4" fill="#ffffff" />
      <path d="M262 76C250 62 243 53 243 42A19 19 0 1 1 281 42C281 53 274 62 262 76Z" fill={url('pink')} stroke="#ffffff" strokeWidth="3" />
      <circle cx="262" cy="41" r="7" fill="#ffffff" />

      {/* "On the way" chip. */}
      <rect x="196" y="186" width="128" height="44" rx="22" {...glass} filter={url('lift')} />
      <circle cx="220" cy="208" r="9" fill={url('main')} />
      <rect x="236" y="198" width="66" height="7" rx="3.5" fill={G.g300} />
      <rect x="236" y="211" width="44" height="6" rx="3" fill={G.g200} />

      {/* A parcel. */}
      <circle cx="320" cy="122" r="26" {...glass} filter={url('lift')} />
      <Package x="303" y="105" size={34} weight="fill" fill={url('main')} />

      {/* The rider. */}
      <g transform="translate(6 132) scale(1.12)">
        <ellipse cx="80" cy="92" rx="60" ry="5" fill={G.g800} opacity="0.12" />
        {drawVehicle(vehicle, url)}
      </g>

      <path d={sparklePath(56, 46, 7)} fill={G.g300} />
      <path d={sparklePath(340, 54, 5.5)} fill="#5eead4" />
      <path d={sparklePath(168, 228, 4.5)} fill={G.g300} />
    </svg>
  );
}

/**
 * The landing page's picture, kept simple: the rider on a soft green circle,
 * a dotted route ahead to the drop-off pin. No glass, blur or sparkles.
 */
export function CleanHeroArt({ className = '', vehicle = 'MOTORCYCLE' }) {
  const id = useArtId('ch');
  const url = (part) => `url(#${id}-${part})`;
  return (
    <svg viewBox="0 0 360 280" className={`hero-art ${className}`.trim()} aria-hidden="true" focusable="false">
      <Defs id={id} />
      <circle cx="180" cy="140" r="122" fill="#ecfdf5" />

      {/* The route, from the rider to the drop-off. */}
      <path d="M226 228C262 228 292 204 286 128" fill="none" stroke={G.g500} strokeWidth="4" strokeLinecap="round" strokeDasharray="0.5 11" />
      <ellipse cx="286" cy="124" rx="11" ry="3.5" fill={G.g800} opacity="0.14" />
      <path d="M286 122C273 107 266 98 266 86A20 20 0 1 1 306 86C306 98 299 107 286 122Z" fill={url('pink')} />
      <circle cx="286" cy="85" r="7.5" fill="#ffffff" />

      {/* The rider. */}
      <ellipse cx="132" cy="252" rx="84" ry="6" fill={G.g800} opacity="0.1" />
      <g transform="translate(44 152) scale(1.1)">{drawVehicle(vehicle, url)}</g>
    </svg>
  );
}

/* ── Empty states ──────────────────────────────────────────────────────── */

const SCENES = {
  notifications: { layout: 'device', main: Bell, a: CheckCircle },
  deliveries: { layout: 'route', main: MapPin, a: Package },
  ongoing: { layout: 'route', main: NavigationArrow, a: Truck },
  parcels: { layout: 'stack', main: Package, a: CheckCircle },
  cancelled: { layout: 'stack', main: Package, a: Receipt },
  history: { layout: 'stack', main: Receipt, a: CheckCircle },
  offers: { layout: 'radar', main: MapPin, a: Moped },
  searching: { layout: 'radar', main: MagnifyingGlass, a: Moped },
  offline: { layout: 'ride', main: Moon, a: WifiSlash },
  ride: { layout: 'ride', main: Moped, a: MapPin },
  earnings: { layout: 'chart', main: Coins, a: TrendUp },
  analytics: { layout: 'chart', main: ChartBar, a: CalendarBlank },
  cash: { layout: 'chart', main: Wallet, a: Coins },
  paid: { layout: 'card', main: CheckCircle, a: Coins },
  search: { layout: 'lens', main: MagnifyingGlass, a: Package },
  riders: { layout: 'card', main: Moped, a: IdentificationCard },
  applications: { layout: 'card', main: IdentificationCard, a: ClockCountdown },
  review: { layout: 'card', main: ClockCountdown, a: ShieldCheck },
  customers: { layout: 'card', main: AddressBook, a: UsersThree },
  towns: { layout: 'map', main: MapTrifold, a: House },
  places: { layout: 'map', main: MapPin, a: House },
  photos: { layout: 'stack', main: Images, a: Camera },
  ratings: { layout: 'bubbles', main: Star, a: Heart },
  help: { layout: 'bubbles', main: ChatCircleDots, a: ShieldCheck },
  shop: { layout: 'card', main: Storefront, a: Package },
  security: { layout: 'card', main: ShieldCheck, a: Key },
  promos: { layout: 'card', main: Gift, a: Tag },
  area: { layout: 'map', main: MapPinArea, a: House },
};

/** The glass picture for an empty state. `size` is its height. */
export function EmptyArt({ name, size = 112, className = '' }) {
  const scene = SCENES[name] || SCENES.parcels;
  const id = useArtId('ea');
  const url = (part) => `url(#${id}-${part})`;
  const h = Math.round(size * 1.25);
  const w = Math.round((h * 200) / 160);

  const icon = (Icon, x, y, s) => <Icon x={x} y={y} size={s} weight="fill" fill={url('main')} />;
  const glass = { fill: url('glass'), stroke: url('edge'), strokeWidth: 1.3 };
  const chip = (cx, cy, r, Icon) => (
    <g>
      <circle cx={cx} cy={cy} r={r} {...glass} filter={url('lift')} />
      {icon(Icon, cx - r * 0.6, cy - r * 0.6, r * 1.2)}
    </g>
  );
  const bar = (x, y, wBar, hBar, color = G.g200) => <rect x={x} y={y} width={wBar} height={hBar} rx={hBar / 2} fill={color} opacity="0.9" />;

  const layouts = {
    card: () => (
      <>
        <rect x="62" y="30" width="84" height="96" rx="20" transform="rotate(-9 104 78)" {...glass} opacity="0.5" />
        <rect x="56" y="34" width="88" height="96" rx="22" {...glass} strokeWidth="1.4" filter={url('lift')} />
        {icon(scene.main, 70, 52, 60)}
        {chip(148, 112, 16, scene.a)}
      </>
    ),
    device: () => (
      <>
        <rect x="70" y="14" width="62" height="128" rx="16" {...glass} strokeWidth="1.5" filter={url('lift')} />
        <rect x="91" y="21" width="20" height="4" rx="2" fill="#ffffff" opacity="0.9" />
        {[52, 78].map((y, i) => (
          <g key={y} opacity={1 - i * 0.35}>
            <rect x="77" y={y} width="48" height="18" rx="7" fill="#ffffff" opacity="0.75" />
            <circle cx="86" cy={y + 9} r="4.5" fill={G.g300} />
            {bar(94, y + 7.25, 24, 3.5)}
          </g>
        ))}
        <circle cx="138" cy="46" r="25" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {icon(scene.main, 122, 30, 32)}
        <circle cx="157" cy="27" r="5.5" fill={G.g500} stroke="#ffffff" strokeWidth="2" />
      </>
    ),
    stack: () => (
      <>
        <rect x="80" y="30" width="76" height="70" rx="16" transform="rotate(8 118 65)" {...glass} opacity="0.6" />
        <rect x="50" y="48" width="86" height="82" rx="18" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {icon(scene.main, 67, 63, 52)}
        {chip(150, 112, 16, scene.a)}
      </>
    ),
    chart: () => (
      <>
        <rect x="40" y="34" width="120" height="94" rx="18" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {[[60, 30], [82, 48], [104, 38], [126, 60]].map(([x, hBar], i) => (
          <rect key={x} x={x} y={114 - hBar} width="14" height={hBar} rx="5" fill={url('main')} opacity={0.55 + i * 0.15} />
        ))}
        <circle cx="156" cy="36" r="21" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {icon(scene.main, 143, 23, 26)}
      </>
    ),
    lens: () => (
      <>
        <rect x="104" y="34" width="56" height="64" rx="13" {...glass} opacity="0.55" />
        <circle cx="94" cy="72" r="38" fill="#ffffff" opacity="0.6" filter={url('lift')} />
        <circle cx="94" cy="72" r="38" fill="none" stroke={url('main')} strokeWidth="8" />
        <path d="M74 54a26 26 0 0 1 30 -8" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <path d="M122 100L146 124" stroke={url('main')} strokeWidth="13" strokeLinecap="round" />
        {icon(scene.a, 78, 56, 32)}
      </>
    ),
    map: () => (
      <>
        <path d="M100 116L34 90L100 64L166 90Z" fill={G.g300} opacity="0.4" transform="translate(0 7)" />
        <path d="M100 116L34 90L100 64L166 90Z" {...glass} strokeWidth="1.5" filter={url('lift')} />
        <ellipse cx="100" cy="90" rx="14" ry="5" fill={G.g800} opacity="0.18" />
        {icon(scene.main, 70, 22, 62)}
      </>
    ),
    bubbles: () => (
      <>
        <path d="M100 24h44a20 20 0 0 1 20 20v12a20 20 0 0 1 -20 20h-4l4 14l-18 -14h-26a20 20 0 0 1 -20 -20v-12a20 20 0 0 1 20 -20Z" {...glass} opacity="0.6" />
        <path d="M60 56h50a22 22 0 0 1 22 22v18a22 22 0 0 1 -22 22h-38l-22 16l4 -16a22 22 0 0 1 -16 -22v-18a22 22 0 0 1 22 -22Z" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {icon(scene.main, 66, 63, 48)}
      </>
    ),
    // A map card with a dotted route from A to a pin at B.
    route: () => (
      <>
        <rect x="36" y="38" width="128" height="94" rx="20" {...glass} strokeWidth="1.5" filter={url('lift')} />
        <path d="M36 98H164M112 38V132" stroke="#ffffff" strokeWidth="7" opacity="0.7" />
        <path d="M62 112C82 112 82 82 104 80S134 70 140 62" fill="none" stroke={url('main')} strokeWidth="4" strokeLinecap="round" strokeDasharray="1 8" />
        <circle cx="62" cy="112" r="8" fill={url('main')} stroke="#ffffff" strokeWidth="2.5" />
        {icon(scene.main, 121, 22, 40)}
        {chip(42, 46, 16, scene.a)}
      </>
    ),
    // Rings spreading out from a pin: looking for someone nearby.
    radar: () => (
      <>
        <circle cx="100" cy="78" r="60" {...glass} opacity="0.35" />
        <circle cx="100" cy="78" r="42" {...glass} opacity="0.6" />
        <circle cx="100" cy="78" r="26" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {icon(scene.main, 84, 62, 32)}
        <circle cx="52" cy="58" r="5" fill={G.g500} opacity="0.75" />
        <circle cx="150" cy="100" r="4" fill="#14b8a6" opacity="0.7" />
        <circle cx="134" cy="34" r="3.5" fill={G.g300} />
        {chip(150, 120, 16, scene.a)}
      </>
    ),
    // A round glass badge on a road.
    ride: () => (
      <>
        <rect x="26" y="116" width="148" height="14" rx="7" fill="#ffffff" opacity="0.7" />
        <path d="M44 123H156" stroke={G.g300} strokeWidth="3" strokeDasharray="10 9" strokeLinecap="round" />
        <circle cx="100" cy="70" r="44" {...glass} strokeWidth="1.5" filter={url('lift')} />
        {icon(scene.main, 74, 44, 52)}
        {chip(146, 40, 16, scene.a)}
      </>
    ),
  };
  const draw = layouts[scene.layout] || layouts.card;

  return (
    <span aria-hidden="true" className={`empty-art ${className}`.trim()} style={{ '--ea-h': `${h}px` }}>
      <svg viewBox="0 0 200 160" width={w} height={h} focusable="false">
        <Defs id={id} />
        <g filter={url('blur')}>
          <circle cx="76" cy="64" r="44" fill={url('blob')} opacity="0.65" />
          <circle cx="134" cy="104" r="34" fill={url('teal')} opacity="0.42" />
        </g>
        <ellipse cx="100" cy="148" rx="50" ry="6" fill={G.g800} opacity="0.1" />
        {draw()}
        <path d={sparklePath(176, 92, 5.5)} fill={G.g300} />
        <path d={sparklePath(28, 54, 4.5)} fill="#5eead4" />
      </svg>
    </span>
  );
}
