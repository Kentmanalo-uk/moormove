import { Link } from 'react-router-dom';
import {
  ArrowRight, Camera, CheckCircle, Clock, CurrencyCircleDollar, MapPin, MapPinLine, Money, Moped, NavigationArrow,
  Package, ShieldCheck, Storefront, UsersThree,
} from '@phosphor-icons/react';
import { useInfo } from '../../lib/hooks';
import { peso } from '../../lib/format';
import { Brand } from '../../components/ui';
import { EmptyArt, HeroArt, VehicleArt } from '../../components/art';

const STEPS = [
  ['places', 'Drop two pins', 'Where to pick up and where to deliver, anywhere in your town. You see the fare before you book.'],
  ['offers', 'A local rider accepts', 'Tricycle, motorcycle and bike riders near the pickup see it right away. The first to accept takes it.'],
  ['deliveries', 'Follow it live', 'Watch the rider on the map, call or text them, and get a photo the moment it arrives.'],
];

const RIDES = [
  ['BICYCLE', 'Bike / e-bike', 'Documents, food, medicine', 'Small packages'],
  ['MOTORCYCLE', 'Motorcycle', 'Groceries, shoes, small boxes', 'Small and medium'],
  ['TRICYCLE', 'Tricycle', 'Sacks of rice, furniture parts', 'Up to large'],
];

const WHY = [
  [UsersThree, '#059669', 'Riders from your town', 'Every rider is checked by MoorMove: ID, license and vehicle papers.'],
  [MapPinLine, '#3b82f6', 'Live tracking', 'See where your rider is from pickup to drop-off.'],
  [Camera, '#ec4899', 'Photo proof', 'A photo at pickup and at delivery, every time.'],
  [CurrencyCircleDollar, '#f59e0b', 'Clear, fair fares', 'The price is shown before you book. Pay cash; COD welcome.'],
];

const RIDER_PERKS = [
  'Go online whenever you want, no fixed hours',
  'Deliveries in your own town, nearest first',
  'See what you earn before you accept',
  'Paid in cash, right away, by the customer',
];

/* ── While MoorMove carries E-MOORM orders only: a page for riders ───── */

const RIDER_STEPS = [
  ['applications', 'Sign up and apply', 'Tell us your town and vehicle, and add photos of your ID and papers. MoorMove checks every rider.'],
  ['offers', 'Go online, accept a delivery', 'E-MOORM shops in your town call a rider when an order is packed. You see the pay before you accept.'],
  ['deliveries', 'Pick up and deliver', 'From the shop to the buyer, with a photo at pickup and at delivery. Cash on delivery goes back to the shop.'],
];

const CARRY = [
  ['BICYCLE', 'Bike / e-bike', 'Small parcels'],
  ['MOTORCYCLE', 'Motorcycle', 'Small and medium parcels'],
  ['TRICYCLE', 'Tricycle', 'Every size, up to large'],
];

const RIDER_WHY = [
  [Clock, '#3b82f6', 'Your own hours', "Go online when you want to work, offline when you don't."],
  [MapPinLine, '#059669', 'Your own town', 'Deliveries near you, nearest pickups first.'],
  [Storefront, '#ec4899', 'Local shops', 'Orders from E-MOORM shops in Oriental Mindoro.'],
  [CurrencyCircleDollar, '#f59e0b', 'Paid in cash', 'The delivery fee is yours, minus a small MoorMove commission.'],
];

