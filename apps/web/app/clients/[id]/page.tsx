import { ClientDetailPage } from '@/components/management/client-detail-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailPage id={id} />;
}
