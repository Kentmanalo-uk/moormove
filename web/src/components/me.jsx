import { Link } from 'react-router-dom';
import { CaretRight, PencilSimple } from '@phosphor-icons/react';
import { Avatar } from './ui';

/**
 * The pieces of E-MOORM's "Me" pages (its buyer Profile and Seller Center
 * Me): the person at the top, a strip of numbers, a grid of coloured tools and
 * lists of plain rows.
 */

/** Avatar, name, one line, and "Edit profile". */
export function MeHeader({ name, line, edit, children }) {
  return (
    <section className="me-head">
      <Avatar name={name} size="xl" />
      <div className="me-head__text">
        <h2>{name}</h2>
        {line && <span className="me-head__line">{line}</span>}
        {children}
        {edit && <Link to={edit} className="me-head__edit"><PencilSimple size={18} /> Edit profile</Link>}
      </div>
    </section>
  );
}

/** Numbers side by side: [{ label, value, to?, tone? }]. */
export function NumberStrip({ items }) {
  const list = items.filter(Boolean);
  return (
    <div className="num-strip" style={{ '--n': list.length }}>
      {list.map(({ label, value, to, tone }) => {
        const body = <><strong className={tone ? `tone-${tone}` : ''}>{value}</strong><span>{label}</span></>;
        return to
          ? <Link key={label} to={to} className="num-strip__item">{body}</Link>
          : <div key={label} className="num-strip__item">{body}</div>;
      })}
    </div>
  );
}

/**
 * E-MOORM's tool grid: filled coloured icons with no tile, a pink count.
 * tools: [{ to, label, icon, color, count? }].
 */
export function ToolGrid({ title, more, tools }) {
  return (
    <section className="section tool-grid">
      {title && (
        <div className="section__head">
          <h2>{title}</h2>
          {more && <Link to={more.to} className="see-all">{more.label} <CaretRight size={14} /></Link>}
        </div>
      )}
      <div className="tool-grid__list">
        {tools.filter(Boolean).map(({ to, label, icon: Icon, color, count }) => (
          <Link key={to + label} to={to} className="tool-grid__item">
            <span className="tool-grid__icon" style={{ color }}>
              <Icon size={32} weight="fill" />
              {count > 0 && <b className="badge badge--pink">{count > 99 ? '99+' : count}</b>}
            </span>
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * A titled list of rows with plain ink icons.
 * rows: [{ to | onClick, label, icon, sub?, end?, danger? }].
 */
export function RowList({ title, rows }) {
  return (
    <section className="section row-list">
      {title && <div className="section__head"><h2>{title}</h2></div>}
      <ul className="rows">
        {rows.filter(Boolean).map(({ to, onClick, label, icon: Icon, sub, end, danger }) => {
          const inner = (
            <>
              <span className="row__icon row__icon--ink"><Icon size={22} weight="fill" /></span>
              <span className="row__text">{label}{sub && <small>{sub}</small>}</span>
              <span className="row__end">{end}{!danger && <CaretRight size={18} />}</span>
            </>
          );
          const cls = `row${danger ? ' row--danger' : ''}`;
          return (
            <li key={label}>
              {to ? <Link className={cls} to={to}>{inner}</Link> : <button type="button" className={cls} onClick={onClick}>{inner}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
