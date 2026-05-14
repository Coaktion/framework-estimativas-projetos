import prisma from "@/lib/prisma";
import AEClient from "./AEClient";

export default async function AEPage({ searchParams }: { searchParams: { client?: string } }) {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { categoryName: 'asc' },
  });

  const variables = await prisma.variable.findMany({
    where: { isActive: true }
  });
  
  const categories = Array.from(new Set(packages.map(p => p.categoryName).filter(Boolean))) as string[];

  return (
    <AEClient 
      packages={packages} 
      categories={categories} 
      variables={variables}
      initialClientName={searchParams.client || ''}
    />
  );
}
