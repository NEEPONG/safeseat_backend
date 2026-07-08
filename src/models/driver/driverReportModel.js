const supabase = require('./dbClient');

class DriverReportModel {
  // Fetch all reports
  static async getAllReports() {
    try {
      // Attempt join query
      const { data, error } = await supabase
        .from('driverreport')
        .select('*, requestbyuser(*)')
        .order('reportdate', { ascending: false });

      if (error) {
        console.warn("Join with requestbyuser failed, falling back to direct select:", error.message);
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('driverreport')
          .select('*')
          .order('reportdate', { ascending: false });

        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    } catch (e) {
      console.error("Error in getAllReports:", e);
      // Absolute fallback
      const { data, error } = await supabase
        .from('driverreport')
        .select('*')
        .order('driverreportid', { ascending: false });
      if (error) throw error;
      return data;
    }
  }

  // Fetch reports for a specific driver / username
  static async getReportsByDriver(username) {
    if (!username) return [];

    const u = username.toLowerCase();

    // 1. ดึงข้อมูลทีมบัดดี้ทั้งหมดในระบบที่คนขับคนนี้เคยเข้าร่วม (ทั้ง leader และ follower)
    let teamIds = [];
    try {
      const { data: teams, error: teamsError } = await supabase
        .from('buddyteam')
        .select('buddyteamid')
        .or(`leaderid.ilike.${u},followerid.ilike.${u}`);
      
      if (!teamsError && teams) {
        teamIds = teams.map(t => t.buddyteamid);
      }
    } catch (e) {
      console.error("Error fetching historical buddy teams in getReportsByDriver:", e);
    }

    // 2. ดึงรายงานทั้งหมดพร้อม Join ตาราง requestbyuser
    const allReports = await this.getAllReports();

    // 3. กรองรายงานที่เกี่ยวข้องกับคนขับคนนี้จริงๆ
    return allReports.filter(report => {
      const req = report.requestbyuser;
      if (!req) {
        return false;
      }

      // ตรวจสอบจากประวัติทีมบัดดี้ของคนขับคนนี้ (รวมถึงทีมเก่าๆ ที่เคยอยู่ด้วย)
      if (req.buddy_team_id && teamIds.includes(req.buddy_team_id)) {
        return true;
      }

      // ตรวจสอบความเชื่อมโยงผ่าน username / driver_username ใน requestbyuser
      const isDriver = 
        (req.driver_username && req.driver_username.toLowerCase() === u) ||
        (req.driver_id && req.driver_id.toString().toLowerCase() === u) ||
        (req.driverid && req.driverid.toString().toLowerCase() === u) ||
        (req.username && req.username.toLowerCase() === u) ||
        (req.phoneno && req.phoneno === username);

      return isDriver;
    });
  }

  // Create a new report
  static async createReport(reportData) {
    const { data, error } = await supabase
      .from('driverreport')
      .insert([reportData])
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = DriverReportModel;
