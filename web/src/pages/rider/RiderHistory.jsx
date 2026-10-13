import { useSearchParams } from 'react-router-dom';
import { useLive } from '../../lib/hooks';
import { dateTime, peso, plural } from '../../lib/format';
import { DeliveryCard, isFree, returnedText, townHop } from '../../components/delivery';
import { Empty, Loading, PageHead, StatStrip } from '../../components/ui';

const TABS = [['completed', 'Delivered'], ['other', 'Cancelled & failed']];

export default function RiderHistory() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'completed';
  const { data, loading, error } = useLive('/rider/jobs', { params: { tab } });
  const delivered = (data || []).filter((j) => j.status === 'DELIVERED');
  const total = delivered.reduce((s, j) => s + j.riderEarning, 0);
  // Failed trips the rider is still paid for (the buyer's fault, E-MOORM orders).
  const paidFails = (data || []).filter((j) => j.failPaid);
  const failedEarned = paidFails.reduce((s, j) => s + j.riderEarning, 0);

  return (
    <>
      <PageHead title="History" />
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab${tab === key ? ' is-on' : ''}`} onClick={() => setParams({ tab: key }, { replace: true })}>{label}</button>
        ))}
      </div>
      {tab === 'completed' && delivered.length > 0 && (
        <StatStrip items={[
          { label: 'Deliveries', value: delivered.length },
          { label: 'Earned', value: peso(total), tone: 'green' },
          { label: 'Average', value: peso(Math.round(total / delivered.length)), sub: 'per delivery' },
        ]} />
      )}
      {loading && !data ? <Loading /> : error ? <p className="alert">{error}</p> : !data.length ? (
        <Empty art={tab === 'completed' ? 'history' : 'cancelled'} title={tab === 'completed' ? 'No deliveries yet' : 'Nothing here'}>
          {tab === 'completed' ? 'Deliveries you finish are listed here, with what you earned.' : 'Deliveries you gave back or couldn\'t finish show up here.'}
        </Empty>
      ) : (
        <div className="card-grid">
          {data.map((j) => (
            <DeliveryCard key={j.id} job={j} to={`/rider/jobs/${j.id}`}
              money={j.status === 'DELIVERED' || j.failPaid ? `+${peso(j.riderEarning)}` : '—'} extra={`${j.failPaid ? 'Failed trip · paid · ' : ''}${isFree(j) && !j.failPaid ? 'Free delivery, paid by MoorMove · ' : ''}${townHop(j) ? `${townHop(j).join(' → ')} · ` : ''}${j.externalCode ? `E-MOORM #${j.externalCode} · ` : ''}${returnedText(j) || dateTime(j.deliveredAt || j.failedAt || j.updatedAt)}`} />
          ))}
        </div>
      )}
      {tab === 'completed' && data?.length > 0 && <p className="list-foot">{plural(data.length, 'delivery', 'deliveries')}</p>}
      {tab === 'other' && paidFails.length > 0 && <p className="list-foot">{plural(paidFails.length, 'paid failed trip')} · you earned {peso(failedEarned)}</p>}
    </>
  );
}