function RiderWelcome() {
  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__inner">
          <Brand />
          <nav className="landing__links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#rides">Vehicles</a>
            <Link to="/info/help">Help</Link>
          </nav>
          <div className="landing__auth">
            <Link to="/login" className="btn btn--ghost btn--sm">Log in</Link>
            <Link to="/register?as=rider" className="btn btn--primary btn--sm">Sign up</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing__inner landing-hero__grid">
          <div className="landing-hero__text">
            <span className="eyebrow"><Moped size={16} weight="fill" /> For riders in Oriental Mindoro</span>
            <h1>Ride with MoorMove, <span>deliver for shops in your own town</span></h1>
            <p>MoorMove riders bring E-MOORM orders from local shops to their buyers with a tricycle, motorcycle or bike. Go online when you want and earn on every delivery.</p>
            <div className="landing-hero__cta">
              <Link to="/register?as=rider" className="btn btn--primary btn--lg btn--shadow"><Moped size={20} weight="fill" /> Sign up to ride</Link>
              <Link to="/login" className="btn btn--white btn--lg">Log in</Link>
            </div>
            <ul className="landing-hero__chips">
              <li><Clock size={18} weight="fill" /> Your own hours</li>
              <li><NavigationArrow size={18} weight="fill" /> Nearest first</li>
              <li><Money size={18} weight="fill" /> Paid in cash</li>
            </ul>
          </div>
          <div className="landing-hero__art"><HeroArt vehicle="TRICYCLE" /></div>
        </div>
      </section>

      <section id="how" className="landing-sec">
        <div className="landing__inner">
          <h2 className="landing-sec__title">How it works</h2>
          <p className="landing-sec__sub">From sign-up to your first delivery.</p>
          <ol className="how-grid">
            {RIDER_STEPS.map(([art, title, text], i) => (
              <li key={title} className="how-card">
                <span className="how-card__n">{i + 1}</span>
                <EmptyArt name={art} size={84} />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="rides" className="landing-sec landing-sec--white">
        <div className="landing__inner">
          <h2 className="landing-sec__title">Ride what you have</h2>
          <p className="landing-sec__sub">You see the deliveries your vehicle can carry.</p>
          <div className="ride-cards">
            {CARRY.map(([type, name, fits]) => (
              <div key={type} className="ride-card">
                <div className="ride-card__art"><VehicleArt type={type} size={190} /></div>
                <h3>{name}</h3>
                <div className="ride-card__foot"><span className="pill pill--green">{fits}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-sec">
        <div className="landing__inner">
          <h2 className="landing-sec__title">Why ride with MoorMove</h2>
          <div className="why-grid">
            {RIDER_WHY.map(([Icon, color, title, text]) => (
              <div key={title} className="why-card">
                <Icon size={30} weight="fill" style={{ color }} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <p className="landing-safe"><ShieldCheck size={22} weight="fill" /> Your ID and papers are seen only by MoorMove&apos;s team.</p>
        </div>
      </section>

      <footer className="landing-foot">
        <div className="landing__inner landing-foot__inner">
          <div>
            <Brand />
            <p>Local delivery by the E-MOORM team, for Oriental Mindoro.</p>
          </div>
          <nav aria-label="More">
            <Link to="/info/help">Help</Link>
            <Link to="/info/terms">Terms</Link>
            <Link to="/info/privacy">Privacy</Link>
            <Link to="/info/about">About</Link>
            <Link to="/login">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default function Welcome() {
  const info = useInfo();
  if (info?.publicBooking !== true) return <RiderWelcome />;
  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__inner">
          <Brand />
          <nav className="landing__links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#rides">Rides</a>
            <a href="#riders">Ride with us</a>
            <Link to="/info/help">Help</Link>
          </nav>
          <div className="landing__auth">
            <Link to="/login" className="btn btn--ghost btn--sm">Log in</Link>
            <Link to="/register" className="btn btn--primary btn--sm">Sign up</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing__inner landing-hero__grid">
          <div className="landing-hero__text">
            <span className="eyebrow"><MapPin size={16} weight="fill" /> Local delivery in Oriental Mindoro</span>
            <h1>Send anything across town, <span>with riders from your own town</span></h1>
            <p>MoorMove brings your packages across town with local tricycle, motorcycle and bike riders. Book in a minute, follow it live, pay in cash.</p>
            <div className="landing-hero__cta">
              <Link to="/register?as=customer" className="btn btn--primary btn--lg btn--shadow"><Package size={20} weight="fill" /> Send a package</Link>
              <Link to="/register?as=rider" className="btn btn--white btn--lg"><Moped size={20} weight="fill" /> Become a rider</Link>
            </div>
            <ul className="landing-hero__chips">
              <li><Camera size={18} weight="fill" /> Photo proof</li>
              <li><NavigationArrow size={18} weight="fill" /> Live tracking</li>
              <li><Money size={18} weight="fill" /> Cash &amp; COD</li>
            </ul>
          </div>
          <div className="landing-hero__art"><HeroArt /></div>
        </div>
      </section>

      <section id="how" className="landing-sec">
        <div className="landing__inner">
          <h2 className="landing-sec__title">How it works</h2>
          <p className="landing-sec__sub">Three steps, and you can watch every one of them.</p>
          <ol className="how-grid">
            {STEPS.map(([art, title, text], i) => (
              <li key={title} className="how-card">
                <span className="how-card__n">{i + 1}</span>
                <EmptyArt name={art} size={84} />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="rides" className="landing-sec landing-sec--white">
        <div className="landing__inner">
          <h2 className="landing-sec__title">A ride for every package</h2>
          <p className="landing-sec__sub">Choose the vehicle when you book. Prices update as you drop the pins.</p>
          <div className="ride-cards">
            {RIDES.map(([type, name, examples, fits]) => (
              <div key={type} className="ride-card">
                <div className="ride-card__art"><VehicleArt type={type} size={190} /></div>
                <h3>{name}</h3>
                <p>{examples}</p>
                <div className="ride-card__foot">
                  <span className="pill pill--green">{fits}</span>
                  {info?.fromFare?.[type] !== undefined && <span className="ride-card__price">from <b>{peso(info.fromFare[type])}</b></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="riders" className="landing-sec">
        <div className="landing__inner">
          <div className="rider-banner">
            <div className="rider-banner__text">
              <span className="eyebrow eyebrow--glass"><Moped size={16} weight="fill" /> For riders</span>
              <h2>Earn with your tricycle, motorcycle or bike</h2>
              <ul>
                {RIDER_PERKS.map((p) => <li key={p}><CheckCircle size={20} weight="fill" /> {p}</li>)}
              </ul>
              <Link to="/register?as=rider" className="btn btn--white btn--lg">Apply to ride <ArrowRight size={18} weight="bold" /></Link>
            </div>
            <div className="rider-banner__art">
              <span className="rider-banner__glow" />
              <VehicleArt type="TRICYCLE" size={300} />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-sec">
        <div className="landing__inner">
          <h2 className="landing-sec__title">Why MoorMove</h2>
          <div className="why-grid">
            {WHY.map(([Icon, color, title, text]) => (
              <div key={title} className="why-card">
                <Icon size={30} weight="fill" style={{ color }} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <p className="landing-safe"><ShieldCheck size={22} weight="fill" /> Your details are only shared with the rider doing your delivery.</p>
        </div>
      </section>

      <footer className="landing-foot">
        <div className="landing__inner landing-foot__inner">
          <div>
            <Brand />
            <p>Local delivery by the E-MOORM team, for Oriental Mindoro.</p>
          </div>
          <nav aria-label="More">
            <Link to="/info/help">Help</Link>
            <Link to="/info/terms">Terms</Link>
            <Link to="/info/privacy">Privacy</Link>
            <Link to="/info/about">About</Link>
            <Link to="/login">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
