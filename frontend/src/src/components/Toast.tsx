import { Toaster, toast } from 'react-hot-toast';

export { toast };

export default function Toast() {
  return <Toaster position="top-right" toastOptions={{ duration: 4000 }} />;
}
