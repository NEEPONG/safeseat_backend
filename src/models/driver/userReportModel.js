const supabase = require('./dbClient');
const { getThaiCurrentISOString } = require('../../utils/thaiDate');

class UserReportModel {
  // ตรวจสอบว่ามีรายงานของ request_id นี้แล้วหรือไม่
  static async findExistingReportByRequestId(requestId) {
    if (!requestId) return null;
    const reqIdNum = parseInt(requestId, 10);
    if (isNaN(reqIdNum)) return null;

    const { data, error } = await supabase
      .from('userreport')
      .select('*')
      .eq('request_id', reqIdNum)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing user report:', error);
    }
    return data;
  }

  // สร้างรายงานข้อร้องเรียนเกี่ยวกับลูกค้า
  static async createReport(reportData) {
    const payload = {
      ...reportData,
      reportdate: reportData.reportdate || getThaiCurrentISOString()
    };
    const { data, error } = await supabase
      .from('userreport')
      .insert([payload])
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
