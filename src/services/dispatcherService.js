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
    // ดักฟังตาราง requestbyuser เมื่อมีข้อมูลใหม่ถูก Insert
    supabase
      .channel('public:requestbyuser')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requestbyuser' }, async (payload) => {
        const newJob = payload.new;
        
        if (newJob.requeststatus === 'กำลังค้นหาคนขับ') {
          await DispatcherService.dispatchJob(newJob, 'user');
        }
      })
      .subscribe();

    // ดักฟังตาราง requestbypub เมื่อมีข้อมูลใหม่ถูก Insert
    supabase
      .channel('public:requestbypub')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requestbypub' }, async (payload) => {
        const newJob = payload.new;
        
        if (newJob.requeststatus === 'รอคนขับ') {
          await DispatcherService.dispatchJob(newJob, 'pub');
        }
      })
      .subscribe();
  }

  static async dispatchJob(job, type = 'user') {
    try {
      // 1. ดึงทีมคนขับที่กำลังว่าง (Ready) ทั้งหมด
      const { data: teams, error } = await supabase
        .from('buddyteam')
        .select('*')
        .eq('teamstatus', 'Ready');

      if (error) throw error;

      if (!teams || teams.length === 0) {
        return;
      }

      // 2. คำนวณระยะทางและหาทีมที่ใกล้ที่สุด (ในรัศมี 50km)
      let nearestTeam = null;
      let minDistance = 50; // ล็อครัศมีสูงสุดที่ 50 กิโลเมตร (ขยายสำหรับทดสอบและพื้นที่จริง)

      for (const team of teams) {
        if (!team.currentloclat || !team.currentloclng) {
          continue;
        }
        
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
        // แนบข้อมูลระยะทางเข้าไปในข้อมูลงานด้วย เพื่อให้คนขับเห็นว่าห่างเท่าไหร่
        const jobPayload = {
            ...job,
            reqdistance: minDistance.toFixed(2),
            job_source: type
        };

        const channel = supabase.channel(`team_room_${nearestTeam.buddyteamid}`);
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'new_job_dispatched',
              payload: jobPayload
            });
            // ถอดการเชื่อมต่อ channel หลังจากส่งเสร็จเพื่อไม่ให้เปลืองทรัพยากร (ดีเลย์เล็กน้อยเพื่อให้แน่ใจว่าส่งข้อมูลเสร็จสิ้น)
            setTimeout(() => {
              supabase.removeChannel(channel);
            }, 2000);
          }
        });
      }
    } catch (err) {
      console.error('[Dispatcher] Error:', err);
    }
  }
}

module.exports = DispatcherService;
