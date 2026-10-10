import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight, BookmarkSimple, Archive, CheckCircle, Envelope, MapPin, Money, Package, UserCircle, WarningCircle,
} from '@phosphor-icons/react';
import api from '../api';
import { useAuth } from '../auth';
import { useLive } from '../lib/hooks';
import { km, peso, SIZES, VEHICLES } from '../lib/format';
import { DEFAULT_CENTER, MapPicker, RouteMap } from './maps';
import { BackBar, Field, Loading, MapPage } from './ui';
import { VehicleArt } from './art';

const STEPS = ['Pickup', 'Drop-off', 'Package', 'Review'];
const EMPTY_STOP = { name: '', phone: '', address: '', barangay: '', notes: '', lat: null, lng: null };
// A saved place (from the home screen's recent places) as a stop.
const asStop = (p) => (p ? {
  name: p.name || '', phone: p.phone || '', address: p.address || '', barangay: p.barangay || '', notes: p.notes || '', lat: p.lat, lng: p.lng,
} : EMPTY_STOP);
const SIZE_ICONS = { SMALL: Envelope, MEDIUM: Package, LARGE: Archive };

const stopErrors = (s) => {
  const e = {};
  if (!s.lat) e.pin = 'Drop a pin on the map';
  if (s.name.trim().length < 2) e.name = 'Enter a name';
  if (!/^(09|\+639)\d{9}$/.test(s.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a mobile number, like 09171234567';
  if (s.address.trim().length < 3) e.address = 'Enter the street, building or landmark';
  if (!s.barangay.trim()) e.barangay = 'Enter the barangay';
  return e;
};

function StopForm({ kind, value, onChange, errors, places, me }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const fill = (p) => onChange({ ...value, name: p.name, phone: p.phone, address: p.address, barangay: p.barangay, notes: p.notes || '', lat: p.lat, lng: p.lng });
  const label = kind === 'pickup' ? 'Sender' : 'Recipient';
  return (
    <>
      <p className={`pin-status${value.lat ? ' is-set' : ''}${errors.pin ? ' is-error' : ''}`}>
        {value.lat ? <CheckCircle size={20} weight="fill" /> : errors.pin ? <WarningCircle size={20} weight="fill" /> : <MapPin size={20} weight="fill" />}
        <span>{value.lat ? 'Pin set on the map. Drag it to adjust.' : errors.pin || `Tap the map to drop the ${kind === 'pickup' ? 'pickup' : 'drop-off'} pin`}</span>
      </p>
      {places?.length > 0 && (
        <div className="place-chips" aria-label="Recent places">
          {places.map((p) => (
            <button key={`${p.name}${p.lat}${p.lng}`} type="button" className="place-chip" onClick={() => fill(p)}>
              <BookmarkSimple size={15} weight="fill" /> {p.name} · {p.barangay}
            </button>
          ))}
        </div>
      )}
      <div className="field-pair">
        <Field label="Barangay" id={`${kind}-barangay`} error={errors.barangay}>
          <input id={`${kind}-barangay`} value={value.barangay} onChange={set('barangay')} placeholder="e.g. Lalud" />
        </Field>
        <Field label="Street / landmark" id={`${kind}-address`} error={errors.address}>
          <input id={`${kind}-address`} value={value.address} onChange={set('address')} placeholder="House no., street" />
        </Field>
      </div>
      <div className="stop-who">
        <span className="field__label">{label}</span>
        {me && (
          <button type="button" className="link-btn small" onClick={() => onChange({ ...value, name: me.fullName, phone: me.phone })}>
            <UserCircle size={16} style={{ verticalAlign: -3 }} /> Use my details
          </button>
        )}
      </div>
      <div className="field-pair">
        <Field id={`${kind}-name`} error={errors.name}>
          <input id={`${kind}-name`} value={value.name} onChange={set('name')} placeholder="Name" aria-label={`${label} name`} />
        </Field>
        <Field id={`${kind}-phone`} error={errors.phone}>
          <input id={`${kind}-phone`} type="tel" inputMode="tel" value={value.phone} onChange={set('phone')} placeholder="09171234567" aria-label={`${label} mobile`} />
        </Field>
      </div>
      <Field label="Notes for the rider (optional)" id={`${kind}-notes`}>
        <input id={`${kind}-notes`} value={value.notes} onChange={set('notes')} placeholder="Gate colour, floor, who to look for…" />
      </Field>
    </>
  );
}

/**
 * Book a delivery, on a map screen.
 * @param {{ endpoint, onBooked, forCaller?, title, back, note? }} props
 */
export default function BookingForm({ endpoint, onBooked, forCaller = false, title = 'Book a delivery', back, note }) {
  const { user } = useAuth();
  const { data: towns } = useLive('/towns');
  const { data: rules } = useLive('/jobs/rules');
  const { data: places } = useLive(forCaller ? null : '/jobs/places', { skip: forCaller });

  // The home screen can start a booking from a recent place, or with a vehicle chosen.
  const { state: preset } = useLocation();
  const [step, setStep] = useState(0);
  const [townId, setTownId] = useState(preset?.pickup?.townId || '');
  const [pickup, setPickup] = useState(() => asStop(preset?.pickup));
  const [dropoff, setDropoff] = useState(EMPTY_STOP);
  const [packageSize, setPackageSize] = useState('SMALL');
  const [vehicleType, setVehicleType] = useState(preset?.vehicle || '');
  const [packageDetails, setPackageDetails] = useState('');
  const [feePaidBy, setFeePaidBy] = useState('SENDER');
  const [codOn, setCodOn] = useState(false);
  const [codAmount, setCodAmount] = useState('');
  const [quotes, setQuotes] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openTowns = useMemo(() => (towns || []).filter((t) => t.serviceOpen), [towns]);
  useEffect(() => {
    if (!townId && openTowns.length) setTownId(openTowns.find((t) => /calapan/i.test(t.name))?.id || openTowns[0].id);
  }, [openTowns, townId]);
  const town = (towns || []).find((t) => t.id === townId);
  const center = town?.center || DEFAULT_CENTER;
  const townPlaces = (places || []).filter((p) => p.townId === townId);

  // Prices for every vehicle, once both pins are down.
  const pinsKey = `${pickup.lat},${pickup.lng},${dropoff.lat},${dropoff.lng},${packageSize}`;
  useEffect(() => {
    if (!pickup.lat || !dropoff.lat) return;
    let live = true;
    Promise.all(Object.keys(VEHICLES).map((v) => api.post('/jobs/quote', {
      vehicleType: v, packageSize, pickup: { lat: pickup.lat, lng: pickup.lng }, dropoff: { lat: dropoff.lat, lng: dropoff.lng },
    }).then((q) => [v, q]).catch(() => [v, null])))
      .then((list) => live && setQuotes(Object.fromEntries(list)));
    return () => { live = false; };
  }, [pinsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A vehicle that can't carry the chosen size is dropped.
  useEffect(() => {
    if (vehicleType && rules && !rules.carries[vehicleType].includes(packageSize)) setVehicleType('');
  }, [packageSize, vehicleType, rules]);

  if (!towns || !rules) return <><BackBar title={title} to={back} /><Loading /></>;
  if (!rules.bookingOpen || rules.publicBooking === false || !openTowns.length) {
    return (
      <>
        <BackBar title={title} to={back} />
        <p className="alert alert--warn"><WarningCircle size={20} weight="fill" />
          {rules.publicBooking === false ? "MoorMove isn't open to customers yet. You can still see your past deliveries." : !rules.bookingOpen ? "MoorMove isn't taking bookings right now. Please check again later." : "MoorMove isn't open in any town yet."}
        </p>
      </>
    );
  }

  const pin = (s) => (s.lat ? { lat: s.lat, lng: s.lng } : null);

  const next = () => {
    let e = {};
    if (step === 0) e = stopErrors(pickup);
    if (step === 1) e = stopErrors(dropoff);
    if (step === 2) {
      if (!vehicleType) e.vehicleType = 'Choose a vehicle';
      if (packageDetails.trim().length < 2) e.packageDetails = 'Say what the package is';
      if (codOn && !(Number(codAmount) > 0)) e.codAmount = 'Enter the amount to collect';
      if (codOn && Number(codAmount) > rules.maxCod) e.codAmount = `Up to ${peso(rules.maxCod)}`;
      if (quotes[vehicleType]?.tooFar) e.vehicleType = `Too far: MoorMove delivers up to ${rules.maxDistanceKm} km`;
    }
    setErrors(e);
    if (!Object.keys(e).length) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const book = async () => {
    setBusy(true);
    setError('');
    try {
      const job = await api.post(endpoint, {
        townId, pickup, dropoff, packageSize, vehicleType, packageDetails, feePaidBy, codAmount: codOn ? Number(codAmount) : 0,
      });
      onBooked(job);
    } catch (err) {
      const errs = err.errors || {};
      setError(err.message);
      // Back to the step with the problem.
      const keys = Object.keys(errs);
      if (keys.some((k) => k.startsWith('pickup') || k === 'townId')) setStep(0);
      else if (keys.some((k) => k.startsWith('dropoff'))) setStep(1);
      else if (keys.length) setStep(2);
      setErrors(Object.fromEntries(keys.map((k) => [k.replace(/^(pickup|dropoff)\./, ''), errs[k]])));
    } finally {
      setBusy(false);
    }
  };

  const quote = quotes[vehicleType];
  const placePin = (setter) => (p) => {
    setter((s) => ({ ...s, lat: p.lat, lng: p.lng }));
    setErrors((e) => ({ ...e, pin: '' }));
  };
  const map = step === 0
    ? <MapPicker key="pickup" kind="pickup" center={center} value={pin(pickup)} other={pin(dropoff)} error={errors.pin} onChange={placePin(setPickup)} />
    : step === 1
      ? <MapPicker key="dropoff" kind="dropoff" center={pin(pickup) || center} value={pin(dropoff)} other={pin(pickup)} error={errors.pin} onChange={placePin(setDropoff)} />
      : <RouteMap fill pickup={pin(pickup)} dropoff={pin(dropoff)} />;

  return (
    <MapPage title={title} back={back} compactMap={step >= 2} map={map}>
      <div className="booking">
        {note && <p className="booking__note">{note}</p>}
        <ol className="stepper" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''}>
              <button type="button" disabled={i > step} onClick={() => setStep(i)}>
                <span>{i < step ? <CheckCircle size={18} weight="fill" /> : i + 1}</span>{s}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="card">
            <h2 className="card-title"><span className="step-dot step-dot--a">A</span> Where should the rider pick up?</h2>
            <Field label="Town" id="townId" error={errors.townId}>
              <select id="townId" value={townId} onChange={(e) => { setTownId(e.target.value); setPickup({ ...pickup, lat: null, lng: null }); setDropoff({ ...dropoff, lat: null, lng: null }); }}>
                {towns.map((t) => <option key={t.id} value={t.id} disabled={!t.serviceOpen}>{t.name}{t.serviceOpen ? '' : ' (soon)'}</option>)}
              </select>
            </Field>
            <StopForm kind="pickup" value={pickup} onChange={setPickup} errors={errors} places={townPlaces} me={forCaller ? null : user} />
          </section>
        )}

        {step === 1 && (
          <section className="card">
            <h2 className="card-title"><span className="step-dot step-dot--b">B</span> Where should it go?</h2>
            <p className="muted small" style={{ marginTop: -6, marginBottom: 12 }}>Within {town?.name}</p>
            <StopForm kind="dropoff" value={dropoff} onChange={setDropoff} errors={errors} places={townPlaces} me={forCaller ? null : user} />
          </section>
        )}

        {step === 2 && (
          <>
            <section className="card">
              <h2 className="card-title">Package size</h2>
              <div className="size-pick" role="radiogroup" aria-label="Package size">
                {Object.entries(SIZES).map(([key, s]) => {
                  const Icon = SIZE_ICONS[key];
                  return (
                    <button key={key} type="button" role="radio" aria-checked={packageSize === key}
                      className={`size-pick__item choice${packageSize === key ? ' is-on' : ''}`} onClick={() => setPackageSize(key)}>
                      <Icon size={28} weight={packageSize === key ? 'fill' : 'duotone'} />
                      <strong>{s.label}</strong>
                      <small>{s.max}</small>
                    </button>
                  );
                })}
              </div>
              <p className="muted small size-pick__hint">{SIZES[packageSize].hint}</p>
              <Field label="What is it?" id="packageDetails" error={errors.packageDetails}>
                <input id="packageDetails" value={packageDetails} onChange={(e) => setPackageDetails(e.target.value)} placeholder="e.g. Documents, a box of shoes" />
              </Field>
            </section>

            <section className="card">
              <h2 className="card-title">Vehicle</h2>
              <div className="vehicle-list">
                {['MOTORCYCLE', 'TRICYCLE', 'BICYCLE'].map((key) => {
                  const fits = rules.carries[key].includes(packageSize);
                  const q = quotes[key];
                  return (
                    <button key={key} type="button" disabled={!fits} className={`vehicle-opt choice${vehicleType === key ? ' is-on' : ''}`} onClick={() => setVehicleType(key)}>
                      <span className="vehicle-opt__art"><VehicleArt type={key} size={84} /></span>
                      <span className="choice__text">
                        <strong>{VEHICLES[key]}</strong>
                        <small>{fits ? (q ? `${km(q.distanceKm)} trip` : 'Getting price…') : `Can't carry ${SIZES[packageSize].label.toLowerCase()} packages`}</small>
                      </span>
                      {fits && q && <span className="choice__end">{peso(q.fee)}</span>}
                    </button>
                  );
                })}
              </div>
              {errors.vehicleType && <p className="field__error">{errors.vehicleType}</p>}
            </section>

            <section className="card">
              <h2 className="card-title">Payment</h2>
              <p className="field__label">Who pays the fare? (cash to the rider)</p>
              <div className="segmented">
                <button type="button" className={feePaidBy === 'SENDER' ? 'is-on' : ''} onClick={() => setFeePaidBy('SENDER')}>Sender, at pickup</button>
                <button type="button" className={feePaidBy === 'RECIPIENT' ? 'is-on' : ''} onClick={() => setFeePaidBy('RECIPIENT')}>Recipient, at drop-off</button>
              </div>
              <label className="toggle-row">
                <span className="toggle-row__icon"><Money size={24} weight="fill" /></span>
                <span className="toggle-row__text">
                  <strong>Collect cash on delivery (COD)</strong>
                  <small className="muted">The rider collects the item price and brings it back to the sender</small>
                </span>
                <span className="switch">
                  <input type="checkbox" checked={codOn} onChange={(e) => setCodOn(e.target.checked)} />
                  <span />
                </span>
              </label>
              {codOn && (
                <Field label="Amount to collect" id="codAmount" error={errors.codAmount}>
                  <div className="input-prefix"><span>₱</span>
                    <input id="codAmount" type="number" inputMode="numeric" min="1" max={rules.maxCod} value={codAmount} onChange={(e) => setCodAmount(e.target.value)} />
                  </div>
                </Field>
              )}
            </section>
          </>
        )}

        {step === 3 && quote && (
          <>
            <section className="card">
              <h2 className="card-title">Check your booking</h2>
              <ol className="route">
                <li className="route__stop">
                  <span className="route__dot route__dot--a">A</span>
                  <div className="route__text"><small className="route__label">Pickup</small><strong>{pickup.name}</strong><span>{pickup.address}, {pickup.barangay}</span><span>{pickup.phone}</span></div>
                </li>
                <li className="route__stop">
                  <span className="route__dot route__dot--b">B</span>
                  <div className="route__text"><small className="route__label">Drop-off</small><strong>{dropoff.name}</strong><span>{dropoff.address}, {dropoff.barangay}</span><span>{dropoff.phone}</span></div>
                </li>
              </ol>
            </section>
            <section className="card">
              <div className="pkg-line">
                <span className="pkg-line__art"><VehicleArt type={vehicleType} size={64} /></span>
                <div>
                  <strong>{packageDetails}</strong>
                  <span>{SIZES[packageSize].label} package · {VEHICLES[vehicleType]} · {km(quote.distanceKm)}</span>
                </div>
              </div>
              <dl className="receipt">
                <div className="kv"><dt>Base fare</dt><dd>{peso(quote.breakdown.base)}</dd></div>
                {quote.breakdown.distanceFare > 0 && <div className="kv"><dt>Distance ({km(quote.breakdown.extraKm)} past {quote.breakdown.includedKm} km)</dt><dd>{peso(quote.breakdown.distanceFare)}</dd></div>}
                {quote.breakdown.surcharge > 0 && <div className="kv"><dt>{SIZES[packageSize].label} package</dt><dd>{peso(quote.breakdown.surcharge)}</dd></div>}
                <div className="kv kv--total"><dt>Fare</dt><dd>{peso(quote.fee)}</dd></div>
                <div className="kv"><dt>Paid by</dt><dd>{feePaidBy === 'SENDER' ? 'Sender, at pickup' : 'Recipient, at drop-off'}</dd></div>
                {codOn && <div className="kv"><dt>COD to collect</dt><dd className="tone-amber">{peso(codAmount)}</dd></div>}
              </dl>
            </section>
            {error && <p className="alert" role="alert">{error}</p>}
          </>
        )}

        <div className="booking__actions">
          {step > 0 && <button type="button" className="btn btn--grey" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
          {step < 3
            ? <button type="button" className="btn btn--primary" onClick={next}>{step === 2 && quote ? `Review · ${peso(quote.fee)}` : 'Continue'} <ArrowRight size={18} /></button>
            : <button type="button" className="btn btn--primary" onClick={book} disabled={busy || !quote}>{busy ? 'Booking…' : `Book for ${peso(quote?.fee)}`}</button>}
        </div>
      </div>
    </MapPage>
  );
}
