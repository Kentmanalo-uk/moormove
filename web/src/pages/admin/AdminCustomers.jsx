import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useLive } from '../../lib/hooks';
import { ago, date, plural } from '../../lib/format';
import { Avatar, BackBar, Empty, Loading } from '../../components/ui';

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading, error } = useLive('/admin/customers', { params: { q: query || undefined } });

  return (
    <>
      <BackBar title="Customers" to="/admin/me" />
      <div className="list-tools">
        <p className="muted small">{data ? plural(data.length, 'customer') : ''}</p>
        <label className="search">
          <MagnifyingGlass size={18} />
          <input placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        </label>
      </div>
      {loading && !data ? <Loading /> : error ? <p className="alert">{error}</p> : !data.length ? (
        <Empty art={query ? 'search' : 'customers'} title={query ? 'Nothing matches' : 'No customers yet'}>
          {query ? 'Try a name, email or phone number.' : 'People who sign up to send packages show up here.'}
        </Empty>
      ) : (
        <>
          <div className="table-wrap only-wide">
            <table className="table">
              <thead>
                <tr><th>Customer</th><th>Mobile</th><th className="table__num">Bookings</th><th>Signed up</th><th>Last seen</th><th>Account</th></tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} onClick={() => navigate(`/admin/customers/${u.id}`)}>
                    <td>
                      <Link to={`/admin/customers/${u.id}`} className="table__person" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={u.fullName} size="sm" />
                        <span><b>{u.fullName}</b><small>{u.email}</small></span>
                      </Link>
                    </td>
                    <td>{u.phone}</td>
                    <td className="table__num"><b>{u.deliveries}</b></td>
                    <td className="muted">{date(u.createdAt)}</td>
                    <td className="muted">{u.lastLoginAt ? ago(u.lastLoginAt) : '—'}</td>
                    <td>{u.isActive ? <span className="pill pill--green">Active</span> : <span className="pill pill--red">Off</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="section people only-narrow">
            {data.map((u) => (
              <li key={u.id}>
                <Link to={`/admin/customers/${u.id}`} className="person-row">
                  <Avatar name={u.fullName} size="sm" />
                  <span className="person-row__text">
                    <strong>{u.fullName}{!u.isActive && <span className="pill pill--red" style={{ marginLeft: 6 }}>Off</span>}</strong>
                    <small>{u.phone} · {plural(u.deliveries, 'booking')}</small>
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
