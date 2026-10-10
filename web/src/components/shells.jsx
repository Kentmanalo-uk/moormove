import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell, ChartBar, House, Moped, Package, Plus, Receipt, SignOut, User, Wallet,
  GearSix, MapTrifold, AddressBook, UserCircle, Question,
} from '@phosphor-icons/react';
import { useAuth } from '../auth';
import { useInfo } from '../lib/hooks';
import { Avatar, Brand } from './ui';

const CUSTOMER_TABS = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/deliveries', label: 'Deliveries', icon: Package },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/profile', label: 'Profile', icon: User, me: true },
];

const RIDER_TABS = [
  { to: '/rider', label: 'Home', icon: House },
  { to: '/rider/history', label: 'History', icon: Receipt },
  { to: '/rider/earnings', label: 'Earnings', icon: Wallet },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/profile', label: 'Profile', icon: User, me: true },
];

const ADMIN_TABS = [
  { to: '/admin', label: 'Home', icon: ChartBar },
  { to: '/admin/deliveries', label: 'Deliveries', icon: Package },
  { to: '/admin/riders', label: 'Riders', icon: Moped },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/admin/me', label: 'Me', icon: UserCircle },
];

const isOn = (pathname, to) => pathname === to || (to !== '/rider' && to !== '/admin' && pathname.startsWith(`${to}/`));

/** E-MOORM's bottom navigation (phones). */
function BottomNav({ tabs }) {
  const { pathname } = useLocation();
  const { unread } = useAuth();
  return (
    <nav className="bottom-nav" style={{ '--tabs': tabs.length }} aria-label="Main">
      {tabs.map(({ to, label, icon: Icon, badge }) => {
        const on = isOn(pathname, to);
        return (
          <NavLink key={to} to={to} end className={on ? 'is-on' : ''}>
            <span className="bottom-nav__icon">
              <Icon size={24} weight={on ? 'fill' : 'regular'} />
              {badge && unread > 0 && <b className="badge">{unread > 99 ? '99+' : unread}</b>}
            </span>
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Customers and riders. Phones: E-MOORM's bottom navigation on the tab
 * pages. Desktop: a white top bar with the same places, a main action, and
 * the person's avatar for their profile.
 */
export function AppShell() {
  const { user, unread } = useAuth();
  const { pathname } = useLocation();
  const rider = user.role === 'RIDER';
  const canBook = useInfo()?.publicBooking === true;
  const tabs = rider ? RIDER_TABS : CUSTOMER_TABS;
  const onTab = tabs.some((t) => t.to === pathname);
  return (
    <div className={`app${onTab ? '' : ' app--plain'}`}>
      <header className="top-nav">
        <div className="top-nav__inner">
          <Link to="/" aria-label="MoorMove home"><Brand /></Link>
          <nav className="top-nav__links" aria-label="Main">
            {tabs.filter((t) => !t.me).map(({ to, label, icon: Icon, badge }) => {
              const on = isOn(pathname, to);
              return (
                <NavLink key={to} to={to} end className={on ? 'is-on' : ''}>
                  <Icon size={20} weight={on ? 'fill' : 'regular'} /> {label}
                  {badge && unread > 0 && <b className="badge">{unread > 99 ? '99+' : unread}</b>}
                </NavLink>
              );
            })}
          </nav>
          <div className="top-nav__end">
            <Link to="/info/help" className="round-btn round-btn--soft" aria-label="Help" title="Help"><Question size={20} /></Link>
            {!rider && canBook && <Link to="/book" className="btn btn--primary btn--sm"><Plus size={18} weight="bold" /> Book a delivery</Link>}
            <Link to="/profile" className={`top-nav__me${isOn(pathname, '/profile') ? ' is-on' : ''}`} title="Profile">
              <Avatar name={user.fullName} size="sm" />
              <span>{user.fullName.split(' ')[0]}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="app__main">
        <div key={pathname} className="page-enter"><Outlet /></div>
      </main>
      {onTab && <BottomNav tabs={tabs} />}
    </div>
  );
}

/** MoorMove's admin: a side menu on wide screens, bottom tabs on phones. */
export function AdminShell() {
  const { user, signOut, unread } = useAuth();
  const { pathname } = useLocation();
  const on = (to, exact) => (exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  const link = (to, label, Icon, { exact = false, badge = 0 } = {}) => (
    <NavLink to={to} end={exact} className={on(to, exact) ? 'is-on' : ''}>
      <Icon size={20} weight={on(to, exact) ? 'fill' : 'regular'} /> <span>{label}</span>
      {badge > 0 && <b className="badge">{badge}</b>}
    </NavLink>
  );
  const onTab = ADMIN_TABS.some((t) => t.to === pathname);
  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="admin__brand">
          <Brand />
          <span className="admin__role">Admin</span>
        </div>
        <span className="admin__group">Operations</span>
        {link('/admin', 'Overview', ChartBar, { exact: true })}
        {link('/admin/deliveries', 'Deliveries', Package)}
        {link('/admin/riders', 'Riders', Moped)}
        {link('/admin/customers', 'Customers', AddressBook)}
        {link('/admin/cash', 'Cash', Wallet)}
        <span className="admin__group">Setup</span>
        {link('/admin/towns', 'Towns', MapTrifold)}
        {link('/admin/settings', 'Fares & settings', GearSix)}
        {link('/admin/notifications', 'Notifications', Bell, { badge: unread })}
        <Link to="/admin/deliveries/new" className="btn btn--primary admin__new"><Plus size={18} weight="bold" /> New delivery</Link>
        <div className="admin__me">
          <Avatar name={user.fullName} size="sm" />
          <Link to="/admin/me" className="admin__me-text">
            <span>{user.fullName}</span>
            <small>{user.email}</small>
          </Link>
          <button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><SignOut size={20} /></button>
        </div>
      </aside>
      <main className="admin__main">
        <div key={pathname} className="page-enter"><Outlet /></div>
      </main>
      {onTab && <BottomNav tabs={ADMIN_TABS} />}
    </div>
  );
}
