/**
 * Knowledge Base Ingestion Script
 * Run: node scripts/ingest.js [--division=<name>] [--clear]
 */
import 'dotenv/config';
import { initDatabase, clearChunks } from '../server/database/init.js';
import { ingestAll, ingestDivision } from '../server/services/knowledgeBaseService.js';

async function main() {
  const args = process.argv.slice(2);
  const divisionArg = args.find(a => a.startsWith('--division='));
  const shouldClear = args.includes('--clear');

  console.log('🚀 AI Helpdesk ICT - Knowledge Base Ingestion Tool\n');

  // Initialize database
  await initDatabase();

  if (shouldClear) {
    const division = divisionArg ? divisionArg.split('=')[1] : null;
    clearChunks(division);
    console.log(division
      ? `🗑️  Cleared knowledge base for division: ${division}`
      : '🗑️  Cleared entire knowledge base'
    );

    if (!divisionArg && !args.includes('--ingest')) {
      console.log('\nDone!');
      process.exit(0);
    }
  }

  try {
    if (divisionArg) {
      const division = divisionArg.split('=')[1];
      console.log(`📂 Ingesting division: ${division}\n`);
      const count = await ingestDivision(division);
      console.log(`\n✅ Done! Ingested ${count} chunks for "${division}"`);
    } else {
      console.log('📂 Ingesting all divisions...\n');
      const count = await ingestAll();
      console.log(`\n✅ Done! Total ${count} chunks ingested across all divisions`);
    }
  } catch (error) {
    console.error('❌ Ingestion failed:', error.message);
    console.log('\n💡 Tip: Pastikan NVIDIA_API_KEY sudah diisi di file .env');
    console.log(`   Model embedding: ${process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5'}`);
    console.log('\n   Knowledge base tersimpan tanpa embedding (pencarian kata kunci dipakai sebagai fallback).');
  }

  process.exit(0);
}

main();
