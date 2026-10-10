import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Bell, Coins, MapPin, Moon, Power, SealCheck, WarningCircle,
} from '@phosphor-icons/react';
import api from '../../api';
import { useAuth } from '../../auth';
import { useLive, useShareLocation } from '../../lib/hooks';
import { ago, JOB_STATUS, km, peso, plural, SIZES, VEHICLES } from '../../lib/format';
import { RiderMap } from '../../components/maps';
import { buyerPays, MiniRoute, OrderBadge, Progress } from '../../components/delivery';
import { Avatar, Empty, Loading, MapPage, Plate, RiderPill, StatStrip, useToast } from '../../components/ui';
import { EmptyArt, VehicleArt } from '../../components/art';

function Bellbutton() {
  const { unread } = useAuth();
  return (
    <Link to="/notifications" className="round-btn" aria-label="Notifications">
      <Bell size={22} />
      {unread > 0 && <b className="badge">{unread}</b>}
    </Link>
  );
}

function Head({ name }) {
  return (
    <header className="home-head">
      <Link to="/profile" className="home-head__me">
        <Avatar name={name} size="sm" />
        <span><small>Hi,</small><strong>{name.split(' ')[0]}</strong></span>
      </Link>
      <div className="page-head__actions home-head__actions"><Bellbutton /></div>
    </header>
  );
}

// Before approval: where the application stands.
const APPLICATION = {
  DRAFT: ['applications', 'Become a MoorMove rider', "Tell us where you'll ride and add photos of your ID and vehicle. MoorMove checks every rider before their first delivery."],
  NEEDS_CHANGES: ['applications', 'Your application needs changes', 'Please fix what the MoorMove team asked for, then send it again.'],
  PENDING: ['review', "We're checking your application", "Thanks! You'll get a notification once you're approved, usually within 1–2 working days."],
  REJECTED: ['riders', 'Your application was not approved', 'See the note below, or contact MoorMove if you have questions.'],
  SUSPENDED: ['riders', 'Your rider account is suspended', 'See the note below, or contact MoorMove to sort it out.'],
};

const STEPS_BEFORE = [
  ['Send your application', 'ID, license and vehicle photos'],
  ['Get approved', 'MoorMove checks your documents'],
  ['Go online and earn', 'Accept deliveries in your town'],
];

