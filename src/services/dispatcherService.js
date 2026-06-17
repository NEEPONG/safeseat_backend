const supabase = require('../models/driver/dbClient');

// ฟังก์ชันคำนวณระยะทาง Haversine (หน่วย: กิโลเมตร)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // รัศมีโลกเป็นกิโลเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

class DispatcherService {
  static start() {
    console.log('[Dispatcher] 🟢 เริ่มต้นระบบดักจับงานจากผู้ใช้...');

    // ดักฟังตาราง requestbyuser เมื่อมีข้อมูลใหม่ถูก Insert
    supabase
      .channel('public:requestbyuser')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requestbyuser' }, async (payload) => {
        const newJob = payload.new;
        
        if (newJob.requeststatus === 'pending') {
          console.log(`[Dispatcher] 🔔 พบงานใหม่! Request ID: ${newJob.requestid}`);
          await DispatcherService.dispatchJob(newJob);
        }
      })
      .subscribe();
  }

  static async dispatchJob(job) {
    try {
      // 1. ดึงทีมคนขับที่กำลังว่าง (Ready) ทั้งหมด
      const { data: teams, error } = await supabase
        .from('buddyteam')
        .select('*')
        .eq('teamstatus', 'Ready');

      if (error) throw error;

      if (!teams || teams.length === 0) {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับที่ว่างในขณะนี้ (Request ID: ${job.requestid})`);
        return;
      }

      // 2. คำนวณระยะทางและหาทีมที่ใกล้ที่สุด (ในรัศมี 5km)
      let nearestTeam = null;
      let minDistance = 5; // ล็อครัศมีสูงสุดที่ 5 กิโลเมตร

      for (const team of teams) {
        if (!team.currentloclat || !team.currentloclng) continue;
        
        const distance = calculateDistance(
          job.pickuplatitude, job.pickuplongitude,
          team.currentloclat, team.currentloclng
        );

        if (distance <= minDistance) {
          minDistance = distance;
          nearestTeam = team;
        }
      }

      // 3. หากเจอทีมที่ใกล้ที่สุด ส่ง Broadcast แจ้งเตือนแอปคนขับ
      if (nearestTeam) {
        console.log(`[Dispatcher] 🚀 ส่งงาน Request ID ${job.requestid} ไปที่ Team ID: ${nearestTeam.buddyteamid} (ระยะทางห่าง ${minDistance.toFixed(2)} กม.)`);
        
        // แนบข้อมูลระยะทางเข้าไปในข้อมูลงานด้วย เพื่อให้คนขับเห็นว่าห่างเท่าไหร่
        const jobPayload = {
            ...job,
            reqdistance: minDistance.toFixed(2)
        };

        const channel = supabase.channel(`team_room_${nearestTeam.buddyteamid}`);
        await channel.send({
          type: 'broadcast',
          event: 'new_job_dispatched',
          payload: jobPayload
        });
      } else {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับอยู่ในรัศมี 5 กม. (Request ID: ${job.requestid})`);
      }
    } catch (err) {
      console.error('[Dispatcher] Error:', err);
    }
  }
}

module.exports = DispatcherService;
