const supabase = require('./dbClient');

class BuddyRequestModel {
  // 1. ส่งคำขอ (leaderid = คนส่ง, followerid = คนรับ)
  static async sendRequest(senderId, receiverId) {
    const { data, error } = await supabase
      .from('buddyteam')
      .insert([
        {
          leaderid: senderId,
          followerid: receiverId,
          teamstatus: 'pending',
          currentloclat: 0, // ใส่ค่าเริ่มต้นเนื่องจากเป็น NOT NULL
          currentloclng: 0
        }
      ])
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // 2. ดึงคำขอที่ส่งมาถึงเรา (followerid = เรา)
  static async getPendingRequests(userId) {
    // const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('buddyteam')
      .select('*, sender:leaderid(username, firstname, lastname, regisimagepath)')
      .eq('followerid', userId)
      .eq('teamstatus', 'pending');
    // .gt('teamdate', fiveMinutesAgo);

    if (error) throw error;
    return data;
  }

  // 3. ยอมรับคำขอ (เปลี่ยน teamstatus เป็น Ready)
  static async acceptRequest(requestId) {
    const cleanId = parseInt(requestId, 10) || requestId;
    
    // 1. ดึงข้อมูลทีมบัดดี้เพื่อระบุตัวผู้ส่งและผู้รับ
    const { data: team, error: getError } = await supabase
      .from('buddyteam')
      .select('*')
      .eq('buddyteamid', cleanId)
      .maybeSingle();

    if (getError) throw getError;
    if (!team) throw new Error("Buddy team request not found");

    // 2. อัปเดตสถานะทีมเป็น Ready
    const { data, error } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'Ready' })
      .eq('buddyteamid', cleanId)
      .select();

    if (error) throw error;

    // 3. อัปเดต buddy_team_id ในตาราง driver ของทั้ง leader และ follower
    const { error: leaderError } = await supabase
      .from('driver')
      .update({ buddy_team_id: cleanId })
      .eq('username', team.leaderid);

    if (leaderError) {
      console.error("Error setting leader buddy_team_id:", leaderError);
    }

    const { error: followerError } = await supabase
      .from('driver')
      .update({ buddy_team_id: cleanId })
      .eq('username', team.followerid);

    if (followerError) {
      console.error("Error setting follower buddy_team_id:", followerError);
    }

    return data;
  }

  // 4. ปฏิเสธหรือลบคำขอ
  static async removeRequest(requestId) {
    const cleanId = parseInt(requestId, 10) || requestId;
    // ก่อนที่จะลบ buddyteam ให้เคลียร์ buddy_team_id ในตาราง driver ที่อ้างอิงถึงทีมนี้ก่อน
    const { error: updateError } = await supabase
      .from('driver')
      .update({ buddy_team_id: null })
      .eq('buddy_team_id', cleanId);

    if (updateError) {
      console.error("Error setting driver buddy_team_id to null:", updateError);
    }

    // แทนที่จะลบแถวข้อมูลใน buddyteam ซึ่งจะติด NOT NULL constraint ในตารางอื่น (เช่น requestbyuser) ที่อ้างอิงอยู่
    // ให้เปลี่ยนสถานะ teamstatus เป็น 'Cancelled' แทน เพื่อตัดการเชื่อมต่อและรักษาความสัมพันธ์ข้อมูลย้อนหลัง
    const { error } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'Cancelled' })
      .eq('buddyteamid', cleanId);

    if (error) throw error;
    return { message: 'Deleted' };
  }

  // 5. ดูคู่หูปัจจุบัน
  static async getActiveBuddy(userId) {
    const cleanUserId = userId;
    const lowerUserId = userId.toLowerCase();
    const { data, error } = await supabase
      .from('buddyteam')
      .select('*, leader:leaderid(username, firstname, lastname, regisimagepath), follower:followerid(username, firstname, lastname, regisimagepath)')
      .or(`leaderid.eq.${cleanUserId},followerid.eq.${cleanUserId},leaderid.eq.${lowerUserId},followerid.eq.${lowerUserId}`)
      .eq('teamstatus', 'Ready')
      .order('buddyteamid', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = BuddyRequestModel;
