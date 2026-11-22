import { AssignmentsPage } from '@/components/management/assignments-page';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense>
      <AssignmentsPage />
    </Suspense>
  );
}
