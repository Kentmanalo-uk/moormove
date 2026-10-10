import { useEffect, useState } from 'react';
import api from '../../api';
import { useLive } from '../../lib/hooks';
import { ago, dateTime, peso, VEHICLES } from '../../lib/format';
import { BackBar, Field, Loading, useToast } from '../../components/ui';
import { VehicleArt } from '../../components/art';

/** Is the E-MOORM link set up, and are E-MOORM's updates getting through? */
function PartnerHealth() {
  const { data: p } = useLive('/admin/partner', { every: 30000 });
  if (!p) return null;
  if (!p.secretSet) {
    return <p className="alert alert--warn">The E-MOORM link is not set up: set PARTNER_SECRET on the server (the same value as E-MOORM&apos;s MOORMOVE_SECRET).</p>;
  }
  return (
    <>
      <p className={`alert ${p.lastError ? 'alert--warn' : 'alert--ok'}`}>
        {p.lastError
          ? <>E-MOORM isn&apos;t getting updates: {p.lastError.message}{p.lastError.job ? ` (${p.lastError.job.code})` : ''}. {p.lastError.gaveUp ? 'Stopped trying after a day.' : `Trying again ${dateTime(p.lastError.nextTryAt)}.`}</>
          : <>Linked with E-MOORM.{p.lastSentAt ? ` Last update sent ${ago(p.lastSentAt)}.` : ''}</>}
      </p>
      {p.waiting > 0 && <p className="small muted">{p.waiting} update{p.waiting === 1 ? '' : 's'} waiting to be sent.</p>}
    </>
  );
}

/** Fares, commission and booking rules. */
export default function AdminSettings() {
  const toast = useToast();
  const { data } = useLive('/admin/settings');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return <><BackBar title="Fares & settings" /><Loading /></>;

  const setVehicle = (v, k, value) => setForm({ ...form, vehicles: { ...form.vehicles, [v]: { ...form.vehicles[v], [k]: value } } });
  const num = (key, label, hint, prefix) => (
    <Field label={label} id={key} error={errors[key]} hint={hint}>
      <div className={prefix ? 'input-prefix' : undefined}>
        {prefix && <span>{prefix}</span>}
        <input id={key} type="number" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      </div>
    </Field>
  );

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      setForm(await api.put('/admin/settings', form));
      toast('Settings saved');
    } catch (err) {
      setErrors(err.errors || {});
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  // A 5 km small-package example, so the numbers mean something.
  const example = (v) => {
    const f = form.vehicles[v];
    const extra = Math.max(0, 5 - Number(form.includedKm || 0));
    return Math.round(Number(f.base || 0) + extra * Number(f.perKm || 0));
  };

  return (
    <form onSubmit={save} className="settings-form">
      <BackBar title="Fares & settings" to="/admin/me" />
      <div className="settings-grid">

      <section className="section">
        <div className="section__head"><h2>Fares by vehicle</h2></div>
        <div className="section__body">
          {Object.keys(VEHICLES).map((v) => (
            <div key={v} className="fare-row">
              <span className="fare-row__name"><VehicleArt type={v} size={64} /> <span>{VEHICLES[v]}<small>A 5 km small delivery costs <b>{peso(example(v))}</b></small></span></span>
              <div className="field-pair">
                <Field label="Base fare" id={`${v}-base`} error={errors[`${v}.base`]}>
                  <div className="input-prefix"><span>₱</span><input id={`${v}-base`} type="number" value={form.vehicles[v].base} onChange={(e) => setVehicle(v, 'base', e.target.value)} /></div>
                </Field>
                <Field label="Per extra km" id={`${v}-km`} error={errors[`${v}.perKm`]}>
                  <div className="input-prefix"><span>₱</span><input id={`${v}-km`} type="number" value={form.vehicles[v].perKm} onChange={(e) => setVehicle(v, 'perKm', e.target.value)} /></div>
                </Field>
              </div>
            </div>
          ))}
          {num('includedKm', 'Km included in the base fare', null)}
          {num('roadFactor', 'Road factor', 'Straight-line distance × this, for the roads in between (1.3 is typical)')}
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Package size surcharge</h2></div>
        <div className="section__body field-trio">
          {['SMALL', 'MEDIUM', 'LARGE'].map((s) => (
            <Field key={s} label={s[0] + s.slice(1).toLowerCase()} id={`size-${s}`} error={errors[s]}>
              <div className="input-prefix"><span>₱</span><input id={`size-${s}`} type="number" value={form.sizeSurcharge[s]} onChange={(e) => setForm({ ...form, sizeSurcharge: { ...form.sizeSurcharge, [s]: e.target.value } })} /></div>
            </Field>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Rules</h2></div>
        <div className="section__body">
          {num('commissionPercent', "MoorMove's commission (%)", 'Taken from each fare; riders keep the rest')}
          {num('maxDistanceKm', 'Longest delivery (km)')}
          {num('maxCod', 'Most COD a rider carries', null, '₱')}
          <label className="toggle-row">
            <span className="toggle-row__text"><strong>Taking bookings</strong><small className="muted">Turn off to pause all new bookings</small></span>
            <span className="switch"><input type="checkbox" checked={Boolean(form.bookingOpen)} onChange={(e) => setForm({ ...form, bookingOpen: e.target.checked })} /><span /></span>
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>E-MOORM</h2></div>
        <div className="section__body">
          <label className="toggle-row">
            <span className="toggle-row__text"><strong>Take E-MOORM deliveries</strong><small className="muted">E-MOORM shops call a MoorMove rider when an order is packed</small></span>
            <span className="switch"><input type="checkbox" checked={Boolean(form.partnerOpen)} onChange={(e) => setForm({ ...form, partnerOpen: e.target.checked })} /><span /></span>
          </label>
          <label className="toggle-row">
            <span className="toggle-row__text"><strong>Let people book deliveries on MoorMove</strong><small className="muted">Off: MoorMove carries E-MOORM orders only, and sign-up is for riders</small></span>
            <span className="switch"><input type="checkbox" checked={Boolean(form.publicBooking)} onChange={(e) => setForm({ ...form, publicBooking: e.target.checked })} /><span /></span>
          </label>
          <PartnerHealth />
        </div>
      </section>

      <section className="section">
        <div className="section__head"><h2>Support contacts</h2></div>
        <div className="section__body">
          <Field label="Support phone" id="supportPhone" hint="Shown in the Help center">
            <input id="supportPhone" type="tel" value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
          </Field>
          <Field label="Support email" id="supportEmail">
            <input id="supportEmail" type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
          </Field>
        </div>
      </section>

      </div>
      <div className="sticky-action">
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>
    </form>
  );
}
