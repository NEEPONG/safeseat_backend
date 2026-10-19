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

      // 2. สถิติสถานบันเทิง
      const { count: pubPending } = await supabase
        .from('pub')
        .select('*', { count: 'exact', head: true })
        .or('regisstatus.eq.รอดำเนินการ,regisstatus.eq.pending');

      const { count: pubApproved } = await supabase
        .from('pub')
        .select('*', { count: 'exact', head: true })
        .or('regisstatus.eq.อนุมัติแล้ว,regisstatus.eq.approved');

      // 3. สถิติรายงานคนขับ
      const { count: driverReportPending } = await supabase
        .from('driverreport')
        .select('*', { count: 'exact', head: true })
        .eq('reportstatus', 'กำลังดำเนินการ');

      const { count: driverReportApproved } = await supabase
        .from('driverreport')
        .select('*', { count: 'exact', head: true })
        .or('reportstatus.eq.อนุมัติแล้ว,reportstatus.eq.แก้ไขแล้ว');

      // 4. สถิติรายงานลูกค้า / ผู้ใช้
      const { count: userReportPending } = await supabase
        .from('userreport')
        .select('*', { count: 'exact', head: true })
        .eq('reportstatus', 'กำลังดำเนินการ');

      const { count: userReportApproved } = await supabase
        .from('userreport')
        .select('*', { count: 'exact', head: true })
        .or('reportstatus.eq.อนุมัติแล้ว,reportstatus.eq.แก้ไขแล้ว');

      return res.status(200).json({
        success: true,
        data: {
          drivers: {
            pending: driverPending || 0,
            approved: driverApproved || 0,
            total: (driverPending || 0) + (driverApproved || 0)
          },
          pubs: {
            pending: pubPending || 0,
            approved: pubApproved || 0,
            total: (pubPending || 0) + (pubApproved || 0)
          },
          driverReports: {
            pending: driverReportPending || 0,
            total: (driverReportPending || 0) + (driverReportApproved || 0)
          },
          userReports: {
            pending: userReportPending || 0,
            total: (userReportPending || 0) + (userReportApproved || 0)
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
      const { formatDriverDocs, deleteFromSupabase } = require('../../utils/supabaseStorage');

      // ลบข้อมูลคนขับที่ถูกปฏิเสธตกค้างออกจากระบบอัตโนมัติ (Cleanup)
      const { data: rejectedDrivers } = await supabase
        .from('driver')
        .select('*, drivercar:driver_car(*)')
        .in('registerstatus', ['ปฏิเสธ', 'rejected']);

      if (rejectedDrivers && rejectedDrivers.length > 0) {
        for (const drv of rejectedDrivers) {
          const filesToDelete = [drv.regisimagepath];
          if (drv.drivercar && Array.isArray(drv.drivercar)) {
            drv.drivercar.forEach(c => filesToDelete.push(c.carimagepath));
          }
          await deleteFromSupabase(filesToDelete);
          await supabase.from('driverskill').delete().eq('driver_id', drv.username);
          await supabase.from('drivercar').delete().eq('driver_username', drv.username);
          await supabase.from('driver').delete().eq('username', drv.username);
        }
      }

      // ดึงรายชื่อคนขับพร้อมข้อมูลรถยนต์ (เฉพาะที่ยังไม่ถูกปฏิเสธ)
      const { data, error } = await supabase
        .from('driver')
        .select('*, drivercar:driver_car(*)')
        .not('registerstatus', 'in', '("ปฏิเสธ","rejected")')
        .order('regisdate', { ascending: true });

      if (error) throw error;

      let formattedData = (data || []).map(driver => formatDriverDocs(driver));

      // เรียงลำดับ: สถานะรอดำเนินการขึ้นก่อน ตามด้วยลำดับวันที่สมัครก่อน (น้อยไปมาก)
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
      const { formatPubDocs, deleteFromSupabase } = require('../../utils/supabaseStorage');

      // ลบข้อมูลสถานบันเทิงที่ถูกปฏิเสธตกค้างออกจากระบบอัตโนมัติ (Cleanup)
      const { data: rejectedPubs } = await supabase
        .from('pub')
        .select('*')
        .in('regisstatus', ['ปฏิเสธ', 'rejected']);

      if (rejectedPubs && rejectedPubs.length > 0) {
        for (const p of rejectedPubs) {
          await deleteFromSupabase([p.regisimagepath, p.pubimagepath]);
          await supabase.from('pub').delete().eq('username', p.username);
        }
      }

      // ดึงรายชื่อสถานบันเทิง
      const { data, error } = await supabase
        .from('pub')
        .select('*')
        .not('regisstatus', 'in', '("ปฏิเสธ","rejected")')
        .order('regisdate', { ascending: true });

      if (error) throw error;

      let pubsData = (data || []).map(pub => formatPubDocs(pub));

      // เรียงลำดับ: สถานะรอดำเนินการ (pending) ขึ้นก่อน ตามด้วยลำดับวันที่สมัครก่อน
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
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถานบันเทิงได้' });
    }
  }

  // PUT /api/admin/drivers/:username/status
  static async updateDriverStatus(req, res) {
    try {
      const { username } = req.params;
      const { status } = req.body; // 'อนุมัติแล้ว' หรือ 'ปฏิเสธ' หรือ 'รอดำเนินการ'

      if (!status || !['อนุมัติแล้ว', 'ปฏิเสธ', 'รอดำเนินการ', 'approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      }

      if (status === 'ปฏิเสธ' || status === 'rejected') {
        const { data: driverData } = await supabase
          .from('driver')
          .select('*, drivercar:driver_car(*)')
          .eq('username', username)
          .maybeSingle();

        if (driverData) {
          const { deleteFromSupabase } = require('../../utils/supabaseStorage');
          const filesToDelete = [driverData.regisimagepath];
          if (driverData.drivercar && Array.isArray(driverData.drivercar)) {
            driverData.drivercar.forEach(c => filesToDelete.push(c.carimagepath));
          }
          await deleteFromSupabase(filesToDelete);
          await supabase.from('driverskill').delete().eq('driver_id', username);
          await supabase.from('drivercar').delete().eq('driver_username', username);
          await supabase.from('driver').delete().eq('username', username);
        }

        return res.status(200).json({
          success: true,
          message: 'ปฏิเสธและลบข้อมูลคนขับออกจากระบบเรียบร้อยแล้ว'
        });
      }

      let thaiStatus = status;
      if (status === 'approved') thaiStatus = 'อนุมัติแล้ว';
      if (status === 'pending') thaiStatus = 'รอดำเนินการ';

      const { data, error } = await supabase
        .from('driver')
        .update({ registerstatus: thaiStatus })
        .eq('username', username)
        .select('username, registerstatus, firstname, lastname')
        .maybeSingle();

      if (error) throw error;
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
      const { status } = req.body; // 'approved', 'rejected', 'อนุมัติแล้ว', 'ปฏิเสธ'

      if (!status || !['approved', 'rejected', 'pending', 'อนุมัติแล้ว', 'ปฏิเสธ', 'รอดำเนินการ'].includes(status)) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      }

      if (status === 'ปฏิเสธ' || status === 'rejected') {
        const { data: pubData } = await supabase
          .from('pub')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (pubData) {
          const { deleteFromSupabase } = require('../../utils/supabaseStorage');
          await deleteFromSupabase([pubData.regisimagepath, pubData.pubimagepath]);
          await supabase.from('pub').delete().eq('username', username);
        }

        return res.status(200).json({
          success: true,
          message: 'ปฏิเสธและลบข้อมูลสถานบันเทิงออกจากระบบเรียบร้อยแล้ว'
        });
      }

      let thaiStatus = status;
      if (status === 'approved') thaiStatus = 'อนุมัติแล้ว';
      if (status === 'pending') thaiStatus = 'รอดำเนินการ';

      const { data, error } = await supabase
        .from('pub')
        .update({ regisstatus: thaiStatus })
        .eq('username', username)
        .select('username, regisstatus, pubname')
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'ไม่พบสถานบันเทิงนี้' });

      return res.status(200).json({
        success: true,
        message: `ปรับปรุงสถานะสถานบันเทิงเป็น ${thaiStatus} สำเร็จ`,
        data
      });
    } catch (err) {
      console.error("Admin update pub status error:", err);
      return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะสถานบันเทิงได้' });
    }
  }

  // GET /api/admin/driver-reports
  static async getDriverReports(req, res) {
    try {
      // ลบข้อมูลรายงานคนขับที่ถูกปฏิเสธออกจาก Supabase อัตโนมัติ (Cleanup)
      await supabase
        .from('driverreport')
        .delete()
        .in('reportstatus', ['ปฏิเสธ', 'ไม่อนุมัติ', 'rejected']);

      // ดึงรายงานเกี่ยวกับคนขับ (เฉพาะรายการที่ยังไม่ถูกปฏิเสธ)
      const { data, error } = await supabase
        .from('driverreport')
        .select('*')
        .not('reportstatus', 'in', '("ปฏิเสธ","ไม่อนุมัติ","rejected")')
        .order('reportdate', { ascending: true });

      if (error) throw error;

      const { getFullStorageUrl } = require('../../utils/supabaseStorage');
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

      // เรียงลำดับ: สถานะกำลังดำเนินการขึ้นก่อน ตามด้วยวันที่แจ้งรายงานก่อน
      reportsData.sort((a, b) => {
        const aPending = a.reportstatus === 'กำลังดำเนินการ' || a.reportstatus === 'รอดำเนินการ' || a.reportstatus === 'pending';
        const bPending = b.reportstatus === 'กำลังดำเนินการ' || b.reportstatus === 'รอดำเนินการ' || b.reportstatus === 'pending';
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
      // ลบข้อมูลรายงานผู้ใช้ที่ถูกปฏิเสธออกจาก Supabase อัตโนมัติ (Cleanup)
      await supabase
        .from('userreport')
        .delete()
        .in('reportstatus', ['ปฏิเสธ', 'ไม่อนุมัติ', 'rejected']);

      // ดึงรายงานเกี่ยวกับลูกค้า / ผู้ใช้ (เฉพาะรายการที่ยังไม่ถูกปฏิเสธ)
      const { data, error } = await supabase
        .from('userreport')
        .select('*')
        .not('reportstatus', 'in', '("ปฏิเสธ","ไม่อนุมัติ","rejected")')
        .order('reportdate', { ascending: true });

      if (error) throw error;

      const { getFullStorageUrl } = require('../../utils/supabaseStorage');
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

      // เรียงลำดับ: สถานะกำลังดำเนินการขึ้นก่อน ตามด้วยวันที่แจ้งรายงานก่อน
      reportsData.sort((a, b) => {
        const aPending = a.reportstatus === 'กำลังดำเนินการ' || a.reportstatus === 'รอดำเนินการ' || a.reportstatus === 'pending';
        const bPending = b.reportstatus === 'กำลังดำเนินการ' || b.reportstatus === 'รอดำเนินการ' || b.reportstatus === 'pending';
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

      if (status === 'ปฏิเสธ' || status === 'ไม่อนุมัติ' || status === 'rejected') {
        // ลบเอกสารรายงานคนขับออกจากระบบ
        const { data, error } = await supabase
          .from('driverreport')
          .delete()
          .eq('driverreportid', id)
          .select()
          .maybeSingle();

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'ปฏิเสธและลบเอกสารรายงานคนขับออกจากระบบเรียบร้อยแล้ว',
          data
        });
      }

      const { data, error } = await supabase
        .from('driverreport')
        .update({ reportstatus: status })
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
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'กรุณาระบุสถานะ' });
      }

      if (status === 'ปฏิเสธ' || status === 'ไม่อนุมัติ' || status === 'rejected') {
        // ลบเอกสารรายงานผู้ใช้ออกจากระบบ
        const { data, error } = await supabase
          .from('userreport')
          .delete()
          .eq('userreportid', id)
          .select()
          .maybeSingle();

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'ปฏิเสธและลบเอกสารรายงานผู้ใช้ออกจากระบบเรียบร้อยแล้ว',
          data
        });
      }

      const { data, error } = await supabase
        .from('userreport')
        .update({ reportstatus: status })
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
