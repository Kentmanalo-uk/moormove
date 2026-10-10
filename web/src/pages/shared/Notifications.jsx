import { useNavigate } from 'react-router-dom';
import { Bell, Checks, IdentificationCard, Package, Star, Wallet } from '@phosphor-icons/react';
import api from '../../api';
import { useAuth } from '../../auth';
import { useLive } from '../../lib/hooks';
import { ago } from '../../lib/format';
import { Empty, Loading, PageHead } from '../../components/ui';

const KINDS = {
  job: { icon: Package, tone: 'green' },
  rider: { icon: IdentificationCard, tone: 'blue' },
  cash: { icon: Wallet, tone: 'amber' },
  star: { icon: Star, tone: 'amber' },
};

const dayOf = (d) => {
  const day = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
};

export default function Notifications() {
  const navigate = useNavigate();
  const { refreshUnread } = useAuth();
  const { data, loading, error, setData } = useLive('/notifications', { every: 20000 });

  const open = async (n) => {
    if (!n.readAt) {
      setData((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      api.put(`/notifications/${n.id}/read`).then(refreshUnread).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await api.put('/notifications/read-all');
    setData((list) => list.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    refreshUnread();
  };

  const unread = data?.filter((n) => !n.readAt).length || 0;
  const groups = [];
  for (const n of data || []) {
    const label = dayOf(n.createdAt);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(n);
  }

  return (
    <div className="page-narrow">
      <PageHead title="Notifications">
        {unread > 0 && (
          <button type="button" className="btn btn--soft btn--sm" onClick={readAll}>
            <Checks size={18} /> Mark all read
          </button>
        )}
      </PageHead>
      {loading && !data ? <Loading /> : error ? <p className="alert">{error}</p> : !data.length ? (
        <Empty art="notifications" title="No notifications yet">Updates about your deliveries will show up here.</Empty>
      ) : groups.map((g) => (
        <section key={g.label} className="notif-group">
          <h2 className="notif-group__title">{g.label}</h2>
          <ul className="section notif-list">
            {g.items.map((n) => {
              const kind = KINDS[n.kind] || { icon: Bell, tone: 'grey' };
              const Icon = kind.icon;
              return (
                <li key={n.id}>
                  <button type="button" className={`notif${n.readAt ? '' : ' notif--new'}`} onClick={() => open(n)}>
                    <span className={`notif__icon notif__icon--${kind.tone}`}><Icon size={22} weight="fill" /></span>
                    <span className="notif__text">
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                      <small>{ago(n.createdAt)}</small>
                    </span>
                    {!n.readAt && <span className="dot" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
