const { supabase } = require('../../config/supabase');
const bcrypt = require('bcrypt');

class AdminController {
  // POST /api/admin/login
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
      }

      // ค้นหาผู้ดูแลระบบจากตาราง admin
      const { data: admin, error } = await supabase
        .from('admin')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error || !admin) {
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

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
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
      // 1. สถิติคนขับ
      const { count: driverPending } = await supabase
        .from('driver')
        .select('*', { count: 'exact', head: true })
        .eq('registerstatus', 'รอดำเนินการ');

      const { count: driverApproved } = await supabase
        .from('driver')
        .select('*', { count: 'exact', head: true })
        .eq('registerstatus', 'อนุมัติแล้ว');

      const { count: driverRejected } = await supabase
        .from('driver')
        .select('*', { count: 'exact', head: true })
        .eq('registerstatus', 'ปฏิเสธ');

      // 2. สถิติตุ๊กร้านค้า / สถานบันเทิง
      const { count: pubPending } = await supabase
        .from('pub')
        .select('*', { count: 'exact', head: true })
        .eq('regisstatus', 'pending');

      const { count: pubApproved } = await supabase
        .from('pub')
        .select('*', { count: 'exact', head: true })
        .eq('regisstatus', 'approved');

      const { count: pubRejected } = await supabase
        .from('pub')
        .select('*', { count: 'exact', head: true })
        .eq('regisstatus', 'rejected');

      // 3. สถิติรายงานคนขับ
      const { count: driverReportAll } = await supabase
        .from('driverreport')
        .select('*', { count: 'exact', head: true });

      const { count: driverReportPending } = await supabase
        .from('driverreport')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'กำลังดำเนินการ');

      // 4. สถิติรายงานลูกค้า / ผู้ใช้
      const { count: userReportAll } = await supabase
        .from('userreport')
        .select('*', { count: 'exact', head: true });

      const { count: userReportPending } = await supabase
        .from('userreport')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'กำลังดำเนินการ');

      return res.status(200).json({
        success: true,
        data: {
          drivers: {
            pending: driverPending || 0,
            approved: driverApproved || 0,
            rejected: driverRejected || 0,
            total: (driverPending || 0) + (driverApproved || 0) + (driverRejected || 0)
          },
          pubs: {
            pending: pubPending || 0,
            approved: pubApproved || 0,
            rejected: pubRejected || 0,
            total: (pubPending || 0) + (pubApproved || 0) + (pubRejected || 0)
          },
          driverReports: {
            pending: driverReportPending || 0,
            total: driverReportAll || 0
          },
          userReports: {
            pending: userReportPending || 0,
            total: userReportAll || 0
          }
        }
      });
    } catch (err) {
      console.error("Admin stats fetch error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถิติได้' });
    }
  }

  // GET /api/admin/drivers
  static async getDrivers(req, res) {
    try {
      // ดึงรายชื่อคนขับพร้อมข้อมูลรถยนต์ (สัมพันธ์ผ่านฟิลด์ driver_car)
      const { data, error } = await supabase
        .from('driver')
        .select('*, drivercar:driver_car(*)')
        .order('regisdate', { ascending: false });

      if (error) throw error;

      const { formatDriverDocs } = require('../../utils/supabaseStorage');
      const formattedData = (data || []).map(driver => formatDriverDocs(driver));

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
      const { data, error } = await supabase
        .from('pub')
        .select('*')
        .order('regisdate', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || []
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
      const { status } = req.body; // 'อนุมัติแล้ว' หรือ 'ปฏิเสธ'

      if (!status || !['อนุมัติแล้ว', 'ปฏิเสธ', 'รอดำเนินการ'].includes(status)) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      }

      const { data, error } = await supabase
        .from('driver')
        .update({ registerstatus: status })
        .eq('username', username)
        .select('username, registerstatus, firstname, lastname')
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'ไม่พบผู้ใช้คนขับนี้' });

      return res.status(200).json({
        success: true,
        message: `ปรับปรุงสถานะคนขับเป็น ${status} สำเร็จ`,
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
      const { status } = req.body; // 'approved' หรือ 'rejected'

      if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      }

      const { data, error } = await supabase
        .from('pub')
        .update({ regisstatus: status })
        .eq('username', username)
        .select('username, regisstatus, pubname')
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'ไม่พบผู้ประกอบการร้านนี้' });

      return res.status(200).json({
        success: true,
        message: `ปรับปรุงสถานะสถานประกอบการเป็น ${status} สำเร็จ`,
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
      // ดึงรายงานความเสียหาย/ความประพฤติของคนขับ
      const { data, error } = await supabase
        .from('driverreport')
        .select('*')
        .order('reportdate', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || []
      });
    } catch (err) {
      console.error("Admin fetch driver reports error:", err);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลรายงานคนขับได้' });
    }
  }

  // GET /api/admin/user-reports
  static async getUserReports(req, res) {
    try {
      // ดึงรายงานเกี่ยวกับลูกค้า / ผู้ใช้
      const { data, error } = await supabase
        .from('userreport')
        .select('*')
        .order('reportdate', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || []
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
      const { status } = req.body; // 'กำลังดำเนินการ' หรือ 'แก้ไขแล้ว'

      if (!status) {
        return res.status(400).json({ error: 'กรุณาระบุสถานะ' });
      }

      const { data, error } = await supabase
        .from('driverreport')
        .update({ status })
        .eq('driverreportid', id)
        .select()
        .maybeSingle();

      if (error) throw error;
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
      const { status } = req.body; // 'กำลังดำเนินการ' หรือ 'แก้ไขแล้ว'

      if (!status) {
        return res.status(400).json({ error: 'กรุณาระบุสถานะ' });
      }

      const { data, error } = await supabase
        .from('userreport')
        .update({ status })
        .eq('userreportid', id)
        .select()
        .maybeSingle();

      if (error) throw error;
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
