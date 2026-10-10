import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CaretRight, ClockCounterClockwise, Info, Package, Question } from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { useInfo, useLive } from '../../lib/hooks';
import { dateTime, peso, SIZES, VEHICLES } from '../../lib/format';
import { DeliveryCard } from '../../components/delivery';
import { Empty, PageHead } from '../../components/ui';
import { VehicleArt } from '../../components/art';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

/** "Small", "Small – medium", "Up to large". */
const fits = (sizes = []) => {
  if (sizes.length === 3) return 'Up to large';
  if (sizes.length === 2) return `${SIZES[sizes[0]].label} – ${SIZES[sizes[1]].label.toLowerCase()}`;
  return sizes.length ? `${SIZES[sizes[0]].label} only` : '';
};

export default function CustomerHome() {
  const { user, unread } = useAuth();
  const { data: ongoing } = useLive('/jobs', { params: { tab: 'ongoing' }, every: 10000 });
  const { data: done } = useLive('/jobs', { params: { tab: 'completed' } });
  const { data: rules } = useLive('/jobs/rules');
  const { data: places } = useLive('/jobs/places');
  // Off while MoorMove carries E-MOORM orders only: history stays visible.
  const canBook = useInfo()?.publicBooking === true;

  return (
    <>
      <PageHead title={`${greeting()}, ${user.fullName.split(' ')[0]}`} brand="Deliveries">
        <Link to="/info/help" className="round-btn only-phone" aria-label="Help"><Question size={22} /></Link>
        <Link to="/notifications" className="round-btn only-phone" aria-label="Notifications">
          <Bell size={22} />
          {unread > 0 && <b className="badge">{unread}</b>}
        </Link>
      </PageHead>

      <div className="home-layout">
        <div className="home-layout__main">
          {!canBook && (
            <p className="alert alert--warn"><Info size={20} weight="fill" /> MoorMove isn&apos;t taking bookings from customers right now. Your past deliveries are still here.</p>
          )}
          {/* The one thing people come here to do. */}
          {canBook && <section className="book-panel">
            <h1>Send a package</h1>
            <Link to="/book" className="where-box">
              <span className="where-box__stops">
                <span className="where-box__row"><i className="mini-route__a" /> Pickup location</span>
                <span className="where-box__row"><i className="mini-route__b" /> Drop-off location</span>
              </span>
              <span className="where-box__go" aria-label="Book a delivery"><ArrowRight size={22} weight="bold" /></span>
            </Link>
            {places?.length > 0 && (
              <ul className="recent-places" aria-label="Send from a recent place">
                {places.slice(0, 3).map((p) => (
                  <li key={`${p.name}${p.lat}${p.lng}`}>
                    <Link to="/book" state={{ pickup: p }} className="recent-place">
                      <ClockCounterClockwise size={18} />
                      <span><strong>{p.name}</strong><small>{p.address}, {p.barangay}</small></span>
                      <CaretRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>}

          {canBook && rules && (
            <section className="vehicles" aria-label="Vehicles">
              {['MOTORCYCLE', 'TRICYCLE', 'BICYCLE'].map((key) => (
                <Link key={key} to="/book" state={{ vehicle: key }} className="vehicle-tile">
                  <VehicleArt type={key} size={74} />
                  <strong>{VEHICLES[key].split(' /')[0]}</strong>
                  <small>{fits(rules.carries[key])}</small>
                  <span>from {peso(rules.vehicles[key].base)}</span>
                </Link>
              ))}
            </section>
          )}
        </div>

        <div className="home-layout__side">
          {ongoing?.jobs.length > 0 && (
            <section className="section section--plain">
              <div className="section__head"><h2><span className="live-dot" /> On the way</h2><Link to="/deliveries">See all</Link></div>
              <div className="section__body list-gap">
                {ongoing.jobs.map((j) => <DeliveryCard key={j.id} job={j} to={`/deliveries/${j.id}`} extra={j.riderName ? `Rider: ${j.riderName}` : dateTime(j.createdAt)} />)}
              </div>
            </section>
          )}

          <section className="section section--plain">
            <div className="section__head"><h2>Recent deliveries</h2>{done?.jobs.length > 0 && <Link to="/deliveries?tab=completed">See all</Link>}</div>
            {done?.jobs.length ? (
              <div className="section__body list-gap">
                {done.jobs.slice(0, 3).map((j) => <DeliveryCard key={j.id} job={j} to={`/deliveries/${j.id}`} />)}
              </div>
            ) : done ? (
              <Empty compact art="deliveries" title="No deliveries yet"
                action={canBook && <Link to="/book" className="btn btn--primary"><Package size={18} weight="fill" /> Book your first delivery</Link>}>
                Drop two pins, choose a vehicle and a local rider takes it from there.
              </Empty>
            ) : null}
          </section>

          <Link to="/info/help" className="help-line">
            <Question size={20} />
            <span>Help with fares, COD and cancelling</span>
            <CaretRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
