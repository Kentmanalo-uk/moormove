import { Link, useNavigate } from 'react-router-dom';
import {
  AddressBook, Bell, Coins, GearSix, Gift, MapTrifold, Moped, Package, Plus, UserPlus, Wallet,
} from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { ToolGrid } from '../../components/me';
import { useLive } from '../../lib/hooks';
import { ago, peso, plural, VEHICLES } from '../../lib/format';
import { LiveMap } from '../../components/maps';
import { MiniRoute } from '../../components/delivery';
import { Avatar, Empty, JobPill, Loading, PageHead, VehicleIcon } from '../../components/ui';

const DAY = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' });

/** One number in the strip at the top (E-MOORM's dashboard numbers). */
function Kpi({ to, value, label, sub, hot }) {
  return (
    <Link to={to} className={`kpi${hot ? ' kpi--hot' : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </Link>
  );
}

function HeadBell() {
  const { unread } = useAuth();
  return (
    <Link to="/admin/notifications" className="round-btn only-phone" aria-label="Notifications">
      <Bell size={24} />
      {unread > 0 && <b className="badge">{unread}</b>}
    </Link>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  const { data, error } = useLive('/admin/summary', { every: 15000 });
  const { data: live } = useLive('/admin/live', { every: 15000 });
  const head = (children) => <PageHead title="Overview" brand="Admin" sub={data ? `Open in ${data.openTowns} of ${data.towns} towns · updated every few seconds` : undefined}>{children}<HeadBell /></PageHead>;
  if (error) return <>{head()}<p className="alert">{error}</p></>;
  if (!data) return <>{head()}<Loading /></>;
  const oldest = data.waiting[data.waiting.length - 1];
  const max = Math.max(1, ...data.days.map((d) => d.deliveries));
  const week = data.days.reduce((s, d) => s + d.deliveries, 0);

  return (
    <>
      {head(<Link to="/admin/deliveries/new" className="btn btn--primary btn--sm only-desk"><Plus size={18} weight="bold" /> New delivery</Link>)}

      {data.counts.PENDING > 0 && (
        <Link to="/admin/riders?status=PENDING" className="attention">
          <span className="attention__icon"><UserPlus size={22} weight="fill" /></span>
          <span className="attention__text">
            <strong>Rider applications</strong>
            <small>{data.counts.PENDING} waiting{oldest ? ` · oldest sent ${ago(oldest.submittedAt)}` : ''}</small>
          </span>
          <span className="btn btn--primary btn--sm">Review</span>
        </Link>
      )}

      <div className="kpis">
        <Kpi to="/admin/deliveries?tab=searching" value={data.searching} label="Finding a rider" sub="Waiting for a rider to accept" hot={data.searching > 0} />
        <Kpi to="/admin/deliveries?tab=active" value={data.active} label="On the way" sub="Picked up or heading there" />
        <Kpi to="/admin/riders?status=APPROVED" value={data.ridersOnline} label="Riders online" sub={`${plural(data.counts.APPROVED || 0, 'approved rider')}`} />
        <Kpi to="/admin/riders?status=PENDING" value={data.counts.PENDING} label="Applications" sub="Waiting for your review" hot={data.counts.PENDING > 0} />
      </div>

      <div className="only-phone">
        <ToolGrid title="Quick tools" tools={[
          { to: '/admin/deliveries/new', label: 'New delivery', icon: Plus, color: '#059669' },
          { to: '/admin/deliveries', label: 'Deliveries', icon: Package, color: '#f59e0b', count: data.searching },
          { to: '/admin/riders', label: 'Riders', icon: Moped, color: '#3b82f6', count: data.counts.PENDING },
          { to: '/admin/customers', label: 'Customers', icon: AddressBook, color: '#8b5cf6' },
          { to: '/admin/cash', label: 'Cash', icon: Wallet, color: '#10b981' },
          { to: '/admin/towns', label: 'Towns', icon: MapTrifold, color: '#ec4899' },
          { to: '/admin/promos', label: 'Free delivery', icon: Gift, color: '#f43f5e' },
          { to: '/admin/settings', label: 'Fares', icon: GearSix, color: '#6b7280' },
        ]} />
      </div>

      <div className="admin-split">
        <section className="section live-card">
          <div className="section__head">
            <h2><span className="live-dot" /> Live map</h2>
            <span className="legend">
              <span><i className="legend__dot legend__dot--amber" /> Finding rider</span>
              <span><i className="legend__dot legend__dot--blue" /> On the way</span>
              <span><i className="legend__dia" /> Free rider</span>
              <span><i className="legend__dia legend__dia--busy" /> Busy</span>
            </span>
          </div>
          <div className="live-card__map">
            <LiveMap jobs={live?.jobs} riders={live?.riders} onOpenJob={(j) => navigate(`/admin/deliveries/${j.id}`)} />
            {live && !live.jobs.length && !live.riders.length && (
              <p className="live-card__quiet">No open deliveries and no riders online right now</p>
            )}
          </div>
        </section>

        <section className="section today-card">
          <div className="section__head"><h2>Today</h2></div>
          <div className="today-grid">
            <div><span>Booked</span><strong>{data.today.booked}</strong></div>
            <div><span>Delivered</span><strong className="tone-green">{data.today.delivered}</strong></div>
            <div><span>Cancelled / failed</span><strong>{data.today.cancelled}</strong></div>
            <div><span>Fares</span><strong>{peso(data.today.fees)}</strong></div>
            <div><span>Commission</span><strong>{peso(data.today.commission, { cents: true })}</strong></div>
            <Link to="/admin/cash"><span>To collect from riders</span><strong className={data.owed ? 'tone-amber' : ''}>{peso(data.owed, { cents: true })}</strong></Link>
            <Link to="/admin/cash"><span>MoorMove owes riders</span><strong className={data.moormoveOwes ? 'tone-blue' : ''}>{peso(data.moormoveOwes || 0, { cents: true })}</strong><small>For free deliveries</small></Link>
          </div>
          <div className="today-card__foot">
            <Coins size={18} weight="fill" className="tone-green" />
            <span>Open in <b>{data.openTowns}</b> of {data.towns} towns · {plural(data.customers, 'customer')}</span>
            <Link to="/admin/towns">Towns</Link>
          </div>
        </section>
      </div>

      <div className="grid-2 admin-row">
        <section className="section">
          <div className="section__head"><h2>Deliveries, last 7 days</h2><span className="muted small">{plural(week, 'delivery', 'deliveries')}</span></div>
          <div className="chart" role="img" aria-label="Deliveries per day">
            {data.days.map((d) => (
              <div key={d.date} className="chart__col">
                <span className="chart__value">{d.deliveries || ''}</span>
                <span className="chart__bar" style={{ height: `${Math.max(3, (d.deliveries / max) * 100)}%` }} />
                <small>{DAY(d.date)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section__head"><h2>Waiting for review</h2><Link to="/admin/riders?status=PENDING">All</Link></div>
          {data.waiting.length ? (
            <ul className="rows">
              {data.waiting.map((r) => (
                <li key={r.id}>
                  <Link className="row" to={`/admin/riders/${r.id}`}>
                    <Avatar name={r.name} size="sm" />
                    <span className="row__text">{r.name}<small>{[r.town, r.vehicleType && VEHICLES[r.vehicleType]].filter(Boolean).join(' · ')} · sent {ago(r.submittedAt)}</small></span>
                    <span className="btn btn--soft btn--sm">Review</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty compact art="applications" title="All caught up">No rider applications are waiting.</Empty>}
        </section>
      </div>

      <section className="section">
        <div className="section__head"><h2>Latest deliveries</h2><Link to="/admin/deliveries?tab=all">All deliveries</Link></div>
        {data.recent.length ? (
          <ul className="rows">
            {data.recent.map((j) => (
              <li key={j.id}>
                <Link className="row latest-row" to={`/admin/deliveries/${j.id}`}>
                  <span className="latest-row__veh"><VehicleIcon type={j.vehicleType} size={22} /></span>
                  <span className="row__text">
                    <MiniRoute from={j.pickupBarangay} to={j.dropoffBarangay} />
                    <small>{j.code} · {j.town} · {j.riderName || 'no rider yet'} · {ago(j.createdAt)}</small>
                  </span>
                  <span className="row__end"><JobPill status={j.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty compact art="deliveries" title="No deliveries yet">Bookings from customers and the ones you make show up here.</Empty>}
      </section>
    </>
  );
}
