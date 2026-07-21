/**
 * Knowledge Base API Routes
 * Handles ingestion and management of SOP documents
 */
import { Router } from 'express';
import { ingestAll, ingestDivision } from '../services/knowledgeBaseService.js';
import { getAllChunks, getChunksByDivision, clearChunks } from '../database/init.js';

export const kbRouter = Router();

/**
 * POST /api/kb/ingest
 * Ingest all knowledge base documents or a specific division
 */
kbRouter.post('/ingest', async (req, res) => {
  try {
    const { division } = req.body;

    let count;
    if (division) {
      count = await ingestDivision(division);
      res.json({
        success: true,
        message: `Berhasil ingest ${count} chunks untuk divisi: ${division}`
      });
    } else {
      count = await ingestAll();
      res.json({
        success: true,
        message: `Berhasil ingest ${count} total chunks untuk semua divisi`
      });
    }
  } catch (error) {
    console.error('Error ingesting:', error);
    res.status(500).json({
      success: false,
      error: `Gagal melakukan ingestion: ${error.message}`
    });
  }
});

/**
 * GET /api/kb/stats
 * Get knowledge base statistics
 */
kbRouter.get('/stats', (req, res) => {
  const allChunks = getAllChunks();
  const divisions = ['printer', 'cctv', 'telepon', 'radio', 'windows', 'fttp', 'lan', 'wan'];

  const stats = {};
  for (const div of divisions) {
    stats[div] = getChunksByDivision(div).length;
  }

  res.json({
    success: true,
    totalChunks: allChunks.length,
    byDivision: stats
  });
});

/**
 * DELETE /api/kb/clear
 * Clear knowledge base (all or specific division)
 */
kbRouter.delete('/clear', (req, res) => {
  try {
    const { division } = req.body;

    clearChunks(division || null);

    res.json({
      success: true,
      message: division
        ? `Knowledge base divisi ${division} berhasil dihapus`
        : 'Seluruh knowledge base berhasil dihapus'
    });
  } catch (error) {
    console.error('Error clearing KB:', error);
    res.status(500).json({ success: false, error: 'Gagal menghapus knowledge base' });
  }
});
