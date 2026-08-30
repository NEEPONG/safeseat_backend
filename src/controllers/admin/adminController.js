const AdminModel = require('../../models/admin/adminModel');
const bcrypt = require('bcrypt');
const { generateToken } = require('../../middlewares/authMiddleware');
const { formatDriverDocs, getFullStorageUrl } = require('../../utils/supabaseStorage');

class AdminController {
  // POST /api/admin/login
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
      }

      // ค้นหาผู้ดูแลระบบจากตาราง admin ผ่าน AdminModel
      const admin = await AdminModel.findAdminByUsername(username);

      if (!admin) {
        return res.status(401).json({ error: 'ไม่พบข้อมูลผู้ดูแลระบบในระบบ' });
      }

      // ตรวจสอบรหัสผ่าน (เปรียบเทียบทั้งแบบ Plain text ดั้งเดิมใน Supabase และแบบ bcrypt hash)
      const isMatch = (password === admin.password) || await bcrypt.compare(password, admin.password);
      
      if (!isMatch) {
        return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
      }

      // ป้องกันการส่งรหัสผ่านกลับไป
      const adminData = { ...admin };
      delete adminData.password;

      const token = generateToken({
        id: adminData.adminid || adminData.id,
        username: adminData.username,
        role: 'admin'
      });

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        token,
        data: adminData
      });
    } catch (err) {
      console.error("Admin login error:", err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
  }

  // GET /api/admin/stats
  static async getStats(req, res) {
    try {
      const statsData = await AdminModel.getStats();
      return res.status(200).json({
        success: true,
        data: statsData
      });
    } catch (err) {
      console.error("Admin stats fetch error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถิติได้' });
    }
  }

  // GET /api/admin/drivers
  static async getDrivers(req, res) {
    try {
      const data = await AdminModel.getAllDrivers();
      let formattedData = (data || []).map(driver => formatDriverDocs(driver));

      // เรียงลำดับ: สถานะรอดำเนินการขึ้นก่อน ตามด้วยลำดับวันที่สมัครก่อน
      formattedData.sort((a, b) => {
        const aPending = a.registerstatus === 'รอดำเนินการ' || a.registerstatus === 'pending';
        const bPending = b.registerstatus === 'รอดำเนินการ' || b.registerstatus === 'pending';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        const dateA = a.regisdate ? new Date(a.regisdate).getTime() : 0;
        const dateB = b.regisdate ? new Date(b.regisdate).getTime() : 0;
        return dateA - dateB;
      });

      return res.status(200).json({
        success: true,
        data: formattedData
      });
    } catch (err) {
      console.error("Admin fetch drivers error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคนขับรถได้' });
    }
  }

  // GET /api/admin/pubs
  static async getPubs(req, res) {
    try {
      const data = await AdminModel.getAllPubs();
      let pubsData = (data || []).map(pub => {
        let licenseUrl = null;
        let storefrontUrl = null;

        if (pub.regisimagepath) {
          try {
            const parsed = JSON.parse(pub.regisimagepath);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              licenseUrl = parsed.license ? getFullStorageUrl(parsed.license) : null;
              storefrontUrl = parsed.storefront ? getFullStorageUrl(parsed.storefront) : null;
            } else {
              licenseUrl = getFullStorageUrl(pub.regisimagepath);
            }
          } catch {
            licenseUrl = getFullStorageUrl(pub.regisimagepath);
          }
        }

        return {
          ...pub,
          regisimagepath: licenseUrl,
          pubimagepath: storefrontUrl,
        };
      });

      // เรียงลำดับ: สถานะรอดำเนินการขึ้นก่อน ตามด้วยลำดับวันที่สมัครก่อน
      pubsData.sort((a, b) => {
        const aPending = a.regisstatus === 'pending' || a.regisstatus === 'รอดำเนินการ';
        const bPending = b.regisstatus === 'pending' || b.regisstatus === 'รอดำเนินการ';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        const dateA = a.regisdate ? new Date(a.regisdate).getTime() : 0;
        const dateB = b.regisdate ? new Date(b.regisdate).getTime() : 0;
        return dateA - dateB;
      });

      return res.status(200).json({
        success: true,
        data: pubsData
      });
    } catch (err) {
      console.error("Admin fetch pubs error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถานประกอบการได้' });
    }
  }

  // PUT /api/admin/drivers/:username/status
  static async updateDriverStatus(req, res) {
    try {
      const { username } = req.params;
      const { status } = req.body;

      if (!status || !['อนุมัติแล้ว', 'ปฏิเสธ', 'รอดำเนินการ', 'approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      }

      let thaiStatus = status;
      if (status === 'approved') thaiStatus = 'อนุมัติแล้ว';
      if (status === 'rejected') thaiStatus = 'ปฏิเสธ';
      if (status === 'pending') thaiStatus = 'รอดำเนินการ';

      const data = await AdminModel.updateDriverStatus(username, thaiStatus);
      if (!data) return res.status(404).json({ error: 'ไม่พบผู้ใช้คนขับนี้' });

      return res.status(200).json({
        success: true,
        message: `ปรับปรุงสถานะคนขับเป็น ${thaiStatus} สำเร็จ`,
        data
      });
    } catch (err) {
      console.error("Admin update driver status error:", err);
      return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะคนขับรถได้' });
    }
  }

  // PUT /api/admin/pubs/:username/status
  static async updatePubStatus(req, res) {
    try {
      const { username } = req.params;
      const { status } = req.body;

      if (!status || !['approved', 'rejected', 'pending', 'อนุมัติแล้ว', 'ปฏิเสธ', 'รอดำเนินการ'].includes(status)) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      }

      let thaiStatus = status;
      if (status === 'approved') thaiStatus = 'อนุมัติแล้ว';
      if (status === 'rejected') thaiStatus = 'ปฏิเสธ';
      if (status === 'pending') thaiStatus = 'รอดำเนินการ';

      const data = await AdminModel.updatePubStatus(username, thaiStatus);
      if (!data) return res.status(404).json({ error: 'ไม่พบผู้ประกอบการสถานบันเทิงนี้' });

      return res.status(200).json({
        success: true,
        message: `ปรับปรุงสถานะสถานประกอบการเป็น ${thaiStatus} สำเร็จ`,
        data
      });
    } catch (err) {
      console.error("Admin update pub status error:", err);
      return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะสถานประกอบการได้' });
    }
  }

  // GET /api/admin/driver-reports
  static async getDriverReports(req, res) {
    try {
      const data = await AdminModel.getAllDriverReports();
      let reportsData = (data || []).map(report => {
        let imageArray = [];
        if (report.reportimagepath) {
          const rawPaths = String(report.reportimagepath).split(',').map(s => s.trim()).filter(Boolean);
          imageArray = rawPaths.map(p => getFullStorageUrl(p));
        }
        return {
          ...report,
          reportimages: imageArray,
          reportimagepath: imageArray[0] || null
        };
      });

      // เรียงลำดับ: สถานะรอพิจารณาขึ้นก่อน ตามด้วยวันที่แจ้งรายงานก่อน
      reportsData.sort((a, b) => {
        const aPending = a.reportstatus === 'รอพิจารณา' || a.reportstatus === 'กำลังดำเนินการ' || a.reportstatus === 'รอดำเนินการ' || a.reportstatus === 'pending';
        const bPending = b.reportstatus === 'รอพิจารณา' || b.reportstatus === 'กำลังดำเนินการ' || b.reportstatus === 'รอดำเนินการ' || b.reportstatus === 'pending';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        const dateA = a.reportdate ? new Date(a.reportdate).getTime() : 0;
        const dateB = b.reportdate ? new Date(b.reportdate).getTime() : 0;
        return dateA - dateB;
      });

      return res.status(200).json({
        success: true,
        data: reportsData
      });
    } catch (err) {
      console.error("Admin fetch driver reports error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลรายงานคนขับได้' });
    }
  }

  // GET /api/admin/user-reports
  static async getUserReports(req, res) {
    try {
      const data = await AdminModel.getAllUserReports();
      let reportsData = (data || []).map(report => {
        let imageArray = [];
        if (report.reportimagepath) {
          const rawPaths = String(report.reportimagepath).split(',').map(s => s.trim()).filter(Boolean);
          imageArray = rawPaths.map(p => getFullStorageUrl(p));
        }
        return {
          ...report,
          reportimages: imageArray,
          reportimagepath: imageArray[0] || null
        };
      });

      // เรียงลำดับ: สถานะรอพิจารณาขึ้นก่อน ตามด้วยวันที่แจ้งรายงานก่อน
      reportsData.sort((a, b) => {
        const aPending = a.reportstatus === 'รอพิจารณา' || a.reportstatus === 'กำลังดำเนินการ' || a.reportstatus === 'รอดำเนินการ' || a.reportstatus === 'pending';
        const bPending = b.reportstatus === 'รอพิจารณา' || b.reportstatus === 'กำลังดำเนินการ' || b.reportstatus === 'รอดำเนินการ' || b.reportstatus === 'pending';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        const dateA = a.reportdate ? new Date(a.reportdate).getTime() : 0;
        const dateB = b.reportdate ? new Date(b.reportdate).getTime() : 0;
        return dateA - dateB;
      });

      return res.status(200).json({
        success: true,
        data: reportsData
      });
    } catch (err) {
      console.error("Admin fetch user reports error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลรายงานผู้ใช้ได้' });
    }
  }

  // PUT /api/admin/driver-reports/:id/status
  static async updateDriverReportStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'กรุณาระบุสถานะ' });
      }

      const data = await AdminModel.updateDriverReportStatus(id, status);
      if (!data) return res.status(404).json({ error: 'ไม่พบเอกสารรายงานนี้' });

      return res.status(200).json({
        success: true,
        message: 'อัปเดตสถานะการแจ้งรายงานสำเร็จ',
        data
      });
    } catch (err) {
      console.error("Admin update driver report error:", err);
      return res.status(500).json({ error: 'ไม่สามารถปรับปรุงสถานะการแจ้งรายงานได้' });
    }
  }

  // PUT /api/admin/user-reports/:id/status
  static async updateUserReportStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'กรุณาระบุสถานะ' });
      }

      const data = await AdminModel.updateUserReportStatus(id, status);
      if (!data) return res.status(404).json({ error: 'ไม่พบเอกสารรายงานนี้' });

      return res.status(200).json({
        success: true,
        message: 'อัปเดตสถานะการแจ้งรายงานสำเร็จ',
        data
      });
    } catch (err) {
      console.error("Admin update user report error:", err);
      return res.status(500).json({ error: 'ไม่สามารถปรับปรุงสถานะการแจ้งรายงานได้' });
    }
  }
}

module.exports = AdminController;
