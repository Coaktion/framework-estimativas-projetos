import prisma from '@/lib/prisma';
import { carregarEstudos, garantirCargaInicial, requireEstudosUser } from '@/lib/estudos/server';
import EstudosClient from './EstudosClient';

export default async function EstudosPage() {
  const u = await requireEstudosUser();
  // Primeira abertura: traz o conteúdo da planilha. Depois não faz nada.
  await garantirCargaInicial(prisma);
  const dados = await carregarEstudos(prisma);
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return <EstudosClient inicial={dados} euId={u.id} hoje={hoje} />;
}
