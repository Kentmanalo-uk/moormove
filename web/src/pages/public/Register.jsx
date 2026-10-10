import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from '@phosphor-icons/react';
import api from '../../api';
import { useAuth } from '../../auth';
import { Field } from '../../components/ui';
import { useInfo } from '../../lib/hooks';
import AuthLayout from '../../components/AuthLayout';
import { EmptyArt } from '../../components/art';

const ROLES = [
  ['CUSTOMER', 'parcels', 'Send packages', 'Book local riders'],
  ['RIDER', 'ride', 'Deliver & earn', 'Become a rider'],
];

export default function Register() {
  const { signIn } = useAuth();
  const [params] = useSearchParams();
  // While MoorMove carries E-MOORM orders only, sign-up is for riders.
  const customersWelcome = useInfo()?.publicBooking === true;
  const [picked, setRole] = useState(params.get('as') === 'rider' ? 'RIDER' : 'CUSTOMER');
  const role = customersWelcome ? picked : 'RIDER';
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (name) => (e) => {
    setForm({ ...form, [name]: e.target.value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!agree) {
      setError('Please agree to the Terms and Privacy Policy');
      return;
    }
    setBusy(true);
    setError('');
    try {
      signIn(await api.post('/auth/register', { ...form, role }));
    } catch (err) {
      setErrors(err.errors || {});
      if (!Object.keys(err.errors || {}).length) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout other={{ to: '/login', label: 'Log in' }}>
      <h1 className="auth__title">{customersWelcome ? 'Sign Up' : 'Ride with MoorMove'}</h1>
      <p className="auth__lead">{customersWelcome ? 'What would you like to do?' : 'Deliver E-MOORM orders in your own town and earn.'}</p>
      {customersWelcome && (
        <div className="role-pick" role="radiogroup" aria-label="I want to">
          {ROLES.map(([value, art, title, sub]) => (
            <button key={value} type="button" role="radio" aria-checked={role === value}
              className={`role-pick__item${role === value ? ' is-on' : ''}`} onClick={() => setRole(value)}>
              <CheckCircle size={22} weight="fill" className="role-pick__tick" />
              <EmptyArt name={art} size={56} />
              <strong>{title}</strong>
              <small>{sub}</small>
            </button>
          ))}
        </div>
      )}
      <p className="auth__note">
        {role === 'RIDER'
          ? 'After signing up you send a short application with your ID and vehicle. MoorMove checks it before your first delivery.'
          : 'Book deliveries across town and follow them live.'}
      </p>
      <form onSubmit={submit} noValidate>
        <Field label="Full name" id="fullName" error={errors.fullName}>
          <input id="fullName" autoComplete="name" value={form.fullName} onChange={set('fullName')} />
        </Field>
        <div className="field-pair field-pair--wide">
          <Field label="Mobile number" id="phone" error={errors.phone}>
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09171234567" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email" id="email" error={errors.email}>
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
        </div>
        <Field label="Password" id="password" error={errors.password} hint="At least 8 characters">
          <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(''); }} />
          <span className="small">I agree to MoorMove&apos;s <Link to="/info/terms">Terms</Link> and <Link to="/info/privacy">Privacy Policy</Link>.</span>
        </label>
        {error && <p className="alert" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <button className="btn btn--primary btn--block btn--lg auth__submit" style={{ marginTop: 14 }} disabled={busy}>
          {busy ? 'Creating…' : role === 'RIDER' ? 'Sign up as a rider' : 'Sign up'}
        </button>
      </form>
      <p className="auth__switch">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}
