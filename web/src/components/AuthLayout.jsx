import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import { Brand } from './ui';
import { HeroArt } from './art';
import { useInfo } from '../lib/hooks';

const POINTS = [
  'Riders from your own town, checked by MoorMove',
  'Follow every delivery live on the map',
  'Photo proof at pickup and drop-off',
];

// While MoorMove carries E-MOORM orders only, it speaks to riders.
const RIDER_POINTS = [
  'Deliver E-MOORM orders in your own town',
  'Go online whenever you want',
  'See what you earn before you accept',
];

/**
 * Sign in and sign up. Desktop: a green panel with the picture on the left,
 * the form on the right. Phones: the green panel becomes a short header and
 * the form card slides over it.
 */
export default function AuthLayout({ vehicle = 'MOTORCYCLE', children }) {
  const riders = useInfo()?.publicBooking !== true;
  return (
    <div className="auth">
      <aside className="auth__panel">
        <div className="auth__panel-top">
          <Link to="/welcome" className="auth__back" aria-label="Back"><ArrowLeft size={20} /></Link>
          <Link to="/welcome"><Brand white /></Link>
        </div>
        <div className="auth__art"><HeroArt vehicle={vehicle} /></div>
        <div className="auth__pitch">
          <h2>{riders ? 'Ride with MoorMove' : 'Deliveries by riders from your own town'}</h2>
          <ul>
            {(riders ? RIDER_POINTS : POINTS).map((p) => <li key={p}><CheckCircle size={20} weight="fill" /> {p}</li>)}
          </ul>
        </div>
      </aside>
      <main className="auth__main">
        <div className="auth__card">{children}</div>
        <nav className="auth__foot" aria-label="More">
          <Link to="/info/help">Help</Link>
          <Link to="/info/terms">Terms</Link>
          <Link to="/info/privacy">Privacy</Link>
        </nav>
      </main>
    </div>
  );
}
