import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CaretDown, EnvelopeSimple, Phone } from '@phosphor-icons/react';
import { useAuth } from '../../auth';
import { useLive } from '../../lib/hooks';
import { BackBar, Brand } from '../../components/ui';
import { EmptyArt, HeroArt } from '../../components/art';

const FAQ = {
  CUSTOMER: [
    ['How is the fare computed?', 'A base fare for the vehicle, plus a small amount per km after the first few km, plus a little more for medium or large packages. You always see the exact price before you book.'],
    ['How do I pay?', 'In cash to the rider. Choose whether you (the sender) pay at pickup, or the recipient pays at drop-off.'],
    ['What is COD?', 'Cash on delivery: the rider collects the item price from the recipient and brings it back to you. Tap "I got the money" on the delivery once the rider hands it over.'],
    ['Can I cancel?', 'Yes, until the rider has picked up the package. Open the delivery and tap Cancel.'],
    ["What if no rider accepts?", 'Keep the booking open, or cancel it and try again later. Riders see new deliveries as soon as you book.'],
    ['How do I know it arrived?', 'The rider takes a photo at drop-off. You get a notification and can see the photo on the delivery.'],
  ],
  RIDER: [
    ['How do I start?', 'Send your application with your ID and vehicle photos. Once MoorMove approves you, switch Online on the Home tab to see deliveries in your town.'],
    ['How much do I earn?', 'Each delivery shows what you earn before you accept. MoorMove keeps a small commission out of each fare, which you pay at the MoorMove office (see Earnings → Commission to pay).'],
    ['How do I collect payment?', 'The fare is paid in cash, by the sender at pickup or by the recipient at drop-off (shown on the delivery). For COD, collect the item price at drop-off and bring it back to the sender.'],
    ["What if I can't continue?", 'Before pickup, tap "Give back" and the delivery goes to another rider. After pickup, tap "Can\'t deliver", say why, and return the package to the sender.'],
    ['Why do I need to share my location?', 'So customers can see you on the map while you deliver. It is only shared while you are online.'],
  ],
  ADMIN: [
    ['Approving riders', 'Check that the selfie matches the ID, the license is valid, and the plate on the vehicle photo matches the OR/CR.'],
    ['Collecting commission', 'When a rider pays at the office, open Cash and tap Received for that rider.'],
  ],
};

const COMMON = [
  ['I forgot my password', 'Contact MoorMove support with the email you signed up with, and we will help you get back in.'],
  ['Is my information safe?', 'Your ID and documents are only seen by MoorMove staff. Your phone number is only shown to the rider doing your delivery, or to your customer while you deliver.'],
];

function Help() {
  const { user } = useAuth();
  const { data: info } = useLive('/info');
  const [open, setOpen] = useState(0);
  const list = [...(FAQ[user?.role] || [...FAQ.CUSTOMER, ...FAQ.RIDER.slice(0, 2)]), ...COMMON];
  return (
    <>
      <section className="info-hero">
        <EmptyArt name="help" size={86} />
        <div>
          <h2>How can we help?</h2>
          <p>Answers to common questions, and how to reach the MoorMove team.</p>
        </div>
      </section>
      <section className="section">
        <div className="section__head"><h2>Questions</h2></div>
        <ul className="faq">
          {list.map(([q, a], i) => (
            <li key={q}>
              <button type="button" className="faq__q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{q}</span>
                <CaretDown size={18} style={{ transform: open === i ? 'rotate(180deg)' : 'none' }} />
              </button>
              {open === i && <p className="faq__a">{a}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section className="section">
        <div className="section__head"><h2>Contact MoorMove</h2></div>
        <ul className="rows">
          {info?.supportPhone && (
            <li><a className="row" href={`tel:${info.supportPhone}`}><span className="row__icon"><Phone size={22} weight="fill" /></span><span className="row__text">Call support<small>{info.supportPhone}</small></span></a></li>
          )}
          {info?.supportEmail && (
            <li><a className="row" href={`mailto:${info.supportEmail}`}><span className="row__icon"><EnvelopeSimple size={22} weight="fill" /></span><span className="row__text">Email support<small>{info.supportEmail}</small></span></a></li>
          )}
          {info && !info.supportPhone && !info.supportEmail && (
            <li className="row"><span className="row__text muted">Support contacts will be posted here soon.</span></li>
          )}
        </ul>
      </section>
    </>
  );
}

const PAGES = {
  help: { title: 'Help center', body: <Help /> },
  terms: {
    title: 'Terms of Service',
    body: (
      <article className="card prose">
        <p className="muted small">MoorMove is an experimental service by the E-MOORM team. These terms may change as it grows.</p>
        <h3>The service</h3>
        <p>MoorMove connects people who need something delivered within their town with independent local riders. MoorMove is not a courier company and riders are not its employees.</p>
        <h3>Bookings</h3>
        <p>The fare is shown before you book and is paid in cash to the rider. You may cancel until the package is picked up. Don&apos;t send cash, valuables, illegal, dangerous or perishable items that can&apos;t survive the trip.</p>
        <h3>Riders</h3>
        <p>Riders must be approved by MoorMove, keep their license, registration and franchise valid, follow traffic rules and handle packages with care. MoorMove keeps a commission from each fare, which riders pay to MoorMove.</p>
        <h3>Cash on delivery</h3>
        <p>When COD is set, the rider collects the stated amount from the recipient and returns it to the sender the same day.</p>
        <h3>Problems</h3>
        <p>Report lost or damaged packages to MoorMove support as soon as possible. Accounts that misuse the service may be suspended.</p>
      </article>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <article className="card prose">
        <p className="muted small">In line with the Data Privacy Act of 2012 (RA 10173).</p>
        <h3>What we collect</h3>
        <p>Your name, email and mobile number; the addresses and map pins of your deliveries; for riders, your ID, license, vehicle documents and photos, and your location while you are online.</p>
        <h3>Why</h3>
        <p>To run deliveries: matching riders, showing progress, contacting each other, and checking that riders are who they say they are.</p>
        <h3>Who sees it</h3>
        <p>Phone numbers are shown only to the people in the same delivery. Rider documents are seen only by MoorMove staff. We don&apos;t sell your data.</p>
        <h3>How long</h3>
        <p>Delivery records are kept for accounting. Location points are only kept while they are useful for active deliveries.</p>
        <h3>Your rights</h3>
        <p>You may ask to see, correct or delete your data through MoorMove support.</p>
      </article>
    ),
  },
  about: {
    title: 'About MoorMove',
    body: (
      <article className="card prose about">
        <div className="about__art"><HeroArt vehicle="TRICYCLE" /></div>
        <Brand large />
        <p>MoorMove is local delivery for Oriental Mindoro, by the team behind E-MOORM. It gives tricycle, motorcycle and bike riders a fair way to earn from deliveries in their own town, and gives everyone a simple way to send things across town.</p>
        <p className="muted small">Version 0.2 · experimental</p>
      </article>
    ),
  },
};

export default function Info() {
  const { page } = useParams();
  const { user } = useAuth();
  const content = PAGES[page];
  if (!content) return <Navigate to="/" replace />;
  return (
    <div className="app app--plain">
      <main className="app__main">
        <div className="page-narrow">
          <BackBar title={content.title} to={user ? undefined : '/welcome'} />
          {content.body}
        </div>
      </main>
    </div>
  );
}
