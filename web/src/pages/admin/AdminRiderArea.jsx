import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import { AreaEditor } from '../../components/area';
import { BackBar, Loading } from '../../components/ui';

/** An admin sets where a rider delivers (the same picker as the rider's). */
export default function AdminRiderArea() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/admin/riders/${id}`), api.get('/towns')])
      .then(([rider, towns]) => setData({ rider, towns }))
      .catch((err) => setError(err.message));
  }, [id]);

  const bar = (name) => <BackBar title={name ? `Area · ${name}` : 'Delivery area'} to={`/admin/riders/${id}`} />;
  if (error) return <>{bar()}<p className="alert">{error}</p></>;
  if (!data) return <>{bar()}<Loading /></>;
  const { rider } = data;
  const area = { homeTownId: rider.townId, usesHomeTown: rider.usesHomeTown, areas: rider.areas, summary: rider.areasSummary };

  return (
    <>
      {bar(rider.user.fullName)}
      <AreaEditor admin area={area} towns={data.towns}
        save={async (rows) => {
          const r = await api.put(`/admin/riders/${id}/areas`, { areas: rows });
          return { homeTownId: r.townId, usesHomeTown: r.usesHomeTown, areas: r.areas, summary: r.areasSummary, notices: r.notices };
        }} />
    </>
  );
}
