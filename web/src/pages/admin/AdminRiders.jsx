import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useLive } from '../../lib/hooks';
import { ago, date, RIDER_STATUS, VEHICLES } from '../../lib/format';
import { Avatar, Empty, Loading, PageHead, Plate, RiderPill, VehicleIcon } from '../../components/ui';

const TABS = ['PENDING', 'APPROVED', 'NEEDS_CHANGES', 'SUSPENDED', 'REJECTED', 'DRAFT'];
const EMPTY = {
  PENDING: ['applications', 'No applications waiting', 'New rider applications show up here for review.'],
  APPROVED: ['riders', 'No approved riders yet', 'Riders you approve show up here.'],
};

export default function AdminRiders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = TABS.includes(params.get('status')) ? params.get('status') : 'PENDING';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: riders, loading, error } = useLive('/admin/riders', { params: { status, q: query || undefined }, every: 20000 });
  const { data: summary } = useLive('/admin/summary', { every: 20000 });
  const [art, title, text] = query ? ['search', 'Nothing matches', 'Try a name, email, phone or plate number.'] : EMPTY[status] || ['riders', 'No riders here', 'They will show up here.'];
  const place = (r) => [r.barangay, r.town?.name].filter(Boolean).join(', ') || 'No town yet';

  return (
    <>
      <PageHead title="Riders" />
      <div className="list-tools">
        <div className="tabs" role="tablist">
          {TABS.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={s === status} className={`tab${s === status ? ' is-on' : ''}`} onClick={() => setParams({ status: s }, { replace: true })}>
              {s === 'DRAFT' ? 'Not sent' : RIDER_STATUS[s].label}
              {summary?.counts[s] > 0 && <b>{summary.counts[s]}</b>}
            </button>
          ))}
        </div>
        <label className="search">
          <MagnifyingGlass size={18} />
          <input placeholder="Search name, email, phone or plate" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search riders" />
        </label>
      </div>
      {loading && !riders ? <Loading /> : error ? <p className="alert">{error}</p> : !riders.length ? (
        <Empty art={art} title={title}>{text}</Empty>
      ) : (
        <>
          <div className="table-wrap only-wide">
            <table className="table">
              <thead>
                <tr><th>Rider</th><th>Vehicle</th><th>Town</th><th>Mobile</th><th>Status</th><th>{status === 'PENDING' ? 'Sent' : 'Last seen'}</th></tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/admin/riders/${r.id}`)}>
                    <td>
                      <Link to={`/admin/riders/${r.id}`} className="table__person" onClick={(e) => e.stopPropagation()}>
                        <span className="table__avatar">
                          <Avatar name={r.user.fullName} size="sm" />
                          {status === 'APPROVED' && <span className={`presence presence--badge${r.isOnline ? ' presence--on' : ''}`} />}
                        </span>
                        <span><b>{r.user.fullName}</b><small>{r.user.email}</small></span>
                      </Link>
                    </td>
                    <td>{r.vehicleType ? <span className="table__veh"><VehicleIcon type={r.vehicleType} size={20} /> {VEHICLES[r.vehicleType]} <Plate>{r.plateNumber}</Plate></span> : <span className="muted">—</span>}</td>
                    <td>{place(r)}</td>
                    <td>{r.user.phone}</td>
                    <td><RiderPill status={r.status} /></td>
                    <td className="muted">{status === 'PENDING' ? date(r.submittedAt) : (r.lastSeenAt ? ago(r.lastSeenAt) : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="section people only-narrow">
            {riders.map((r) => (
              <li key={r.id}>
                <Link to={`/admin/riders/${r.id}`} className="person-row">
                  <span className="table__avatar">
                    <Avatar name={r.user.fullName} size="sm" />
                    {status === 'APPROVED' && <span className={`presence presence--badge${r.isOnline ? ' presence--on' : ''}`} />}
                  </span>
                  <span className="person-row__text">
                    <strong>{r.user.fullName}</strong>
                    <small>{r.vehicleType ? VEHICLES[r.vehicleType] : 'No vehicle yet'}{r.plateNumber ? ` · ${r.plateNumber}` : ''} · {place(r)}</small>
                  </span>
                  <CaretRight size={18} className="muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
