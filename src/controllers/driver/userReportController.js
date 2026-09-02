const UserReportModel = require('../../models/driver/userReportModel');

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

class UserReportController {
  // POST /api/user-reports
  static async createReport(req, res) {
    try {
      const { reporttype, reportdetail, request_id } = req.body;

      const cleanRequestId = parseInt(request_id, 10);
      // Basic validation
      if (!reporttype || !request_id || isNaN(cleanRequestId)) {
        return res.status(400).json({ error: 'reporttype and valid request_id are required' });
      }

      let reportimagepath = null;
      if (req.file) {
        try {
          const { uploadToSupabase, getRelativePath } = require('../../utils/supabaseStorage');
          const uploaded = await uploadToSupabase(req.file, 'images', 'reports/user');
          reportimagepath = getRelativePath(uploaded);
        } catch (uploadError) {
          console.error("Error uploading report image:", uploadError);
        }
      }

      const reportData = {
        reporttype,
        reportdetail: reportdetail || '',
        request_id: cleanRequestId,
        reportstatus: 'กำลังดำเนินการ',
        reportdate: toThaiLocalISOString(req.body.reportdate),
      };

      if (reportimagepath) {
        reportData.reportimagepath = reportimagepath;
      }

      const newReport = await UserReportModel.createReport(reportData);
      return res.status(201).json({
        success: true,
        message: 'สร้างรายงานผู้ใช้เรียบร้อยแล้ว',
        data: newReport
      });
    } catch (error) {
      console.error("Error creating user report:", error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // GET /api/user-reports
  static async getReports(req, res) {
    try {
      const reports = await UserReportModel.getAllReports();
      return res.status(200).json(reports);
    } catch (error) {
      console.error("Error fetching user reports:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UserReportController;
