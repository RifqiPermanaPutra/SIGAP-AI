/**
 * Knowledge Base Service
 * Handles ingestion, chunking, and semantic search of SOP documents
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embed, embedBatch, cosineSimilarity } from './embeddingService.js';
import {
  addKnowledgeChunk,
  getChunksByDivision,
  getAllChunks,
  clearChunks
} from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_DIR = path.join(__dirname, '..', '..', 'knowledge-base');

// Division mapping
const DIVISIONS = {
  printer: 'Printer',
  cctv: 'CCTV',
  telepon: 'Telepon',
  radio: 'Radio Komunikasi',
  windows: 'Windows',
  fttp: 'FTTP',
  lan: 'LAN',
  wan: 'WAN'
};

/**
 * Split text into overlapping chunks
 * @param {string} text - Full text to chunk
 * @param {number} chunkSize - Maximum chunk size in characters
 * @param {number} overlap - Overlap between chunks in characters
 * @returns {string[]} - Array of text chunks
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  const sections = text.split(/\n## /);

  for (const section of sections) {
    const sectionText = section.trim();
    if (!sectionText) continue;

    if (sectionText.length <= chunkSize) {
      chunks.push(sectionText);
    } else {
      // Split large sections by paragraphs first
      const paragraphs = sectionText.split(/\n\n/);
      let currentChunk = '';

      for (const paragraph of paragraphs) {
        if ((currentChunk + '\n\n' + paragraph).length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          // Keep overlap from end of previous chunk
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '\n\n' + paragraph;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
  }

  return chunks.filter(c => c.length > 20); // Filter out tiny chunks
}

/**
 * Extract category (ringan/berat) from content
 */
function extractCategory(content) {
  const beratKeywords = [
    'rusak', 'kerusakan', 'mainboard', 'hardware', 'blue screen', 'gagal boot',
    'putus', 'mati total', 'server', 'konfigurasi router', 'administrator',
    'kunjungan engineer', 'eskalasi', 'masalah berat'
  ];

  const lowerContent = content.toLowerCase();
  for (const keyword of beratKeywords) {
    if (lowerContent.includes(keyword)) {
      return 'berat';
    }
  }
  return 'ringan';
}

/**
 * Ingest a single SOP document into the knowledge base
 * @param {string} division - Division identifier
 * @param {string} filePath - Path to the SOP markdown file
 */
export async function ingestDocument(division, filePath) {
  console.log(`📄 Ingesting: ${filePath} → Division: ${division}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const chunks = chunkText(content);

  console.log(`   📦 Created ${chunks.length} chunks`);

  // Generate embeddings in batch
  let embeddings;
  try {
    // Dokumen KB di-embed sebagai 'passage' (lihat catatan di embeddingService)
    embeddings = await embedBatch(chunks, 'passage');
  } catch (error) {
    console.warn(`   ⚠️ Embedding gagal: ${error.message}. Disimpan tanpa embedding.`);
    embeddings = chunks.map(() => []);
  }

  // Store each chunk
  for (let i = 0; i < chunks.length; i++) {
    addKnowledgeChunk({
      division,
      title: `${DIVISIONS[division]} - Chunk ${i + 1}`,
      content: chunks[i],
      category: extractCategory(chunks[i]),
      embedding: embeddings[i] || [],
      metadata: {
        sourceFile: path.basename(filePath),
        chunkIndex: i,
        totalChunks: chunks.length
      }
    });
  }

  console.log(`   ✅ Ingested ${chunks.length} chunks for ${DIVISIONS[division]}`);
}

/**
 * Ingest all SOP documents from the knowledge-base directory
 */
export async function ingestAll() {
  console.log('🔄 Starting full knowledge base ingestion...\n');

  for (const [divId, divName] of Object.entries(DIVISIONS)) {
    const divDir = path.join(KB_DIR, divId === 'radio' ? 'radio-komunikasi' : divId);

    if (!fs.existsSync(divDir)) {
      console.warn(`   ⚠️ Directory not found: ${divDir}`);
      continue;
    }

    const files = fs.readdirSync(divDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      await ingestDocument(divId, path.join(divDir, file));
    }
  }

  const total = getAllChunks().length;
  console.log(`\n✅ Ingestion complete! Total chunks: ${total}`);
  return total;
}

/**
 * Ingest a specific division
 */
export async function ingestDivision(division) {
  // Clear existing chunks for this division
  clearChunks(division);

  const divDir = path.join(KB_DIR, division === 'radio' ? 'radio-komunikasi' : division);

  if (!fs.existsSync(divDir)) {
    throw new Error(`Directory not found for division: ${division}`);
  }

  const files = fs.readdirSync(divDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    await ingestDocument(division, path.join(divDir, file));
  }

  return getChunksByDivision(division).length;
}

/**
 * Search the knowledge base using semantic similarity
 * @param {string} query - User's question
 * @param {string} division - Division to search within
 * @param {number} topK - Number of top results to return
 * @returns {Promise<Array>} - Top-K relevant chunks
 */
export async function search(query, division, topK = 3) {
  const chunks = division
    ? getChunksByDivision(division)
    : getAllChunks();

  if (chunks.length === 0) {
    return [];
  }

  // Check if chunks have embeddings
  const hasEmbeddings = chunks.some(c => c.embedding && c.embedding.length > 0);

  if (!hasEmbeddings) {
    // Fallback: keyword search if no embeddings
    return keywordSearch(query, chunks, topK);
  }

  try {
    // Pertanyaan pengguna di-embed sebagai 'query', bukan 'passage'
    const queryEmbedding = await embed(query, 'query');

    // Calculate similarities
    const scored = chunks
      .filter(c => c.embedding && c.embedding.length > 0)
      .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  } catch (error) {
    console.warn('⚠️ Semantic search failed, falling back to keyword search:', error.message);
    return keywordSearch(query, chunks, topK);
  }
}

/**
 * Fallback keyword-based search
 */
function keywordSearch(query, chunks, topK = 3) {
  const queryWords = query.toLowerCase().split(/\s+/);

  const scored = chunks.map(chunk => {
    const content = chunk.content.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      if (word.length > 2 && content.includes(word)) {
        score += 1;
      }
    }

    return { ...chunk, score };
  })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
