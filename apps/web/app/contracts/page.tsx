import { ContractsPage } from '@/components/management/contracts-page';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <ContractsPage />
    </Suspense>
  );
}
