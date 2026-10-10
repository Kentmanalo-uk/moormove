import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, CheckCircle, Coins, Gift, MapPin, MapPinArea, Package, WarningCircle } from '@phosphor-icons/react';
import api from '../../api';
import { useLive, useShareLocation } from '../../lib/hooks';
import { ACTIVE, dateTime, JOB_STATUS, km, peso, SIZES } from '../../lib/format';
import { RouteMap } from '../../components/maps';
import {
  buyerPays, FreeChip, isFree, moormovePays, MoneyBlock, OrderBadge, orderPayText, Progress, RouteBlock, StatusBlock, Timeline, TownHop,
} from '../../components/delivery';
import { BackBar, Field, Loading, MapPage, PhotoField, PhotoGrid, Sheet, Stars, useToast } from '../../components/ui';

// The button for each step, and whether it needs a photo.
const NEXT = {
  ACCEPTED: { label: "I've arrived at the pickup" },
  AT_PICKUP: { label: 'Picked up', photo: 'Photo of the package', hint: 'Show the package in your hands or on the vehicle' },
  PICKED_UP: { label: "I've arrived at the drop-off" },
  AT_DROPOFF: { label: 'Delivered', photo: 'Proof of delivery', hint: 'The package with the recipient or at the door' },
};

const GIVE_BACK = ['Vehicle trouble', 'Emergency', "Can't find the pickup", 'Sender not answering', 'Package too big for my vehicle'];
const CANT_DELIVER = ['Recipient not answering', 'Recipient refused the package', 'Wrong address', 'Recipient did not pay', 'Package damaged'];

function StepPanel({ job, onDone, position }) {
  const toast = useToast();
  const next = NEXT[job.status];
  const [photoId, setPhotoId] = useState(null);
  const [cod, setCod] = useState(false);
  const [busy, setBusy] = useState(false);
  const atPickupSide = ['ACCEPTED', 'AT_PICKUP'].includes(job.status);
  // A free delivery has no fare to collect: MoorMove pays the rider.
  const free = isFree(job);
  const collectFee = !free && job.fee > 0 && ((atPickupSide && job.feePaidBy === 'SENDER') || (!atPickupSide && job.feePaidBy === 'RECIPIENT'));
  const needsCod = job.status === 'AT_DROPOFF' && job.codAmount > 0;
  const order = job.source === 'EMOORM';
  // What the rider ticks at delivery: on E-MOORM orders, everything the buyer pays.
  const collected = order ? buyerPays(job) : job.codAmount;

  const go = async () => {
    setBusy(true);
    try {
      const body = { ...(photoId ? { photoId } : {}), ...(needsCod ? { codCollected: cod } : {}), ...(position || {}) };
      onDone(await api.post(`/rider/jobs/${job.id}/step`, body));
      setPhotoId(null);
      setCod(false);
      if (job.status === 'AT_DROPOFF') toast(`Delivered! You earned ${peso(job.riderEarning)}.`);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card step-panel">
      <div className="step-panel__head">
        <span className="step-panel__icon">{next.photo ? <Camera size={22} weight="fill" /> : <MapPin size={22} weight="fill" />}</span>
        <div>
          <small>Next step</small>
          <h2>{JOB_STATUS[job.status].rider}</h2>
        </div>
      </div>
      {order && (
        <div className="collect">
          <Coins size={22} weight="fill" />
          <div><p>{orderPayText(job)}</p></div>
        </div>
      )}
      {!order && free && (
        <div className="collect collect--free">
          <Gift size={22} weight="fill" />
          <div><p>Free delivery: collect no fare. MoorMove pays your <strong>{peso(moormovePays(job))}</strong>.</p></div>
        </div>
      )}
      {!order && (collectFee || needsCod) && (
        <div className="collect">
          <Coins size={22} weight="fill" />
          <div>
            {collectFee && <p>Collect the fare <strong>{peso(job.fee)}</strong> from the {atPickupSide ? 'sender' : 'recipient'}.</p>}
            {(needsCod || (!atPickupSide && job.codAmount > 0)) && <p>Collect COD <strong>{peso(job.codAmount)}</strong> and bring it back to {job.pickup.name}.</p>}
          </div>
        </div>
      )}
      {next.photo && (
        <PhotoField label={next.photo} hint={next.hint} value={photoId} onChange={setPhotoId} capture="environment" />
      )}
      {needsCod && (
        <label className="check" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} />
          <span>{order ? 'I collected' : 'I collected the COD of'} <strong>{peso(collected)}</strong>{order ? ' from the buyer' : ''}</span>
        </label>
      )}
      <button type="button" className="btn btn--primary btn--block btn--lg btn--shadow" style={{ marginTop: 12 }} onClick={go}
        disabled={busy || (next.photo && !photoId) || (needsCod && !cod)}>
        {busy ? 'Saving…' : next.label}
      </button>
    </section>
  );
}

