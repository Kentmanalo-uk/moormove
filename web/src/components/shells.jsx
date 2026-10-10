import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AddressBook, Bell, CaretRight, ClockCounterClockwise, GearSix, Gift, House, MapPinArea, MapTrifold, Moped, Package, Plus,
  Question, SignOut, SquaresFour, User, UserCircle, UsersThree, Wallet,
} from '@phosphor-icons/react';
import { useAuth } from '../auth';
import { useInfo, useLive } from '../lib/hooks';
import { Avatar } from './ui';
import { ShellContext } from './shellContext';

/*
 * MoorMove's frames, built like E-MOORM's:
 * - Desktop: the Seller Center / admin panel shell. A white sidebar (logo,
 *   grouped links, the signed-in person at the bottom), a white top bar
 *   (where you are, quick actions) and the page on grey.
 * - Phones: E-MOORM's app. Each page draws its own white top bar
 *   (PageHead / BackBar); the tab pages get the bottom tab bar.
 *
 * Every place is listed once here, as groups of [path, label, icon, options].
 * A new place (say a rider's "Delivery area", or the admin's "Free
 * delivery") is one more line in a group: the sidebar, the phone ⋯ menu and
 * the crumbs pick it up.
 */

const ADMIN = {
  role: 'Admin',
  home: '/admin',
  me: '/admin/me',
  groups: [
    ['Operations', [
      ['/admin', 'Overview', SquaresFour, { exact: true }],
      ['/admin/deliveries', 'Deliveries', Package],
      ['/admin/riders', 'Riders', Moped, { count: 'pending' }],
      ['/admin/customers', 'Customers', AddressBook],
      ['/admin/cash', 'Cash from riders', Wallet],
    ]],
    ['Setup', [
      ['/admin/towns', 'Towns', MapTrifold],
      ['/admin/coverage', 'Rider coverage', UsersThree],
      ['/admin/promos', 'Free delivery', Gift],
      ['/admin/settings', 'Fares & settings', GearSix],
    ]],
    ['Account', [
      ['/admin/notifications', 'Notifications', Bell, { count: 'unread' }],
      ['/admin/me', 'Me', UserCircle],
    ]],
  ],
  tabs: [
    ['/admin', 'Home', House],
    ['/admin/deliveries', 'Deliveries', Package],
    ['/admin/riders', 'Riders', Moped],
    ['/admin/notifications', 'Notifications', Bell, { count: 'unread' }],
    ['/admin/me', 'Me', User],
  ],
  // Pages under these belong to that tab for the crumbs (new delivery, a rider…).
  quick: [['/admin/deliveries/new', 'New delivery', Plus]],
};

const RIDER = {
  role: 'Rider',
  home: '/rider',
  me: '/profile',
  groups: [
    ['Work', [
      ['/rider', 'Home', House, { exact: true }],
      ['/rider/history', 'History', ClockCounterClockwise],
      ['/rider/earnings', 'Earnings', Wallet],
      ['/rider/area', 'Delivery area', MapPinArea],
    ]],
    ['Account', [
      ['/notifications', 'Notifications', Bell, { count: 'unread' }],
      ['/profile', 'Me', UserCircle],
    ]],
    ['Help', [
      ['/info/help', 'Help center', Question],
    ]],
  ],
  tabs: [
    ['/rider', 'Home', House],
    ['/rider/history', 'History', ClockCounterClockwise],
    ['/rider/earnings', 'Earnings', Wallet],
    ['/notifications', 'Notifications', Bell, { count: 'unread' }],
    ['/profile', 'Me', User],
  ],
  quick: [],
};

const CUSTOMER = {
  role: 'Customer',
  home: '/home',
  me: '/profile',
  groups: [
    ['Deliveries', [
      ['/home', 'Home', House, { exact: true }],
      ['/deliveries', 'My deliveries', Package],
    ]],
    ['Account', [
      ['/notifications', 'Notifications', Bell, { count: 'unread' }],
      ['/profile', 'Me', UserCircle],
    ]],
    ['Help', [
      ['/info/help', 'Help center', Question],
    ]],
  ],
  tabs: [
    ['/home', 'Home', House],
    ['/deliveries', 'Deliveries', Package],
    ['/notifications', 'Notifications', Bell, { count: 'unread' }],
    ['/profile', 'Me', User],
  ],
  quick: [],
};


