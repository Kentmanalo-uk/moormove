import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUUpLeft, CheckCircle, Phone, Storefront } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { ACTIVE, ago, dateTime, failReasonOf, JOB_STATUS, peso } from '../../lib/format';
import { RouteMap } from '../../components/maps';
import {
  failedTrip, FreeChip, isFree, MoneyBlock, OrderBadge, orderPayText, Progress, returnedText, RiderCard, RouteBlock, StatusBlock, Timeline, TownHop,
  tripEarning, TripPayRows, tripPaid,
} from '../../components/delivery';
import { Avatar, BackBar, Empty, Field, JobPill, Loading, MapPage, PhotoGrid, Sheet, Stars, useToast } from '../../components/ui';

function AssignRider({ job, onAssigned }) {
  const toast = useToast();
  const { data: riders } = useLive(`/admin/jobs/${job.id}/riders`, { every: 15000 });
  const [busy, setBusy] = useState('');
  const assign = async (r) => {
    setBusy(r.id);
    try {
      onAssigned(await api.post(`/admin/jobs/${job.id}/assign`, { riderId: r.id }));
      toast(`${r.name} assigned`);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="section">
      <div className="section__head"><h2>Give it to a rider</h2></div>
      {riders?.length > 0 && (
        <p className="section__body muted small assign-note">Riders whose area covers both the pickup and the drop-off come first. You can still give it to one outside their area.</p>
      )}
      {!riders ? <Loading /> : !riders.length ? (
        <Empty compact art="riders" title="No free riders">
          {job.source === 'EMOORM'
            ? `No free riders in ${job.town.name} whose vehicle carries a ${job.packageSize.toLowerCase()} package right now.`
            : `No free ${job.vehicleType.toLowerCase()} riders in ${job.town.name} right now.`}
        </Empty>
      ) : (
        <ul className="rows">
          {riders.map((r, i) => (
            <li key={r.id} className={`row assign-row${r.coversArea ? '' : ' assign-row--out'}${!r.coversArea && (i === 0 || riders[i - 1].coversArea) ? ' assign-row--first-out' : ''}`}>
              <span className="table__avatar">
                <Avatar name={r.name} size="sm" />
                <span className={`presence presence--badge${r.isOnline ? ' presence--on' : ''}`} aria-label={r.isOnline ? 'Online' : 'Offline'} />
              </span>
              <span className="row__text">
                <span className="assign-row__name">
                  {r.name}
                  {r.coversArea
                    ? <span className="pill pill--green"><CheckCircle size={12} weight="fill" /> Covers this area</span>
                    : <span className="pill pill--amber">Outside their area</span>}
                </span>
                <small>{r.plateNumber || '—'} · {r.isOnline ? 'online' : `seen ${ago(r.lastSeenAt) || 'never'}`}</small>
                {r.areasSummary && <small>Area: {r.areasSummary}</small>}
              </span>
              <a className="round-btn round-btn--grey" href={`tel:${r.phone}`} aria-label={`Call ${r.name}`}><Phone size={18} weight="fill" /></a>
              <button type="button" className="btn btn--soft btn--sm" onClick={() => assign(r)} disabled={Boolean(busy)}>{busy === r.id ? '…' : 'Assign'}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminDelivery() {
  const { id } = useParams();
  const toast = useToast();
  const { data: job, error, setData } = useLive(`/admin/jobs/${id}`, { every: 10000 });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <><BackBar title="Delivery" /><p className="alert">{error}</p></>;
  if (!job) return <><BackBar title="Delivery" /><Loading /></>;
  // A parcel on its way back to the shop is closed with "Mark returned", not cancelled.
  const returning = job.status === 'RETURNING';
  const open = ['SEARCHING', ...ACTIVE].includes(job.status) && !returning;
  const order = job.source === 'EMOORM';
  const riderPos = ACTIVE.includes(job.status) && job.rider?.lat ? { lat: job.rider.lat, lng: job.rider.lng } : null;

  const cancel = async () => {
    setBusy(true);
    try {
      setData(await api.post(`/admin/jobs/${job.id}/cancel`, { reason }));
      setCancelOpen(false);
      toast('Delivery cancelled');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const markReturned = async () => {
    setBusy(true);
    try {
      setData(await api.post(`/admin/jobs/${job.id}/returned`));
      setReturnOpen(false);
      toast('Marked returned');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Not delivered: the reason picked, the rider's note (after " · " in failReason) and who pays for the trip.
  const failed = failedTrip(job);
  const failLabel = failReasonOf(job.failCode)?.label;
  const failNote = failLabel && job.failReason?.includes(' · ') ? job.failReason.slice(job.failReason.indexOf(' · ') + 3) : '';
  const paidTrip = failed && tripPaid(job);

  const statusText = [
    job.town.name,
    `booked ${dateTime(job.createdAt)}`,
    job.cancelReason,
    job.failReason,
    returning && job.returnTo ? `the rider is bringing the parcel back to ${job.returnTo.name}` : '',
    returnedText(job),
  ].filter(Boolean).join(' · ');

  return (
    <MapPage title={job.code} back="/admin/deliveries" actions={<JobPill status={job.status} />}
      map={<RouteMap fill pickup={job.pickup} dropoff={job.dropoff} rider={riderPos} searching={job.status === 'SEARCHING'} />}>
          {order && <OrderBadge job={job} />}
          {isFree(job) && <FreeChip job={job} line admin />}
          <TownHop job={job} />
          <section className="card status-card">
            <StatusBlock status={job.status} title={JOB_STATUS[job.status]?.label || job.status} text={statusText} />
            <Progress status={job.status} />
          </section>
          {job.rider && (
            <section className="card">
              <RiderCard rider={job.rider} />
              <Link to={`/admin/riders/${job.rider.id}`} className="card-link">Rider profile</Link>
            </section>
          )}
          {failed && (job.failReason || failLabel) && (
            <section className="section">
              <div className="section__head">
                <h2>Why it wasn&apos;t delivered</h2>
                {job.failCode && <span className={`pill ${job.buyerFault ? 'pill--red' : 'pill--grey'}`}>{job.buyerFault ? "Buyer's fault" : "Not the buyer's fault"}</span>}
              </div>
              <div className="section__body">
                <dl className="receipt">
                  <div className="kv"><dt>Reason</dt><dd>{failLabel || job.failReason}</dd></div>
                  {failNote && <div className="kv"><dt>Rider&apos;s note</dt><dd>{failNote}</dd></div>}
                  {job.failedAt && <div className="kv"><dt>Reported</dt><dd>{dateTime(job.failedAt)}</dd></div>}
                  <div className="kv"><dt>Rider paid for the trip</dt><dd className={paidTrip ? 'tone-green' : ''}>{paidTrip ? `Yes, ${peso(tripEarning(job), { cents: true })}` : 'No'}</dd></div>
                  <TripPayRows pay={job.tripPay} />
                </dl>
              </div>
            </section>
          )}
          {job.status === 'SEARCHING' && <AssignRider job={job} onAssigned={setData} />}
          <section className="section">
            <div className="section__head"><h2>Booked by</h2></div>
            <div className="section__body">
              {order ? (
                <p className="person"><Storefront size={30} weight="fill" className="tone-blue" /> <span><strong>E-MOORM order #{job.externalCode}</strong><small className="muted">{job.pickup.name} called a rider from E-MOORM. E-MOORM is told about every step.</small></span></p>
              ) : job.customer ? (
                <Link to={`/admin/customers/${job.customer.id}`} className="person">
                  <Avatar name={job.customer.fullName} size="sm" />
                  <span><strong>{job.customer.fullName}</strong><small className="muted">{job.customer.phone} · {job.customer.email}</small></span>
                </Link>
              ) : <p className="person"><Storefront size={30} weight="fill" className="tone-green" /> <span className="muted small">Booked by MoorMove for someone who called or walked in.</span></p>}
            </div>
          </section>
          <section className="section">
            <div className="section__head"><h2>Route</h2></div>
            <div className="section__body"><RouteBlock job={job} contact /></div>
          </section>
          <section className="section">
            <div className="section__head"><h2>Money</h2></div>
            <div className="section__body">
              <MoneyBlock job={job} />
              {order && <p className="small muted order-pay">For the rider: {orderPayText(job)}</p>}
              {/* Free deliveries: the fare and what MoorMove pays the rider are in the receipt above. */}
              {job.platformCut >= 0 && <div className="kv"><dt>MoorMove commission</dt><dd>{peso(job.platformCut, { cents: true })}</dd></div>}
              <div className="kv"><dt>Rider earns</dt><dd>{failed && !paidTrip ? 'No pay (not delivered)' : peso(job.riderEarning, { cents: true })}</dd></div>
              {(job.status === 'DELIVERED' || job.failPaid) && <div className="kv"><dt>{job.platformCut < 0 ? 'Rider paid by MoorMove' : 'Commission paid'}</dt><dd>{job.settlementId ? 'Yes' : 'Not yet'}</dd></div>}
              {job.codAmount > 0 && job.status === 'DELIVERED' && <div className="kv"><dt>{order ? 'COD back to the shop' : 'COD back to sender'}</dt><dd>{job.codReturnedAt ? `Confirmed ${dateTime(job.codReturnedAt)}` : 'Not confirmed yet'}</dd></div>}
            </div>
          </section>
          {job.rating && (
            <section className="card">
              <p className="small muted">Customer rating</p>
              <Stars value={job.rating} size={18} />
              {job.ratingComment && <p className="muted" style={{ marginTop: 6 }}>“{job.ratingComment}”</p>}
            </section>
          )}
          {(job.pickupPhotoId || job.deliveryPhotoId) && (
            <section className="section section--plain">
              <div className="section__head"><h2>Photos</h2></div>
              <div className="section__body"><PhotoGrid photos={[{ id: job.pickupPhotoId, label: 'At pickup' }, { id: job.deliveryPhotoId, label: 'Delivered' }]} /></div>
            </section>
          )}
          <section className="section section--plain">
            <div className="section__head"><h2>Timeline</h2></div>
            <div className="section__body"><Timeline events={job.events} /></div>
          </section>
          {returning && (
            <>
              <p className="alert alert--warn" style={{ marginTop: 12 }}>
                <ArrowUUpLeft size={20} weight="bold" />
                <span>The shop confirms on E-MOORM once it has the parcel. Mark it returned only if the shop has it but didn't confirm.</span>
              </p>
              <button type="button" className="btn btn--primary btn--block" onClick={() => setReturnOpen(true)}>Mark returned</button>
            </>
          )}
          {open && <button type="button" className="btn btn--danger btn--block" style={{ marginTop: 12 }} onClick={() => setCancelOpen(true)}>Cancel delivery</button>}

      <Sheet open={returnOpen} onClose={() => setReturnOpen(false)} label="Mark returned">
        <h2>Parcel back with {job.returnTo?.name || job.pickup.name}?</h2>
        <p>The delivery closes as not delivered and the rider can take new deliveries.{order ? ' E-MOORM is told.' : ''}</p>
        <div className="btn-row">
          <button type="button" className="btn btn--grey" onClick={() => setReturnOpen(false)}>Back</button>
          <button type="button" className="btn btn--primary" onClick={markReturned} disabled={busy}>{busy ? 'Saving…' : 'Mark returned'}</button>
        </div>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} label="Cancel delivery">
        <h2>Cancel {job.code}?</h2>
        <p>{order ? 'The shop (on E-MOORM)' : 'The customer'}{job.rider ? ' and the rider' : ''} will be told why.</p>
        <Field label="Reason" id="reason">
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The caller cancelled" />
        </Field>
        <div className="btn-row">
          <button type="button" className="btn btn--grey" onClick={() => setCancelOpen(false)}>Back</button>
          <button type="button" className="btn btn--danger" onClick={cancel} disabled={busy || !reason.trim()}>{busy ? 'Cancelling…' : 'Cancel delivery'}</button>
        </div>
      </Sheet>
    </MapPage>
  );
}
