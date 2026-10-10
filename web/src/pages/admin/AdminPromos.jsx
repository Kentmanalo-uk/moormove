import { useState } from 'react';
import {
  CalendarBlank, CheckCircle, Gift, MapPin, PencilSimple, Plus, Power, Ruler, StopCircle, Users,
} from '@phosphor-icons/react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { dateTime, peso, plural } from '../../lib/format';
import { BackBar, Empty, Field, Loading, Sheet, useToast } from '../../components/ui';

/*
 * Free-delivery promos. While one runs, E-MOORM orders picked up in its towns
 * (and no longer than its max distance) cost the buyer no delivery fee; the
 * rider still earns their usual amount and MoorMove pays it.
 */

const STATES = {
  ON: ['green', 'On'],
  SCHEDULED: ['blue', 'Scheduled'],
  OFF: ['amber', 'Off'],
  ENDED: ['grey', 'Ended'],
};

const pad = (n) => String(n).padStart(2, '0');
/** A date as a datetime-local value, in this device's time. */
const toInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const fromInput = (v) => (v ? new Date(v).toISOString() : null);

const blank = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  const end = new Date(now.getTime() + 7 * 86400000);
  return { title: '', note: '', startsAt: toInput(now), endsAt: toInput(end), allTowns: true, townIds: [], maxKm: '', active: true };
};

const formOf = (p) => ({
  title: p.title,
  note: p.note || '',
  startsAt: toInput(p.startsAt),
  endsAt: toInput(p.endsAt),
  allTowns: !p.townIds?.length,
  townIds: p.townIds || [],
  maxKm: p.maxKm === null || p.maxKm === undefined ? '' : String(p.maxKm),
  active: p.active,
});