function NotApproved({ rider, name }) {
  const s = rider.status;
  const [art, title, text] = APPLICATION[s] || APPLICATION.DRAFT;
  const canEdit = s === 'DRAFT' || s === 'NEEDS_CHANGES';
  return (
    <div className="page-narrow">
      <Head name={name} />
      <section className="apply-hero">
        <RiderPill status={s} />
        <EmptyArt name={art} size={98} />
        <h2>{title}</h2>
        <p>{text}</p>
        {rider.reviewNote && s !== 'DRAFT' && <blockquote className="note">{rider.reviewNote}</blockquote>}
        {canEdit && (
          <Link to="/rider/apply" className="btn btn--primary btn--lg btn--shadow">
            {s === 'NEEDS_CHANGES' ? 'Fix application' : rider.townId || rider.vehicleType ? 'Continue application' : 'Start application'} <ArrowRight size={18} />
          </Link>
        )}
        {!canEdit && s !== 'PENDING' && <Link to="/info/help" className="btn btn--white">Contact MoorMove</Link>}
      </section>

      <section className="section section--plain">
        <div className="section__head"><h2>How to start</h2></div>
        <ol className="steps-list">
          {STEPS_BEFORE.map(([t, d], i) => {
            const done = (i === 0 && ['PENDING', 'APPROVED'].includes(s));
            return (
              <li key={t} className={done ? 'is-done' : i === (s === 'PENDING' ? 1 : 0) ? 'is-on' : ''}>
                <span className="steps-list__n">{i + 1}</span>
                <div><strong>{t}</strong><p className="muted">{d}</p></div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card ride-pitch">
        <div className="ride-pitch__art">
          {['BICYCLE', 'MOTORCYCLE', 'TRICYCLE'].map((v) => <VehicleArt key={v} type={v} size={96} />)}
        </div>
        <p><strong>Tricycle, motorcycle or bike.</strong> Deliver in your own town, whenever you go online.</p>
      </section>
    </div>
  );
}

function JobOffer({ job }) {
  return (
    <Link to={`/rider/jobs/${job.id}`} className="offer">
      <div className="offer__top">
        <span className="offer__earn">{peso(job.riderEarning)}</span>
        {job.awayKm !== null && <span className="offer__away"><MapPin size={14} weight="fill" /> {km(job.awayKm)} away</span>}
      </div>
      <OrderBadge job={job} />
      <MiniRoute from={job.pickupBarangay} to={job.dropoffBarangay} />
      <p className="offer__meta">
        <span>{km(job.distanceKm)} · {SIZES[job.packageSize].label}{job.source === 'EMOORM'
          ? buyerPays(job) > 0 && <> · <b>Collect {peso(buyerPays(job))}</b></>
          : job.codAmount > 0 && <> · <b>COD {peso(job.codAmount)}</b></>}</span>
        <span>{ago(job.createdAt)}</span>
      </p>
    </Link>
  );
}

export default function RiderHome() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, setData, reload } = useLive('/rider/dashboard', { every: 15000 });
  const approved = data?.rider.status === 'APPROVED';
  const online = approved && data.rider.isOnline;
  const { data: offers } = useLive('/rider/jobs/available', { every: 10000, skip: !online || Boolean(data?.active) });
  const { data: towns } = useLive(approved ? '/towns' : null, { skip: !approved });
  const { position, problem } = useShareLocation(online);
  const [busy, setBusy] = useState(false);

  if (error) return <><Head name={user.fullName} /><p className="alert">{error}</p></>;
  if (!data) return <><Head name={user.fullName} /><Loading /></>;
  if (!approved) return <NotApproved rider={data.rider} name={user.fullName} />;

  const toggle = async () => {
    setBusy(true);
    try {
      const rider = await api.put('/rider/online', { online: !online });
      setData({ ...data, rider });
      toast(rider.isOnline ? "You're online. New deliveries will show here." : "You're offline.");
      reload({ quiet: true });
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const { rider, active } = data;
  const me = position || offers?.here || (rider.lastLat !== null ? { lat: rider.lastLat, lng: rider.lastLng } : null);
  const townCenter = towns?.find((t) => t.id === rider.townId)?.center;
  const list = online && !active ? offers?.jobs || [] : [];
  const first = user.fullName.split(' ')[0];

  return (
    <MapPage
      tab
      back={false}
      title={`Hi, ${first}`}
      lead={(
        <Link to="/profile" className="float-chip">
          <Avatar name={user.fullName} size="xs" /> {online ? 'Online' : 'Offline'}
          <span className={`presence${online ? ' presence--on' : ''}`} />
        </Link>
      )}
      actions={<Bellbutton />}
      map={<RiderMap me={me} offers={list} center={townCenter} onOpen={(o) => navigate(`/rider/jobs/${o.id}`)} />}
      overlay={(
        <>
          {!online && <div className="map-veil"><span><Moon size={18} weight="fill" /> You&apos;re offline</span></div>}
          <div className="go-online">
            <button type="button" className={`go-btn${online ? ' go-btn--on' : ''}`} onClick={toggle} disabled={busy} aria-pressed={online}>
              <Power size={22} weight="bold" /> {busy ? '…' : online ? 'Go offline' : 'Go online'}
            </button>
          </div>
        </>
      )}
    >
      <StatStrip items={[
        { label: 'Today', value: peso(data.today.earnings), to: '/rider/earnings', tone: 'green' },
        { label: 'Trips today', value: data.today.deliveries },
        { label: 'Rating', value: data.rating ?? '—', sub: data.ratingCount ? plural(data.ratingCount, 'rating') : 'No ratings yet' },
      ]} />

      {data.owed > 0 && (
        <Link to="/rider/earnings" className="alert alert--warn owed-alert">
          <Coins size={20} weight="fill" /> <span>Commission to pay MoorMove: <strong>{peso(data.owed, { cents: true })}</strong></span> <ArrowRight size={16} />
        </Link>
      )}

      {data.cashToReturn?.length > 0 && (
        <div className="alert alert--warn cash-return">
          {data.cashToReturn.map((c) => (
            <Link key={c.id} to={`/rider/jobs/${c.id}`}>
              <Coins size={20} weight="fill" />
              <span>Bring <strong>{peso(c.codAmount)}</strong> back to {c.pickupName}{c.externalCode ? ` (order #${c.externalCode})` : ''}</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      )}

      {active && (
        <Link to={`/rider/jobs/${active.id}`} className="active-job">
          <div className="active-job__top">
            <span className="live-dot live-dot--white" />
            <strong>{JOB_STATUS[active.status].rider}</strong>
            <span className="active-job__earn">{peso(active.riderEarning)}</span>
          </div>
          {active.source === 'EMOORM' && <OrderBadge job={active} className="pill--white" />}
          <MiniRoute light from={`${active.pickup.name} · ${active.pickup.barangay}`} to={`${active.dropoff.name} · ${active.dropoff.barangay}`} />
          <Progress status={active.status} />
          <span className="active-job__go">Open delivery <ArrowRight size={16} weight="bold" /></span>
        </Link>
      )}

      {!active && (
        <section className="section section--plain">
          <div className="section__head">
            <div>
              <h2>Deliveries near you</h2>
              <p className="section__sub">{VEHICLES[rider.vehicleType]} · {rider.town?.name}</p>
            </div>
            {online && offers && <span className="pill pill--green">{offers.jobs.length} open</span>}
          </div>
          <div className="section__body list-gap">
            {!online ? (
              <Empty compact art="offline" title="You're offline">Tap Go online to start receiving deliveries in {rider.town?.name}.</Empty>
            ) : !offers ? <Loading /> : !offers.jobs.length ? (
              <Empty compact art="offers" title="No deliveries right now">New ones appear here and on the map by themselves. Stay online.</Empty>
            ) : offers.jobs.map((j) => <JobOffer key={j.id} job={j} />)}
          </div>
        </section>
      )}

      {online && problem && (
        <p className="alert alert--warn"><WarningCircle size={18} weight="fill" /> {problem}</p>
      )}

      <section className="section">
        <div className="section__head"><h2>Your ride</h2><Link to="/profile">Profile</Link></div>
        <div className="vehicle-card">
          <span className="vehicle-card__art"><VehicleArt type={rider.vehicleType} size={92} /></span>
          <div>
            <strong>{VEHICLES[rider.vehicleType]}</strong>
            <Plate>{rider.plateNumber}</Plate>
            <span className="muted small">{[rider.barangay, rider.town?.name].filter(Boolean).join(', ')}</span>
          </div>
          <SealCheck size={26} weight="fill" className="tone-green vehicle-card__ok" aria-label="Approved" />
        </div>
      </section>
    </MapPage>
  );
}
