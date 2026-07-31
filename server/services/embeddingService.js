/**
 * Embedding Service
 * Menghasilkan vektor embedding melalui Ollama yang berjalan di komputer lokal.
 *
 * Ollama menyediakan endpoint yang kompatibel dengan OpenAI di
 * http://localhost:11434/v1, sehingga SDK OpenAI tetap dapat dipakai.
 *
 * Model yang dipakai: bge-m3 (multilingual, 1024 dimensi). Model ini dipilih
 * karena kuat untuk Bahasa Indonesia — model embedding yang hanya baik untuk
 * bahasa Inggris membuat pencarian SOP meleset tanpa memunculkan galat apa pun.
 */
import OpenAI from 'openai';

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'bge-m3';

// Batas aman jumlah teks per permintaan
const BATCH_SIZE = 16;

const client = new OpenAI({
  baseURL: BASE_URL,
  // Ollama tidak memeriksa kunci, tetapi SDK OpenAI menolak nilai kosong.
  apiKey: process.env.OLLAMA_API_KEY || 'ollama'
});

/**
 * Kirim permintaan embedding ke Ollama
 * @param {string[]} input - Daftar teks
 * @returns {Promise<number[][]>}
 */
async function requestEmbeddings(input) {
  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input,
    encoding_format: 'float'
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Generate embedding untuk satu teks
 * @param {string} text - Teks yang di-embed
 * @returns {Promise<number[]>} - Vektor embedding
 */
export async function embed(text) {
  try {
    const [vector] = await requestEmbeddings([text]);
    return vector;
  } catch (error) {
    console.error('❌ Embedding error:', error.message);
    throw new Error(`Gagal membuat embedding: ${error.message}`);
  }
}

/**
 * Generate embedding untuk banyak teks sekaligus
 * @param {string[]} texts - Daftar teks
 * @returns {Promise<number[][]>} - Daftar vektor embedding
 */
export async function embedBatch(texts) {
  try {
    const results = [];

    // Dipecah agar permintaan tidak terlalu besar untuk server lokal
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      results.push(...(await requestEmbeddings(slice)));
    }

    return results;
  } catch (error) {
    console.error('❌ Batch embedding error:', error.message);
    throw new Error(`Gagal membuat embedding massal: ${error.message}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Cosine similarity (-1 to 1)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
