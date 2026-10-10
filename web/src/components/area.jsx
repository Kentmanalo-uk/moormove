import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, House, Info, MagnifyingGlass, MapPin, MapPinArea, Plus, WarningCircle, X,
} from '@phosphor-icons/react';
import { listBarangays, normBarangay } from '../lib/places';
import { useToast } from './ui';
import { plural } from '../lib/format';

/*
 * Where a rider delivers: whole towns, or some barangays of a town. The rider
 * picks it on /rider/area and an admin on /admin/riders/:id/area; both use
 * AreaEditor. The server keeps it as rows [{ townId, barangay|null }]; an
 * empty list means the rider's whole home town.
 */

export const AREA_LIMITS = { towns: 15, places: 300, barangayLength: 80 };

/** Server rows → picks [{ townId, whole, barangays: [name] }], in town order. */
export const rowsToPicks = (rows = [], homeTownId = null) => {
  if (!rows.length) return homeTownId ? [{ townId: homeTownId, whole: true, barangays: [] }] : [];
  const picks = [];
  for (const r of rows) {
    let p = picks.find((x) => x.townId === r.townId);
    if (!p) {
      p = { townId: r.townId, whole: false, barangays: [] };
      picks.push(p);
    }
    if (!r.barangay) p.whole = true;
    else p.barangays.push(r.barangay);
  }
  // The home town first.
  return [...picks.filter((p) => p.townId === homeTownId), ...picks.filter((p) => p.townId !== homeTownId)];
};

/** Picks → the rows to send (a town on "Some barangays" with none ticked is left out). */
export const picksToRows = (picks) => picks.flatMap((p) => (p.whole
  ? [{ townId: p.townId, barangay: null }]
  : p.barangays.map((b) => ({ townId: p.townId, barangay: b }))));

/** "Calapan City (whole town) · Baco (3 barangays)", like the server's summary. */
export const picksSummary = (picks, townName, homeTownId = null) => picks
  .filter((p) => p.whole || p.barangays.length)
  // The home town first, then A to Z (as the server writes it).
  .sort((a, b) => (a.townId === homeTownId ? -1 : b.townId === homeTownId ? 1 : townName(a.townId).localeCompare(townName(b.townId))))
  .map((p) => {
    const name = townName(p.townId);
    if (p.whole) return `${name} (whole town)`;
    if (p.barangays.length === 1) return `${name} (${p.barangays[0]})`;
    return `${name} (${p.barangays.length} barangays)`;
  })
  .join(' · ');

