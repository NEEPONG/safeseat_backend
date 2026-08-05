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

      // Populate buddyteam and drivers for each request
      if (data && data.length > 0) {
        for (const report of data) {
          const req = report.requestbyuser;
          if (req && req.buddy_team_id) {
            const { data: team } = await supabase
              .from('buddyteam')
              .select('*')
              .eq('buddyteamid', req.buddy_team_id)
              .maybeSingle();
            req.buddyteam = team;

            if (team) {
              const { data: leader } = await supabase
                .from('driver')
                .select('username, firstname, lastname, phoneno, regisimagepath')
                .eq('username', team.leaderid)
                .maybeSingle();
              const { data: follower } = await supabase
                .from('driver')
                .select('username, firstname, lastname, phoneno, regisimagepath')
                .eq('username', team.followerid)
                .maybeSingle();

              req.leader = leader;
              req.follower = follower;
            }
          }
        }
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
    const allReports = await this.getAllReports();
    if (!username) return allReports;

    // Fetch the driver's profile to get their buddy_team_id
    const UserModel = require('./userModel');
    let driverBuddyTeamId = null;
    try {
      const driver = await UserModel.getProfileByUsername(username);
      driverBuddyTeamId = driver ? driver.buddy_team_id : null;
    } catch (e) {
      console.error("Error fetching driver profile in getReportsByDriver:", e);
    }

    const u = username.toLowerCase();

    // Filter reports in-memory to be highly resilient to schema variations in 'requestbyuser'
    return allReports.filter(report => {
      // If we don't have request details, keep it in the list (or we can match on other fields)
      if (!report.requestbyuser) {
        return true; 
      }
      
      const req = report.requestbyuser;

      // Check if request belongs to the driver's buddy team
      if (driverBuddyTeamId && req.buddy_team_id === driverBuddyTeamId) {
        return true;
      }

      // Check common driver identifying fields in booking/request
      const isDriver = 
        (req.driver_username && req.driver_username.toLowerCase() === u) ||
        (req.driver_id && req.driver_id.toString().toLowerCase() === u) ||
        (req.driverid && req.driverid.toString().toLowerCase() === u) ||
        (req.username && req.username.toLowerCase() === u) ||
        (req.phoneno && req.phoneno === username);

      return isDriver;
    });
  }

  // Fetch reports submitted by a specific user (phone number)
  static async getReportsByUser(userId) {
    const allReports = await this.getAllReports();
    if (!userId) return allReports;

    return allReports.filter(report => {
      return report.requestbyuser && report.requestbyuser.user_id === userId;
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
