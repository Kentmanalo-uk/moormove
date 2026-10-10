import { Link, useNavigate } from 'react-router-dom';
import {
  AddressBook, ArrowRight, Coins, GearSix, MagnifyingGlass, MapTrifold, Moped, Plus, Truck, UserPlus, Wallet,
} from '@phosphor-icons/react';
import { useLive } from '../../lib/hooks';
import { ago, peso, plural, VEHICLES } from '../../lib/format';
import { LiveMap } from '../../components/maps';
import { MiniRoute } from '../../components/delivery';
import { Avatar, Empty, JobPill, Loading, PageHead, VehicleIcon } from '../../components/ui';

const DAY = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' });

const TOOLS = [
  ['/admin/deliveries/new', 'New delivery', Plus, '#059669'],
  ['/admin/riders', 'Riders', Moped, '#3b82f6'],
  ['/admin/customers', 'Customers', AddressBook, '#8b5cf6'],
  ['/admin/cash', 'Cash', Wallet, '#f59e0b'],
  ['/admin/towns', 'Towns', MapTrifold, '#ec4899'],
  ['/admin/settings', 'Fares', GearSix, '#6b7280'],
];

function Kpi({ to, icon: Icon, tone, value, label, hot }) {
  return (
    <Link to={to} className={`kpi${hot ? ' kpi--hot' : ''}`}>
      <span className={`kpi__icon kpi__icon--${tone}`}><Icon size={22} weight="fill" /></span>
      <b>{value}</b>
      <span>{label}</span>
      <ArrowRight size={16} className="kpi__go" />
    </Link>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  const { data, error } = useLive('/admin/summary', { every: 15000 });
  const { data: live } = useLive('/admin/live', { every: 15000 });
  if (error) return <><PageHead title="Overview" /><p className="alert">{error}</p></>;
  if (!data) return <><PageHead title="Overview" /><Loading /></>;
  const max = Math.max(1, ...data.days.map((d) => d.deliveries));
  const week = data.days.reduce((s, d) => s + d.deliveries, 0);

  return (
    <>
      <PageHead title="Overview">
        <Link to="/admin/deliveries/new" className="btn btn--primary btn--sm"><Plus size={18} weight="bold" /> New delivery</Link>
      </PageHead>

      <div className="kpis">
        <Kpi to="/admin/deliveries?tab=searching" icon={MagnifyingGlass} tone="amber" value={data.searching} label="Finding a rider" hot={data.searching > 0} />
        <Kpi to="/admin/deliveries?tab=active" icon={Truck} tone="blue" value={data.active} label="On the way now" />
        <Kpi to="/admin/riders?status=APPROVED" icon={Moped} tone="green" value={data.ridersOnline} label="Riders online" />
        <Kpi to="/admin/riders?status=PENDING" icon={UserPlus} tone="violet" value={data.counts.PENDING} label="Applications waiting" hot={data.counts.PENDING > 0} />
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
          </div>
          <div className="today-card__foot">
            <Coins size={18} weight="fill" className="tone-green" />
            <span>Open in <b>{data.openTowns}</b> of {data.towns} towns · {plural(data.customers, 'customer')}</span>
            <Link to="/admin/towns">Towns</Link>
          </div>
        </section>
      </div>

      <section className="section section--plain">
        <div className="section__head"><h2>Admin tools</h2></div>
        <div className="tools">
          {TOOLS.map(([to, label, Icon, color]) => (
            <Link key={to} to={to} className="tool"><Icon size={30} weight="fill" style={{ color }} /><span>{label}</span></Link>
          ))}
        </div>
      </section>

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