/** The area, town by town: for the admin's rider page. */
export function AreaList({ area, homeTownName }) {
  const picks = area.areas.length ? rowsToPicks(area.areas, area.homeTownId) : [];
  if (!picks.length) {
    return (
      <ul className="area-list">
        <li>
          <span className="area-list__icon"><House size={20} weight="fill" /></span>
          <span className="area-list__text"><strong>{homeTownName || 'Home town not chosen yet'}</strong><small>{homeTownName ? 'Whole town · their home town (nothing picked)' : 'No area yet'}</small></span>
        </li>
      </ul>
    );
  }
  const names = Object.fromEntries(area.areas.map((a) => [a.townId, a]));
  return (
    <ul className="area-list">
      {picks.map((p) => (
        <li key={p.townId}>
          <span className="area-list__icon"><MapPin size={20} weight="fill" /></span>
          <span className="area-list__text">
            <strong>{names[p.townId]?.townName || 'A town'}{p.townId === area.homeTownId && <span className="pill pill--grey">Home</span>}{names[p.townId]?.serviceOpen === false && <span className="pill pill--amber">Not open yet</span>}</strong>
            <small>{p.whole ? 'Whole town' : p.barangays.join(', ')}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One chosen town: whole, or a searchable checklist of its barangays. */
function TownCard({ town, pick, home, onChange, onRemove, errors, limits }) {
  const [names, setNames] = useState(null); // null: loading; [] : couldn't load
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (pick.whole || names) return undefined;
    let live = true;
    listBarangays(town.name)
      .then((list) => live && setNames(list))
      .catch(() => {
        if (!live) return;
        setNames([]);
        setFailed(true);
      });
    return () => { live = false; };
  }, [pick.whole, names, town.name]);

  const chosen = new Set(pick.barangays.map(normBarangay));
  const isOn = (name) => chosen.has(normBarangay(name));
  const toggle = (name) => {
    const key = normBarangay(name);
    onChange({ ...pick, barangays: isOn(name) ? pick.barangays.filter((b) => normBarangay(b) !== key) : [...pick.barangays, name] });
  };
  const add = (name) => {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean || isOn(clean)) return;
    onChange({ ...pick, barangays: [...pick.barangays, clean] });
  };

  const needle = normBarangay(q);
  const shown = (names || []).filter((n) => !needle || normBarangay(n).includes(needle));
  // Saved names PSGC doesn't list (typed by hand earlier): shown as chips only.
  const listed = new Set((names || []).map(normBarangay));
  const extra = pick.barangays.filter((b) => !listed.has(normBarangay(b)));
  const canAddSearch = names && !failed && q.trim() && !shown.some((n) => normBarangay(n) === needle);

  return (
    <section className={`card town-pick${errors.length ? ' town-pick--error' : ''}`}>
      <div className="town-pick__head">
        <span className="town-pick__icon"><MapPin size={22} weight="fill" /></span>
        <div className="town-pick__title">
          <strong>{town.name}</strong>
          <small>
            {home && 'Your home town · '}
            {town.serviceOpen ? (pick.whole ? 'Every barangay' : plural(pick.barangays.length, 'barangay')) : 'MoorMove is not open here yet'}
          </small>
        </div>
        <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove ${town.name}`} title="Remove"><X size={20} /></button>
      </div>

      <div className="segmented" role="radiogroup" aria-label={`How much of ${town.name}`}>
        <button type="button" role="radio" aria-checked={pick.whole} className={pick.whole ? 'is-on' : ''} onClick={() => onChange({ ...pick, whole: true })}>Whole town</button>
        <button type="button" role="radio" aria-checked={!pick.whole} className={!pick.whole ? 'is-on' : ''} onClick={() => onChange({ ...pick, whole: false })}>Some barangays</button>
      </div>

      {!pick.whole && (
        <div className="brgy">
          {pick.barangays.length > 0 && (
            <ul className="brgy__chosen" aria-label="Chosen barangays">
              {[...pick.barangays].sort((a, b) => a.localeCompare(b)).map((b) => (
                <li key={b}>
                  <button type="button" className="chip chip--on" onClick={() => toggle(b)} aria-label={`Remove ${b}`}>{b} <X size={14} weight="bold" /></button>
                </li>
              ))}
            </ul>
          )}

          {names === null ? (
            <p className="brgy__note"><span className="spinner spinner--sm" /> Loading the barangays of {town.name}…</p>
          ) : failed ? (
            <>
              <p className="alert alert--warn"><WarningCircle size={18} weight="fill" /> <span>We couldn&apos;t load the list of barangays. Type each one you deliver to and tap Add.</span></p>
              <form className="brgy__add" onSubmit={(e) => { e.preventDefault(); add(typed); setTyped(''); }}>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={limits.barangayLength} placeholder="Barangay name, e.g. Lalud" aria-label="Barangay name" />
                <button className="btn btn--soft" disabled={!typed.trim()}><Plus size={16} weight="bold" /> Add</button>
              </form>
            </>
          ) : (
            <>
              <label className="search search--soft">
                <MagnifyingGlass size={18} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${names.length} barangays`} aria-label={`Search barangays in ${town.name}`} maxLength={limits.barangayLength} />
                {q && <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>}
              </label>
              <ul className="brgy__list">
                {shown.map((n) => (
                  <li key={n}>
                    <label className={`brgy__item${isOn(n) ? ' is-on' : ''}`}>
                      <input type="checkbox" checked={isOn(n)} onChange={() => toggle(n)} />
                      <span>{n}</span>
                    </label>
                  </li>
                ))}
                {!shown.length && <li className="brgy__none">No barangay called “{q.trim()}” in the list.</li>}
              </ul>
              {canAddSearch && (
                <button type="button" className="link-btn brgy__add-link" onClick={() => { add(q); setQ(''); }}>
                  <Plus size={16} weight="bold" /> Add “{q.trim()}” anyway
                </button>
              )}
              {extra.length > 0 && <p className="brgy__note">Typed by hand: {extra.join(', ')}</p>}
            </>
          )}
          {!pick.barangays.length && <p className="field__hint">Tick at least one barangay, or choose Whole town.</p>}
        </div>
      )}

      {errors.map((e) => <p key={e} className="field__error">{e}</p>)}
    </section>
  );
}

