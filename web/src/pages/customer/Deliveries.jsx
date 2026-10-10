import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useInfo, useLive } from '../../lib/hooks';
import { dateTime } from '../../lib/format';
import { DeliveryCard } from '../../components/delivery';
import { Empty, Loading, PageHead } from '../../components/ui';

const TABS = [['ongoing', 'Ongoing'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
const EMPTY = {
  ongoing: ['ongoing', 'Nothing on the way', 'Book a delivery and follow it here, live on the map.'],
  completed: ['parcels', 'No completed deliveries yet', 'Deliveries that arrive show up here, with their photos.'],
  cancelled: ['cancelled', 'Nothing cancelled', "Deliveries you cancel, or that couldn't be delivered, show up here."],
};

export default function Deliveries() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'ongoing';
  const { data, loading, error } = useLive('/jobs', { params: { tab }, every: tab === 'ongoing' ? 10000 : 0 });
  const [art, title, text] = EMPTY[tab];
  const canBook = useInfo()?.publicBooking === true;

  return (
    <>
      <PageHead title="Deliveries">
        {canBook && <Link to="/book" className="btn btn--primary btn--sm"><Plus size={18} weight="bold" /> Book</Link>}
      </PageHead>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab${tab === key ? ' is-on' : ''}`} onClick={() => setParams({ tab: key }, { replace: true })}>
            {label}{data?.counts?.[key] > 0 && <b>{data.counts[key]}</b>}
          </button>
        ))}
      </div>
      {loading && !data ? <Loading /> : error ? <p className="alert">{error}</p> : !data.jobs.length ? (
        <Empty art={art} title={title}
          action={tab === 'ongoing' && canBook && <Link to="/book" className="btn btn--primary">Book a delivery</Link>}>
          {canBook || tab !== 'ongoing' ? text : 'Your deliveries show up here.'}
        </Empty>
      ) : (
        <div className="card-grid">
          {data.jobs.map((j) => (
            <DeliveryCard key={j.id} job={j} to={`/deliveries/${j.id}`}
              extra={tab === 'ongoing' && j.riderName ? `Rider: ${j.riderName}` : dateTime(j.deliveredAt || j.createdAt)} />
          ))}
        </div>
      )}
    </>
  );
}
