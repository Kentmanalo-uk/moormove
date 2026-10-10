import { Link } from 'react-router-dom';
import { CheckCircle, X } from '@phosphor-icons/react';
import { Brand } from './ui';
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
 * Log in and sign up, in E-MOORM's sign-in look.
 * Desktop: a white bar with the logo, the green field with MoorMove's line on
 * the left, the white form card on the right. Phones: the form is a white
 * sheet (grip, close, the other choice at the top right).
 * `other` is the switch at the top: { to, label }.
 */
export default function AuthLayout({ other, children }) {
  const riders = useInfo()?.publicBooking !== true;
  return (
    <div className="auth">
      <header className="auth__bar">
        <Link to="/welcome" aria-label="MoorMove home"><Brand /></Link>
        {other && <Link to={other.to} className="auth__bar-link">{other.label}</Link>}
      </header>
      <div className="auth__stage">
        <aside className="auth__pitch">
          <span className="auth__mark"><span className="auth__logo"><img src="/icon.svg" alt="" /></span>MoorMove</span>
          {riders
            ? <h2>Deliver for shops <span>in your own town,</span> <span>on your own hours</span></h2>
            : <h2>Local deliveries <span>by riders from</span> <span>your own town</span></h2>}
          <ul>
            {(riders ? RIDER_POINTS : POINTS).map((p) => <li key={p}><CheckCircle size={20} weight="fill" /> {p}</li>)}
          </ul>
        </aside>
        <main className="auth__main">
          <div className="auth__sheet">
            <span className="auth__grip" aria-hidden="true" />
            <div className="auth__sheet-top">
              <Link to="/welcome" className="auth__close" aria-label="Close"><X size={22} /></Link>
              {other && <Link to={other.to} className="auth__sheet-link">{other.label}</Link>}
            </div>
            {children}
          </div>
          <Link to="/info/help" className="auth__help">Need Help?</Link>
        </main>
      </div>
    </div>
  );
}

/** "By … you agree to MoorMove's Terms & Privacy Policy" under the form. */
export function AuthTerms({ doing = 'logging in' }) {
  return (
    <p className="auth__terms">
      By {doing}, you agree to MoorMove&apos;s <Link to="/info/terms">Terms</Link> &amp; <Link to="/info/privacy">Privacy Policy</Link>
    </p>
  );
}
