import { ClientsPage } from '@/components/management/clients-page';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <ClientsPage />
    </Suspense>
  );
}
