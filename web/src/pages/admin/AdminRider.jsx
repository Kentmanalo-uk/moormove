import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPinArea, PencilSimple, Phone } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { ago, dateTime, peso, plural, VEHICLES } from '../../lib/format';
import { Avatar, BackBar, Empty, JobPill, Loading, PhotoGrid, Plate, RiderPill, StatStrip, useToast } from '../../components/ui';
import { VehicleArt } from '../../components/art';
import { AreaList } from '../../components/area';

// The decisions an admin can make, by the rider's state.
const ACTIONS = {
  PENDING: [
    { action: 'approve', label: 'Approve', tone: 'primary' },
    { action: 'needs_changes', label: 'Ask for changes', tone: 'soft', note: 'What should the rider fix?' },
    { action: 'reject', label: 'Reject', tone: 'danger', note: 'Why is the application rejected?' },
  ],
  APPROVED: [{ action: 'suspend', label: 'Suspend', tone: 'danger', note: 'Why is the rider suspended?' }],
  SUSPENDED: [{ action: 'reinstate', label: 'Reinstate', tone: 'primary' }],
};

const DOCS = [
  ['selfieUploadId', 'Selfie'],
  ['idUploadId', 'Valid ID'],
  ['licenseUploadId', "Driver's license"],
  ['orcrUploadId', 'OR/CR'],
  ['vehicleUploadId', 'Vehicle'],
];

