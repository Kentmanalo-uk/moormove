import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Gift, HandCoins } from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { dateTime, peso, plural } from '../../lib/format';
import { Avatar, BackBar, Empty, Field, Loading, Sheet, useToast } from '../../components/ui';

/*
 * Each rider's balance with MoorMove. Usually the rider owes commission. On
 * free-delivery promos MoorMove pays the rider's earning, so a balance can go
 * the other way: then MoorMove owes the rider. Rows carry a signed `amount`
 * (positive: the rider owes) and a `direction`.
 */
const owesUs = (o) => (o.direction ? o.direction === 'RIDER_OWES' : o.amount > 0);

export default function AdminCash() {
  const toast = useToast();
  const { data, error, reload } = useLive('/admin/cash', { every: 30000 });
  const [paying, setPaying] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <><BackBar title="Cash" /><p className="alert">{error}</p></>;
  if (!data) return <><BackBar title="Cash" /><Loading /></>;
  const riderOwes = data.owed.filter(owesUs);
  const weOwe = data.owed.filter((o) => !owesUs(o) && o.amount !== 0);
  const toCollect = riderOwes.reduce((s, o) => s + Math.abs(o.amount), 0);
  const toPay = weOwe.reduce((s, o) => s + Math.abs(o.amount), 0);

  const settle = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/admin/cash/${paying.riderId}/settle`, { note });
      const amount = peso(Math.abs(r.amount), { cents: true });
      toast(r.direction === 'MOORMOVE_PAID' ? `Recorded: MoorMove paid ${paying.name} ${amount}` : `${amount} recorded from ${paying.name}`);
      setPaying(null);
      setNote('');
      reload({ quiet: true });
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const row = (o) => {
    const ours = owesUs(o);
    const amount = peso(Math.abs(o.amount), { cents: true });
    return (
      <li key={o.riderId} className="row cash-row">
        <Avatar name={o.name} size="sm" />
        <Link to={`/admin/riders/${o.riderId}`} className="row__text">
          {o.name}
          <small>{[o.town, plural(o.jobs, 'delivery', 'deliveries'), o.phone].filter(Boolean).join(' · ')}</small>
        </Link>
        <span className="cash-row__amount">
          <small>{ours ? 'Rider owes' : 'MoorMove owes rider'}</small>
          <strong className={ours ? 'tone-amber' : 'tone-blue'}>{amount}</strong>
        </span>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => setPaying(o)}>
          {ours ? 'Record payment' : `Record MoorMove paid ${amount}`}
        </button>
      </li>
    );
  };

  const payingOurs = paying && owesUs(paying);
  const payingAmount = paying ? peso(Math.abs(paying.amount), { cents: true }) : '';

  return (
    <>
      <BackBar title="Cash" to="/admin/me" />
      <div className="cash-heroes">
        <section className="cash-hero">
          <div>
            <span>Commission to collect from riders</span>
            <strong>{peso(toCollect, { cents: true })}</strong>
            <small>{riderOwes.length ? `From ${plural(riderOwes.length, 'rider')}` : 'No rider owes anything right now'}</small>
          </div>
          <HandCoins size={64} weight="duotone" className="cash-hero__icon" />
        </section>
        <section className="cash-hero cash-hero--blue">
          <div>
            <span>MoorMove owes riders</span>
            <strong>{peso(toPay, { cents: true })}</strong>
            <small>{weOwe.length ? `To ${plural(weOwe.length, 'rider')}, for free deliveries` : 'Nothing owed for free deliveries'}</small>
          </div>
          <Gift size={64} weight="duotone" className="cash-hero__icon" />
        </section>
      </div>

      <div className="grid-2 admin-row">
        <div className="stack">
          <section className="section">
            <div className="section__head"><h2>Riders who owe MoorMove</h2></div>
            {riderOwes.length
              ? <ul className="rows">{riderOwes.map(row)}</ul>
              : <Empty compact art="paid" title="All paid up">No rider owes commission right now.</Empty>}
          </section>
          {weOwe.length > 0 && (
            <section className="section">
              <div className="section__head">
                <div>
                  <h2>MoorMove owes these riders</h2>
                  <p className="section__sub">Their usual pay for free deliveries, after any commission they owe</p>
                </div>
              </div>
              <ul className="rows">{weOwe.map(row)}</ul>
            </section>
          )}
        </div>

        <section className="section">
          <div className="section__head"><h2>Payments recorded</h2></div>
          {data.settlements.length ? (
            <ul className="rows">
              {data.settlements.map((s) => (
                <li key={s.id} className="row">
                  <span className={`earn-list__icon ${s.amount < 0 ? 'earn-list__icon--blue' : 'earn-list__icon--amber'}`}>
                    {s.amount < 0 ? <Gift size={20} weight="fill" /> : <Coins size={20} weight="fill" />}
                  </span>
                  <span className="row__text">
                    {s.amount < 0 ? `MoorMove paid ${s.rider}` : `${s.rider} paid`}
                    <small>{dateTime(s.createdAt)} · by {s.recordedBy}{s.note ? ` · ${s.note}` : ''}</small>
                  </span>
                  <strong className={`nowrap${s.amount < 0 ? ' tone-blue' : ''}`}>{peso(Math.abs(s.amount), { cents: true })}</strong>
                </li>
              ))}
            </ul>
          ) : <Empty compact art="cash" title="Nothing recorded yet">Payments from riders, and what MoorMove pays them, are listed here.</Empty>}
        </section>
      </div>

      <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} label={payingOurs ? 'Record payment' : 'Record MoorMove paid'}>
        {paying && (
          <>
            <h2>{payingOurs ? `Received ${payingAmount}?` : `Paid ${paying.name} ${payingAmount}?`}</h2>
            <p>
              {payingOurs
                ? `From ${paying.name}, for ${plural(paying.jobs, 'delivery', 'deliveries')}. This marks all of it as paid.`
                : `MoorMove's pay for ${paying.name}'s free deliveries (after any commission they owed), for ${plural(paying.jobs, 'delivery', 'deliveries')}. This settles their balance.`}
            </p>
            <Field label="Note (optional)" id="note">
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={payingOurs ? 'e.g. Paid at the office, OR #123' : 'e.g. Paid in cash at the office'} />
            </Field>
            <div className="btn-row">
              <button type="button" className="btn btn--grey" onClick={() => setPaying(null)}>Back</button>
              <button type="button" className="btn btn--primary" onClick={settle} disabled={busy}>
                {busy ? 'Saving…' : payingOurs ? 'Record payment' : `Record MoorMove paid ${payingAmount}`}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
