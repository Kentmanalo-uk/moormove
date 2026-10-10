import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { AreaEditor } from '../../components/area';
import { BackBar, Loading } from '../../components/ui';

/** The rider's delivery area: the towns (or barangays) they take deliveries in. */
export default function RiderArea() {
  const [params] = useSearchParams();
  const fromApply = params.get('from') === 'apply';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/rider/areas'), api.get('/towns')])
      .then(([area, towns]) => setData({ area, towns }))
      .catch((err) => setError(err.message));
  }, []);

  const bar = <BackBar title="Delivery area" to={fromApply ? '/rider/apply' : undefined} />;
  if (error) return <>{bar}<p className="alert">{error}</p></>;
  if (!data) return <>{bar}<Loading /></>;

  return (
    <>
      {bar}
      <AreaEditor area={data.area} towns={data.towns} limits={data.area.limits}
        save={(rows) => api.put('/rider/areas', { areas: rows })} />
    </>
  );
}
