import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, HandCoins } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { dateTime, peso, plural } from '../../lib/format';
import { Avatar, BackBar, Empty, Field, Loading, Sheet, useToast } from '../../components/ui';

/** Commission riders owe MoorMove, and recording what they hand over. */
export default function AdminCash() {
  const toast = useToast();
  const { data, error, reload } = useLive('/admin/cash', { every: 30000 });
  const [paying, setPaying] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <><BackBar title="Cash" /><p className="alert">{error}</p></>;
  if (!data) return <><BackBar title="Cash" /><Loading /></>;
  const total = data.owed.reduce((s, o) => s + o.amount, 0);

  const settle = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/admin/cash/${paying.riderId}/settle`, { note });
      toast(`${peso(r.amount, { cents: true })} recorded from ${paying.name}`);
      setPaying(null);
      setNote('');
      reload({ quiet: true });
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BackBar title="Cash" to="/admin/me" />
      <section className="cash-hero">
        <div>
          <span>Commission to collect from riders</span>
          <strong>{peso(total, { cents: true })}</strong>
          <small>{data.owed.length ? `From ${plural(data.owed.length, 'rider')}` : 'Nobody owes anything right now'}</small>
        </div>
        <HandCoins size={64} weight="duotone" className="cash-hero__icon" />
      </section>
      <div className="grid-2 admin-row">

      <section className="section">
        <div className="section__head"><h2>Riders who owe</h2></div>
        {data.owed.length ? (
          <ul className="rows">
            {data.owed.map((o) => (
              <li key={o.riderId} className="row">
                <Avatar name={o.name} size="sm" />
                <Link to={`/admin/riders/${o.riderId}`} className="row__text">{o.name}<small>{o.town} · {plural(o.jobs, 'delivery', 'deliveries')} · {o.phone}</small></Link>
                <strong className="nowrap">{peso(o.amount, { cents: true })}</strong>
                <button type="button" className="btn btn--soft btn--sm" onClick={() => setPaying(o)}>Received</button>
              </li>
            ))}
          </ul>
        ) : <Empty compact art="paid" title="All paid up">No rider owes commission right now.</Empty>}
      </section>

      <section className="section">
        <div className="section__head"><h2>Payments recorded</h2></div>
        {data.settlements.length ? (
          <ul className="rows">
            {data.settlements.map((s) => (
              <li key={s.id} className="row">
                <span className="earn-list__icon earn-list__icon--amber"><Coins size={20} weight="fill" /></span>
                <span className="row__text">{s.rider}<small>{dateTime(s.createdAt)} · by {s.recordedBy}{s.note ? ` · ${s.note}` : ''}</small></span>
                <strong className="nowrap">{peso(s.amount, { cents: true })}</strong>
              </li>
            ))}
          </ul>
        ) : <Empty compact art="cash" title="Nothing recorded yet">Payments you record from riders are listed here.</Empty>}
      </section>
      </div>

      <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} label="Record payment">
        {paying && (
          <>
            <h2>Received {peso(paying.amount, { cents: true })}?</h2>
            <p>From {paying.name}, for {plural(paying.jobs, 'delivery', 'deliveries')}. This marks all of it as paid.</p>
            <Field label="Note (optional)" id="note">
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid at the office, OR #123" />
            </Field>
            <div className="btn-row">
              <button type="button" className="btn btn--grey" onClick={() => setPaying(null)}>Back</button>
              <button type="button" className="btn btn--primary" onClick={settle} disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
