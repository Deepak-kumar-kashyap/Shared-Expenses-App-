const importResolutionService = require('../services/import-resolution.service');

const resolveJob = async (req, res) => {
  try {
    const { importJobId } = req.params;
    const { rows } = req.body; // Array of resolved rows

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Payload must contain a list of resolved rows.' });
    }

    const summary = await importResolutionService.resolveAndImport(importJobId, rows);

    return res.status(200).json({
      message: 'Import job resolved and saved successfully.',
      summary
    });
  } catch (error) {
    console.error('Error resolving import job:', error);
    return res.status(500).json({ error: error.message || 'An error occurred while resolving the import job.' });
  }
};

module.exports = {
  resolveJob
};
