const supabase = require('./dbClient');
const { formatDriverDocs, getFullStorageUrl } = require('../../utils/supabaseStorage');

const formatCarImagePath = (driver) => {
  if (driver && driver.drivercar && driver.drivercar.carimagepath) {
    try {
      const paths = JSON.parse(driver.drivercar.carimagepath);
      if (paths && typeof paths === 'object') {
        const formatted = {};
        for (const [key, val] of Object.entries(paths)) {
          formatted[key] = getFullStorageUrl(val);
        }
        driver.drivercar.carimagepath = JSON.stringify(formatted);
      } else {
        driver.drivercar.carimagepath = getFullStorageUrl(driver.drivercar.carimagepath);
      }
    } catch (e) {
      driver.drivercar.carimagepath = getFullStorageUrl(driver.drivercar.carimagepath);
    }
  }
  return driver;
};

class UserModel {
  // ดึงข้อมูลโปรไฟล์ผู้ใช้งานด้วย username (หรือเบอร์โทรศัพท์)
  static async getProfileByUsername(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('*, drivercar:driver_car(*), driverskill(car_type_id, cartype(cartypeid, cartypename))')
      .or(`username.eq.${username},phoneno.eq.${username}`)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      // Map driverskill relation to driverskills array for frontend/app
      if (Array.isArray(data.driverskill) && data.driverskill.length > 0) {
        data.driverskills = data.driverskill.map(s => s.cartype ? s.cartype.cartypename : s.car_type_id).filter(Boolean);
      } else {
        data.driverskills = [];
      }
      const { data: reviews, error: reviewError } = await supabase
        .from('review')
        .select('*')
        .eq('driverusername', data.username);

      if (!reviewError && reviews) {
        const count = reviews.length;
        let sum = 0;
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
          const rate = r.reviewrate;
          sum += rate;
          if (distribution[rate] !== undefined) {
            distribution[rate]++;
          }
        });
        const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0.0;
        data.review_stats = {
          count,
          average,
          distribution
        };
        data.reviews = reviews;
      } else {
        data.review_stats = {
          count: 0,
          average: 0.0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        };
        data.reviews = [];
      }

      // ดึงประวัติทีมบัดดี้เพื่อคำนวณอัตราการรับงานและยกเลิกงานแบบกึ่งไดนามิก
      let completedJobsCount = 0;
      try {
        const { data: teams, error: teamsError } = await supabase
          .from('buddyteam')
          .select('buddyteamid')
          .or(`leaderid.ilike.${data.username},followerid.ilike.${data.username}`);

        if (!teamsError && teams && teams.length > 0) {
          const teamIds = teams.map(t => t.buddyteamid);

          const { count: completedUserJobs } = await supabase
            .from('requestbyuser')
            .select('*', { count: 'exact', head: true })
            .in('buddy_team_id', teamIds)
            .in('requeststatus', ['เสร็จสิ้น', 'completed']);

          const { count: completedPubJobs } = await supabase
            .from('requestbypub')
            .select('*', { count: 'exact', head: true })
            .in('buddy_team_id', teamIds)
            .in('requeststatus', ['เสร็จสิ้น', 'completed']);

          completedJobsCount = (completedUserJobs || 0) + (completedPubJobs || 0);
        }
      } catch (err) {
        console.error("Error calculating completed jobs for profile rates:", err);
      }

      // คำนวณอัตราการรับงานและอัตราการยกเลิกงานอิงตามจำนวนงานสำเร็จจริง
      if (completedJobsCount === 0) {
        data.acceptance_rate = "100.0%";
        data.cancellation_rate = "0.0%";
      } else {
        const acceptRateVal = Math.min(100.0, 95.0 + Math.min(5.0, completedJobsCount * 0.5));
        const cancelRateVal = Math.max(0.0, 5.0 - Math.min(5.0, completedJobsCount * 0.5));
        data.acceptance_rate = `${acceptRateVal.toFixed(1)}%`;
        data.cancellation_rate = `${cancelRateVal.toFixed(1)}%`;
      }
    }

    return formatCarImagePath(formatDriverDocs(data));
  }

  // อัปเดตข้อมูลโปรไฟล์ผู้ใช้งาน
  static async updateProfile(username, profileData) {
    const { drivercar, ...driverFields } = profileData;

    if (drivercar) {
      // 1. ค้นหาไอดีรถ (driver_car ID) ของคนขับคนนี้
      const { data: driverRow, error: getDriverError } = await supabase
        .from('driver')
        .select('driver_car')
        .eq('username', username)
        .maybeSingle();

      if (!getDriverError && driverRow && driverRow.driver_car) {
        // 2. อัปเดตข้อมูลในตารางข้อมูลรถ (drivercar)
        const { error: carError } = await supabase
          .from('drivercar')
          .update(drivercar)
          .eq('drivercarid', driverRow.driver_car);

        if (carError) {
          throw carError;
        }
      }
    }

    // 3. อัปเดตข้อมูลในตารางคนขับ (driver)
    const { data: updatedDriver, error: driverError } = await supabase
      .from('driver')
      .update(driverFields)
      .eq('username', username)
      .select('*, drivercar:driver_car(*)')
      .maybeSingle();

    if (driverError) {
      throw driverError;
    }
    return formatCarImagePath(formatDriverDocs(updatedDriver));
  }
  // ค้นหาผู้ใช้งานด้วยชื่อ นามสกุล หรือ username
  static async searchUsers(search, category, exclude, lat, lng, radius = 2) {
    let query = supabase.from('driver').select('*').eq('registerstatus', 'อนุมัติแล้ว');

    if (search) {
      query = query.or(`firstname.ilike.%${search}%,lastname.ilike.%${search}%,username.ilike.%${search}%`);
    }

    if (exclude) {
      query = query.neq('username', exclude);
    }

    // ตรวจสอบขอบเขตตำแหน่งคนขับใกล้เคียง (คำนวณแบบ Bounding Box สำหรับรัศมีเป็นกิโลเมตร)
    if (category === 'nearby' && lat && lng) {
      const r = parseFloat(radius);
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      // ละติจูด 1 องศา มีค่าประมาณ 111 กิโลเมตร
      // ลองจิจูด 1 องศา มีค่าประมาณ 111 กิโลเมตร * cos(latitude)
      const latDelta = r / 111.0;
      const lngDelta = r / (111.0 * Math.cos(latitude * Math.PI / 180));

      query = query
        .gte('latitude', latitude - latDelta)
        .lte('latitude', latitude + latDelta)
        .gte('longitude', longitude - lngDelta)
        .lte('longitude', longitude + lngDelta);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // หากมีการส่งพิกัดมา ให้คำนวณหาระยะห่างจริงสำหรับคนขับแต่ละคน
    if (data && lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      return data.map(user => {
        const formattedUser = formatDriverDocs(user);
        if (formattedUser.latitude != null && formattedUser.longitude != null) {
          const dLat = (formattedUser.latitude - latitude) * Math.PI / 180;
          const dLng = (formattedUser.longitude - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(latitude * Math.PI / 180) * Math.cos(formattedUser.latitude * Math.PI / 180) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = 6371 * c; // รัศมีของโลก (ประมาณ 6371 กิโลเมตร)
          return { ...formattedUser, distance: `${distance.toFixed(1)} km` };
        }
        return { ...formattedUser, distance: 'Nearby' };
      });
    }

    return data ? data.map(formatDriverDocs) : data;
  }
}

module.exports = UserModel;
