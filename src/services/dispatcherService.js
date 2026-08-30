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
    console.log('[Dispatcher] 🟢 เริ่มต้นระบบดักจับงานจากผู้ใช้และสถานบันเทิง...');

    // ดักฟังตาราง requestbyuser เมื่อมีข้อมูลใหม่ถูก Insert
    supabase
      .channel('public:requestbyuser')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requestbyuser' }, async (payload) => {
        const newJob = payload.new;
        
        if (newJob.requeststatus === 'กำลังค้นหาคนขับ') {
          console.log(`[Dispatcher] 🔔 พบงานใหม่! Request ID: ${newJob.requestid}`);
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
          console.log(`[Dispatcher] 🔔 พบงานใหม่จากสถานบันเทิง! Request ID: ${newJob.requestid}`);
          await DispatcherService.dispatchJob(newJob, 'pub');
        }
      })
      .subscribe();
  }

  static async dispatchJob(job, type = 'user') {
    try {
      // 1. ดึงทีมคนขับที่กำลังว่าง (Ready) ทั้งหมด พร้อมข้อมูลเพศเพื่อรองรับ Lady Mode
      const { data: teams, error } = await supabase
        .from('buddyteam')
        .select('*, leader:leaderid(gender), follower:followerid(gender)')
        .eq('teamstatus', 'Ready');

      if (error) throw error;

      if (!teams || teams.length === 0) {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับที่ว่างในขณะนี้ (Request ID: ${job.requestid})`);
        return;
      }

      // กรองตาม Lady Mode
      let eligibleTeams = teams;
      if (job.isladymode) {
        const isFemale = (g) => g === 2 || g === '2' || String(g).toLowerCase() === 'female' || String(g) === 'หญิง';
        eligibleTeams = teams.filter(team => {
          return team.leader && isFemale(team.leader.gender) && team.follower && isFemale(team.follower.gender);
        });
        console.log(`[Dispatcher] กรองทีมสำหรับ Lady Mode (เหลือ ${eligibleTeams.length} ทีมจาก ${teams.length} ทีม)`);
      }

      if (eligibleTeams.length === 0) {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับที่สอดคล้องกับเงื่อนไข Lady Mode หรือไม่มีทีมว่าง (Request ID: ${job.requestid})`);
        return;
      }

      // กรองตามประเภทรถยนต์ที่ลูกค้า/สถานบันเทิงต้องการ (Driver Skills: 1 = EV, 2 = Manual, 3 = Auto)
      let requiredCarType = job.requiredcartype;
      if (!requiredCarType && job.user_car_id) {
        const { data: uCar } = await supabase
          .from('usercar')
          .select('car_type')
          .eq('usercarid', job.user_car_id)
          .maybeSingle();
        if (uCar && uCar.car_type) {
          requiredCarType = uCar.car_type;
        }
      }
      if (!requiredCarType) {
        requiredCarType = 3; // Default เป็น Auto
      }

      const carTypeNames = { 1: 'Electric / EV', 2: 'Manual (เกียร์ธรรมดา)', 3: 'Auto (เกียร์อัตโนมัติ)' };
      console.log(`[Dispatcher] 🔍 ตรวจสอบทักษะคนขับสำหรับรถประเภท: ${carTypeNames[requiredCarType] || requiredCarType} (ID: ${requiredCarType})`);

      const leaderUsernames = eligibleTeams.map(t => t.leaderid).filter(Boolean);
      const { data: skillsData } = await supabase
        .from('driverskill')
        .select('driver_id, car_type_id')
        .in('driver_id', leaderUsernames);

      eligibleTeams = eligibleTeams.filter(team => {
        const leaderSkills = (skillsData || [])
          .filter(s => s.driver_id === team.leaderid)
          .map(s => s.car_type_id);
        const effectiveSkills = leaderSkills.length > 0 ? leaderSkills : [3];
        const hasSkill = effectiveSkills.includes(Number(requiredCarType));
        if (!hasSkill) {
          console.log(`[Dispatcher] ⚠️ ข้าม Team ID ${team.buddyteamid} (Leader ${team.leaderid} ไม่มีทักษะขับขี่รถประเภท ${carTypeNames[requiredCarType]})`);
        }
        return hasSkill;
      });

      if (eligibleTeams.length === 0) {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับที่มีทักษะขับขี่รถประเภท ${carTypeNames[requiredCarType]} (Request ID: ${job.requestid})`);
        return;
      }

      // 2. คำนวณระยะทางและหาทีมที่ใกล้ที่สุด (ในรัศมี 50km)
      let nearestTeam = null;
      let minDistance = 50; // ล็อครัศมีสูงสุดที่ 50 กิโลเมตร (ขยายสำหรับทดสอบและพื้นที่จริง)

      for (const team of eligibleTeams) {
        if (!team.currentloclat || !team.currentloclng) {
          console.log(`[Dispatcher] ทีม ID ${team.buddyteamid} ไม่มีข้อมูลพิกัด (Lat/Lng is null/0)`);
          continue;
        }
        
        console.log(`[Dispatcher] คำนวณระยะทาง - User: (${job.pickuplatitude}, ${job.pickuplongitude}) vs Team ID ${team.buddyteamid}: (${team.currentloclat}, ${team.currentloclng})`);
        const distance = calculateDistance(
          job.pickuplatitude, job.pickuplongitude,
          team.currentloclat, team.currentloclng
        );
        console.log(`[Dispatcher] ระยะทางไปยัง Team ID ${team.buddyteamid} = ${distance.toFixed(2)} กม.`);

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
      } else {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับอยู่ในรัศมี 5 กม. (Request ID: ${job.requestid})`);
      }
    } catch (err) {
      console.error('[Dispatcher] Error:', err);
    }
  }
}

module.exports = DispatcherService;
