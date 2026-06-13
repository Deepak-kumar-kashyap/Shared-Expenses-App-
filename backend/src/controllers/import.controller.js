const importService = require('../services/import.service');
const prisma = require('../services/db');

const uploadCSV = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a CSV file.' });
    }

    const csvContentString = req.file.buffer.toString('utf8');

    // Run parser & anomaly validation
    const report = await importService.processCSVImport(groupId, csvContentString);

    return res.status(200).json({
      message: 'CSV file processed. Anomalies detected requiring review.',
      report
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    return res.status(500).json({ error: error.message || 'An error occurred during CSV import.' });
  }
};

const getJobAnomalies = async (req, res) => {
  try {
    const { importJobId } = req.params;

    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
      include: {
        anomalies: {
          orderBy: { rowIndex: 'asc' }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Import job not found.' });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    return res.status(500).json({ error: 'An error occurred while fetching anomalies.' });
  }
};

module.exports = {
  uploadCSV,
  getJobAnomalies
};
