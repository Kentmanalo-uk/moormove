import { useState } from 'react';
import { ArrowsClockwise, MapPin } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { dateTime } from '../../lib/format';
import { BackBar, Empty, Loading, useToast } from '../../components/ui';

/** Towns (copied from E-MOORM's API) and where MoorMove takes bookings. */
export default function AdminTowns() {
  const toast = useToast();
  const { data, error, setData, reload } = useLive('/admin/towns');
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setBusy(true);
    try {
      const { count } = await api.post('/towns/sync');
      toast(`${count} towns copied from E-MOORM`);
      reload({ quiet: true });
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (t) => {
    try {
      await api.patch(`/towns/${t.id}`, { serviceOpen: !t.serviceOpen });
      setData(data.map((x) => (x.id === t.id ? { ...x, serviceOpen: !t.serviceOpen } : x)));
    } catch (err) {
      toast(err.message);
    }
  };

  return (
    <>
      <BackBar title="Towns" to="/admin/me">
        <button type="button" className="btn btn--soft btn--sm" onClick={sync} disabled={busy}>
          <ArrowsClockwise size={16} /> {busy ? 'Updating…' : 'Update from E-MOORM'}
        </button>
      </BackBar>
      <p className="muted small" style={{ margin: '0 4px 12px' }}>
        The list comes from E-MOORM&apos;s public town list (read only). Switch a town off to stop new bookings there.
      </p>
      {error ? <p className="alert">{error}</p> : !data ? <Loading /> : !data.length ? (
        <Empty art="towns" title="No towns yet" action={<button type="button" className="btn btn--primary" onClick={sync} disabled={busy}>Copy towns from E-MOORM</button>}>
          Copy the towns so riders and customers can choose them.
        </Empty>
      ) : (
        <ul className="town-grid">
          {data.map((t) => (
            <li key={t.id} className={`town-card${t.serviceOpen ? ' is-open' : ''}`}>
              <span className="town-card__icon"><MapPin size={22} weight="fill" /></span>
              <span className="row__text">
                <strong>{t.name}</strong>{!t.isActive && <span className="pill pill--grey">No longer on E-MOORM</span>}
                <small>{t.riders} riders · {t.delivered} delivered</small>
                <small>{t.serviceOpen ? 'Taking bookings' : 'Closed'} · updated {dateTime(t.syncedAt)}</small>
              </span>
              <label className="switch" aria-label={`Bookings in ${t.name}`}>
                <input type="checkbox" checked={t.serviceOpen} onChange={() => toggle(t)} disabled={!t.isActive} />
                <span />
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
