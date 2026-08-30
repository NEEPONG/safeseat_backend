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
      const requestId = reportData.request_id || reportData.reportindex;
      
      // Basic validation
      if (!reportData.reporttype || !requestId) {
        return res.status(400).json({ error: 'reporttype and request_id are required' });
      }

      // ตรวจสอบว่าเคยรายงานรายการนี้ไปแล้วหรือยัง (รายงานได้ครั้งเดียวต่อรายการ)
      const existing = await DriverReportModel.findExistingReportByRequestId(requestId);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'รายการจองนี้ได้รับการส่งรายงานไปแล้ว (สามารถรายงานได้เพียง 1 ครั้งต่อรายการ)'
        });
      }

      const newReport = await DriverReportModel.createReport(reportData);
      return res.status(201).json({
        success: true,
        message: 'สร้างรายงานความประพฤติคนขับเรียบร้อยแล้ว',
        data: newReport
      });
    } catch (error) {
      console.error("Error creating driver report:", error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = DriverReportController;
