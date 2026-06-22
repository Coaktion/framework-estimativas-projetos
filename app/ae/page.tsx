import prisma from "@/lib/prisma";
import AEClient from "./AEClient";

export default async function AEPage({ searchParams }: { searchParams: { client?: string } }) {
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

  return (
    <AEClient 
      packages={packages} 
      categories={categories} 
      variables={variables}
      initialClientName={searchParams.client || ''}
    />
  );
}
