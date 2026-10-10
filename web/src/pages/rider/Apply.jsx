import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ShieldCheck } from '@phosphor-icons/react';
import api from '../../api';
import { BackBar, Field, Loading, PhotoField } from '../../components/ui';
import { VehicleArt } from '../../components/art';
import { VEHICLES } from '../../lib/format';

const TEXT_FIELDS = ['townId', 'barangay', 'vehicleType', 'plateNumber', 'licenseNumber', 'todaName', 'mtopNumber', 'emergencyName', 'emergencyPhone'];
const PHOTO_FIELDS = ['selfieUploadId', 'idUploadId', 'licenseUploadId', 'orcrUploadId', 'vehicleUploadId'];

export default function Apply() {
  const navigate = useNavigate();
  const [towns, setTowns] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    Promise.all([api.get('/rider/me'), api.get('/towns')])
      .then(([{ rider }, list]) => {
        if (!['DRAFT', 'NEEDS_CHANGES'].includes(rider.status)) {
          navigate('/rider', { replace: true });
          return;
        }
        setTowns(list);
        setForm(Object.fromEntries([...TEXT_FIELDS, ...PHOTO_FIELDS].map((f) => [f, rider[f] || ''])));
      })
      .catch((err) => setError(err.message));
  }, [navigate]);

  if (!form) {
    return error
      ? <><BackBar title="Rider application" to="/rider" /><p className="alert">{error}</p></>
      : <Loading />;
  }

  const motorised = form.vehicleType === 'TRICYCLE' || form.vehicleType === 'MOTORCYCLE';
  const needed = [
    'townId', 'barangay', 'vehicleType', 'selfieUploadId', 'idUploadId', 'vehicleUploadId', 'emergencyName', 'emergencyPhone',
    ...(motorised ? ['plateNumber', 'licenseNumber', 'licenseUploadId', 'orcrUploadId'] : []),
    ...(form.vehicleType === 'TRICYCLE' ? ['todaName', 'mtopNumber'] : []),
  ];
  const filled = needed.filter((f) => String(form[f] || '').trim()).length;
  const percent = Math.round((filled / needed.length) * 100);
  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setError('');
  };
  const input = (name) => ({ id: name, value: form[name], onChange: (e) => set(name, e.target.value) });

  // A photo is kept on the application as soon as it is uploaded.
  const setPhoto = (name) => async (id) => {
    set(name, id);
    try {
      await api.put('/rider/application', { [name]: id });
    } catch (err) {
      setErrors((prev) => ({ ...prev, ...err.errors }));
    }
  };

  const save = async () => {
    await api.put('/rider/application', Object.fromEntries(TEXT_FIELDS.map((f) => [f, form[f]])));
  };

  const saveForLater = async () => {
    setBusy('save');
    setError('');
    try {
      await save();
      navigate('/rider');
    } catch (err) {
      setErrors(err.errors);
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const send = async (e) => {
    e.preventDefault();
    setBusy('send');
    setError('');
    try {
      await save();
      await api.post('/rider/application/submit');
      navigate('/rider');
    } catch (err) {
      setErrors(err.errors);
      setError(Object.keys(err.errors).length ? 'Some things are still missing. See the marked fields.' : err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="page-form">
        <BackBar title="Rider application" to="/rider" />
        <section className="apply-progress">
          <div className="apply-progress__top">
            <strong>{percent === 100 ? 'Ready to send' : `${filled} of ${needed.length} done`}</strong>
            <span>{percent}%</span>
          </div>
          <span className="apply-progress__bar"><i style={{ width: `${percent}%` }} /></span>
          <p><ShieldCheck size={16} weight="fill" /> Everything here is seen only by MoorMove&apos;s team.</p>
        </section>

        <form onSubmit={send} noValidate>
          <section className="card form-section">
            <h2><span className="form-section__n">1</span> Where you&apos;ll ride</h2>
            <Field label="Town" id="townId" error={errors.townId}>
              <select {...input('townId')}>
                <option value="">Choose your town</option>
                {towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Barangay" id="barangay" error={errors.barangay}>
              <input {...input('barangay')} placeholder="e.g. Poblacion" />
            </Field>
          </section>

          <section className="card form-section">
            <h2><span className="form-section__n">2</span> Your vehicle</h2>
            <div className={`vehicle-pick${errors.vehicleType ? ' vehicle-pick--error' : ''}`} role="radiogroup" aria-label="Vehicle">
              {Object.entries(VEHICLES).map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={form.vehicleType === value}
                  className={form.vehicleType === value ? 'is-on' : ''} onClick={() => set('vehicleType', value)}>
                  <CheckCircle size={20} weight="fill" className="vehicle-pick__tick" />
                  <VehicleArt type={value} size={88} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {errors.vehicleType && <p className="field__error">{errors.vehicleType}</p>}

            {motorised && (
              <>
                <Field label="Plate number" id="plateNumber" error={errors.plateNumber}>
                  <input {...input('plateNumber')} autoCapitalize="characters" />
                </Field>
                <Field label="Driver's license number" id="licenseNumber" error={errors.licenseNumber}>
                  <input {...input('licenseNumber')} autoCapitalize="characters" />
                </Field>
              </>
            )}
            {form.vehicleType === 'TRICYCLE' && (
              <>
                <Field label="TODA" id="todaName" error={errors.todaName} hint="Your tricycle operators and drivers association">
                  <input {...input('todaName')} />
                </Field>
                <Field label="Franchise (MTOP) number" id="mtopNumber" error={errors.mtopNumber}>
                  <input {...input('mtopNumber')} autoCapitalize="characters" />
                </Field>
              </>
            )}
          </section>

          <section className="card form-section">
            <h2><span className="form-section__n">3</span> Photos</h2>
            <PhotoField label="Selfie" hint="Your face, clearly, no sunglasses" capture="user"
              value={form.selfieUploadId} onChange={setPhoto('selfieUploadId')} error={errors.selfieUploadId} />
            <PhotoField label="Valid ID" hint="Front of a government ID"
              value={form.idUploadId} onChange={setPhoto('idUploadId')} error={errors.idUploadId} />
            {motorised && (
              <>
                <PhotoField label="Driver's license" hint="Front, all text readable"
                  value={form.licenseUploadId} onChange={setPhoto('licenseUploadId')} error={errors.licenseUploadId} />
                <PhotoField label="OR/CR" hint="Official receipt and certificate of registration"
                  value={form.orcrUploadId} onChange={setPhoto('orcrUploadId')} error={errors.orcrUploadId} />
              </>
            )}
            <PhotoField label="Your vehicle" hint={motorised ? 'With the plate showing' : 'The whole vehicle'} capture="environment"
              value={form.vehicleUploadId} onChange={setPhoto('vehicleUploadId')} error={errors.vehicleUploadId} />
          </section>

          <section className="card form-section">
            <h2><span className="form-section__n">4</span> Emergency contact</h2>
            <Field label="Name" id="emergencyName" error={errors.emergencyName}>
              <input {...input('emergencyName')} />
            </Field>
            <Field label="Mobile number" id="emergencyPhone" error={errors.emergencyPhone}>
              <input {...input('emergencyPhone')} type="tel" inputMode="tel" placeholder="09171234567" />
            </Field>
          </section>

          {error && <p className="alert" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={saveForLater} disabled={Boolean(busy)}>
              {busy === 'save' ? 'Saving…' : 'Save for later'}
            </button>
            <button className="btn btn--primary btn--shadow" disabled={Boolean(busy)}>
              {busy === 'send' ? 'Sending…' : 'Send application'}
            </button>
          </div>
        </form>
    </div>
  );
}
