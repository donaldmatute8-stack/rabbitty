import { redirect } from 'next/navigation';

export default async function TableRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ branch?: string; branchId?: string }>;
}) {
  const { tableId } = await params;
  const query = await searchParams;
  const branch = query.branch || query.branchId || '';

  const destination = branch
    ? `/scan?tableId=${encodeURIComponent(tableId)}&branchId=${encodeURIComponent(branch)}`
    : `/scan?tableId=${encodeURIComponent(tableId)}`;

  redirect(destination);
}
