import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bicycle, Camera, CaretLeft, CheckCircle, DotsThree, Image as ImageIcon, Moped, Star,
} from '@phosphor-icons/react';
import { useShell } from './shellContext';
import { useAuth } from '../auth';
import api from '../api';
import { initials, JOB_STATUS, RIDER_STATUS } from '../lib/format';
import { EmptyArt } from './art';

export function Brand({ large = false, white = false }) {
  return (
    <span className={`brand${large ? ' brand--lg' : ''}${white ? ' brand--white' : ''}`}>
      <img src="/icon.svg" alt="" />
      <span>Moor<b>Move</b></span>
    </span>
  );
}

/**
 * A tricycle (a motorcycle with a covered sidecar), drawn here: the icon set
 * has none. Takes `size` like the Phosphor icons around it.
 */
export function TricycleIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9h12v12H3z" fill="currentColor" fillOpacity="0.2" />
      <path d="M3 13h12" />
      <circle cx="7" cy="24" r="3" />
      <circle cx="25" cy="24" r="3" />
      <path d="M15 21h5l3-6h3" />
      <path d="M21 11h3l2 4" />
      <path d="M10 24h12" />
    </svg>
  );
}

const VEHICLE_ICONS = { TRICYCLE: TricycleIcon, MOTORCYCLE: Moped, BICYCLE: Bicycle };
export function VehicleIcon({ type, size = 24, ...rest }) {
  const Icon = VEHICLE_ICONS[type] || Moped;
  return <Icon size={size} weight="duotone" {...rest} />;
}

/**
 * Phones: the ⋯ at the right end of a page's top bar. It lists this page's own
 * actions (`extra`: { label, icon, to | onClick }) and then every place of the
 * signed-in area, so nothing is out of reach on a phone. Desktop: hidden
 * (the sidebar has the places).
 */
