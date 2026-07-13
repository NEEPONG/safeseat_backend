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

  // ดึงรายงานข้อมูลข้อร้องเรียนลูกค้าทั้งหมด
  static async getAllReports() {
    const { data, error } = await supabase
      .from('userreport')
      .select('*')
      .order('reportdate', { ascending: false });

    if (error) throw error;
    return data;
  }
}

module.exports = UserReportModel;
