import { Link } from 'react-router-dom';
import {
  Bell, CheckCircle, ClockCounterClockwise, FileText, House, IdentificationCard, Info, Key, MapPinArea, NotePencil,
  PlusCircle, Question, ShieldCheck, SignOut, Truck, Wallet, XCircle,
} from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { useInfo, useLive } from '../../lib/hooks';
import { peso, VEHICLES } from '../../lib/format';
import { PageHead, Plate, RiderPill, Stars } from '../../components/ui';
import { MeHeader, NumberStrip, RowList, ToolGrid } from '../../components/me';
import { VehicleArt } from '../../components/art';

/*
 * The rider's (and customer's) "Me" tab, in E-MOORM's Profile / Seller Center
 * Me look. Each list is an array of rows, so a new place (a rider's
 * "Delivery area", say) is one more row in RIDER_WORK.
 */
const RIDER_WORK = [
  { to: '/rider/area', label: 'Delivery area', icon: MapPinArea, sub: 'The towns and barangays you deliver in' },
  { to: '/rider/earnings', label: 'Earnings & commission', icon: Wallet },
  { to: '/rider/history', label: 'Delivery history', icon: ClockCounterClockwise },
];

const ACCOUNT = [
  { to: '/profile/edit', label: 'Edit profile', icon: NotePencil, sub: 'Name and mobile number' },
  { to: '/profile/password', label: 'Change password', icon: Key },
];

const SUPPORT = [
  { to: '/info/help', label: 'Help center', icon: Question },
  { to: '/info/terms', label: 'Terms of Service', icon: FileText },
  { to: '/info/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { to: '/info/about', label: 'About MoorMove', icon: Info },
];

function CustomerBlocks() {
  const { data } = useLive('/jobs', { params: { tab: 'ongoing' } });
  const c = data?.counts || {};
  const canBook = useInfo()?.publicBooking === true;
  return (
    <ToolGrid title="My Deliveries" more={{ to: '/deliveries', label: 'See all' }} tools={[
      { to: '/deliveries?tab=ongoing', label: 'Ongoing', icon: Truck, color: '#3b82f6', count: c.ongoing },
      { to: '/deliveries?tab=completed', label: 'Completed', icon: CheckCircle, color: '#059669' },
      { to: '/deliveries?tab=cancelled', label: 'Cancelled', icon: XCircle, color: '#9ca3af' },
      canBook && { to: '/book', label: 'Book', icon: PlusCircle, color: '#ec4899' },
    ]} />
  );
}

function RiderBlocks({ rider }) {
  const canApply = ['DRAFT', 'NEEDS_CHANGES'].includes(rider.status);
  return (
    <>
      <ToolGrid title="My Work" more={{ to: '/rider', label: 'Home' }} tools={[
        { to: '/rider', label: 'Jobs', icon: House, color: '#059669' },
        { to: '/rider/earnings', label: 'Earnings', icon: Wallet, color: '#f59e0b' },
        { to: '/rider/history', label: 'History', icon: ClockCounterClockwise, color: '#3b82f6' },
        { to: canApply ? '/rider/apply' : '/rider', label: 'Application', icon: IdentificationCard, color: '#8b5cf6' },
      ]} />
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
  const approved = dash?.rider?.status === 'APPROVED';
  return (
    <>
      <PageHead title="Me">
        <Link to="/info/help" className="round-btn only-phone" aria-label="Help"><Question size={22} /></Link>
      </PageHead>

      <div className="page-grid page-grid--even">
        <div>
          <div className="me-card">
            <MeHeader name={user.fullName} line={user.email} edit="/profile/edit">
              <span className="me-head__line">{user.phone}</span>
              <span className="me-head__pills">
                <span className="pill pill--green">{rider ? 'Rider' : 'Customer'}</span>
                {rider && dash?.rating && <span className="pill pill--amber"><Stars value={dash.rating} size={12} /> {dash.rating}</span>}
              </span>
            </MeHeader>
            {rider && approved && (
              <NumberStrip items={[
                { label: 'Deliveries', value: dash.deliveries ?? 0, to: '/rider/history' },
                { label: 'Rating', value: dash.rating ?? '—' },
                { label: 'Today', value: peso(dash.today?.earnings), to: '/rider/earnings' },
              ]} />
            )}
          </div>

          {rider ? (dash?.rider && <RiderBlocks rider={dash.rider} />) : <CustomerBlocks />}
        </div>

        <div>
          <RowList title="Activity" rows={[
            { to: '/notifications', label: 'Notifications', icon: Bell, end: unread > 0 ? <span className="pill pill--red">{unread}</span> : null },
            ...(rider
              // The area row shows where they deliver now.
              ? RIDER_WORK.map((r) => (r.to === '/rider/area' && dash?.rider?.areasSummary ? { ...r, sub: dash.rider.areasSummary } : r))
              : [{ to: '/deliveries?tab=completed', label: 'Delivery history', icon: ClockCounterClockwise }]),
          ]} />
          <RowList title="Account" rows={ACCOUNT} />
          <RowList title="Support" rows={SUPPORT} />
          <RowList rows={[{ label: 'Log out', icon: SignOut, onClick: signOut, danger: true }]} />
          <p className="app-version">MoorMove 0.3 · by the E-MOORM team</p>
        </div>
      </div>
    </>
  );
}
