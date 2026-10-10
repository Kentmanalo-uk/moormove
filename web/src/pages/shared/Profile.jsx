import { Link } from 'react-router-dom';
import {
  Bell, CaretRight, CheckCircle, ClockCounterClockwise, FileText, IdentificationCard, Info, Key, NotePencil,
  PlusCircle, Question, ShieldCheck, SignOut, Truck, Wallet, XCircle, House,
} from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { useInfo, useLive } from '../../lib/hooks';
import { plural, VEHICLES } from '../../lib/format';
import { Avatar, PageHead, Plate, RiderPill, Stars } from '../../components/ui';
import { VehicleArt } from '../../components/art';

function Row({ to, icon: Icon, label, sub, end, onClick, danger }) {
  const inner = (
    <>
      <span className="row__icon row__icon--ink"><Icon size={22} /></span>
      <span className="row__text">{label}{sub && <small>{sub}</small>}</span>
      <span className="row__end">{end}{!danger && <CaretRight size={18} />}</span>
    </>
  );
  return (
    <li>
      {to
        ? <Link className={`row${danger ? ' row--danger' : ''}`} to={to}>{inner}</Link>
        : <button type="button" className={`row${danger ? ' row--danger' : ''}`} onClick={onClick}>{inner}</button>}
    </li>
  );
}

function Shortcut({ to, icon: Icon, label, count, color }) {
  return (
    <Link to={to} className="shortcut">
      <span className="shortcut__icon" style={{ color }}>
        <Icon size={30} weight="fill" />
        {count > 0 && <b className="badge">{count}</b>}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function CustomerBlocks() {
  const { data } = useLive('/jobs', { params: { tab: 'ongoing' } });
  const c = data?.counts || {};
  const canBook = useInfo()?.publicBooking === true;
  return (
    <section className="section">
      <div className="section__head"><h2>My Deliveries</h2><Link to="/deliveries">See all</Link></div>
      <div className="shortcuts">
        <Shortcut to="/deliveries?tab=ongoing" icon={Truck} label="Ongoing" count={c.ongoing} color="#3b82f6" />
        <Shortcut to="/deliveries?tab=completed" icon={CheckCircle} label="Completed" color="#059669" />
        <Shortcut to="/deliveries?tab=cancelled" icon={XCircle} label="Cancelled" color="#9ca3af" />
        {canBook && <Shortcut to="/book" icon={PlusCircle} label="Book" color="#ec4899" />}
      </div>
    </section>
  );
}

function RiderBlocks({ rider }) {
  return (
    <>
      <section className="section">
        <div className="section__head"><h2>My Work</h2><Link to="/rider">Home</Link></div>
        <div className="shortcuts">
          <Shortcut to="/rider" icon={House} label="Jobs" color="#059669" />
          <Shortcut to="/rider/earnings" icon={Wallet} label="Earnings" color="#f59e0b" />
          <Shortcut to="/rider/history" icon={ClockCounterClockwise} label="History" color="#3b82f6" />
          <Shortcut to={['DRAFT', 'NEEDS_CHANGES'].includes(rider.status) ? '/rider/apply' : '/rider'} icon={IdentificationCard} label="Application" color="#8b5cf6" />
        </div>
      </section>
      {rider.vehicleType && (
        <section className="section">
          <div className="section__head"><h2>My Vehicle</h2><RiderPill status={rider.status} /></div>
          <div className="vehicle-card">
            <span className="vehicle-card__art"><VehicleArt type={rider.vehicleType} size={92} /></span>
            <div>
              <strong>{VEHICLES[rider.vehicleType]}</strong>
              <Plate>{rider.plateNumber}</Plate>
              <span className="muted small">{[rider.barangay, rider.town?.name].filter(Boolean).join(', ')}</span>
              {rider.todaName && <span className="muted small">{rider.todaName}{rider.mtopNumber ? ` · MTOP ${rider.mtopNumber}` : ''}</span>}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export default function Profile() {
  const { user, signOut, unread } = useAuth();
  const rider = user.role === 'RIDER';
  const { data: dash } = useLive(rider ? '/rider/dashboard' : null, { skip: !rider });
  return (
    <>
      <PageHead title="Profile">
        <Link to="/info/help" className="round-btn" aria-label="Help"><Question size={22} /></Link>
      </PageHead>

      <div className="page-grid page-grid--even">
        <div>
          <section className="profile-hero">
            <div className="profile-hero__cover" aria-hidden="true" />
            <div className="profile-hero__body">
              <Avatar name={user.fullName} size="xl" ring />
              <div className="profile-hero__text">
                <h2>{user.fullName}</h2>
                <span>{user.phone}</span>
                <span className="muted small">{user.email}</span>
                <span className="profile-hero__pills">
                  <span className="pill pill--green">{rider ? 'Rider' : 'Customer'}</span>
                  {rider && dash?.rating && <span className="pill pill--amber"><Stars value={dash.rating} size={12} /> {dash.rating} · {plural(dash.deliveries, 'delivery', 'deliveries')}</span>}
                </span>
              </div>
              <Link to="/profile/edit" className="round-btn round-btn--soft profile-hero__edit" aria-label="Edit profile"><NotePencil size={20} /></Link>
            </div>
          </section>

          {rider ? (dash?.rider && <RiderBlocks rider={dash.rider} />) : <CustomerBlocks />}
        </div>

        <div>
          <section className="section">
            <div className="section__head"><h2>Activity</h2></div>
            <ul className="rows">
              <Row to="/notifications" icon={Bell} label="Notifications" end={unread > 0 ? <span className="pill pill--red">{unread}</span> : null} />
              {rider
                ? <Row to="/rider/earnings" icon={Wallet} label="Earnings & commission" />
                : <Row to="/deliveries?tab=completed" icon={ClockCounterClockwise} label="Delivery history" />}
            </ul>
          </section>

          <section className="section">
            <div className="section__head"><h2>Account</h2></div>
            <ul className="rows">
              <Row to="/profile/edit" icon={NotePencil} label="Edit profile" sub="Name and mobile number" />
              <Row to="/profile/password" icon={Key} label="Change password" />
            </ul>
          </section>

          <section className="section">
            <div className="section__head"><h2>Support</h2></div>
            <ul className="rows">
              <Row to="/info/help" icon={Question} label="Help center" />
              <Row to="/info/terms" icon={FileText} label="Terms of Service" />
              <Row to="/info/privacy" icon={ShieldCheck} label="Privacy Policy" />
              <Row to="/info/about" icon={Info} label="About MoorMove" />
            </ul>
          </section>

          <section className="section">
            <ul className="rows rows--first">
              <Row icon={SignOut} label="Log out" onClick={signOut} danger />
            </ul>
          </section>
          <p className="app-version">MoorMove 0.3 · by the E-MOORM team</p>
        </div>
      </div>
    </>
  );
}
