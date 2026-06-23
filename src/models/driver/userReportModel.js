const supabase = require('./dbClient');

class UserReportModel {
  // Create a new report on a user
  static async createReport(reportData) {
    const { data, error } = await supabase
      .from('userreport')
      .insert([reportData])
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Get all user reports
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
