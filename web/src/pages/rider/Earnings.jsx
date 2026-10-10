import { Link } from 'react-router-dom';
import { CheckCircle, Coins, Info, Receipt, TrendUp } from '@phosphor-icons/react';
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
                      <span className="earn-list__icon"><Receipt size={20} weight="fill" /></span>
                      <div>
                        <strong>{j.pickupBarangay} → {j.dropoffBarangay}</strong>
                        <small className="muted">{dateTime(j.deliveredAt)} · fare {peso(j.fee)} − commission {peso(j.platformCut, { cents: true })}</small>
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
          <section className={`card owed-card${data.owed > 0 ? '' : ' owed-card--clear'}`}>
            <div className="owed-card__top">
              <span className="owed-card__icon">{data.owed > 0 ? <Coins size={26} weight="fill" /> : <CheckCircle size={26} weight="fill" />}</span>
              <div>
                <span>Commission to pay MoorMove</span>
                <strong>{peso(data.owed, { cents: true })}</strong>
              </div>
            </div>
            <p className="muted small">
              {data.owed > 0
                ? `From ${plural(data.owedJobs, 'delivery', 'deliveries')}. Pay it at the MoorMove office; it's recorded here once received.`
                : "You're all paid up. Thank you!"}
            </p>
          </section>

          <section className="section">
            <div className="section__head"><h2>Commission paid</h2></div>
            {data.settlements.length ? (
              <ul className="earn-list">
                {data.settlements.map((s) => (
                  <li key={s.id}>
                    <div className="earn-list__row">
                      <span className="earn-list__icon earn-list__icon--amber"><Coins size={20} weight="fill" /></span>
                      <div><strong>{date(s.createdAt)}</strong>{s.note && <small className="muted">{s.note}</small>}</div>
                      <span className="earn-list__amount earn-list__amount--ink">{peso(s.amount, { cents: true })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="section__body muted small">Payments you make at the office are listed here.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
