import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, Copy, Money, Question, Star } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { ACTIVE, dateTime, JOB_STATUS, peso } from '../../lib/format';
import { RouteMap } from '../../components/maps';
import { MoneyBlock, Progress, RiderCard, RouteBlock, StatusBlock, Timeline } from '../../components/delivery';
import { Avatar, BackBar, Field, Loading, MapPage, PhotoGrid, Sheet, Stars, useToast } from '../../components/ui';

const REASONS = ['I booked by mistake', 'The details are wrong', 'It took too long to find a rider', 'I no longer need it'];
const CANCELLABLE = ['SEARCHING', 'ACCEPTED', 'AT_PICKUP'];

function RateCard({ job, onDone }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const send = async () => {
    setBusy(true);
    try {
      onDone(await api.post(`/jobs/${job.id}/rate`, { rating: stars, comment }));
      toast('Thanks for rating!');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };
  const name = job.rider?.name.split(' ')[0] || 'your rider';
  return (
    <section className="card rate-card">
      {job.rider && <Avatar name={job.rider.name} size="lg" ring />}
      <h2>How was {name}?</h2>
      <p className="muted small">Your rating helps riders in your town.</p>
      <div className="stars-pick" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} stars`} className={n <= stars ? 'is-on' : ''} onClick={() => setStars(n)}>
            <Star size={36} weight="fill" />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <Field id="comment">
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Say something nice, or what could be better (optional)" />
          </Field>
          <button type="button" className="btn btn--primary btn--block" onClick={send} disabled={busy}>Send rating</button>
        </>
      )}
    </section>
  );
}

export default function DeliveryDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: job, error, setData, reload } = useLive(`/jobs/${id}`, { every: 8000 });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);

  if (error) return <><BackBar title="Delivery" /><p className="alert">{error}</p></>;
  if (!job) return <><BackBar title="Delivery" /><Loading /></>;

  const s = JOB_STATUS[job.status];
  const live = ACTIVE.includes(job.status);
  const riderPos = live && job.rider?.lat ? { lat: job.rider.lat, lng: job.rider.lng } : null;

  const cancel = async () => {
    setBusy(true);
    try {
      setData(await api.post(`/jobs/${job.id}/cancel`, { reason }));
      setCancelOpen(false);
      toast('Delivery cancelled');
    } catch (err) {
      toast(err.message);
      reload({ quiet: true });
    } finally {
      setBusy(false);
    }
  };

  const codBack = async () => {
    try {
      setData(await api.post(`/jobs/${job.id}/cod-returned`));
      toast('Thanks! The rider has been told.');
    } catch (err) {
      toast(err.message);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(job.code).then(() => toast('Code copied')).catch(() => {});
  };

  const text = {
    SEARCHING: `Riders in ${job.town.name} can see your booking now.`,
    DELIVERED: `Delivered ${dateTime(job.deliveredAt)} to ${job.dropoff.name}`,
    CANCELLED: job.cancelReason || 'Cancelled',
    FAILED: job.failReason,
  }[job.status] || (job.rider ? `${job.rider.name} · ${job.dropoff.barangay}` : '');

  return (
    <MapPage
      title={job.code}
      back="/deliveries"
      actions={<button type="button" className="round-btn" onClick={copy} aria-label="Copy code" title="Copy code"><Copy size={20} /></button>}
      map={<RouteMap fill pickup={job.pickup} dropoff={job.dropoff} rider={riderPos} searching={job.status === 'SEARCHING'} />}
    >
      <section className="card status-card">
        <StatusBlock status={job.status} title={s.customer} text={text} />
        <Progress status={job.status} />
        <div className="status-card__code"><span>Code</span><b>{job.code}</b><button type="button" className="link-btn small" onClick={copy}>Copy</button></div>
      </section>

      {job.rider && (
        <section className="card">
          <RiderCard rider={job.rider} />
        </section>
      )}

      {job.status === 'DELIVERED' && job.codAmount > 0 && (
        <section className={`card cod-card${job.codReturnedAt ? ' cod-card--done' : ''}`}>
          {job.codReturnedAt ? (
            <p><CheckCircle size={20} weight="fill" className="tone-green" /> You confirmed getting the COD of <b>{peso(job.codAmount)}</b>.</p>
          ) : (
            <>
              <div className="cod-card__top">
                <Money size={26} weight="fill" />
                <p><strong>COD {peso(job.codAmount)}</strong> was collected from {job.dropoff.name}. Did the rider bring it back to you?</p>
              </div>
              <button type="button" className="btn btn--primary btn--block" onClick={codBack}>I got the money</button>
            </>
          )}
        </section>
      )}

      {job.status === 'DELIVERED' && !job.rating && <RateCard job={job} onDone={setData} />}
      {job.rating && (
        <section className="card rated">
          <span className="muted small">You rated this delivery</span>
          <Stars value={job.rating} size={20} />
          {job.ratingComment && <p>“{job.ratingComment}”</p>}
        </section>
      )}

      <section className="section">
        <div className="section__head"><h2>Route</h2></div>
        <div className="section__body"><RouteBlock job={job} /></div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Package &amp; payment</h2></div>
        <div className="section__body"><MoneyBlock job={job} /></div>
      </section>

      {(job.pickupPhotoId || job.deliveryPhotoId) && (
        <section className="section section--plain">
          <div className="section__head"><h2>Photos</h2></div>
          <div className="section__body">
            <PhotoGrid photos={[{ id: job.pickupPhotoId, label: 'At pickup' }, { id: job.deliveryPhotoId, label: 'Delivered' }]} />
          </div>
        </section>
      )}

      <section className="section section--plain">
        <div className="section__head"><h2>Timeline</h2></div>
        <div className="section__body"><Timeline events={job.events} /></div>
      </section>

      <div className="detail-actions">
        {CANCELLABLE.includes(job.status) && (
          <>
            <button type="button" className="btn btn--danger btn--block" onClick={() => setCancelOpen(true)}>Cancel delivery</button>
            <p className="detail-actions__note">You can cancel until the rider picks up the package. It's free.</p>
          </>
        )}
        <Link to="/info/help" className="btn btn--white btn--block"><Question size={18} /> Need help?</Link>
      </div>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} label="Cancel delivery">
        <h2>Cancel this delivery?</h2>
        <p>{job.rider ? `${job.rider.name} will be told it's cancelled.` : 'No rider has taken it yet.'}</p>
        <div className="reason-list" role="radiogroup">
          {REASONS.map((r) => (
            <label key={r} className="check">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
              <span>{r}</span>
            </label>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn--grey" onClick={() => setCancelOpen(false)}>Keep it</button>
          <button type="button" className="btn btn--danger" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel delivery'}</button>
        </div>
      </Sheet>
    </MapPage>
  );
}
