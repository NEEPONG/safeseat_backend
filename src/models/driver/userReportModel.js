const supabase = require('./dbClient');

class UserReportModel {
  // สร้างรายงานข้อร้องเรียนเกี่ยวกับลูกค้า
  static async createReport(reportData) {
    // 1. ตรวจสอบและหาค่า userreportid สูงสุดที่มีอยู่ เพื่อป้องกันปัญหา ID Sequence ชน
    let payload = { ...reportData };
    try {
      const { data: latest } = await supabase
        .from('userreport')
        .select('userreportid')
        .order('userreportid', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.userreportid) {
        payload.userreportid = latest.userreportid + 1;
      } else {
        payload.userreportid = 1;
      }
    } catch (err) {
      console.warn("Could not determine max userreportid, falling back to default insert:", err);
    }

    const { data, error } = await supabase
      .from('userreport')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) {
      // Fallback: ถ้าเกิดข้อผิดพลาด ให้ลอง insert แบบปกติ (ให้ sequence จัดการ)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('userreport')
        .insert([reportData])
        .select()
        .maybeSingle();

      if (fallbackError) throw error;
      return fallbackData;
    }
    return data;
  }

  // ดึงรายงานข้อมูลข้อร้องเรียนลูกค้าทั้งหมด (ย้อนหลังไม่เกิน 1 เดือน)
  static async getAllReports() {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data, error } = await supabase
      .from('userreport')
      .select('*')
      .gte('reportdate', oneMonthAgo.toISOString())
      .order('reportdate', { ascending: false });

    if (error) throw error;
    return data;
  }
}

module.exports = UserReportModel;
