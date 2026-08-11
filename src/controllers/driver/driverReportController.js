const DriverReportModel = require('../../models/driver/driverReportModel');

class DriverReportController {
  // GET /api/driver-reports
  static async getReports(req, res) {
    try {
      const { username } = req.query;
      let reports;
      
      if (username) {
        reports = await DriverReportModel.getReportsByDriver(username);
      } else {
        reports = await DriverReportModel.getAllReports();
      }

      return res.status(200).json(reports);
    } catch (error) {
      console.error("Error fetching driver reports:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/driver-reports
  static async createReport(req, res) {
    try {
      const reportData = req.body;
      
      // Basic validation
      if (!reportData.reporttype || !reportData.request_id) {
        return res.status(400).json({ error: 'reporttype and request_id are required' });
      }

      const newReport = await DriverReportModel.createReport(reportData);
      return res.status(201).json(newReport);
    } catch (error) {
      console.error("Error creating driver report:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = DriverReportController;
