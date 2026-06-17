const supabase = require('./dbClient');
const { formatDriverDocs } = require('../../utils/supabaseStorage');

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
      .ilike('followerid', userId)
      .eq('teamstatus', 'pending');
    // .gt('teamdate', fiveMinutesAgo);

    if (error) throw error;
    if (data) {
      data.forEach(item => {
        if (item.sender) formatDriverDocs(item.sender);
      });
    }
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
    
    // 1. เคลียร์ buddy_team_id ในตาราง driver ให้เป็น null เพื่อปล่อยคนขับทั้งสองคนให้เป็นอิสระ
    const { error: updateError } = await supabase
      .from('driver')
      .update({ buddy_team_id: null })
      .eq('buddy_team_id', cleanId);

    if (updateError) {
      console.error("Error setting driver buddy_team_id to null:", updateError);
    }

    // 2. ลบประวัติการเดินทางในตาราง requestbyuser ที่อ้างอิงถึงทีมนี้ออก เพื่อหลีกเลี่ยง foreign key constraint
    const { error: reqError } = await supabase
      .from('requestbyuser')
      .delete()
      .eq('buddy_team_id', cleanId);

    if (reqError) {
      console.error("Error deleting requestbyuser referencing this team:", reqError);
    }

    // 3. ลบแถวข้อมูลของทีมนี้ออกจากตาราง buddyteam ในฐานข้อมูลโดยสมบูรณ์
    const { error } = await supabase
      .from('buddyteam')
      .delete()
      .eq('buddyteamid', cleanId);

    if (error) throw error;
    return { message: 'Deleted' };
  }

  // 5. ดูคู่หูปัจจุบัน
  static async getActiveBuddy(userId) {
    const { data, error } = await supabase
      .from('buddyteam')
      .select('*, leader:leaderid(username, firstname, lastname, regisimagepath), follower:followerid(username, firstname, lastname, regisimagepath)')
      .or(`leaderid.ilike.${userId},followerid.ilike.${userId}`)
      .eq('teamstatus', 'Ready')
      .order('buddyteamid', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      if (data.leader) formatDriverDocs(data.leader);
      if (data.follower) formatDriverDocs(data.follower);
    }
    return data;
  }

  // 6. รับงาน (Accept Job)
  static async acceptJob(requestId, buddyTeamId) {
    // 1. ตรวจสอบว่างานยังว่างอยู่ไหม และรับงาน
    const { data: jobData, error: jobError } = await supabase
      .from('requestbyuser')
      .update({ 
        buddy_team_id: buddyTeamId, 
        requeststatus: 'กำลังไปรับ' 
      })
      .eq('requestid', requestId)
      .eq('requeststatus', 'รอคนขับ') // การันตี Atomic Update
      .select();

    if (jobError) throw jobError;
    if (!jobData || jobData.length === 0) {
      throw new Error('งานนี้ถูกรับไปแล้วหรือหมดเวลา');
    }

    // 2. ปรับสถานะทีมเป็น Busy
    const { error: teamError } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'Busy' })
      .eq('buddyteamid', buddyTeamId);

    if (teamError) throw teamError;

    return jobData[0];
  }
}

module.exports = BuddyRequestModel;
