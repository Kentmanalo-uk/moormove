import { Link, useNavigate } from 'react-router-dom';
import { CaretRight, MapPin, MapTrifold, WarningCircle } from '@phosphor-icons/react';
import { useLive } from '../../lib/hooks';
import { plural } from '../../lib/format';
import { BackBar, Empty, Loading, StatStrip } from '../../components/ui';

const ridersIn = (townId) => `/admin/riders?status=APPROVED&townId=${townId}`;

/** What a town's numbers mean, in a word: the flag next to it. */
const flag = (t) => {
  if (!t.ridersApproved) return t.serviceOpen ? ['red', 'No riders'] : ['grey', 'No riders yet'];
  if (!t.ridersOnline) return t.serviceOpen ? ['amber', 'None online now'] : ['grey', 'Closed'];
  return ['green', 'Covered'];
};

/** Per town: the approved riders who deliver in some part of it, and how many are online. */
export default function AdminCoverage() {
  const navigate = useNavigate();
  const { data, error } = useLive('/admin/coverage', { every: 30000 });
  const head = (
    <BackBar title="Rider coverage" to="/admin/me">
      <Link to="/admin/towns" className="btn btn--soft btn--sm"><MapTrifold size={16} /> Towns</Link>
    </BackBar>
  );
  if (error) return <>{head}<p className="alert">{error}</p></>;
  if (!data) return <>{head}<Loading /></>;
  if (!data.length) return <>{head}<Empty art="towns" title="No towns yet">Copy the towns from E-MOORM on the Towns page first.</Empty></>;

  const covered = data.filter((t) => t.ridersApproved > 0).length;
  const bare = data.filter((t) => t.serviceOpen && !t.ridersApproved);
  const quiet = data.filter((t) => t.serviceOpen && t.ridersApproved && !t.ridersOnline).length;

  return (
    <>
      {head}
      <p className="muted small page-note">
        A rider counts in every town where they deliver to some part, so one rider can count in several towns.
        Riders only get deliveries whose pickup and drop-off are both inside their area.
      </p>

      <StatStrip items={[
        { label: 'Towns with riders', value: `${covered} of ${data.length}`, tone: covered === data.length ? 'green' : undefined },
        { label: 'Open towns, no riders', value: bare.length, tone: bare.length ? 'red' : undefined, sub: bare.length ? bare.map((t) => t.name).join(', ') : 'Every open town has riders' },
        { label: 'Open, none online now', value: quiet, tone: quiet ? 'amber' : undefined },
      ]} />

      {bare.length > 0 && (
        <p className="alert alert--warn coverage-alert">
          <WarningCircle size={18} weight="fill" />
          <span>No approved rider delivers in {bare.map((t) => t.name).join(', ')}. Bookings there will wait for a rider. Approve riders there, or set a rider&apos;s area to include {bare.length === 1 ? 'it' : 'them'}.</span>
        </p>
      )}

      <div className="table-wrap only-wide coverage-table">
        <table className="table">
          <thead>
            <tr><th>Town</th><th>Bookings</th><th className="table__num">Approved riders</th><th className="table__num">Online now</th><th>Coverage</th><th aria-label="Riders" /></tr>
          </thead>
          <tbody>
            {data.map((t) => {
              const [tone, label] = flag(t);
              return (
                <tr key={t.townId} onClick={() => navigate(ridersIn(t.townId))}>
                  <td><span className="table__lead"><span className="table__icon"><MapPin size={20} weight="fill" className={t.serviceOpen ? '' : 'muted'} /></span><b>{t.name}</b></span></td>
                  <td>{t.serviceOpen ? 'Open' : <span className="muted">Closed</span>}</td>
                  <td className="table__num"><b className={t.ridersApproved ? '' : 'tone-red'}>{t.ridersApproved}</b></td>
                  <td className="table__num"><b className={t.ridersOnline ? 'tone-green' : 'muted'}>{t.ridersOnline}</b></td>
                  <td><span className={`pill pill--${tone}`}>{label}</span></td>
                  <td className="table__num"><Link to={ridersIn(t.townId)} onClick={(e) => e.stopPropagation()} className="see-riders">See riders <CaretRight size={14} /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="town-grid only-narrow coverage-list">
        {data.map((t) => {
          const [tone, label] = flag(t);
          return (
            <li key={t.townId}>
              <Link to={ridersIn(t.townId)} className={`town-card${t.serviceOpen ? ' is-open' : ''}`}>
                <span className="town-card__icon"><MapPin size={22} weight="fill" /></span>
                <span className="row__text">
                  <strong>{t.name}</strong>
                  <small>{plural(t.ridersApproved, 'rider')} · {t.ridersOnline} online · {t.serviceOpen ? 'open' : 'closed'}</small>
                </span>
                <span className={`pill pill--${tone}`}>{label}</span>
                <CaretRight size={18} className="muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