const onPath = (pathname, to, exact) => (exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

/** The link a path belongs to: the longest match. */
const current = (pathname, items) => items
  .filter(([to, , , o = {}]) => onPath(pathname, to, o.exact))
  .sort((a, b) => b[0].length - a[0].length)[0];

function useCounts(area) {
  const { unread } = useAuth();
  return { unread, pending: area.pending || 0 };
}

/** E-MOORM's bottom tab bar (phones, tab pages only). */
function BottomNav({ tabs, counts }) {
  const { pathname } = useLocation();
  const on = current(pathname, tabs.map(([to, ...rest]) => [to, ...rest.slice(0, 2), { exact: to === tabs[0][0] }]));
  return (
    <nav className="tabbar" style={{ '--tabs': tabs.length }} aria-label="Main">
      {tabs.map(([to, label, Icon, o = {}]) => {
        const active = on?.[0] === to;
        const n = o.count ? counts[o.count] : 0;
        return (
          <NavLink key={to} to={to} end className={active ? 'is-on' : ''} aria-current={active ? 'page' : undefined}>
            <span className="tabbar__icon">
              <Icon size={26} weight={active ? 'fill' : 'regular'} />
              {n > 0 && <b className="badge">{n > 99 ? '99+' : n}</b>}
            </span>
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/** The Seller-Center-style frame, for riders, customers and admins. */
function CenterShell({ area }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const counts = useCounts(area);
  const items = area.groups.flatMap(([, list]) => list);
  const here = current(pathname, [...items, ...area.quick]);
  const onTab = area.tabs.some(([to]) => to === pathname);
  const first = user.fullName.split(' ')[0];

  return (
    <ShellContext.Provider value={area}>
      <div className={`cx${onTab ? ' cx--tabs' : ''}`}>
        <aside className="cx-side" aria-label="MoorMove">
          <Link to={area.home} className="cx-brand">
            <img src="/icon.svg" alt="" />
            <span><strong>MoorMove</strong><small>{area.role === 'Admin' ? 'Admin Center' : `${area.role} Center`}</small></span>
          </Link>
          <nav className="cx-nav">
            {area.groups.map(([group, list]) => (
              <div key={group} className="cx-nav__group">
                <span className="cx-nav__label">{group}</span>
                {list.map(([to, label, Icon, o = {}]) => {
                  const active = here?.[0] === to;
                  const n = o.count ? counts[o.count] : 0;
                  return (
                    <NavLink key={to} to={to} end={o.exact} title={label} className={`cx-nav__item${active ? ' is-on' : ''}`}>
                      <Icon size={20} weight="fill" />
                      <span>{label}</span>
                      {n > 0 && <b className="cx-nav__count">{n > 99 ? '99+' : n}</b>}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
          <Link to={area.me} className="cx-user" title={user.fullName}>
            <Avatar name={user.fullName} size="sm" />
            <span className="cx-user__text"><strong>{user.fullName}</strong><small>{area.role === 'Admin' ? 'MoorMove admin' : `${area.role} account`}</small></span>
            <CaretRight size={16} className="cx-user__caret" />
          </Link>
        </aside>

        <div className="cx-main">
          <header className="cx-top">
            <nav className="cx-crumbs" aria-label="You are here">
              <Link to={area.home}>MoorMove</Link>
              {here && here[0] !== area.home && <><CaretRight size={12} /><Link to={here[0]} className="is-on">{here[1]}</Link></>}
              {(!here || here[0] === area.home) && <><CaretRight size={12} /><span className="is-on">{area.role === 'Admin' ? 'Overview' : `Hi, ${first}`}</span></>}
            </nav>
            <div className="cx-top__actions">
              {area.quick.map(([to, label, Icon]) => (
                <Link key={to} to={to} className="cx-quick"><Icon size={16} weight="bold" /> {label}</Link>
              ))}
              {area.quick.length > 0 && <span className="cx-top__rule" aria-hidden="true" />}
              <Link to="/info/help" className="cx-icon" aria-label="Help" title="Help"><Question size={19} /></Link>
              <Link to={area.groups.flatMap(([, l]) => l).find(([to]) => to.endsWith('notifications'))[0]} className="cx-icon" aria-label="Notifications" title="Notifications">
                <Bell size={19} />
                {counts.unread > 0 && <b className="cx-icon__badge">{counts.unread > 99 ? '99+' : counts.unread}</b>}
              </Link>
              <button type="button" className="cx-icon" onClick={signOut} aria-label="Log out" title="Log out"><SignOut size={19} /></button>
            </div>
          </header>
          <main className="cx-content">
            <div key={pathname} className="page-enter"><Outlet /></div>
          </main>
        </div>
        {onTab && <BottomNav tabs={area.tabs} counts={counts} />}
      </div>
    </ShellContext.Provider>
  );
}

/** Riders and customers. */
export function AppShell() {
  const { user } = useAuth();
  const canBook = useInfo()?.publicBooking === true;
  if (user.role === 'RIDER') return <CenterShell area={RIDER} />;
  const area = canBook
    ? { ...CUSTOMER, quick: [['/book', 'Book a delivery', Plus]] }
    : CUSTOMER;
  return <CenterShell area={area} />;
}

/** MoorMove's admin. */
export function AdminShell() {
  // Applications waiting, for the count next to Riders.
  const { data } = useLive('/admin/summary', { every: 30000 });
  return <CenterShell area={{ ...ADMIN, pending: data?.counts?.PENDING || 0 }} />;
}
