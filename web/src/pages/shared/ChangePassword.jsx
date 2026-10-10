import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { BackBar, Field, useToast } from '../../components/ui';
import { EmptyArt } from '../../components/art';

export default function ChangePassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: "The passwords don't match" });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast('Password changed');
      navigate(-1);
    } catch (err) {
      setErrors(err.errors || {});
      if (!Object.keys(err.errors || {}).length) toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = (name, label, hint) => (
    <Field label={label} id={name} error={errors[name]} hint={hint}>
      <input id={name} type="password" autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
        value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
    </Field>
  );

  return (
    <div className="page-form">
      <BackBar title="Change password" />
      <section className="form-head form-head--art">
        <EmptyArt name="security" size={64} />
        <div><strong>Keep your account safe</strong><span>Use at least 8 characters you don&apos;t use anywhere else.</span></div>
      </section>
      <form className="card" onSubmit={save} noValidate>
        {input('currentPassword', 'Current password')}
        {input('newPassword', 'New password', 'At least 8 characters')}
        {input('confirm', 'New password again')}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
