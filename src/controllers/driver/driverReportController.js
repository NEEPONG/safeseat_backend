const DriverReportModel = require('../../models/driver/driverReportModel');

class DriverReportController {
  // GET /api/driver-reports
  static async getReports(req, res) {
    try {
      const { username, userId } = req.query;
      let reports;

      if (userId) {
        reports = await DriverReportModel.getReportsByUser(userId);
      } else if (username) {
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

  // GET /api/driver-reports/check/:requestId
  static async checkReportStatus(req, res) {
    try {
      const { requestId } = req.params;
      if (!requestId) {
        return res.status(400).json({ error: 'requestId is required' });
      }

      const report = await DriverReportModel.getReportByRequestId(parseInt(requestId, 10));
      return res.status(200).json({
        hasReported: !!report,
        report: report || null,
      });
    } catch (error) {
      console.error("Error checking driver report status:", error);
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

      // Check if report already exists for this request_id (1 report per trip constraint)
      const existingReport = await DriverReportModel.getReportByRequestId(parseInt(reportData.request_id, 10));
      if (existingReport) {
        return res.status(409).json({ error: 'คุณได้ส่งรายงานสำหรับรายการนี้ไปแล้ว ไม่สามารถรายงานซ้ำได้' });
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
