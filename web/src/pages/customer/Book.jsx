import { useNavigate } from 'react-router-dom';
import BookingForm from '../../components/BookingForm';
import { useToast } from '../../components/ui';

export default function Book() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <BookingForm
      endpoint="/jobs"
      title="Book a delivery"
      onBooked={(job) => {
        toast(`Booked ${job.code}. Finding you a rider…`);
        navigate(`/deliveries/${job.id}`, { replace: true });
      }}
    />
  );
}
