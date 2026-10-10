import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import api from '../../api';
import { useAuth } from '../../auth';
import { Field } from '../../components/ui';
import AuthLayout, { AuthTerms } from '../../components/AuthLayout';
import { useInfo } from '../../lib/hooks';

export default function Login() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const customersWelcome = useInfo()?.publicBooking === true;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      signIn(await api.post('/auth/login', form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout other={{ to: '/register', label: 'Sign up' }}>
      <h1 className="auth__title">Log In</h1>
      <p className="auth__lead">{customersWelcome ? 'Log in to send a package or start delivering.' : 'Log in to start delivering.'}</p>
      <form onSubmit={submit} noValidate>
        <Field label="Email address" id="email">
          <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div className="field">
          <div className="auth__label-row">
            <label htmlFor="password">Password</label>
            <Link to="/info/help">Forgot?</Link>
          </div>
          <div className="input-reveal">
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeSlash size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn btn--primary btn--block btn--lg auth__submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="auth__switch">New to MoorMove? <Link to="/register">{customersWelcome ? 'Create an account' : 'Sign up to ride'}</Link></p>
      <AuthTerms />
    </AuthLayout>
  );
}
