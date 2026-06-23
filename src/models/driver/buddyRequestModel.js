const supabase = require('./dbClient');
const { formatDriverDocs } = require('../../utils/supabaseStorage');

class BuddyRequestModel {
  // 1. ส่งคำขอ (leaderid = คนส่ง, followerid = คนรับ)
  static async sendRequest(senderId, receiverId, lat = 0, lng = 0) {
    const { data, error } = await supabase
      .from('buddyteam')
      .insert([
        {
          leaderid: senderId,
          followerid: receiverId,
          teamstatus: 'pending',
          currentloclat: lat, // ใช้ค่าพิกัดที่ส่งมา
          currentloclng: lng
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

    // 2. ลบประวัติการเดินทางในตาราง requestbyuser และ requestbypub ที่อ้างอิงถึงทีมนี้ออก เพื่อหลีกเลี่ยง foreign key constraint
    const { error: reqError } = await supabase
      .from('requestbyuser')
      .delete()
      .eq('buddy_team_id', cleanId);

    if (reqError) {
      console.error("Error deleting requestbyuser referencing this team:", reqError);
    }

    const { error: pubReqError } = await supabase
      .from('requestbypub')
      .delete()
      .eq('buddy_team_id', cleanId);

    if (pubReqError) {
      console.error("Error deleting requestbypub referencing this team:", pubReqError);
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
  static async acceptJob(requestId, buddyTeamId, isPubJob = false) {
    const cleanRequestId = parseInt(requestId, 10);
    const cleanBuddyTeamId = parseInt(buddyTeamId, 10);
    
    // Try primary table first, and fallback to secondary if not found
    const primaryTable = isPubJob ? 'requestbypub' : 'requestbyuser';
    const secondaryTable = isPubJob ? 'requestbyuser' : 'requestbypub';

    const primaryStatus = isPubJob ? 'รอคนขับ' : 'กำลังค้นหาคนขับ';
    const secondaryStatus = isPubJob ? 'กำลังค้นหาคนขับ' : 'รอคนขับ';

    let jobData = null;
    let jobError = null;

    // 1. ตรวจสอบในตารางหลัก
    const { data: primaryData, error: primaryError } = await supabase
      .from(primaryTable)
      .update({ 
        buddy_team_id: cleanBuddyTeamId, 
        requeststatus: 'กำลังไปรับ' 
      })
      .eq('requestid', cleanRequestId)
      .eq('requeststatus', primaryStatus) // การันตี Atomic Update
      .select();

    if (primaryError) {
      jobError = primaryError;
    } else if (primaryData && primaryData.length > 0) {
      jobData = primaryData;
    }

    // 2. ถ้าไม่พบในตารางหลัก ลองหาในตารางรอง
    if (!jobData || jobData.length === 0) {
      const { data: secondaryData, error: secondaryError } = await supabase
        .from(secondaryTable)
        .update({ 
          buddy_team_id: cleanBuddyTeamId, 
          requeststatus: 'กำลังไปรับ' 
        })
        .eq('requestid', cleanRequestId)
        .eq('requeststatus', secondaryStatus) // การันตี Atomic Update
        .select();

      if (secondaryError) {
        jobError = secondaryError;
      } else if (secondaryData && secondaryData.length > 0) {
        jobData = secondaryData;
      }
    }

    if (jobError && (!jobData || jobData.length === 0)) throw jobError;

    if (!jobData || jobData.length === 0) {
      throw new Error('งานนี้ถูกรับไปแล้วหรือหมดเวลา');
    }

    // 3. ปรับสถานะทีมเป็น Busy
    const { error: teamError } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'Busy' })
      .eq('buddyteamid', cleanBuddyTeamId);

    if (teamError) throw teamError;

    return jobData[0];
  }

  // 7. เสร็จสิ้นการเดินทางและแบ่งเงินค่าบริการ (Complete Job & Split Fee)
  static async completeJob(requestId, buddyTeamId, isPubJob = false, evidenceImagePath = null) {
    const cleanRequestId = parseInt(requestId, 10);
    const cleanBuddyTeamId = parseInt(buddyTeamId, 10);

    const primaryTable = isPubJob ? 'requestbypub' : 'requestbyuser';
    const secondaryTable = isPubJob ? 'requestbyuser' : 'requestbypub';

    // 1. Fetch request details to get the fee and verify
    let requestData = null;
    let requestError = null;
    let tableUsed = primaryTable;

    const { data: primaryReq, error: primaryErr } = await supabase
      .from(primaryTable)
      .select('*')
      .eq('requestid', cleanRequestId)
      .maybeSingle();

    if (primaryErr) {
      requestError = primaryErr;
    } else if (primaryReq) {
      requestData = primaryReq;
      tableUsed = primaryTable;
    }

    if (!requestData) {
      const { data: secondaryReq, error: secondaryErr } = await supabase
        .from(secondaryTable)
        .select('*')
        .eq('requestid', cleanRequestId)
        .maybeSingle();

      if (secondaryErr) {
        requestError = secondaryErr;
      } else if (secondaryReq) {
        requestData = secondaryReq;
        tableUsed = secondaryTable;
      }
    }

    if (requestError && !requestData) throw requestError;
    if (!requestData) throw new Error('ไม่พบข้อมูลการเรียกรถ');

    // If already completed, return early to prevent duplicate crediting
    if (requestData.requeststatus === 'completed' || requestData.requeststatus === 'เสร็จสิ้น') {
      return { message: 'งานนี้เสร็จสิ้นไปแล้ว', request: requestData };
    }

    // 2. Update request status to 'เสร็จสิ้น' and evidence picture path
    const updatePayload = { requeststatus: 'เสร็จสิ้น' };
    if (evidenceImagePath) {
      updatePayload.finishjobpicpath = evidenceImagePath;
    }

    const { data: updatedReq, error: updateReqErr } = await supabase
      .from(tableUsed)
      .update(updatePayload)
      .eq('requestid', cleanRequestId)
      .select()
      .maybeSingle();

    if (updateReqErr) throw updateReqErr;

    // 3. Update buddy team status to 'Ready'
    const { error: teamError } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'Ready' })
      .eq('buddyteamid', cleanBuddyTeamId);

    if (teamError) {
      console.error("Error setting buddy team to Ready:", teamError);
    }

    // 4. Split fee: SafeSeat takes 20%, each driver gets 40%
    const requestFee = parseFloat(requestData.requestfee || 0);
    const driverShare = parseFloat((requestFee * 0.40).toFixed(2));

    if (driverShare > 0) {
      // Get the team members (leader and follower)
      const { data: team, error: teamGetError } = await supabase
        .from('buddyteam')
        .select('leaderid, followerid')
        .eq('buddyteamid', cleanBuddyTeamId)
        .maybeSingle();

      if (teamGetError) {
        console.error("Error fetching team drivers:", teamGetError);
      } else if (team) {
        const drivers = [team.leaderid, team.followerid].filter(Boolean);

        for (const driverUsername of drivers) {
          try {
            // Get current wallet balance
            const { data: driverInfo, error: driverGetErr } = await supabase
              .from('driver')
              .select('walletbalance')
              .eq('username', driverUsername)
              .maybeSingle();

            if (driverGetErr) throw driverGetErr;

            const currentBalance = parseFloat(driverInfo?.walletbalance || 0);
            const newBalance = parseFloat((currentBalance + driverShare).toFixed(2));

            // Update driver wallet balance
            const { error: driverUpdateErr } = await supabase
              .from('driver')
              .update({ walletbalance: newBalance })
              .eq('username', driverUsername);

            if (driverUpdateErr) throw driverUpdateErr;

            // Insert transaction record
            const { error: txError } = await supabase
              .from('driverwallettransaction')
              .insert({
                driver_id: driverUsername,
                amount: driverShare,
                trantype: 'service fee',
                transtatus: 'Success'
              });

            if (txError) throw txError;

            console.log(`Successfully credited ${driverShare} to driver ${driverUsername}. New balance: ${newBalance}`);
          } catch (err) {
            console.error(`Failed to credit wallet for driver ${driverUsername}:`, err);
          }
        }
      }
    }

    return { message: 'เสร็จสิ้นงานและจ่ายค่าบริการเรียบร้อย', request: updatedReq };
  }
}

module.exports = BuddyRequestModel;
