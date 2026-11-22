import { DevelopersPage } from '@/components/management/developers-page';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <DevelopersPage />
    </Suspense>
  );
}
