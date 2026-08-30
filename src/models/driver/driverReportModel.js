const supabase = require('./dbClient');
const { getThaiCurrentISOString } = require('../../utils/thaiDate');

class DriverReportModel {
  // Helper to enrich reports with leader and follower driver profiles from buddyteam
  static async enrichReportsWithDrivers(reports) {
    if (!reports || !reports.length) return reports;

    const teamIds = [...new Set(reports.map(r => r.requestbyuser?.buddy_team_id).filter(Boolean))];
    if (!teamIds.length) return reports;

    try {
      const { data: teams } = await supabase
        .from('buddyteam')
        .select('*, leader:leaderid(username, firstname, lastname, phoneno, regisimagepath, drivercar:driver_car(carbrand, carmodel, carplate)), follower:followerid(username, firstname, lastname, phoneno, regisimagepath, drivercar:driver_car(carbrand, carmodel, carplate))')
        .in('buddyteamid', teamIds);

      if (teams && teams.length) {
        const teamMap = new Map(teams.map(t => [t.buddyteamid, t]));
        for (const report of reports) {
          if (report.requestbyuser && report.requestbyuser.buddy_team_id) {
            const team = teamMap.get(report.requestbyuser.buddy_team_id);
            if (team) {
              report.requestbyuser.buddyteam = team;
              if (team.leader) {
                report.requestbyuser.leader = {
                  username: team.leader.username,
                  firstname: team.leader.firstname,
                  lastname: team.leader.lastname,
                  phone_no: team.leader.phoneno,
                  license_plate: team.leader.drivercar?.carplate || null,
                  driver_car: team.leader.drivercar || null,
                  regisimagepath: team.leader.regisimagepath || null,
                };
              }
              if (team.follower) {
                report.requestbyuser.follower = {
                  username: team.follower.username,
                  firstname: team.follower.firstname,
                  lastname: team.follower.lastname,
                  phone_no: team.follower.phoneno,
                  license_plate: team.follower.drivercar?.carplate || null,
                  driver_car: team.follower.drivercar || null,
                  regisimagepath: team.follower.regisimagepath || null,
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error enriching reports with driver details:", e.message);
    }
    return reports;
  }

  // ดึงข้อมูลรายงานทั้งหมด
  static async getAllReports() {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const isoDate = oneMonthAgo.toISOString();

      // พยายามดึงข้อมูลแบบ Join ตาราง
      const { data, error } = await supabase
        .from('driverreport')
        .select('*, requestbyuser(*)')
        .gte('reportdate', isoDate)
        .order('reportdate', { ascending: false });

      if (error) {
        console.warn("Join with requestbyuser failed, falling back to direct select:", error.message);
        // หาก Join ล้มเหลว ให้ดึงข้อมูลตรงจากตารางหลักโดยไม่ Join
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('driverreport')
          .select('*')
          .gte('reportdate', isoDate)
          .order('reportdate', { ascending: false });

        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return await this.enrichReportsWithDrivers(data || []);
    } catch (e) {
      console.error("Error in getAllReports:", e);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const isoDate = oneMonthAgo.toISOString();

      // กรณีเกิดข้อผิดพลาดระดับร้ายแรง ให้ดึงข้อมูลทั้งหมดกลับไปเป็นแบบสำรองสุด
      const { data, error } = await supabase
        .from('driverreport')
        .select('*')
        .gte('reportdate', isoDate)
        .order('driverreportid', { ascending: false });
      if (error) throw error;
      return data;
    }
  }

  // ดึงรายงานของคนขับแต่ละคนโดยระบุ username
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

  // ตรวจสอบว่ามีรายงานของ request_id นี้แล้วหรือไม่
  static async findExistingReportByRequestId(requestId) {
    if (!requestId) return null;
    const reqIdNum = parseInt(requestId, 10);
    if (isNaN(reqIdNum)) return null;

    const { data, error } = await supabase
      .from('driverreport')
      .select('*')
      .or(`request_id.eq.${reqIdNum},reportindex.eq.${reqIdNum}`)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing driver report:', error);
    }
    return data;
  }

  // สร้างรายงานใหม่
  static async createReport(reportData) {
    const payload = {
      ...reportData,
      reportdate: reportData.reportdate || getThaiCurrentISOString()
    };
    const { data, error } = await supabase
      .from('driverreport')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = DriverReportModel;

