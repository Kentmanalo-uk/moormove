import { Link, useParams } from 'react-router-dom';
import { Phone } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { ago, dateTime, peso } from '../../lib/format';
import { Avatar, BackBar, Empty, JobPill, Loading, StatStrip, useToast } from '../../components/ui';

export default function AdminCustomer() {
  const { id } = useParams();
  const toast = useToast();
  const { data: c, error, setData } = useLive(`/admin/customers/${id}`);
  if (error) return <><BackBar title="Customer" /><p className="alert">{error}</p></>;
  if (!c) return <><BackBar title="Customer" /><Loading /></>;

  const toggle = async () => {
    try {
      await api.patch(`/admin/users/${c.id}`, { isActive: !c.isActive });
      setData({ ...c, isActive: !c.isActive });
      toast(c.isActive ? 'Account turned off' : 'Account turned on');
    } catch (err) {
      toast(err.message);
    }
  };

  return (
    <>
      <BackBar title="Customer" to="/admin/customers" />
      <section className="profile-hero">
        <div className="profile-hero__cover" aria-hidden="true" />
        <div className="profile-hero__body">
          <Avatar name={c.fullName} size="xl" ring />
          <div className="profile-hero__text">
            <h2>{c.fullName}</h2>
            <span>{c.phone}</span>
            <span className="muted small">{c.email}</span>
            <span className="muted small">Signed up {dateTime(c.createdAt)}{c.lastLoginAt ? ` · last seen ${ago(c.lastLoginAt)}` : ''}</span>
            <span className="profile-hero__pills">
              <span className="pill pill--green">Customer</span>
              {!c.isActive && <span className="pill pill--red">Account off</span>}
            </span>
          </div>
          <a className="round-btn round-btn--green profile-hero__edit" href={`tel:${c.phone}`} aria-label="Call"><Phone size={20} weight="fill" /></a>
        </div>
      </section>

      <StatStrip items={[
        { label: 'Bookings', value: c.jobs.length },
        { label: 'Delivered', value: c.stats.delivered, tone: 'green' },
        { label: 'Fares paid', value: peso(c.stats.spent) },
      ]} />

      <section className="section">
        <div className="section__head"><h2>Deliveries</h2></div>
        {c.jobs.length ? (
          <ul className="rows">
            {c.jobs.map((j) => (
              <li key={j.id}>
                <Link className="row" to={`/admin/deliveries/${j.id}`}>
                  <span className="row__text">{j.pickupBarangay} → {j.dropoffBarangay}<small>{j.code} · {dateTime(j.createdAt)} · {peso(j.fee)}</small></span>
                  <span className="row__end"><JobPill status={j.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty compact art="deliveries" title="No bookings yet">Deliveries this customer books show up here.</Empty>}
      </section>

      <section className="section">
        <ul className="rows rows--first">
          <li>
            <button type="button" className={`row${c.isActive ? ' row--danger' : ''}`} onClick={toggle}>
              <span className="row__text">{c.isActive ? 'Turn off this account' : 'Turn this account back on'}<small>{c.isActive ? 'They can no longer sign in or book' : 'They can sign in again'}</small></span>
            </button>
          </li>
        </ul>
      </section>
    </>
  );
}