/**
 * The area picker with its save button. `area` is the server's area object
 * ({ homeTownId, usesHomeTown, areas, summary }); `save(rows)` sends the rows
 * and resolves with the new area object (plus `notices`). `admin` words it
 * for an admin ("the rider") instead of the rider ("you").
 */
export function AreaEditor({ area, towns, limits = AREA_LIMITS, save, admin = false, onSaved }) {
  const [picks, setPicks] = useState(() => rowsToPicks(area.areas, area.homeTownId));
  const [current, setCurrent] = useState(area);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ byTown: {}, general: '' });
  const [notices, setNotices] = useState(area.notices || []);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  const byId = useMemo(() => Object.fromEntries(towns.map((t) => [t.id, t])), [towns]);
  const townName = (id) => byId[id]?.name || current.areas.find((a) => a.townId === id)?.townName || 'A town';
  const home = byId[area.homeTownId];
  const chosen = new Set(picks.map((p) => p.townId));
  const you = admin ? 'the rider' : 'you';
  const You = admin ? 'The rider' : 'You';

  const change = (next) => {
    setPicks(next);
    setSaved(false);
    setError('');
  };
  const toggleTown = (t) => {
    if (chosen.has(t.id)) change(picks.filter((p) => p.townId !== t.id));
    else if (picks.length >= limits.towns) setError(`Choose up to ${limits.towns} towns.`);
    else change([...picks, { townId: t.id, whole: true, barangays: [] }]);
  };
  const setPick = (next) => change(picks.map((p) => (p.townId === next.townId ? next : p)));

  const rows = picksToRows(picks);
  // Just the whole home town: sent as an empty list, so it follows the home town.
  const onlyHome = rows.length === 1 && rows[0].barangay === null && rows[0].townId === area.homeTownId;
  const send = onlyHome ? [] : rows;
  const summary = rows.length ? picksSummary(picks, townName, area.homeTownId) : (home ? `${home.name} (whole town)` : '');
  const empty = picks.filter((p) => !p.whole && !p.barangays.length);
  const tooMany = rows.length > limits.places;
  const nothing = !rows.length && !area.homeTownId;

  const submit = async () => {
    setBusy(true);
    setError('');
    setFieldErrors({ byTown: {}, general: '' });
    try {
      const next = await save(send);
      setCurrent(next);
      setNotices(next.notices || []);
      setPicks(rowsToPicks(next.areas, next.homeTownId));
      setSaved(true);
      // Phones: the save bar is at the bottom; say it here too.
      toast(next.notices?.length ? next.notices[0] : `Saved. ${admin ? 'Their' : 'Your'} area: ${next.summary}`);
      onSaved?.(next);
    } catch (err) {
      // 422: errors keyed areas, areas.N.townId or areas.N.barangay.
      const byTown = {};
      let general = '';
      for (const [key, message] of Object.entries(err.errors || {})) {
        const m = key.match(/^areas\.(\d+)\.(townId|barangay)$/);
        const row = m ? send[Number(m[1])] : null;
        if (row) {
          const text = row.barangay ? `${row.barangay}: ${message}` : message;
          byTown[row.townId] = [...(byTown[row.townId] || []), text];
        } else {
          general = message;
        }
      }
      setFieldErrors({ byTown, general });
      setError(general || (Object.keys(byTown).length ? 'Some places need fixing. See the marked towns.' : err.message));
    } finally {
      setBusy(false);
    }
  };

  const canSave = !busy && !empty.length && !tooMany && !nothing;
  const saveBtn = (cls = '') => (
    <button type="button" className={`btn btn--primary ${cls}`} onClick={submit} disabled={!canSave}>
      {busy ? 'Saving…' : saved ? <><CheckCircle size={18} weight="fill" /> Saved</> : 'Save area'}
    </button>
  );
  const status = (
    <>
      {error && <p className="alert" role="alert"><WarningCircle size={18} weight="fill" /> <span>{error}</span></p>}
      {saved && <p className="alert alert--ok" role="status"><CheckCircle size={18} weight="fill" /> <span>Saved. {admin ? 'The rider was told about their new area.' : 'New deliveries now follow your area.'}</span></p>}
      {notices.map((n) => <p key={n} className="alert alert--info"><Info size={18} weight="fill" /> <span>{n}</span></p>)}
    </>
  );

  return (
    <div className="area-editor">
      <div className="page-grid area-page">
        <div>
          <section className="card area-intro">
            <span className="area-intro__icon"><MapPinArea size={30} weight="fill" /></span>
            <div>
              <h2>{admin ? 'Where this rider delivers' : 'Where do you deliver?'}</h2>
              <p>{You} only get{admin ? 's' : ''} deliveries whose <strong>pickup and drop-off are both inside {admin ? 'this' : 'your'} area</strong>. Pick whole towns, or only the barangays {you} know well.</p>
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <div>
                <h2>Towns</h2>
                <p className="section__sub">Tap the towns {you} deliver in{picks.length ? ` · ${plural(picks.length, 'town')} chosen` : ''}</p>
              </div>
            </div>
            <div className="section__body">
              <ul className="town-chips">
                {towns.map((t) => {
                  const on = chosen.has(t.id);
                  return (
                    <li key={t.id}>
                      <button type="button" className={`chip${on ? ' chip--on' : ''}${t.serviceOpen ? '' : ' chip--closed'}`} aria-pressed={on} onClick={() => toggleTown(t)}>
                        {on ? <CheckCircle size={16} weight="fill" /> : t.id === area.homeTownId ? <House size={16} /> : null}
                        <span>{t.name}</span>
                        {!t.serviceOpen && <small>not open yet</small>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {!picks.length && (
                <p className="field__hint area-hint">
                  {home
                    ? <>No towns chosen: {you} deliver{admin ? 's' : ''} in the whole home town, <strong>{home.name}</strong>.</>
                    : <>Choose at least one town{admin ? '' : ', or set your home town in your application first'}.</>}
                </p>
              )}
            </div>
          </section>

          {picks.map((p) => (
            byId[p.townId] || current.areas.some((a) => a.townId === p.townId) ? (
              <TownCard key={p.townId} town={byId[p.townId] || { id: p.townId, name: townName(p.townId), serviceOpen: true }} pick={p}
                home={p.townId === area.homeTownId && !admin} limits={limits}
                errors={fieldErrors.byTown[p.townId] || []}
                onChange={setPick} onRemove={() => change(picks.filter((x) => x.townId !== p.townId))} />
            ) : null
          ))}

          <div className="only-phone area-status">{status}</div>
        </div>

        <aside className="page-grid__aside stack">
          <section className="card area-sum">
            <span className="area-sum__label">{admin ? 'Their area' : 'Your area'}</span>
            <strong className="area-sum__text">{summary || 'Nothing chosen yet'}</strong>
            {tooMany && <p className="field__error">That&apos;s {rows.length} places; choose up to {limits.places}.</p>}
            {empty.length > 0 && <p className="field__hint">Tick barangays in {empty.map((p) => townName(p.townId)).join(', ')}, or choose Whole town.</p>}
            {current.summary && current.summary !== summary && <p className="field__hint">Saved now: {current.summary}</p>}
            <div className="only-desk area-sum__status">{status}</div>
            {saveBtn('btn--block only-desk')}
          </section>
        </aside>
      </div>

      <div className="sticky-action only-phone area-bar">
        <span className="area-bar__text"><small>{admin ? 'Their area' : 'Your area'}</small><b>{summary || 'Nothing chosen yet'}</b></span>
        {saveBtn()}
      </div>
    </div>
  );
}