export function PageMenu({ extra = [], className = '' }) {
  const area = useShell();
  const { user } = useAuth() || {};
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);
  const outside = user
    ? [['/', 'Back to MoorMove', null], ['/info/help', 'Help center', null]]
    : [['/welcome', 'MoorMove home', null], ['/info/help', 'Help center', null], ['/login', 'Log in', null]];
  const places = (area ? area.groups.flatMap(([, list]) => list) : outside).filter(([to]) => to !== pathname);
  const items = [...extra.filter(Boolean), ...places.map(([to, label, icon]) => ({ to, label, icon }))];
  if (!items.length) return null;
  return (
    <div className={`page-menu ${className}`.trim()} ref={box}>
      <button type="button" className="bar-icon page-menu__btn" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <DotsThree size={26} weight="bold" />
      </button>
      {open && (
        <div className="page-menu__list" role="menu">
          {items.map(({ to, label, icon: Icon, onClick }) => {
            const inner = <>{Icon ? <Icon size={20} /> : <span className="page-menu__gap" />}<span>{label}</span></>;
            return to
              ? <Link key={label} to={to} role="menuitem" onClick={() => setOpen(false)}>{inner}</Link>
              : <button key={label} type="button" role="menuitem" onClick={() => { setOpen(false); onClick(); }}>{inner}</button>;
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Tab pages. Desktop: E-MOORM's page header (title, a line under it, the
 * main action on the right). Phones: a white top bar with the title, plain
 * icon buttons and ⋯. `brand` shows MoorMove's logo and that line instead
 * of the title on phones (home tabs, like E-MOORM's admin and seller homes).
 */
export function PageHead({ title, sub, brand, children, menu = [] }) {
  return (
    <header className={`page-head${brand ? ' page-head--brand' : ''}`}>
      {brand && (
        <span className="page-head__brand">
          <img src="/icon.svg" alt="" />
          <span><strong>MoorMove</strong><small>{brand}</small></span>
        </span>
      )}
      <div className="page-head__title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="page-head__actions">
        {children}
        <PageMenu extra={menu} />
      </div>
    </header>
  );
}

/** Other pages: back, title and ⋯ (phones); back button and title (desktop). */
export function BackBar({ title, to, children, menu = [] }) {
  const navigate = useNavigate();
  const back = () => {
    if (to) navigate(to);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <div className="back-bar">
      <button type="button" className="bar-icon back-bar__back" onClick={back} aria-label="Back"><CaretLeft size={24} weight="bold" className="only-phone" /><ArrowLeft size={20} className="only-desk" /></button>
      <h1>{title}</h1>
      <div className="back-bar__end">
        {children}
        <PageMenu extra={menu} />
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

export function Loading() {
  return (
    <div className="skeletons" role="status" aria-label="Loading">
      <span className="skeleton skeleton--lg" />
      <span className="skeleton" />
      <span className="skeleton" />
    </div>
  );
}

/**
 * "Nothing here yet": E-MOORM's glass picture, a title, one line and an
 * optional action. `compact` for inside a card; otherwise it is its own card.
 */
export function Empty({ art = 'parcels', title, children, action, compact = false }) {
  return (
    <div className={`empty${compact ? ' empty--compact' : ''}`}>
      <EmptyArt name={art} size={compact ? 76 : 104} />
      {title && <strong className="empty__title">{title}</strong>}
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 'md', ring = false }) {
  return <span className={`avatar avatar--${size}${ring ? ' avatar--ring' : ''}`} aria-hidden="true">{initials(name)}</span>;
}

/** A plate number, drawn like a plate. */
export function Plate({ children }) {
  if (!children) return null;
  return <span className="plate">{children}</span>;
}

/** Numbers side by side in one card, split by thin lines. */
export function StatStrip({ items }) {
  return (
    <div className="stat-strip">
      {items.filter(Boolean).map(({ label, value, sub, to, tone }) => {
        const body = <><span>{label}</span><strong className={tone ? `tone-${tone}` : ''}>{value}</strong>{sub && <small>{sub}</small>}</>;
        return to ? <Link key={label} to={to} className="stat-strip__item">{body}</Link> : <div key={label} className="stat-strip__item">{body}</div>;
      })}
    </div>
  );
}

/**
 * Grab-style map screen. Phones: the map fills the top, with round buttons
 * floating on it, and the page slides over it as a sheet. Desktop: the page
 * on the left, the map filling the right.
 */
export function MapPage({ map, title, back, actions, lead, overlay, compactMap = false, tab = false, children }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <div className={`map-page${compactMap ? ' map-page--compact' : ''}${tab ? ' map-page--tab' : ''}`}>
      {/* Phones: these stay at the top of the screen while the page slides over the map. */}
      <div className="map-page__float">
        {back !== false && <button type="button" className="float-btn" onClick={goBack} aria-label="Back"><ArrowLeft size={20} weight="bold" /></button>}
        {lead && <span className="map-page__float-actions">{lead}</span>}
        <span className="map-page__spacer" />
        {actions && <span className="map-page__float-actions">{actions}</span>}
        <PageMenu className="page-menu--float" />
      </div>
      <div className="map-page__map">
        {map}
        <span className="map-page__shade" aria-hidden="true" />
        {overlay}
      </div>
      <div className="map-page__panel">
        <span className="map-page__grip" aria-hidden="true" />
        {(title || back !== false) && (
          <div className="map-page__head">
            {back !== false && <button type="button" className="round-btn round-btn--soft" onClick={goBack} aria-label="Back"><ArrowLeft size={20} /></button>}
            {title && <h1>{title}</h1>}
            {actions && <div className="map-page__actions">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function JobPill({ status }) {
  const s = JOB_STATUS[status] || { label: status, tone: 'grey' };
  return <span className={`pill pill--${s.tone}`}>{s.label}</span>;
}

export function RiderPill({ status }) {
  const s = RIDER_STATUS[status] || { label: status, tone: 'grey' };
  return <span className={`pill pill--${s.tone}`}>{s.label}</span>;
}

export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="stars" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} weight={n <= Math.round(value) ? 'fill' : 'regular'} />)}
    </span>
  );
}

/** A bottom sheet (a centred dialog on desktop). */
export function Sheet({ open, onClose, children, label }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        {children}
      </div>
    </div>
  );
}

/** A private photo (it needs the signed-in person's token), shown from a blob. */
export function AuthImage({ id, alt, className }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    let url;
    let live = true;
    api.get(`/uploads/${id}`, { responseType: 'blob' })
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!id) return null;
  return src
    ? <img src={src} alt={alt} className={className} />
    : <div className={`${className || ''} photo-placeholder`} aria-label={alt}><ImageIcon size={26} /></div>;
}

/** Photos that open full screen when tapped. */
export function PhotoGrid({ photos }) {
  const [zoom, setZoom] = useState(null);
  const shown = photos.filter((p) => p.id);
  if (!shown.length) return null;
  return (
    <>
      <div className="thumbs">
        {shown.map((p) => (
          <button key={p.id} type="button" className="thumb" onClick={() => setZoom(p)}>
            <AuthImage id={p.id} alt={p.label} className="thumb__img" />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      {zoom && (
        <div className="zoom" role="dialog" aria-label={zoom.label} onClick={() => setZoom(null)}>
          <AuthImage id={zoom.id} alt={zoom.label} className="zoom__img" />
          <span>{zoom.label} · tap to close</span>
        </div>
      )}
    </>
  );
}

/** Upload one photo; returns its id. */
export const uploadPhoto = async (file) => {
  const form = new FormData();
  form.append('photo', file);
  const { id } = await api.post('/uploads', form);
  return id;
};

/**
 * Take or choose a photo; it is uploaded straight away and `onChange` gets
 * its id.
 */
export function PhotoField({ label, hint, value, onChange, error, capture }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setUploadError('');
    try {
      onChange(await uploadPhoto(file));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`photo-field${error || uploadError ? ' photo-field--error' : ''}`}>
      <button type="button" className="photo-field__box" onClick={() => input.current?.click()} disabled={busy} aria-label={label}>
        {busy ? <div className="spinner" /> : value ? <AuthImage id={value} alt={label} className="photo-field__img" /> : <Camera size={28} weight="duotone" />}
      </button>
      <div className="photo-field__text">
        <strong className="strong">{label} {value && <CheckCircle size={16} weight="fill" className="tone-green" style={{ verticalAlign: -2 }} />}</strong>
        {hint && <span>{hint}</span>}
        <button type="button" className="link-btn" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : value ? 'Retake photo' : 'Take photo'}
        </button>
        {(uploadError || error) && <p className="field__error">{uploadError || error}</p>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture={capture} hidden onChange={pick} />
    </div>
  );
}

/* ── Toasts ───────────────────────────────────────────────────────────── */
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && <div className="toast" role="status">{message}</div>}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
