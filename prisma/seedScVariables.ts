import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedVarDef {
  key: string;
  label: string;
  labelEn: string;
  value: string;
  type?: 'PERCENT' | 'FLAT' | 'MIXED';
  category?: string;
  isActive?: boolean;
}

const VARIABLES: SeedVarDef[] = [
  {
    key:   'SD_DRN_DEVOPS_PERCENT',
    label: 'DRN - % sobre Desenvolvimento',
    labelEn: 'DRN - % over Development',
    value: '15',
    type:  'PERCENT',
    category: 'Solution Design',
    isActive: true,
  },
  {
    key:   'SD_DISCOVERY_DEVOPS_PERCENT',
    label: 'SD c/ Dev - % Discovery sobre Desenvolvimento',
    labelEn: 'SD with Dev - % Discovery over Development',
    value: '15',
    type:  'PERCENT',
    category: 'Solution Design',
    isActive: true,
  },
  {
    key:   'SD_LIQUID_TO_DISCOVERY_PCT',
    label: 'SD - % do bruto para Discovery',
    labelEn: 'SD - % gross value to Discovery',
    value: '100',
    type:  'PERCENT',
    category: 'Solution Design',
    isActive: true,
  },
];

async function seedVariables() {
  console.log(`🚀 Iniciando upsert de ${VARIABLES.length} variáveis de SD/DRN...`);

  for (const v of VARIABLES) {
    try {
      const existing = await prisma.variable.findUnique({ where: { key: v.key } });

      const upserted = await prisma.variable.upsert({
        where: { key: v.key },
        update: {
          isActive: true,
          // Se NÃO existia no banco, ou se o banco tem label vazio (padrão antigo),
          // garantimos labels legíveis. Se o usuário já havia customizado (existing.label !== '')
          // mantemos o que ele tinha.
          label:   existing?.label   ? existing.label   : v.label,
          labelEn: existing?.labelEn ? existing.labelEn : v.labelEn,
          category: existing?.category ?? v.category,
          type:     existing?.type     ?? v.type,
        },
        create: {
          key:       v.key,
          label:     v.label,
          labelEn:   v.labelEn,
          value:     v.value,
          type:      v.type     ?? 'PERCENT',
          category:  v.category ?? null,
          isActive:  v.isActive ?? true,
        },
      });

      console.log(`✅ Variável OK: ${upserted.key}`);
      console.log(`   Tipo: ${upserted.type} | Valor atual (banco): ${upserted.value} | Categoria: ${upserted.category ?? '—'}`);
      console.log(`   PT: "${upserted.label}" / EN: "${upserted.labelEn}"`);
      console.log(`   ------------------------------------------------`);
    } catch (error) {
      console.error(`❌ Erro ao processar ${v.key}:`, error);
    }
  }

  console.log('\n✨ Seed finalizado. As variáveis já aparecem no painel de Admin (/admin).');
  console.log('   ℹ️  Se precisar alterar os % depois, edite DIRETO no painel — não precisa rodar esse script de novo.');

  await prisma.$disconnect();
}

seedVariables();
