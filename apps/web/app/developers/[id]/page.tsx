import { DeveloperDetailPage } from '@/components/management/developer-detail-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeveloperDetailPage id={id} />;
}
