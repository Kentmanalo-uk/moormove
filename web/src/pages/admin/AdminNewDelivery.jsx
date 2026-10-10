import { useNavigate } from 'react-router-dom';
import BookingForm from '../../components/BookingForm';
import { useToast } from '../../components/ui';

/** Book for someone who called or walked in. */
export default function AdminNewDelivery() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <BookingForm
      endpoint="/admin/jobs"
      forCaller
      title="New delivery"
      back="/admin/deliveries"
      note="For someone who called or walked in. Riders in the town see it right away."
      onBooked={(job) => {
        toast(`Booked ${job.code}`);
        navigate(`/admin/deliveries/${job.id}`, { replace: true });
      }}
    />
  );
}
