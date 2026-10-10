import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Loading } from './components/ui';
import { AdminShell, AppShell } from './components/shells';
import Welcome from './pages/public/Welcome';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import Info from './pages/public/Info';
import Notifications from './pages/shared/Notifications';
import Profile from './pages/shared/Profile';
import EditProfile from './pages/shared/EditProfile';
import ChangePassword from './pages/shared/ChangePassword';
import CustomerHome from './pages/customer/CustomerHome';
import Book from './pages/customer/Book';
import Deliveries from './pages/customer/Deliveries';
import DeliveryDetail from './pages/customer/DeliveryDetail';
import RiderHome from './pages/rider/RiderHome';
import RiderJob from './pages/rider/RiderJob';
import RiderHistory from './pages/rider/RiderHistory';
import Earnings from './pages/rider/Earnings';
import Apply from './pages/rider/Apply';
import AdminHome from './pages/admin/AdminHome';
import AdminDeliveries from './pages/admin/AdminDeliveries';
import AdminDelivery from './pages/admin/AdminDelivery';
import AdminNewDelivery from './pages/admin/AdminNewDelivery';
import AdminRiders from './pages/admin/AdminRiders';
import AdminRider from './pages/admin/AdminRider';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminCustomer from './pages/admin/AdminCustomer';
import AdminCash from './pages/admin/AdminCash';
import AdminSettings from './pages/admin/AdminSettings';
import AdminTowns from './pages/admin/AdminTowns';
import AdminMe from './pages/admin/AdminMe';

const HOME = { ADMIN: '/admin', RIDER: '/rider', CUSTOMER: '/home' };

/** Signed in with one of `roles`, or sent to the right place. */
function Only({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/welcome" replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

function SignedOut({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return user ? <Navigate to={HOME[user.role]} replace /> : children;
}

function Start() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return <Navigate to={user ? HOME[user.role] : '/welcome'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/welcome" element={<SignedOut><Welcome /></SignedOut>} />
      <Route path="/login" element={<SignedOut><Login /></SignedOut>} />
      <Route path="/register" element={<SignedOut><Register /></SignedOut>} />
      <Route path="/info/:page" element={<Info />} />

      <Route element={<Only roles={['CUSTOMER', 'RIDER']}><AppShell /></Only>}>
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/profile/password" element={<ChangePassword />} />
      </Route>

      <Route element={<Only roles={['CUSTOMER']}><AppShell /></Only>}>
        <Route path="/home" element={<CustomerHome />} />
        <Route path="/book" element={<Book />} />
        <Route path="/deliveries" element={<Deliveries />} />
        <Route path="/deliveries/:id" element={<DeliveryDetail />} />
      </Route>

      <Route element={<Only roles={['RIDER']}><AppShell /></Only>}>
        <Route path="/rider" element={<RiderHome />} />
        <Route path="/rider/history" element={<RiderHistory />} />
        <Route path="/rider/earnings" element={<Earnings />} />
        <Route path="/rider/jobs/:id" element={<RiderJob />} />
        <Route path="/rider/apply" element={<Apply />} />
      </Route>

      <Route path="/admin" element={<Only roles={['ADMIN']}><AdminShell /></Only>}>
        <Route index element={<AdminHome />} />
        <Route path="deliveries" element={<AdminDeliveries />} />
        <Route path="deliveries/new" element={<AdminNewDelivery />} />
        <Route path="deliveries/:id" element={<AdminDelivery />} />
        <Route path="riders" element={<AdminRiders />} />
        <Route path="riders/:id" element={<AdminRider />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="customers/:id" element={<AdminCustomer />} />
        <Route path="cash" element={<AdminCash />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="towns" element={<AdminTowns />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="me" element={<AdminMe />} />
        <Route path="profile/edit" element={<EditProfile />} />
        <Route path="profile/password" element={<ChangePassword />} />
      </Route>

      <Route path="*" element={<Start />} />
    </Routes>
  );
}
