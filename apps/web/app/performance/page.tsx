import { PerformancePage } from '@/components/management/performance-page';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <PerformancePage />
    </Suspense>
  );
}