export default function RiderJob() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: job, error, setData, reload } = useLive(`/rider/jobs/${id}`, { every: 8000 });
  const mine = Boolean(job?.pickup.phone);
  const active = mine && ACTIVE.includes(job?.status);
  const { position } = useShareLocation(active);
  const [problem, setProblem] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [outside, setOutside] = useState('');

  if (error) return <><BackBar title="Delivery" /><p className="alert">{error}</p></>;
  if (!job) return <><BackBar title="Delivery" /><Loading /></>;

  const accept = async () => {
    setBusy(true);
    try {
      setData(await api.post(`/rider/jobs/${job.id}/accept`));
      toast('Delivery accepted. Head to the pickup.');
    } catch (err) {
      if (err.status === 409 && /outside your area/i.test(err.message)) {
        setOutside(err.message);
        return;
      }
      toast(err.message);
      if (err.status === 409 || err.status === 404) navigate('/rider', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const beforePickup = ['ACCEPTED', 'AT_PICKUP'].includes(job.status);
  const reasons = beforePickup ? GIVE_BACK : CANT_DELIVER;
  const report = async () => {
    setBusy(true);
    try {
      if (beforePickup) {
        await api.post(`/rider/jobs/${job.id}/release`, { reason });
        toast('Delivery given back');
        navigate('/rider', { replace: true });
      } else {
        setData(await api.post(`/rider/jobs/${job.id}/fail`, { reason }));
        toast('Reported. Please bring the package back to the sender.');
        setProblem(false);
      }
    } catch (err) {
      toast(err.message);
      reload({ quiet: true });
    } finally {
      setBusy(false);
    }
  };

  // An open delivery the rider hasn't taken: a preview without phone numbers.
  if (!mine) {
    return (
      <MapPage title="New delivery" back="/rider" map={<RouteMap fill pickup={job.pickup} dropoff={job.dropoff} />}>
        <section className="earn-hero">
          <OrderBadge job={job} className="pill--white" />
          <span>You earn</span>
          <strong>{peso(job.riderEarning)}</strong>
          <small>{km(job.distanceKm)} · {SIZES[job.packageSize].label} package{job.codAmount > 0 ? ` · ${isFree(job) ? 'collect only' : 'COD'} ${peso(job.codAmount)}` : ''}</small>
          <TownHop job={job} className="earn-hero__hop" />
          <FreeChip job={job} line />
        </section>
        {outside && (
          <div className="alert alert--warn outside-alert" role="alert">
            <MapPinArea size={20} weight="fill" />
            <span><b>{outside}.</b> You only get deliveries whose pickup and drop-off are both in your area.</span>
            <Link to="/rider/area" className="btn btn--soft btn--sm">Change area</Link>
          </div>
        )}
        <section className="section">
          <div className="section__head"><h2>Route</h2></div>
          <div className="section__body"><RouteBlock job={job} /></div>
        </section>
        <section className="section">
          <div className="section__head"><h2>Details</h2></div>
          <div className="section__body"><MoneyBlock job={job} rider /></div>
        </section>
        <div className="sticky-action">
          {job.status === 'SEARCHING'
            ? <><button type="button" className="btn btn--grey btn--lg" onClick={() => navigate('/rider')} disabled={busy}>Skip</button><button type="button" className="btn btn--primary btn--lg" onClick={accept} disabled={busy || Boolean(outside)}>{busy ? 'Accepting…' : outside ? 'Outside your area' : `Accept · ${peso(job.riderEarning)}`}</button></>
            : <p className="alert alert--warn">This delivery was taken by another rider.</p>}
        </div>
      </MapPage>
    );
  }

  const done = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(job.status);
  const order = job.source === 'EMOORM';
  // E-MOORM COD: the item money goes back to the shop, who confirms it on E-MOORM.
  const cashBack = order && job.status === 'DELIVERED' && job.codAmount > 0;
  const target = ['ACCEPTED', 'AT_PICKUP'].includes(job.status) ? 'pickup' : 'dropoff';

  return (
    <MapPage title={job.code} back="/rider" compactMap={done}
      map={<RouteMap fill pickup={job.pickup} dropoff={job.dropoff} me={active ? position : null} />}>
      {order && <OrderBadge job={job} />}
      {isFree(job) && <FreeChip job={job} line />}
      <TownHop job={job} />

      {active && (
        <section className="card status-card">
          <Progress status={job.status} />
        </section>
      )}

      {done && (
        <section className="card status-card">
          <StatusBlock status={job.status} title={JOB_STATUS[job.status].rider}
            text={{
              DELIVERED: `${dateTime(job.deliveredAt)} · you earned ${peso(job.riderEarning)}`,
              CANCELLED: job.cancelReason || 'Cancelled',
              FAILED: `${job.failReason}. Bring the package back to ${job.pickup.name}.`,
            }[job.status]} />
        </section>
      )}

      {cashBack && (job.codReturnedAt ? (
        <p className="alert alert--ok"><CheckCircle size={20} weight="fill" /> Shop confirmed the cash ✓</p>
      ) : (
        <p className="alert alert--warn"><Coins size={20} weight="fill" /> Bring <strong>{peso(job.codAmount)}</strong> back to {job.pickup.name}.</p>
      ))}

      {active && <StepPanel job={job} onDone={setData} position={position} />}

      {active && (
        <section className="section">
          <div className="section__head"><h2>{target === 'pickup' ? 'Pickup' : 'Drop-off'}</h2><span className="pill pill--grey">{target === 'pickup' ? 'A' : 'B'}</span></div>
          <div className="section__body">
            <RouteBlock job={job} only={target} contact directions />
          </div>
        </section>
      )}

      {job.rating && (
        <section className="card rated">
          <span className="muted small">The customer rated you</span>
          <Stars value={job.rating} size={20} />
          {job.ratingComment && <p>“{job.ratingComment}”</p>}
        </section>
      )}

      <section className="section">
        <div className="section__head"><h2>{active ? 'Whole route' : 'Route'}</h2></div>
        <div className="section__body"><RouteBlock job={job} contact={active} /></div>
      </section>

      <section className="section">
        <div className="section__head"><h2><Package size={20} className="tone-green" /> Package &amp; pay</h2></div>
        <div className="section__body"><MoneyBlock job={job} rider /></div>
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

      {active && (
        <div className="detail-actions">
          <button type="button" className="btn btn--danger btn--block" onClick={() => { setReason(reasons[0]); setProblem(true); }}>
            <WarningCircle size={18} /> {beforePickup ? 'Give back this delivery' : "Can't deliver"}
          </button>
        </div>
      )}

      <Sheet open={problem} onClose={() => setProblem(false)} label="Problem">
        <h2>{beforePickup ? 'Give back this delivery?' : "Can't deliver?"}</h2>
        <p>{beforePickup ? 'It goes back to other riders and the customer is told.' : 'The customer and MoorMove are told. Bring the package back to the sender.'}</p>
        <div className="reason-list">
          {reasons.map((r) => (
            <label key={r} className="check">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
              <span>{r}</span>
            </label>
          ))}
        </div>
        <Field label="Or say what happened" id="reason-other">
          <input id="reason-other" value={reasons.includes(reason) ? '' : reason} onChange={(e) => setReason(e.target.value)} placeholder="Something else…" />
        </Field>
        <div className="btn-row">
          <button type="button" className="btn btn--grey" onClick={() => setProblem(false)}>Back</button>
          <button type="button" className="btn btn--danger" onClick={report} disabled={busy || !reason.trim()}>{busy ? 'Sending…' : beforePickup ? 'Give back' : 'Report'}</button>
        </div>
      </Sheet>
    </MapPage>
  );
}