export default function AdminRider() {
  const { id } = useParams();
  const toast = useToast();
  const { data: rider, error, setData, reload } = useLive(`/admin/riders/${id}`);
  const [asking, setAsking] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <><BackBar title="Rider" /><p className="alert">{error}</p></>;
  if (!rider) return <><BackBar title="Rider" /><Loading /></>;

  const decide = async (choice, withNote = '') => {
    setBusy(true);
    try {
      await api.patch(`/admin/riders/${id}`, { action: choice.action, note: withNote });
      setAsking(null);
      setNote('');
      toast('Saved. The rider has been told.');
      reload({ quiet: true });
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleAccount = async () => {
    try {
      await api.patch(`/admin/users/${rider.user.id}`, { isActive: !rider.user.isActive });
      setData({ ...rider, user: { ...rider.user, isActive: !rider.user.isActive } });
      toast(rider.user.isActive ? 'Account turned off' : 'Account turned on');
    } catch (err) {
      toast(err.message);
    }
  };

  const rows = [
    ['Mobile', rider.user.phone],
    ['Email', rider.user.email],
    ['Town', [rider.barangay, rider.town?.name].filter(Boolean).join(', ') || '—'],
    ['Vehicle', rider.vehicleType ? VEHICLES[rider.vehicleType] : '—'],
    ['Plate number', rider.plateNumber],
    ["Driver's license no.", rider.licenseNumber],
    ['TODA', rider.todaName],
    ['MTOP / franchise no.', rider.mtopNumber],
    ['Emergency contact', [rider.emergencyName, rider.emergencyPhone].filter(Boolean).join(' · ')],
    ['Signed up', dateTime(rider.user.createdAt)],
    ['Application sent', rider.submittedAt ? dateTime(rider.submittedAt) : null],
    ['Last seen', rider.lastSeenAt ? ago(rider.lastSeenAt) : null],
  ].filter(([, v]) => v);

  return (
    <>
      <BackBar title="Rider" to={`/admin/riders?status=${rider.status}`} />
      <section className="profile-hero">
        <div className="profile-hero__cover" aria-hidden="true">
          {rider.vehicleType && <span className="profile-hero__vehicle"><VehicleArt type={rider.vehicleType} size={150} /></span>}
        </div>
        <div className="profile-hero__body">
          <Avatar name={rider.user.fullName} size="xl" ring />
          <div className="profile-hero__text">
            <h2>{rider.user.fullName}</h2>
            <span className="muted small">{rider.vehicleType ? VEHICLES[rider.vehicleType] : 'No vehicle yet'} <Plate>{rider.plateNumber}</Plate></span>
            <span className="profile-hero__pills">
              <RiderPill status={rider.status} />
              {rider.status === 'APPROVED' && <span className={`pill ${rider.isOnline ? 'pill--green' : 'pill--grey'}`}><i />{rider.isOnline ? 'Online' : 'Offline'}</span>}
              {!rider.user.isActive && <span className="pill pill--red">Account off</span>}
            </span>
          </div>
          <a className="round-btn round-btn--green profile-hero__edit" href={`tel:${rider.user.phone}`} aria-label="Call"><Phone size={20} weight="fill" /></a>
        </div>
      </section>

      {rider.reviewNote && (
        <blockquote className="note">
          {rider.reviewNote}
          <footer>— {rider.reviewedBy?.fullName || 'Admin'}, {dateTime(rider.reviewedAt)}</footer>
        </blockquote>
      )}

      {ACTIONS[rider.status] && !asking && (
        <div className="decide">
          {ACTIONS[rider.status].map((choice) => (
            <button key={choice.action} type="button" className={`btn btn--${choice.tone}`} disabled={busy}
              onClick={() => (choice.note ? setAsking(choice) : decide(choice))}>
              {choice.label}
            </button>
          ))}
        </div>
      )}
      {asking && (
        <section className="card ask">
          <label htmlFor="note"><strong>{asking.note}</strong> The rider will see this.</label>
          <textarea id="note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="decide">
            <button type="button" className="btn btn--grey" onClick={() => { setAsking(null); setNote(''); }} disabled={busy}>Back</button>
            <button type="button" className={`btn btn--${asking.tone === 'danger' ? 'danger' : 'primary'}`} disabled={busy || !note.trim()} onClick={() => decide(asking, note)}>{asking.label}</button>
          </div>
        </section>
      )}

      {rider.status === 'APPROVED' || rider.status === 'SUSPENDED' ? (
        <StatStrip items={[
          { label: 'Deliveries', value: rider.stats.deliveries },
          { label: 'Rating', value: rider.stats.rating ? `★ ${rider.stats.rating}` : '—', sub: plural(rider.stats.ratingCount, 'rating') },
          rider.stats.owed < 0
            ? { label: 'MoorMove owes them', value: peso(-rider.stats.owed, { cents: true }), sub: `earned ${peso(rider.stats.earned)}`, to: '/admin/cash', tone: 'blue' }
            : { label: 'Owes', value: peso(rider.stats.owed, { cents: true }), sub: `earned ${peso(rider.stats.earned)}`, to: '/admin/cash', tone: rider.stats.owed ? 'amber' : undefined },
        ]} />
      ) : null}

      <section className="section admin-row area-section">
        <div className="section__head">
          <div>
            <h2><MapPinArea size={20} weight="fill" className="tone-green" /> Delivery area</h2>
            <p className="section__sub">Gets deliveries whose pickup and drop-off are both inside it</p>
          </div>
          <Link to={`/admin/riders/${rider.id}/area`} className="btn btn--soft btn--sm"><PencilSimple size={16} /> Edit area</Link>
        </div>
        <div className="section__body">
          <p className="area-section__sum">{rider.areasSummary || 'No area yet: the rider has no home town'}{rider.usesHomeTown && rider.areasSummary ? <span className="muted"> · their home town, nothing picked</span> : null}</p>
          {!rider.usesHomeTown && <AreaList area={{ homeTownId: rider.townId, areas: rider.areas }} homeTownName={rider.town?.name} />}
        </div>
      </section>

      <div className="grid-2 admin-row">
        <section className="section">
          <div className="section__head"><h2>Details</h2></div>
          <dl className="section__body">
            {rows.map(([k, v]) => <div key={k} className="kv"><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
        <section className="section">
          <div className="section__head"><h2>Documents</h2></div>
          <div className="section__body">
            {DOCS.some(([f]) => rider[f])
              ? <PhotoGrid photos={DOCS.map(([f, label]) => ({ id: rider[f], label }))} />
              : <Empty compact art="photos" title="No photos yet">The rider hasn't added any documents.</Empty>}
          </div>
        </section>
      </div>

      {rider.recent.length > 0 && (
        <section className="section">
          <div className="section__head"><h2>Recent deliveries</h2></div>
          <ul className="rows">
            {rider.recent.map((j) => (
              <li key={j.id}>
                <Link className="row" to={`/admin/deliveries/${j.id}`}>
                  <span className="row__text">{j.pickupBarangay} → {j.dropoffBarangay}<small>{j.code} · {ago(j.updatedAt)}{j.rating ? ` · ${j.rating}★` : ''}</small></span>
                  <span className="row__end"><JobPill status={j.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <ul className="rows rows--first">
          <li>
            <button type="button" className={`row${rider.user.isActive ? ' row--danger' : ''}`} onClick={toggleAccount}>
              <span className="row__text">{rider.user.isActive ? 'Turn off this account' : 'Turn this account back on'}<small>{rider.user.isActive ? 'They can no longer sign in' : 'They can sign in again'}</small></span>
            </button>
          </li>
        </ul>
      </section>
    </>
  );
}
