const DriverReportModel = require('../../models/driver/driverReportModel');

function toThaiLocalISOString(inputDate) {
  let d = new Date();
  if (inputDate) {
    const parsed = new Date(inputDate);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }
  const pad = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');
  const thaiDate = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60 * 1000);
  const year = thaiDate.getFullYear();
  const month = pad(thaiDate.getMonth() + 1);
  const day = pad(thaiDate.getDate());
  const hours = pad(thaiDate.getHours());
  const minutes = pad(thaiDate.getMinutes());
  const seconds = pad(thaiDate.getSeconds());
  const ms = pad3(thaiDate.getMilliseconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

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

      const payload = {
        ...reportData,
        reportdate: toThaiLocalISOString(reportData.reportdate),
        reportstatus: reportData.reportstatus || 'รอดำเนินการ'
      };

      const newReport = await DriverReportModel.createReport(payload);
      return res.status(201).json(newReport);
    } catch (error) {
      console.error("Error creating driver report:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = DriverReportController;
