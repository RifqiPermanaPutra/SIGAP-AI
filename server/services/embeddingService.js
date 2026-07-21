/**
 * Embedding Service
 * Generates vector embeddings via NVIDIA NIM (OpenAI-compatible endpoint).
 *
 * CATATAN PENTING — input_type:
 * Model retrieval NVIDIA bersifat asimetris: dokumen yang disimpan harus
 * di-embed sebagai "passage", sedangkan pertanyaan pengguna sebagai "query".
 * Menyamakan keduanya tidak memunculkan error, tetapi menurunkan akurasi
 * pencarian secara diam-diam.
 */
import OpenAI from 'openai';

const BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const EMBED_MODEL = process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5';

// Batas aman jumlah teks per permintaan ke endpoint embedding
const BATCH_SIZE = 32;

const client = new OpenAI({
  baseURL: BASE_URL,
  apiKey: process.env.NVIDIA_API_KEY
});

/**
 * Panggil endpoint embedding NVIDIA
 * @param {string[]} input - Daftar teks
 * @param {'query'|'passage'} inputType - Peran teks dalam pencarian
 * @returns {Promise<number[][]>}
 */
async function requestEmbeddings(input, inputType) {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY belum diisi di file .env');
  }

  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input,
    encoding_format: 'float',
    // Parameter khusus NIM di luar spesifikasi OpenAI. Pada SDK Node keduanya
    // ditaruh langsung di sini — `extra_body` hanya berlaku untuk SDK Python
    // dan akan ditolak endpoint dengan galat 400 extra_forbidden.
    input_type: inputType,
    truncate: 'END'
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Generate embedding untuk satu teks
 * @param {string} text - Teks yang di-embed
 * @param {'query'|'passage'} inputType - Default 'query' (pertanyaan pengguna)
 * @returns {Promise<number[]>} - Vektor embedding
 */
export async function embed(text, inputType = 'query') {
  try {
    const [vector] = await requestEmbeddings([text], inputType);
    return vector;
  } catch (error) {
    console.error('❌ Embedding error:', error.message);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embedding untuk banyak teks sekaligus
 * @param {string[]} texts - Daftar teks
 * @param {'query'|'passage'} inputType - Default 'passage' (dokumen knowledge base)
 * @returns {Promise<number[][]>} - Daftar vektor embedding
 */
export async function embedBatch(texts, inputType = 'passage') {
  try {
    const results = [];

    // Dipecah agar tidak melebihi batas permintaan endpoint
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      results.push(...(await requestEmbeddings(slice, inputType)));
    }

    return results;
  } catch (error) {
    console.error('❌ Batch embedding error:', error.message);
    throw new Error(`Failed to generate batch embeddings: ${error.message}`);
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
