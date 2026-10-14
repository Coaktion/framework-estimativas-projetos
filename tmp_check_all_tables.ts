import prisma from './lib/prisma';

async function main() {
  const expectedTables = [
    'User', 'UserPreference', 'AEEstimate', 'Category', 'Skill', 'Package',
    'Variable', 'FrameworkVersion', 'Project', 'ProjectVersion', 'Spreadsheet',
    'ZdEnvironment', 'PsOpsSource', 'PsOpsIngestRun', 'PsOpsRawItem', 'PsOpsSignal',
    'PsOpsTriage', 'PsOpsInitiative', 'PsOpsActivity', 'PsOpsStudyNote', 'PsOpsArtifact', 'PsOpsArtifactSignal'
  ];

  const result: Record<string, boolean> = {};

  for (const model of expectedTables) {
    try {
      const delegate = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)];
      if (!delegate) {
        result[model] = false;
        continue;
      }
      await delegate.findFirst({ take: 1 });
      result[model] = true;
    } catch (e: any) {
      result[model] = false;
    }
  }

  console.log('TABLE STATUS:');
  for (const [table, ok] of Object.entries(result)) {
    console.log(`  ${ok ? '✅' : '❌'} ${table}`);
  }

  const missing = Object.entries(result).filter(([_, ok]) => !ok).map(([t]) => t);
  if (missing.length) {
    console.log(`\nMissing tables: ${missing.join(', ')}`);
  } else {
    console.log('\nAll tables exist.');
  }

  await prisma.$disconnect();
}

main();
