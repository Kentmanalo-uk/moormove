import { Link } from 'react-router-dom';
import { CheckCircle, Coins, Gift, HandCoins, Info, Receipt, TrendUp } from '@phosphor-icons/react';
import { useLive } from '../../lib/hooks';
import { date, dateTime, km, peso, plural } from '../../lib/format';
import { Empty, Loading, PageHead, StatStrip } from '../../components/ui';

const DAY = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' });

export default function Earnings() {
  const { data, error } = useLive('/rider/earnings', { every: 30000 });
  const head = (
    <PageHead title="Earnings">
      <Link to="/info/help" className="round-btn" aria-label="How earnings work"><Info size={22} /></Link>
    </PageHead>
  );
  if (error) return <>{head}<p className="alert">{error}</p></>;
  if (!data) return <>{head}<Loading /></>;
  const max = Math.max(1, ...data.days.map((d) => d.earnings));
  const today = data.days[data.days.length - 1]?.date;
  // Signed balance: the rider owes commission, or MoorMove owes the rider (free deliveries).
  const direction = data.owedDirection || (data.owed > 0 ? 'RIDER_OWES' : data.owed < 0 ? 'MOORMOVE_OWES' : 'SETTLED');
  const owes = direction === 'RIDER_OWES';
  const owed = direction === 'MOORMOVE_OWES';
  const owedAmount = owed ? (data.moormoveOwes || Math.abs(data.owed)) : data.owed;

  return (
    <>
      {head}
      <div className="page-grid">
        <div>
          <section className="earn-panel">
            <div className="earn-panel__top">
              <div>
                <span>Today</span>
                <strong>{peso(data.today.earnings)}</strong>
                <small>{plural(data.today.deliveries, 'delivery', 'deliveries')} · {km(data.today.km)}</small>
              </div>
              <span className="earn-panel__week"><TrendUp size={16} weight="bold" /> {peso(data.week.earnings)} this week</span>
            </div>
            <div className="earn-bars" role="img" aria-label="Earnings for the last 7 days">
              {data.days.map((d) => (
                <div key={d.date} className={`earn-bars__col${d.date === today ? ' is-today' : ''}`}>
                  <span className="earn-bars__value">{d.earnings ? peso(d.earnings) : ''}</span>
                  <span className="earn-bars__bar" style={{ height: `${Math.max(5, (d.earnings / max) * 100)}%` }} />
                  <small>{DAY(d.date)}</small>
                </div>
              ))}
            </div>
          </section>

          <StatStrip items={[
            { label: '7 days', value: peso(data.week.earnings), sub: plural(data.week.deliveries, 'trip') },
            { label: 'This month', value: peso(data.month.earnings), sub: plural(data.month.deliveries, 'trip') },
            { label: 'All time', value: peso(data.all.earnings), sub: plural(data.all.deliveries, 'trip') },
          ]} />

          <section className="section">
            <div className="section__head"><h2>Recent deliveries</h2><Link to="/rider/history">History</Link></div>
            {data.recent.length ? (
              <ul className="earn-list">
                {data.recent.map((j) => (
                  <li key={j.id}>
                    <Link to={`/rider/jobs/${j.id}`}>
                      <span className={`earn-list__icon${j.promo ? ' earn-list__icon--pink' : ''}`}>{j.promo ? <Gift size={20} weight="fill" /> : <Receipt size={20} weight="fill" />}</span>
                      <div>
                        <strong>{j.pickupBarangay} → {j.dropoffBarangay}</strong>
                        <small className="muted">{dateTime(j.deliveredAt)} · {j.promo
                          ? `free delivery${j.listFee ? ` (usually ${peso(j.listFee)})` : ''} · paid by MoorMove`
                          : `fare ${peso(j.fee)} − commission ${peso(j.platformCut, { cents: true })}`}</small>
                      </div>
                      <span className="earn-list__amount">+{peso(j.riderEarning)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty compact art="earnings" title="No earnings yet">Deliveries you complete show up here with what you earned.</Empty>}
          </section>
        </div>

        <aside className="page-grid__aside stack">
          <section className={`card owed-card${owes ? '' : owed ? ' owed-card--owed' : ' owed-card--clear'}`}>
            <div className="owed-card__top">
              <span className="owed-card__icon">{owes ? <Coins size={26} weight="fill" /> : owed ? <HandCoins size={26} weight="fill" /> : <CheckCircle size={26} weight="fill" />}</span>
              <div>
                <span>{owed ? 'MoorMove owes you' : 'Commission to pay MoorMove'}</span>
                <strong>{peso(owes || owed ? owedAmount : 0, { cents: true })}</strong>
              </div>
            </div>
            <p className="muted small">
              {owes
                ? `From ${plural(data.owedJobs, 'delivery', 'deliveries')}. Pay it at the MoorMove office; it's recorded here once received.`
                : owed
                  ? 'Your pay for free deliveries, after any commission you owe. Collect it at the MoorMove office; it shows here once paid.'
                  : "You're all paid up. Thank you!"}
            </p>
          </section>

          <section className="section">
            <div className="section__head"><h2>Payments</h2></div>
            {data.settlements.length ? (
              <ul className="earn-list">
                {data.settlements.map((s) => (
                  <li key={s.id}>
                    <div className="earn-list__row">
                      <span className="earn-list__icon earn-list__icon--amber"><Coins size={20} weight="fill" /></span>
                      <div><strong>{s.amount < 0 ? 'MoorMove paid you' : 'You paid commission'}</strong><small className="muted">{date(s.createdAt)}{s.note ? ` · ${s.note}` : ''}</small></div>
                      <span className={`earn-list__amount${s.amount < 0 ? '' : ' earn-list__amount--ink'}`}>{s.amount < 0 ? '+' : ''}{peso(Math.abs(s.amount), { cents: true })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="section__body muted small">Commission you pay, and what MoorMove pays you, are listed here.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
