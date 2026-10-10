import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useLive } from '../../lib/hooks';
import { ago, peso, VEHICLES } from '../../lib/format';
import { DeliveryCard, MiniRoute } from '../../components/delivery';
import { Empty, JobPill, Loading, PageHead, VehicleIcon } from '../../components/ui';

const SOURCES = [['', 'All sources'], ['EMOORM', 'E-MOORM orders'], ['MOORMOVE', 'Booked on MoorMove']];
const TABS = [['searching', 'Finding rider'], ['active', 'On the way'], ['delivered', 'Delivered'], ['problems', 'Cancelled & failed'], ['all', 'All']];

export default function AdminDeliveries() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'active';
  const source = SOURCES.some(([k]) => k && k === params.get('source')) ? params.get('source') : '';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading, error } = useLive('/admin/jobs', { params: { tab, q: query || undefined, source: source || undefined }, every: 15000 });

  return (
    <>
      <PageHead title="Deliveries">
        <Link to="/admin/deliveries/new" className="btn btn--primary btn--sm"><Plus size={18} weight="bold" /> New</Link>
      </PageHead>
      <div className="list-tools">
        <div className="tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab${tab === key ? ' is-on' : ''}`} onClick={() => setParams({ tab: key, ...(source ? { source } : {}) }, { replace: true })}>
              {label}{data?.counts?.[key] > 0 && <b>{data.counts[key]}</b>}
            </button>
          ))}
        </div>
        <select className="select-sm" value={source} aria-label="Where deliveries came from"
          onChange={(e) => setParams({ tab, ...(e.target.value ? { source: e.target.value } : {}) }, { replace: true })}>
          {SOURCES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <label className="search">
          <MagnifyingGlass size={18} />
          <input placeholder="Search code, order no., name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search deliveries" />
        </label>
      </div>
      {loading && !data ? <Loading /> : error ? <p className="alert">{error}</p> : !data.jobs.length ? (
        <Empty art={query ? 'search' : 'deliveries'} title={query ? 'Nothing matches' : 'No deliveries here'}>
          {query ? 'Try a delivery code, a name or a phone number.' : 'They will show up here as soon as there are some.'}
        </Empty>
      ) : (
        <>
          <div className="table-wrap only-wide">
            <table className="table">
              <thead>
                <tr><th>Delivery</th><th>Route</th><th>Town</th><th>Rider</th><th>Status</th><th className="table__num">Fare</th><th>Booked</th></tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.id} onClick={() => navigate(`/admin/deliveries/${j.id}`)}>
                    <td>
                      <Link to={`/admin/deliveries/${j.id}`} className="table__lead" onClick={(e) => e.stopPropagation()}>
                        <span className="table__icon" title={VEHICLES[j.vehicleType]}><VehicleIcon type={j.vehicleType} size={20} /></span>
                        <span><b>{j.code}</b>{j.source === 'EMOORM' && <small className="tone-blue">E-MOORM #{j.externalCode}</small>}</span>
                      </Link>
                    </td>
                    <td><MiniRoute from={j.pickupBarangay} to={j.dropoffBarangay} /></td>
                    <td>{j.town}</td>
                    <td>{j.riderName || <span className="muted">—</span>}</td>
                    <td><JobPill status={j.status} /></td>
                    <td className="table__num"><b>{peso(j.fee)}</b>{j.codAmount > 0 && <small className="tone-amber">COD {peso(j.codAmount)}</small>}</td>
                    <td className="muted">{ago(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-grid only-narrow">
            {data.jobs.map((j) => (
              <DeliveryCard key={j.id} job={j} to={`/admin/deliveries/${j.id}`} money={peso(j.fee)}
                extra={`${j.code}${j.externalCode ? ` · E-MOORM #${j.externalCode}` : ''} · ${j.riderName || ago(j.createdAt)}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