function PromoForm({ promo, towns, onDone, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(() => (promo ? formOf(promo) : blank()));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
    setError('');
  };
  const toggleTown = (id) => set('townIds', form.townIds.includes(id) ? form.townIds.filter((t) => t !== id) : [...form.townIds, id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.allTowns && !form.townIds.length) {
      setErrors({ townIds: 'Choose at least one town, or All towns' });
      return;
    }
    setBusy(true);
    setError('');
    const body = {
      title: form.title,
      note: form.note.trim() || null,
      startsAt: fromInput(form.startsAt),
      endsAt: fromInput(form.endsAt),
      townIds: form.allTowns ? null : form.townIds,
      maxKm: form.maxKm === '' ? null : Number(form.maxKm),
      active: form.active,
    };
    try {
      const saved = promo ? await api.put(`/admin/promos/${promo.id}`, body) : await api.post('/admin/promos', body);
      toast(promo ? 'Promo saved' : 'Promo created');
      onDone(saved, !promo);
    } catch (err) {
      setErrors(err.errors || {});
      setError(Object.keys(err.errors || {}).length > 1 ? 'Please fix the marked fields.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="promo-form">
      <h2>{promo ? 'Edit promo' : 'New free-delivery promo'}</h2>
      <p>Buyers pay no delivery fee while it runs. Riders still earn their usual amount; MoorMove pays it.</p>
      <Field label="Title" id="p-title" error={errors.title} hint="Buyers and sellers see this on E-MOORM">
        <input id="p-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={80} placeholder="e.g. Free delivery week" />
      </Field>
      <Field label="Note (optional)" id="p-note" error={errors.note}>
        <textarea id="p-note" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={255} placeholder="e.g. For orders in Calapan, until Sunday" />
      </Field>
      <div className="field-pair field-pair--wide">
        <Field label="Starts" id="p-start" error={errors.startsAt}>
          <input id="p-start" type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </Field>
        <Field label="Ends" id="p-end" error={errors.endsAt} hint={form.endsAt ? undefined : 'No end: it runs until you end it'}>
          <input id="p-end" type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
        </Field>
      </div>

      <div className={`field${errors.townIds ? ' field--error' : ''}`}>
        <span className="field__label">Towns (where the order is picked up)</span>
        <div className="segmented">
          <button type="button" className={form.allTowns ? 'is-on' : ''} onClick={() => set('allTowns', true)}>All towns</button>
          <button type="button" className={!form.allTowns ? 'is-on' : ''} onClick={() => set('allTowns', false)}>Only some towns</button>
        </div>
        {!form.allTowns && (
          <ul className="town-chips">
            {towns.map((t) => {
              const on = form.townIds.includes(t.id);
              return (
                <li key={t.id}>
                  <button type="button" className={`chip${on ? ' chip--on' : ''}`} aria-pressed={on} onClick={() => toggleTown(t.id)}>
                    {on && <CheckCircle size={16} weight="fill" />}<span>{t.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {errors.townIds && <p className="field__error">{errors.townIds}</p>}
      </div>

      <Field label="Longest delivery (optional)" id="p-km" error={errors.maxKm} hint="From 0.5 to 30 km. Leave it empty for any distance.">
        <div className="input-suffix">
          <input id="p-km" type="number" inputMode="decimal" min="0.5" max="30" step="0.5" value={form.maxKm} onChange={(e) => set('maxKm', e.target.value)} placeholder="Any distance" />
          <span>km</span>
        </div>
      </Field>

      <label className="toggle-row">
        <span className="toggle-row__icon"><Power size={22} weight="bold" /></span>
        <span className="toggle-row__text"><b>Active</b><small className="muted">{form.active ? 'Runs between the start and end times' : 'Saved, but switched off'}</small></span>
        <span className="switch"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /><span /></span>
      </label>

      {error && <p className="alert" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn--grey" onClick={onClose} disabled={busy}>Back</button>
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : promo ? 'Save' : 'Create promo'}</button>
      </div>
    </form>
  );
}

function PromoCard({ promo, townName, onEdit, onToggle, onEnd, busy }) {
  const [tone, label] = STATES[promo.state] || ['grey', promo.state];
  const towns = promo.townIds?.length ? promo.townIds.map(townName).join(', ') : 'All towns';
  const ended = promo.state === 'ENDED';
  return (
    <article className={`card promo-card promo-card--${promo.state.toLowerCase()}`}>
      <div className="promo-card__head">
        <span className="promo-card__icon"><Gift size={26} weight="fill" /></span>
        <div className="promo-card__title">
          <h3>{promo.title}</h3>
          {promo.note && <p>{promo.note}</p>}
        </div>
        <span className={`pill pill--${tone}`}>{promo.state === 'ON' && <i />}{label}</span>
      </div>
      <ul className="promo-card__facts">
        <li><CalendarBlank size={16} /> {dateTime(promo.startsAt)} → {promo.endsAt ? dateTime(promo.endsAt) : 'no end date'}</li>
        <li><MapPin size={16} /> {towns}</li>
        <li><Ruler size={16} /> {promo.maxKm ? `Up to ${promo.maxKm} km` : 'Any distance'}</li>
      </ul>
      <div className="promo-card__stats">
        <div><span>Deliveries</span><strong>{promo.jobs ?? 0}</strong></div>
        <div><span>Delivered</span><strong>{promo.delivered ?? 0}</strong></div>
        <div><span>Paid to riders</span><strong className={promo.paidToRiders > 0 ? 'tone-pink' : ''}>{peso(promo.paidToRiders || 0, { cents: true })}</strong></div>
      </div>
      <div className="promo-card__foot">
        <small className="muted"><Users size={14} /> {promo.createdBy ? `By ${promo.createdBy} · ` : ''}{dateTime(promo.createdAt)}</small>
        <div className="promo-card__actions">
          <button type="button" className="btn btn--soft btn--sm" onClick={onEdit} disabled={busy}><PencilSimple size={16} /> Edit</button>
          {!ended && (
            <button type="button" className="btn btn--soft btn--sm" onClick={onToggle} disabled={busy}>
              <Power size={16} /> {promo.active ? 'Turn off' : 'Turn on'}
            </button>
          )}
          {!ended && <button type="button" className="btn btn--danger btn--sm" onClick={onEnd} disabled={busy}><StopCircle size={16} /> End now</button>}
        </div>
      </div>
    </article>
  );
}

export default function AdminPromos() {
  const toast = useToast();
  const { data, error, setData, reload } = useLive('/admin/promos', { every: 30000 });
  const { data: towns } = useLive('/towns');
  const [editing, setEditing] = useState(null); // null | 'new' | promo
  const [ending, setEnding] = useState(null);
  const [told, setTold] = useState(null);
  const [busy, setBusy] = useState('');

  const townName = (id) => towns?.find((t) => t.id === id)?.name || 'a town';
  const replace = (p) => setData((list) => (list || []).map((x) => (x.id === p.id ? { ...x, ...p } : x)));

  const saved = (p, created) => {
    if (created) setData((list) => [p, ...(list || [])]);
    else replace(p);
    if (created || p.ridersTold) setTold({ title: p.title, count: p.ridersTold || 0 });
    setEditing(null);
    reload({ quiet: true });
  };

  const toggle = async (p) => {
    setBusy(p.id);
    try {
      const next = await api.put(`/admin/promos/${p.id}`, { active: !p.active });
      replace(next);
      toast(next.active ? 'Promo turned on' : 'Promo turned off');
      if (next.ridersTold) setTold({ title: next.title, count: next.ridersTold });
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy('');
    }
  };

  const end = async () => {
    const p = ending;
    setBusy(p.id);
    try {
      replace(await api.post(`/admin/promos/${p.id}/end`));
      toast('Promo ended');
      setEnding(null);
    } catch (err) {
      toast(err.message);
      if (err.status === 409) {
        setEnding(null);
        reload({ quiet: true });
      }
    } finally {
      setBusy('');
    }
  };

  const head = (
    <BackBar title="Free delivery" to="/admin/me">
      <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')} disabled={!towns}>
        <Plus size={16} weight="bold" /> New promo
      </button>
    </BackBar>
  );
  if (error) return <>{head}<p className="alert">{error}</p></>;

  // Running first, then scheduled, then switched off.
  const RANK = { ON: 0, SCHEDULED: 1, OFF: 2 };
  const live = (data || []).filter((p) => p.state !== 'ENDED').sort((a, b) => RANK[a.state] - RANK[b.state]);
  const ended = (data || []).filter((p) => p.state === 'ENDED');
  const card = (p) => (
    <PromoCard key={p.id} promo={p} townName={townName} busy={busy === p.id}
      onEdit={() => setEditing(p)} onToggle={() => toggle(p)} onEnd={() => setEnding(p)} />
  );

  return (
    <>
      {head}
      <section className="card promo-explain">
        <span className="promo-explain__icon"><Gift size={30} weight="fill" /></span>
        <div>
          <h2>How free delivery works</h2>
          <p>
            Buyers pay no delivery fee for E-MOORM orders in these towns; riders still earn their usual amount and MoorMove pays it.
            E-MOORM shows the promo to buyers and sellers.
          </p>
          <p className="muted small">Riders who deliver in the promo&apos;s towns get a notification when it starts. Orders booked while it runs stay free after it ends.</p>
        </div>
      </section>

      {told && (
        <p className="alert alert--ok" role="status">
          <CheckCircle size={18} weight="fill" />
          <span><b>{told.title}</b> is saved. {told.count ? `${plural(told.count, 'rider was', 'riders were')} told.` : 'No riders were told yet: they hear about it when it is on and has riders in its towns.'}</span>
        </p>
      )}

      {!data ? <Loading /> : !data.length ? (
        <Empty art="promos" title="No promos yet" action={<button type="button" className="btn btn--primary" onClick={() => setEditing('new')} disabled={!towns}><Plus size={18} weight="bold" /> New promo</button>}>
          Run a free-delivery week to bring buyers in. MoorMove pays the riders as usual.
        </Empty>
      ) : (
        <>
          <section className="section section--plain">
            <div className="section__head"><h2>Running and upcoming</h2><span className="muted small">{plural(live.length, 'promo')}</span></div>
            {live.length
              ? <div className="promo-grid">{live.map(card)}</div>
              : <p className="muted small section__body">Nothing running. Start one with New promo.</p>}
          </section>
          {ended.length > 0 && (
            <section className="section section--plain">
              <div className="section__head"><h2>Ended</h2><span className="muted small">{plural(ended.length, 'promo')}</span></div>
              <div className="promo-grid">{ended.map(card)}</div>
            </section>
          )}
        </>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} label="Promo">
        {editing && towns && (
          <PromoForm promo={editing === 'new' ? null : editing} towns={towns} onDone={saved} onClose={() => setEditing(null)} />
        )}
      </Sheet>

      <Sheet open={Boolean(ending)} onClose={() => setEnding(null)} label="End promo">
        {ending && (
          <>
            <h2>End “{ending.title}” now?</h2>
            <p>New orders pay the usual delivery fee from now on. Deliveries already booked stay free, and MoorMove still pays their riders.</p>
            <div className="btn-row">
              <button type="button" className="btn btn--grey" onClick={() => setEnding(null)}>Back</button>
              <button type="button" className="btn btn--danger" onClick={end} disabled={busy === ending.id}>{busy === ending.id ? 'Ending…' : 'End now'}</button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
