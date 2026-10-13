import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUUpLeft, ChatText, CheckCircle, ClipboardText, Gift, MagnifyingGlass, MapPin, MapTrifold, Moped, NavigationArrow, Package,
  Phone, Star, Storefront, XCircle,
} from '@phosphor-icons/react';
import { dateTime, JOB_STATUS, km, mapsLink, peso, plural, SIZES, smsLink, telLink, time, VEHICLES } from '../lib/format';
import { VehicleArt } from './art';
import { Avatar, JobPill, Plate, VehicleIcon } from './ui';

/** "E-MOORM order #EM-ABC123" on jobs that came from an E-MOORM shop. */
export function OrderBadge({ job, className = '' }) {
  if (job?.source !== 'EMOORM') return null;
  return (
    <span className={`pill pill--blue order-badge ${className}`}>
      <Storefront size={14} weight="fill" /> E-MOORM order{job.externalCode ? ` #${job.externalCode}` : ''}
    </span>
  );
}

/**
 * A free-delivery promo job: the buyer pays no delivery fee (fee 0, listFee
 * the usual fee) and MoorMove pays the rider's usual earning.
 */
export const isFree = (job) => Boolean(job?.promo) || (job?.listFee !== null && job?.listFee !== undefined && Number(job.fee) === 0);

/** What MoorMove pays the rider on a free delivery. */
export const moormovePays = (job) => (job.moormovePays > 0 ? job.moormovePays : job.riderEarning);

/** "Free delivery" chip; with `line`, the sentence for riders under it. */
export function FreeChip({ job, line = false, admin = false, className = '' }) {
  if (!isFree(job)) return null;
  const chip = (
    <span className={`pill pill--pink free-chip ${className}`} title={job.promo?.title || undefined}>
      <Gift size={14} weight="fill" /> Free delivery
    </span>
  );
  if (!line) return chip;
  return (
    <span className="free-line">
      {chip}
      <span>{admin
        ? <>Buyer pays no delivery fee{job.listFee ? ` (usually ${peso(job.listFee)})` : ''} · MoorMove pays the rider {peso(moormovePays(job))}</>
        : <>Buyer pays no delivery fee · you earn <b>{peso(job.riderEarning)}</b>, paid by MoorMove</>}</span>
    </span>
  );
}

/** [pickup town, drop-off town] when a delivery goes from one town to another, else null. */
export const townHop = (job) => {
  const from = job.townName || job.town?.name || (typeof job.town === 'string' ? job.town : null);
  const to = job.dropoffTownName || job.dropoffTown?.name || null;
  const fromId = job.townId || job.town?.id;
  const toId = job.dropoffTownId || job.dropoffTown?.id;
  if (!from || !to) return null;
  if ((fromId && toId && fromId === toId) || from === to) return null;
  return [from, to];
};

/** "Calapan City → Baco" on deliveries between towns. */
export function TownHop({ job, className = '' }) {
  const hop = townHop(job);
  if (!hop) return null;
  return (
    <span className={`town-hop ${className}`}>
      <MapTrifold size={15} weight="fill" /> {hop[0]} <ArrowRight size={12} weight="bold" /> {hop[1]}
    </span>
  );
}

/** What the buyer pays the rider on an E-MOORM order (COD item money plus the fee, when the buyer pays it). */
export const buyerPays = (job) => (job.feePaidBy === 'RECIPIENT' ? job.fee : 0) + (job.codAmount || 0);

/** Who pays the rider what on an E-MOORM order, in one sentence. */
export const orderPayText = (job) => {
  const fee = peso(job.fee);
  const cod = peso(job.codAmount);
  if (isFree(job)) {
    const earn = peso(moormovePays(job));
    return job.codAmount > 0
      ? `Free delivery: collect only ${cod} from the buyer and bring it back to the shop. MoorMove pays your ${earn}.`
      : `Free delivery: collect nothing from the buyer. MoorMove pays your ${earn}.`;
  }
  if (job.feePaidBy === 'RECIPIENT') {
    return job.codAmount > 0
      ? `Collect ${peso(buyerPays(job))} from the buyer — ${cod} goes back to the shop, ${fee} is yours.`
      : `Collect ${fee} from the buyer; it's yours.`;
  }
  return job.codAmount > 0
    ? `The shop pays you ${fee} at pickup. Collect ${cod} from the buyer and bring it back to the shop.`
    : `The shop pays you ${fee} at pickup; collect nothing from the buyer.`;
};

