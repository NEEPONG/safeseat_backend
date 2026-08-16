const { supabase } = require('../../config/supabase');

class AdminModel {
  /**
   * ค้นหาผู้ดูแลระบบจากชื่อผู้ใช้ (username)
   */
  static async findAdminByUsername(username) {
    const { data, error } = await supabase
      .from('admin')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * รวบรวมสถิติจำนวนคนขับ ร้านค้า รายงานคนขับ และรายงานผู้ใช้งาน
   */
  static async getStats() {
    const [
      { count: driverPending },
      { count: driverApproved },
      { count: driverRejected },
      { count: pubPending },
      { count: pubApproved },
      { count: pubRejected },
      { count: driverReportPending },
      { count: driverReportApproved },
      { count: userReportPending },
      { count: userReportApproved }
    ] = await Promise.all([
      supabase.from('driver').select('*', { count: 'exact', head: true }).or('registerstatus.eq.รอพิจารณา,registerstatus.eq.รอดำเนินการ,registerstatus.eq.pending'),
      supabase.from('driver').select('*', { count: 'exact', head: true }).eq('registerstatus', 'อนุมัติแล้ว'),
      supabase.from('driver').select('*', { count: 'exact', head: true }).eq('registerstatus', 'ปฏิเสธ'),
      supabase.from('pub').select('*', { count: 'exact', head: true }).or('regisstatus.eq.รอพิจารณา,regisstatus.eq.รอดำเนินการ,regisstatus.eq.pending'),
      supabase.from('pub').select('*', { count: 'exact', head: true }).or('regisstatus.eq.อนุมัติแล้ว,regisstatus.eq.approved'),
      supabase.from('pub').select('*', { count: 'exact', head: true }).or('regisstatus.eq.ปฏิเสธ,regisstatus.eq.rejected'),
      supabase.from('driverreport').select('*', { count: 'exact', head: true }).or('reportstatus.eq.รอพิจารณา,reportstatus.eq.กำลังดำเนินการ,reportstatus.eq.รอดำเนินการ,reportstatus.eq.pending'),
      supabase.from('driverreport').select('*', { count: 'exact', head: true }).or('reportstatus.eq.อนุมัติแล้ว,reportstatus.eq.แก้ไขแล้ว'),
      supabase.from('userreport').select('*', { count: 'exact', head: true }).or('reportstatus.eq.รอพิจารณา,reportstatus.eq.กำลังดำเนินการ,reportstatus.eq.รอดำเนินการ,reportstatus.eq.pending'),
      supabase.from('userreport').select('*', { count: 'exact', head: true }).or('reportstatus.eq.อนุมัติแล้ว,reportstatus.eq.แก้ไขแล้ว')
    ]);

    return {
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
        total: (driverReportPending || 0) + (driverReportApproved || 0)
      },
      userReports: {
        pending: userReportPending || 0,
        total: (userReportPending || 0) + (userReportApproved || 0)
      }
    };
  }

  /**
   * ดึงรายชื่อคนขับทั้งหมดพร้อมข้อมูลรถยนต์
   */
  static async getAllDrivers() {
    const { data, error } = await supabase
      .from('driver')
      .select('*, drivercar:driver_car(*)')
      .order('regisdate', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * ดึงรายชื่อสถานประกอบการทั้งหมด
   */
  static async getAllPubs() {
    const { data, error } = await supabase
      .from('pub')
      .select('*')
      .order('regisdate', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * อัปเดตสถานะการอนุมัติคนขับ
   */
  static async updateDriverStatus(username, thaiStatus) {
    const { data, error } = await supabase
      .from('driver')
      .update({ registerstatus: thaiStatus })
      .eq('username', username)
      .select('username, registerstatus, firstname, lastname')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * อัปเดตสถานะการอนุมัติสถานประกอบการ
   */
  static async updatePubStatus(username, thaiStatus) {
    const { data, error } = await supabase
      .from('pub')
      .update({ regisstatus: thaiStatus })
      .eq('username', username)
      .select('username, regisstatus, pubname')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * ดึงประวัติรายงานความประพฤติคนขับทั้งหมด
   */
  static async getAllDriverReports() {
    const { data, error } = await supabase
      .from('driverreport')
      .select('*')
      .order('reportdate', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * ดึงประวัติรายงานความประพฤติผู้ใช้บริการทั้งหมด
   */
  static async getAllUserReports() {
    const { data, error } = await supabase
      .from('userreport')
      .select('*')
      .order('reportdate', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * ลบรายงานคนขับออกจากระบบ
   */
  static async deleteDriverReport(id) {
    const { data, error } = await supabase
      .from('driverreport')
      .delete()
      .eq('driverreportid', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * อัปเดตสถานะรายงานคนขับ
   */
  static async updateDriverReportStatus(id, status) {
    const { data, error } = await supabase
      .from('driverreport')
      .update({ reportstatus: status })
      .eq('driverreportid', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * ลบรายงานผู้ใช้ออกจากระบบ
   */
  static async deleteUserReport(id) {
    const { data, error } = await supabase
      .from('userreport')
      .delete()
      .eq('userreportid', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * อัปเดตสถานะรายงานผู้ใช้
   */
  static async updateUserReportStatus(id, status) {
    const { data, error } = await supabase
      .from('userreport')
      .update({ reportstatus: status })
      .eq('userreportid', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = AdminModel;
