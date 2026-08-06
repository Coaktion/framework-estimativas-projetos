import prisma from "@/lib/prisma";
import AEClient from "./AEClient";

export default async function AEPage({ searchParams }: { searchParams: { client?: string; cloneFrom?: string } }) {
  const categoriesData = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const variables = await prisma.variable.findMany({
    where: { isActive: true }
  });
  
  const categories = categoriesData.map(c => c.name);

  let initialClientName = searchParams.client || '';
  let initialData: any = null;
  let initialVersion: number | null = null;
  let cloneFromId: number | null = null;

  if (searchParams.cloneFrom) {
    const cloneId = parseInt(searchParams.cloneFrom);
    if (!Number.isNaN(cloneId) && cloneId > 0) {
      const source = await prisma.aEEstimate.findUnique({ where: { id: cloneId } });
      if (source) {
        try {
          initialData = JSON.parse(source.data);
        } catch (_) {
          initialData = {};
        }
        initialVersion = source.version;
        initialClientName = source.clientName;
        cloneFromId = source.id;
      }
    }
  }

  return (
    <AEClient 
      packages={packages} 
      categories={categories} 
      variables={variables}
      initialClientName={initialClientName}
      initialData={initialData}
      initialVersion={initialVersion}
      cloneFromId={cloneFromId}
    />
  );
}