/** "Parcel returned Oct 12, 3:40 PM" on a failed delivery whose parcel is back with the shop. */
export const returnedText = (job) => (job?.returnedAt ? `Parcel returned ${dateTime(job.returnedAt)}` : '');

/** A trip that ended without delivering: the parcel coming back, or back. */
export const failedTrip = (job) => ['FAILED', 'RETURNING'].includes(job?.status);

/** The rider is still paid for a failed trip (the buyer's fault, on an E-MOORM order). */
export const tripPaid = (job) => Boolean(job?.tripPay ? job.tripPay.paid : job?.failPaid);

/** What the rider earns for a paid failed trip. */
export const tripEarning = (job) => (job?.tripPay ? job.tripPay.earning : job?.riderEarning) ?? 0;

/** Who pays whom for a failed E-MOORM trip, as receipt rows (`rider`: said to the rider). */
export function TripPayRows({ pay, rider = false }) {
  if (!pay) return null;
  return (
    <>
      {pay.shopPays > 0 && <div className="kv"><dt>{rider ? 'The shop pays you' : 'Shop pays the rider'}</dt><dd className="tone-green">{peso(pay.shopPays)}</dd></div>}
      {pay.moormovePays > 0 && <div className="kv"><dt>{rider ? 'MoorMove pays you' : 'MoorMove pays the rider'}</dt><dd className="tone-green">{peso(pay.moormovePays)}</dd></div>}
      {pay.kept > 0 && <div className="kv"><dt>{rider ? "You keep the shop's fee" : "Rider keeps the shop's fee"}</dt><dd className="tone-green">{peso(pay.kept)}</dd></div>}
      {pay.giveBack > 0 && <div className="kv"><dt>{rider ? 'Give back to the shop' : 'Rider gives back to the shop'}</dt><dd className="tone-amber">{peso(pay.giveBack)}</dd></div>}
    </>
  );
}

/** A and B, one above the other, joined by a dotted line. */
export function MiniRoute({ from, to, light = false }) {
  return (
    <ol className={`mini-route${light ? ' mini-route--light' : ''}`}>
      <li><i className="mini-route__a" /><span>{from}</span></li>
      <li><i className="mini-route__b" /><span>{to}</span></li>
    </ol>
  );
}

/** One delivery in a list. */
export function DeliveryCard({ job, to, money, extra }) {
  return (
    <Link to={to} className="dcard">
      {job.vehicleType
        ? <span className="dcard__art"><VehicleArt type={job.vehicleType} size={46} /></span>
        : <span className="dcard__art dcard__art--icon"><Package size={22} weight="duotone" /></span>}
      <span className="dcard__body">
        <span className="dcard__row">
          <span className="dcard__title">{job.pickupBarangay} <ArrowRight size={14} weight="bold" className="dcard__arrow" /> {job.dropoffBarangay}</span>
          <span className="dcard__money">{money ?? peso(job.fee)}</span>
        </span>
        <span className="dcard__row">
          <span className="dcard__meta">{extra || dateTime(job.createdAt)}</span>
          <JobPill status={job.status} />
        </span>
      </span>
    </Link>
  );
}

