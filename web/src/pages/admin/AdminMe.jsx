import {
  AddressBook, Bell, ChartBar, GearSix, Gift, Key, MapTrifold, Moped, NotePencil, Package, Plus, Question, SignOut, UsersThree, Wallet,
} from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { PageHead } from '../../components/ui';
import { MeHeader, RowList, ToolGrid } from '../../components/me';
import { useLive } from '../../lib/hooks';

/*
 * The admin's "Me" tab on phones: every admin place, in one spot (E-MOORM's
 * admin Me). Each group is an array of rows: a new admin place (say "Free
 * delivery" promos) is one more row, most likely in Setup.
 */
const WORK = [
  { to: '/admin', label: 'Overview', icon: ChartBar },
  { to: '/admin/deliveries', label: 'Deliveries', icon: Package },
  { to: '/admin/riders', label: 'Riders', icon: Moped },
  { to: '/admin/customers', label: 'Customers', icon: AddressBook },
  { to: '/admin/cash', label: 'Cash from riders', icon: Wallet },
];

const SETUP = [
  { to: '/admin/towns', label: 'Towns', icon: MapTrifold, sub: 'Where MoorMove is open' },
  { to: '/admin/coverage', label: 'Rider coverage', icon: UsersThree, sub: 'Riders who deliver in each town' },
  { to: '/admin/promos', label: 'Free delivery', icon: Gift, sub: 'Promos where buyers pay no delivery fee' },
  { to: '/admin/settings', label: 'Fares & settings', icon: GearSix, sub: 'Fares, rules and support contacts' },
];

export default function AdminMe() {
  const { user, signOut, unread } = useAuth();
  const { data } = useLive('/admin/summary', { every: 30000 });
  return (
    <>
      <PageHead title="Me" />
      <div className="me-card">
        <MeHeader name={user.fullName} line={user.email} edit="/admin/profile/edit">
          <span className="me-head__pills"><span className="pill pill--green">MoorMove admin</span></span>
        </MeHeader>
      </div>
      <ToolGrid title="Quick tools" tools={[
        { to: '/admin/deliveries/new', label: 'New delivery', icon: Plus, color: '#059669' },
        { to: '/admin/riders?status=PENDING', label: 'Applications', icon: Moped, color: '#3b82f6', count: data?.counts?.PENDING },
        { to: '/admin/cash', label: 'Cash', icon: Wallet, color: '#f59e0b' },
        { to: '/admin/towns', label: 'Towns', icon: MapTrifold, color: '#8b5cf6' },
        { to: '/admin/promos', label: 'Free delivery', icon: Gift, color: '#ec4899' },
        { to: '/admin/coverage', label: 'Coverage', icon: UsersThree, color: '#14b8a6' },
      ]} />
      <div className="page-grid page-grid--even">
        <div>
          <RowList title="Work" rows={WORK} />
          <RowList title="Setup" rows={SETUP} />
        </div>
        <div>
          <RowList title="Account" rows={[
            { to: '/admin/notifications', label: 'Notifications', icon: Bell, end: unread > 0 ? <span className="pill pill--red">{unread}</span> : null },
            { to: '/admin/profile/edit', label: 'Edit profile', icon: NotePencil, sub: 'Name and mobile number' },
            { to: '/admin/profile/password', label: 'Change password', icon: Key },
            { to: '/info/help', label: 'Help center', icon: Question },
          ]} />
          <RowList rows={[{ label: 'Log out', icon: SignOut, onClick: signOut, danger: true }]} />
        </div>
      </div>
    </>
  );
}
