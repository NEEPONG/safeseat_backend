const UserReportModel = require('../../models/driver/userReportModel');

class UserReportController {
  // POST /api/user-reports
  static async createReport(req, res) {
    try {
      const { reporttype, reportdetail, request_id } = req.body;

      // Basic validation
      if (!reporttype || !request_id) {
        return res.status(400).json({ error: 'reporttype and request_id are required' });
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
        request_id: parseInt(request_id),
        reportstatus: 'กำลังดำเนินการ',
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