const FLOW = ['SEARCHING', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED'];
const FLOW_STEPS = [
  ['Booked', ClipboardText], ['Rider', Moped], ['Pickup', Package], ['On the way', NavigationArrow], ['Arrived', MapPin], ['Delivered', CheckCircle],
];

/** Where the delivery is: six steps with icons, joined by a line. */
export function Progress({ status }) {
  const at = FLOW.indexOf(status);
  if (at < 0) return null;
  return (
    <ol className="progress" aria-label="Progress" style={{ '--done': at / (FLOW.length - 1) }}>
      {FLOW_STEPS.map(([label, Icon], i) => (
        <li key={label} className={i < at ? 'is-done' : i === at ? 'is-on' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="progress__dot"><Icon size={15} weight={i <= at ? 'fill' : 'regular'} /></span>
          <small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

/** The big status line at the top of a delivery, with a radar while a rider is being found. */
export function StatusBlock({ status, title, text, extra }) {
  const s = JOB_STATUS[status] || { tone: 'grey' };
  const live = ['ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF'].includes(status);
  return (
    <div className={`status-block status-block--${s.tone}`}>
      <span className={`status-block__icon${status === 'SEARCHING' ? ' radar' : ''}`}>
        {status === 'SEARCHING' && <MagnifyingGlass size={24} weight="bold" />}
        {status === 'DELIVERED' && <CheckCircle size={28} weight="fill" />}
        {(status === 'CANCELLED' || status === 'FAILED') && <XCircle size={28} weight="fill" />}
        {status === 'RETURNING' && <ArrowUUpLeft size={26} weight="bold" />}
        {live && <NavigationArrow size={24} weight="fill" />}
      </span>
      <div className="status-block__text">
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {extra}
    </div>
  );
}

// The address with its barangay, unless the address already names it (E-MOORM
// addresses come whole: "12 Rizal St., Lalud, Calapan City").
export const place = (s) => (s.barangay && !String(s.address || '').toLowerCase().includes(s.barangay.toLowerCase())
  ? `${s.address}, ${s.barangay}`
  : s.address);

/** Pickup (A) and drop-off (B) (or `only` one), with call, text and directions when allowed. */
export function RouteBlock({ job, contact = false, directions = false, only }) {
  // Between towns: each stop says its town too.
  const hop = townHop(job);
  const withTown = (s, town) => (hop && town && !String(s.address || '').toLowerCase().includes(town.toLowerCase()) ? `${place(s)}, ${town}` : place(s));
  const stop = (s, letter, label, town) => (
    <li className="route__stop">
      <span className={`route__dot route__dot--${letter.toLowerCase()}`}>{letter}</span>
      <div className="route__text">
        <small className="route__label">{label}</small>
        <strong>{s.name}</strong>
        <span>{withTown(s, town)}</span>
        {s.notes && <span className="route__note">“{s.notes}”</span>}
        {(contact && s.phone) || directions ? (
          <div className="route__actions">
            {contact && s.phone && <a className="chip-btn" href={telLink(s.phone)}><Phone size={16} weight="fill" /> Call</a>}
            {contact && s.phone && <a className="chip-btn" href={smsLink(s.phone)}><ChatText size={16} weight="fill" /> Text</a>}
            {directions && <a className="chip-btn chip-btn--blue" href={mapsLink(s.lat, s.lng)} target="_blank" rel="noreferrer"><NavigationArrow size={16} weight="fill" /> Directions</a>}
          </div>
        ) : null}
      </div>
    </li>
  );
  return (
    <ol className="route">
      {only !== 'dropoff' && stop(job.pickup, 'A', 'Pickup', hop?.[0])}
      {only !== 'pickup' && stop(job.dropoff, 'B', 'Drop-off', hop?.[1])}
    </ol>
  );
}

export function RiderCard({ rider }) {
  if (!rider) return null;
  return (
    <div className="rider-card">
      <Avatar name={rider.name} ring />
      <div className="rider-card__text">
        <strong>{rider.name}</strong>
        <span className="rider-card__meta">
          <VehicleIcon type={rider.vehicleType} size={16} /> {VEHICLES[rider.vehicleType]}
          <Plate>{rider.plateNumber}</Plate>
        </span>
        <span className="rider-card__meta">
          {rider.rating ? <><Star size={14} weight="fill" className="star" /> <b>{rider.rating}</b> · </> : null}
          {plural(rider.deliveries, 'delivery', 'deliveries')}
        </span>
      </div>
      {rider.phone && (
        <div className="rider-card__actions">
          <a className="round-btn round-btn--soft" href={smsLink(rider.phone)} aria-label="Text the rider"><ChatText size={20} weight="fill" /></a>
          <a className="round-btn round-btn--green" href={telLink(rider.phone)} aria-label="Call the rider"><Phone size={20} weight="fill" /></a>
        </div>
      )}
    </div>
  );
}

/** Every step, newest first, with times. */
export function Timeline({ events }) {
  return (
    <ol className="timeline">
      {[...events].reverse().map((e, i) => (
        <li key={`${e.status}${e.createdAt}`} className={i === 0 ? 'is-on' : ''}>
          <span className="timeline__dot" />
          <div>
            <strong>{JOB_STATUS[e.status]?.label || e.status}</strong>
            {e.note && e.note !== 'Booked' && <span>{e.note}</span>}
          </div>
          <time>{time(e.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}

/** Package, fare, who pays and COD, as a receipt. */
export function MoneyBlock({ job, rider = false }) {
  const order = job.source === 'EMOORM';
  // Not delivered: the rider sees what this trip really pays, not the delivery's earning.
  const failed = rider && failedTrip(job);
  return (
    <>
      <div className="pkg-line">
        <span className="pkg-line__art"><VehicleArt type={job.vehicleType} size={64} /></span>
        <div>
          <strong>{job.packageDetails}</strong>
          <span>{SIZES[job.packageSize]?.label} package · {VEHICLES[job.vehicleType]} · {km(job.distanceKm)}</span>
        </div>
      </div>
      <dl className="receipt">
        {isFree(job) ? (
          <div className="kv"><dt>Fare</dt><dd>{job.listFee ? <s className="muted">{peso(job.listFee)}</s> : null} <span className="tone-pink">Free</span></dd></div>
        ) : <div className="kv"><dt>Fare</dt><dd>{peso(job.fee)}</dd></div>}
        {isFree(job) ? (
          <div className="kv"><dt>Promo</dt><dd>{job.promo?.title || 'Free delivery'}</dd></div>
        ) : <div className="kv"><dt>Paid by</dt><dd>{order
          ? (job.feePaidBy === 'SENDER' ? 'The shop, at pickup' : 'The buyer, at drop-off')
          : (job.feePaidBy === 'SENDER' ? 'Sender, at pickup' : 'Recipient, at drop-off')}</dd></div>}
        {!isFree(job) && <div className="kv"><dt>Payment</dt><dd>Cash</dd></div>}
        {isFree(job) && job.riderEarning !== undefined && !failed && (
          <div className="kv"><dt>{rider ? 'MoorMove pays you' : 'MoorMove pays the rider'}</dt><dd className="tone-green">{peso(moormovePays(job))}</dd></div>
        )}
        {job.codAmount > 0 && <div className="kv"><dt>{order ? 'COD for the shop' : 'COD to collect'}</dt><dd className="tone-amber">{peso(job.codAmount)}</dd></div>}
        {order && buyerPays(job) > 0 && !failed && <div className="kv"><dt>Buyer pays you</dt><dd className="tone-amber">{peso(buyerPays(job))}</dd></div>}
        {failed && <TripPayRows pay={job.tripPay} rider />}
        {rider && job.riderEarning !== undefined && (failed ? (
          tripPaid(job)
            ? <div className="kv kv--total"><dt>You earn<small className="kv__sub">for a failed trip (buyer&apos;s fault)</small></dt><dd className="tone-green">{peso(tripEarning(job))}</dd></div>
            : <div className="kv kv--total"><dt>You earn</dt><dd className="muted">No pay for this trip</dd></div>
        ) : (
          <div className="kv kv--total"><dt>You earn</dt><dd className="tone-green">{peso(job.riderEarning)}</dd></div>
        ))}
      </dl>
      {rider && order && !failed && <p className="small muted order-pay">{orderPayText(job)}</p>}
    </>
  );
}
