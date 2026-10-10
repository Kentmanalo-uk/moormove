import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../auth';
import { Avatar, BackBar, Field, useToast } from '../../components/ui';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: user.fullName, phone: user.phone });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setUser(await api.put('/auth/me', form));
      toast('Profile saved');
      navigate(-1);
    } catch (err) {
      setErrors(err.errors || {});
      if (!Object.keys(err.errors || {}).length) toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-form">
      <BackBar title="Edit profile" />
      <section className="form-head">
        <Avatar name={form.fullName || user.fullName} size="lg" ring />
        <div><strong>{form.fullName || user.fullName}</strong><span>{user.email}</span></div>
      </section>
      <form className="card" onSubmit={save} noValidate>
        <Field label="Full name" id="fullName" error={errors.fullName}>
          <input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Mobile number" id="phone" error={errors.phone} hint="Riders and customers call you on this number during a delivery">
          <input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Email" id="email" hint="Contact support to change your email">
          <input id="email" value={user.email} disabled />
        </Field>
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </div>
  );
}
