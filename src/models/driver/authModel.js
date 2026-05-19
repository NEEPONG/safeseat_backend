const supabase = require('./dbClient');

class AuthModel {
  static async login(username, password) {
    const { data, error } = await supabase
      .from('driver')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('registerstatus', 'อนุมัติแล้ว')
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
module.exports = AuthModel;
