import { Link } from 'react-router-dom';
import {
  AddressBook, Bell, CaretRight, ChartBar, GearSix, Key, MapTrifold, Moped, NotePencil, Package, Question, SignOut, Wallet,
} from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { Avatar, PageHead } from '../../components/ui';

const GROUPS = [
  ['Work', [
    ['/admin', 'Overview', ChartBar],
    ['/admin/deliveries', 'Deliveries', Package],
    ['/admin/deliveries/new', 'New delivery', Package],
    ['/admin/riders', 'Riders', Moped],
    ['/admin/customers', 'Customers', AddressBook],
    ['/admin/cash', 'Cash from riders', Wallet],
  ]],
  ['Setup', [
    ['/admin/towns', 'Towns', MapTrifold],
    ['/admin/settings', 'Fares & settings', GearSix],
  ]],
  ['Account', [
    ['/admin/notifications', 'Notifications', Bell],
    ['/admin/profile/edit', 'Edit profile', NotePencil],
    ['/admin/profile/password', 'Change password', Key],
    ['/info/help', 'Help center', Question],
  ]],
];

/** The admin's "Me" tab on phones: every admin section, in one place. */
export default function AdminMe() {
  const { user, signOut } = useAuth();
  return (
    <>
      <PageHead title="Me" />
      <section className="profile-hero">
        <div className="profile-hero__cover" aria-hidden="true" />
        <div className="profile-hero__body">
          <Avatar name={user.fullName} size="xl" ring />
          <div className="profile-hero__text">
            <h2>{user.fullName}</h2>
            <span className="muted small">{user.email}</span>
            <span className="profile-hero__pills"><span className="pill pill--green">MoorMove admin</span></span>
          </div>
        </div>
      </section>
      {GROUPS.map(([title, rows]) => (
        <section key={title} className="section">
          <div className="section__head"><h2>{title}</h2></div>
          <ul className="rows">
            {rows.map(([to, label, Icon]) => (
              <li key={to}>
                <Link className="row" to={to}>
                  <span className="row__icon row__icon--ink"><Icon size={22} /></span>
                  <span className="row__text">{label}</span>
                  <span className="row__end"><CaretRight size={18} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="section">
        <ul className="rows rows--first">
          <li><button type="button" className="row row--danger" onClick={signOut}><span className="row__icon"><SignOut size={22} /></span><span className="row__text">Log out</span></button></li>
        </ul>
      </section>
    </>
  );
}
