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
    if (!team) throw new Error("ไม่พบคำขอทีมบัดดี้");

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

  // 4. ปฏิเสธหรือยกเลิกทีม (เปลี่ยนสถานะเป็น 'ยกเลิกทีม')
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

    // 2. อัปเดตสถานะของทีมในตาราง buddyteam เป็น 'ยกเลิกทีม' แทนการลบข้อมูล
    const { error } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'ยกเลิกทีม' })
      .eq('buddyteamid', cleanId);

    if (error) throw error;
    return { message: 'ยกเลิกทีมแล้ว' };
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
    
    // ลองหาในตารางหลักก่อน หากไม่พบจึงไปหาในตารางรอง
    const primaryTable = isPubJob ? 'requestbypub' : 'requestbyuser';
    const secondaryTable = isPubJob ? 'requestbyuser' : 'requestbypub';

    const validStatuses = ['รอคนขับ', 'กำลังค้นหาคนขับ', 'pending', 'waiting'];

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
      .in('requeststatus', validStatuses)
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
        .in('requeststatus', validStatuses)
        .select();

      if (secondaryError) {
        jobError = secondaryError;
      } else if (secondaryData && secondaryData.length > 0) {
        jobData = secondaryData;
      }
    }

    // 3. Fallback: หากยังไม่พบ อาจเกิดจาก status อื่นๆ ที่ยังไม่เสร็จสิ้น
    if (!jobData || jobData.length === 0) {
      for (const table of [primaryTable, secondaryTable]) {
        const { data: fallbackData } = await supabase
          .from(table)
          .update({ 
            buddy_team_id: cleanBuddyTeamId, 
            requeststatus: 'กำลังไปรับ' 
          })
          .eq('requestid', cleanRequestId)
          .is('buddy_team_id', null)
          .select();
          
        if (fallbackData && fallbackData.length > 0) {
          jobData = fallbackData;
          break;
        }
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

    // 1. ดึงรายละเอียดของงานเพื่อตรวจสอบข้อมูลและดูราคาค่าบริการ
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

    // หากงานเสร็จสิ้นไปแล้ว ให้ส่งข้อมูลกลับทันทีเพื่อป้องกันการโอนเงินซ้ำซ้อน
    if (requestData.requeststatus === 'completed' || requestData.requeststatus === 'เสร็จสิ้น') {
      return { message: 'งานนี้เสร็จสิ้นไปแล้ว', request: requestData };
    }

    // 2. อัปเดตสถานะของงานเป็น 'เสร็จสิ้น' และบันทึกรูปหลักฐาน
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

    // 3. ปรับสถานะของทีมบัดดี้กลับเป็น 'Ready' (ว่างพร้อมรับงาน)
    const { error: teamError } = await supabase
      .from('buddyteam')
      .update({ teamstatus: 'Ready' })
      .eq('buddyteamid', cleanBuddyTeamId);

    if (teamError) {
      console.error("Error setting buddy team to Ready:", teamError);
    }

    // 4. แบ่งค่าบริการ: ระบบ SafeSeat หัก 20%, คนขับแต่ละคนได้คนละ 40%
    const requestFee = parseFloat(requestData.requestfee || 0);
    const driverShare = parseFloat((requestFee * 0.40).toFixed(2));

    if (driverShare > 0) {
      // 4.1 หากเป็นรายการจากสถานบันเทิง (requestbypub) และชำระด้วย SafeSeat Wallet (2) ให้หักเงินจากกระเป๋าผู้ใช้เมื่อจบงาน
      const paymentMethodInt = parseInt(requestData.paymentmethod, 10);
      if (paymentMethodInt === 2 && requestData.user_id && tableUsed === 'requestbypub') {
        try {
          const { data: userInfo, error: userGetErr } = await supabase
            .from('User')
            .select('walletbalance')
            .eq('phoneno', requestData.user_id)
            .maybeSingle();

          if (!userGetErr && userInfo) {
            const userBal = parseFloat(userInfo.walletbalance || 0);
            const userNewBal = Math.max(0, parseFloat((userBal - requestFee).toFixed(2)));
            await supabase
              .from('User')
              .update({ walletbalance: userNewBal })
              .eq('phoneno', requestData.user_id);
            console.log(`Deducted ${requestFee} from user ${requestData.user_id} wallet. New balance: ${userNewBal}`);
          }
        } catch (uErr) {
          console.error(`Failed to deduct user wallet for user ${requestData.user_id}:`, uErr);
        }
      }

      // 4.2 ค้นหาสมาชิกในทีม (หัวหน้าทีมและผู้ติดตาม) เพื่อแบ่งจ่ายค่าบริการ
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
            // ตรวจสอบยอดเงินในกระเป๋าเงินคนขับปัจจุบัน
            const { data: driverInfo, error: driverGetErr } = await supabase
              .from('driver')
              .select('walletbalance')
              .eq('username', driverUsername)
              .maybeSingle();

            if (driverGetErr) throw driverGetErr;

            const currentBalance = parseFloat(driverInfo?.walletbalance || 0);
            const newBalance = parseFloat((currentBalance + driverShare).toFixed(2));

            // อัปเดตยอดเงินในกระเป๋าเงินของคนขับ
            const { error: driverUpdateErr } = await supabase
              .from('driver')
              .update({ walletbalance: newBalance })
              .eq('username', driverUsername);

            if (driverUpdateErr) throw driverUpdateErr;

            // บันทึกประวัติการทำรายการเงินเข้า (Transaction)
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

  // 8. ดึงรายชื่อบัดดี้ที่เคยร่วมงานกันล่าสุด (Recent Buddies)
  static async getRecentBuddies(userId) {
    const { data, error } = await supabase
      .from('buddyteam')
      .select('*, leader:leaderid(username, firstname, lastname, regisimagepath, phoneno), follower:followerid(username, firstname, lastname, regisimagepath, phoneno)')
      .or(`leaderid.ilike.${userId},followerid.ilike.${userId}`)
      .order('buddyteamid', { ascending: false })
      .limit(30);

    if (error) throw error;
    if (!data) return [];

    const seenUsernames = new Set();
    const recentBuddies = [];

    for (const team of data) {
      let partner = null;
      if (team.leaderid && team.leaderid.toLowerCase() === userId.toLowerCase()) {
        partner = team.follower;
      } else if (team.followerid && team.followerid.toLowerCase() === userId.toLowerCase()) {
        partner = team.leader;
      }

      if (partner && partner.username) {
        const pUser = partner.username.toLowerCase();
        if (!seenUsernames.has(pUser)) {
          seenUsernames.add(pUser);
          formatDriverDocs(partner);
          recentBuddies.push({
            ...partner,
            lastTeamId: team.buddyteamid,
            teamstatus: team.teamstatus,
          });
        }
      }
    }

    return recentBuddies;
  }
}

module.exports = BuddyRequestModel;
