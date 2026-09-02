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
    console.log('[Dispatcher] 🟢 เริ่มต้นระบบดักจับงานจากผู้ใช้และร้านค้า...');

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
          console.log(`[Dispatcher] 🔔 พบงานใหม่จากร้านค้า! Request ID: ${newJob.requestid}`);
          await DispatcherService.dispatchJob(newJob, 'pub');
        }
      })
      .subscribe();
  }

  static async dispatchJob(job, type = 'user') {
    try {
      // 1. ดึงทีมคนขับที่กำลังว่าง (Ready) ทั้งหมด พร้อมข้อมูลเพศ และทักษะการขับรถของหัวหน้าทีม (Leader)
      const { data: teams, error } = await supabase
        .from('buddyteam')
        .select('*, leader:leaderid(gender, driverskill(car_type_id, cartype(cartypeid, cartypename))), follower:followerid(gender)')
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
        eligibleTeams = eligibleTeams.filter(team => {
          return team.leader && isFemale(team.leader.gender) && team.follower && isFemale(team.follower.gender);
        });
        console.log(`[Dispatcher] กรองทีมสำหรับ Lady Mode (เหลือ ${eligibleTeams.length} ทีมจาก ${teams.length} ทีม)`);
      }

      // หา requiredcartype ของงาน (ถ้ามาจาก user และไม่มี requiredcartype ใน payload ให้ดึงจากตาราง usercar)
      const parsedReqType = parseInt(job.requiredcartype, 10);
      let requiredCarType = (!isNaN(parsedReqType) && parsedReqType > 0) ? parsedReqType : null;
      let carModelName = job.carmodel || null;
      let carPlateName = job.carplate || null;

      const parsedUserCarId = parseInt(job.user_car_id, 10);
      if (!requiredCarType && !isNaN(parsedUserCarId)) {
        try {
          const { data: userCarData } = await supabase
            .from('usercar')
            .select('car_type, carbrand, carmodel, carplate, cartype(cartypename)')
            .eq('usercarid', parsedUserCarId)
            .maybeSingle();

          if (userCarData) {
            if (userCarData.car_type) {
              const ct = userCarData.car_type;
              if (typeof ct === 'number') {
                requiredCarType = ct;
              } else {
                const ctStr = String(ct).toLowerCase();
                if (ctStr.includes('ev') || ctStr.includes('electric') || ctStr.includes('ไฟฟ้า') || ctStr === '1') requiredCarType = 1;
                else if (ctStr.includes('manual') || ctStr.includes('ธรรมดา') || ctStr.includes('กระปุก') || ctStr === '2') requiredCarType = 2;
                else requiredCarType = 3;
              }
            } else if (userCarData.cartype?.cartypename) {
              const name = userCarData.cartype.cartypename.toLowerCase();
              if (name.includes('ev') || name.includes('electric') || name.includes('ไฟฟ้า')) requiredCarType = 1;
              else if (name.includes('manual') || name.includes('ธรรมดา') || name.includes('กระปุก')) requiredCarType = 2;
              else requiredCarType = 3;
            }

            if (!carModelName && (userCarData.carbrand || userCarData.carmodel)) {
              carModelName = `${userCarData.carbrand || ''} ${userCarData.carmodel || ''}`.trim();
            }
            if (!carPlateName && userCarData.carplate) {
              carPlateName = userCarData.carplate;
            }
          }
        } catch (e) {
          console.error('[Dispatcher] Failed to fetch user car details:', e.message);
        }
      }

      // กรองตามประเภทรถ / ระบบเกียร์ของหัวหน้าทีม (Leader)
      // requiredcartype: 1 = EV/Electric, 2 = Manual, 3 = Auto
      if (requiredCarType) {
        const reqType = requiredCarType;
        eligibleTeams = eligibleTeams.filter(team => {
          if (!team.leader) return false;
          
          const skills = Array.isArray(team.leader.driverskill) ? team.leader.driverskill : [];
          
          // ดึงรายการ car_type_id และชื่อประเภทรถ
          const skillTypeIds = skills.map(s => parseInt(s.car_type_id, 10)).filter(id => !isNaN(id));
          const skillNames = skills.map(s => (s.cartype?.cartypename || '').toLowerCase());
          const skillCombinedText = skillNames.join(' ');

          if (reqType === 1) {
            // รถไฟฟ้า (EV) - ต้องมี ID 1 หรือชื่อ EV/ไฟฟ้า
            return skillTypeIds.includes(1) || 
                   skillCombinedText.includes('ev') || 
                   skillCombinedText.includes('electric') || 
                   skillCombinedText.includes('ไฟฟ้า');
          } else if (reqType === 2) {
            // เกียร์ธรรมดา (Manual) - ต้องมี ID 2 หรือชื่อ Manual/ธรรมดา/กระปุก
            return skillTypeIds.includes(2) || 
                   skillCombinedText.includes('manual') || 
                   skillCombinedText.includes('ธรรมดา') || 
                   skillCombinedText.includes('กระปุก');
          } else if (reqType === 3) {
            // เกียร์ออโต้ (Auto) - มี ID 3, ชื่อ auto/ออโต้ หรือถ้าไม่มีการระบุสกิลใดๆ ให้ fallback เป็น Auto
            if (skills.length === 0) return true;
            return skillTypeIds.includes(3) || 
                   skillCombinedText.includes('auto') || 
                   skillCombinedText.includes('ออโต้');
          }
          return true;
        });
        console.log(`[Dispatcher] กรองทีมตามประเภทรถ/เกียร์ของหัวหน้าทีม (Required: ${requiredCarType}) -> เหลือ ${eligibleTeams.length} ทีม`);
      }

      if (eligibleTeams.length === 0) {
        console.log(`[Dispatcher] ❌ ไม่มีทีมคนขับที่สอดคล้องกับเงื่อนไข (Lady Mode / ประเภทรถ ${requiredCarType || 'ไม่ระบุ'}) หรือไม่มีทีมว่าง (Request ID: ${job.requestid})`);
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
        
        // แนบข้อมูลระยะทาง, ประเภทเกียร์ และข้อมูลรถเข้าไปในข้อมูลงานด้วย
        const jobPayload = {
            ...job,
            requiredcartype: requiredCarType || job.requiredcartype,
            carmodel: carModelName || job.carmodel,
            carplate: carPlateName || job.carplate,
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
