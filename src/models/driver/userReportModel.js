const supabase = require('./dbClient');

class UserReportModel {
  // สร้างรายงานข้อร้องเรียนเกี่ยวกับลูกค้า
  static async createReport(reportData) {
    const { data, error } = await supabase
      .from('userreport')
      .insert([reportData])
      .select()
      .maybeSingle();

    if (error) throw error;
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
