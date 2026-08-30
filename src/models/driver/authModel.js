const supabase = require('./dbClient');
const { formatDriverDocs } = require('../../utils/supabaseStorage');
const { getThaiCurrentISOString } = require('../../utils/thaiDate');
const bcrypt = require('bcrypt');

class AuthModel {
  static async login(username, password, latitude, longitude) {
    let { data, error } = await supabase
      .from('driver')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const isMatch = await bcrypt.compare(password, data.password);
    if (!isMatch) return null;

    // หากเข้าสู่ระบบสำเร็จและมีการส่งพิกัดละติจูด/ลองจิจูดมา ให้ทำการอัปเดตตำแหน่งคนขับ
    if (data && latitude !== undefined && longitude !== undefined) {
      const { data: updatedData, error: updateError } = await supabase
        .from('driver')
        .update({ latitude, longitude })
        .eq('username', username)
        .select('*')
        .maybeSingle();
      
      if (!updateError && updatedData) {
        data = updatedData;
      }
    }

    return formatDriverDocs(data);
  }

  // ตรวจสอบว่ามี username นี้อยู่ในระบบแล้วหรือยัง (ข้ามตาราง driver, pub, admin)
  static async checkDuplicateUsername(username) {
    if (!username) return false;
    const cleanUser = String(username).trim();
    const { data: driverData } = await supabase
      .from('driver')
      .select('username, registerstatus')
      .eq('username', cleanUser);

    if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('username, regisstatus')
      .eq('username', cleanUser);

    if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true;

    const { data: adminData } = await supabase
      .from('admin')
      .select('username')
      .eq('username', cleanUser);

    if (adminData && adminData.length > 0) return true;

    return false;
  }

  // ดึงสถานะการสมัครสมาชิกของคนขับ
  static async getStatus(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('registerstatus, regisdate, firstname, lastname, email, phoneno')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Check if email already exists in driver or pub (excluding rejected)
  static async checkDuplicateEmail(email) {
    if (!email) return false;
    const cleanEmail = String(email).trim().toLowerCase();
    const { data: driverData } = await supabase
      .from('driver')
      .select('email, registerstatus')
      .ilike('email', cleanEmail);

    if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('pubemail, regisstatus')
      .ilike('pubemail', cleanEmail);

    if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true;

    return false;
  }

  // Check if phone number already exists in driver or pub (excluding rejected)
  static async checkDuplicatePhone(phoneno) {
    if (!phoneno) return false;
    const cleanPhone = String(phoneno).trim();
    const { data: driverData } = await supabase
      .from('driver')
      .select('phoneno, registerstatus')
      .eq('phoneno', cleanPhone);

    if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('pubphone, regisstatus')
      .eq('pubphone', cleanPhone);

    if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true;

    return false;
  }

  // ตรวจสอบว่ามีเลขบัตรประชาชนนี้อยู่ในระบบแล้วหรือยัง (excluding rejected)
  static async checkDuplicateIdCard(idcard) {
    if (!idcard) return false;
    const cleanId = String(idcard).trim();
    const { data: driverData } = await supabase
      .from('driver')
      .select('idcard, registerstatus')
      .eq('idcard', cleanId);

    if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('taxnumber, regisstatus')
      .eq('taxnumber', cleanId);

    if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true;

    return false;
  }

  // ตรวจสอบว่ามีเลขที่บัญชีธนาคารนี้อยู่ในระบบแล้วหรือยัง (excluding rejected)
  static async checkDuplicateBankAccount(bankAccountNo) {
    if (!bankAccountNo) return false;
    const cleanAcc = String(bankAccountNo).trim();
    const { data: driverData } = await supabase
      .from('driver')
      .select('bankaccountno, registerstatus')
      .eq('bankaccountno', cleanAcc);

    if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('bankaccountno, regisstatus')
      .eq('bankaccountno', cleanAcc);

    if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true;

    return false;
  }

  // ตรวจสอบว่ามีทะเบียนยานพาหนะนี้อยู่ในระบบแล้วหรือยัง (Normalized เปรียบเทียบ)
  static async checkDuplicateCarPlate(carPlate) {
    if (!carPlate) return false;
    const cleanInput = String(carPlate).replace(/[\s-]/g, '').toLowerCase();
    const { data, error } = await supabase
      .from('drivercar')
      .select('carplate');

    if (error || !data) return false;
    return data.some(c => c.carplate && String(c.carplate).replace(/[\s-]/g, '').toLowerCase() === cleanInput);
  }

  // สมัครสมาชิกคนขับพร้อมทั้งลงทะเบียนข้อมูลรถยนต์และทักษะประเภทรถที่ขับได้
  static async register(driverData, carData, skillIds = [3]) {
    // 0. ตรวจสอบว่าเดิมมีบัญชีที่เคยถูกปฏิเสธอยู่หรือไม่ -> ถ้ามีให้ทำการอัปเดตแทนการ insert ใหม่
    const { data: existingDriver } = await supabase
      .from('driver')
      .select('username, driver_car, registerstatus')
      .eq('username', driverData.username)
      .maybeSingle();

    if (existingDriver) {
      if (existingDriver.driver_car) {
        await supabase
          .from('drivercar')
          .update(carData)
          .eq('drivercarid', existingDriver.driver_car);
      }
      const { data: updatedDriver, error: driverErr } = await supabase
        .from('driver')
        .update({
          ...driverData,
          registerstatus: 'รอดำเนินการ',
          regisdate: getThaiCurrentISOString()
        })
        .eq('username', driverData.username)
        .select()
        .maybeSingle();

      if (driverErr) {
        console.error("Error resubmitting driver:", driverErr);
        throw new Error(`ไม่สามารถอัปเดตข้อมูลการสมัครได้: ${driverErr.message}`);
      }

      // บันทึกทักษะประเภทรถยนต์ลงตาราง driverskill
      if (skillIds && skillIds.length > 0) {
        await supabase.from('driverskill').delete().eq('driver_id', driverData.username);
        const skillRows = skillIds.map(typeId => ({
          driver_id: driverData.username,
          car_type_id: typeId
        }));
        await supabase.from('driverskill').insert(skillRows);
      }

      return {
        driver: updatedDriver,
        car: carData
      };
    }

    // 1. เพิ่มข้อมูลรถยนต์ของคนขับใหม่
    const { data: insertedCar, error: carError } = await supabase
      .from('drivercar')
      .insert([carData])
      .select()
      .maybeSingle();

    if (carError) {
      console.error("Error inserting driver car:", carError);
      throw new Error(`ไม่สามารถบันทึกข้อมูลรถยนต์ได้: ${carError.message}`);
    }

    if (!insertedCar) {
      throw new Error("เกิดข้อผิดพลาดในการบันทึกข้อมูลรถยนต์");
    }

    // 2. เพิ่มข้อมูลคนขับโดยเชื่อมโยงไอดีรถยนต์ที่เพิ่งเพิ่มเข้าไป
    const driverRecord = {
      ...driverData,
      driver_car: insertedCar.drivercarid
    };

    const { data: insertedDriver, error: driverError } = await supabase
      .from('driver')
      .insert([driverRecord])
      .select()
      .maybeSingle();

    if (driverError) {
      console.error("Error inserting driver:", driverError);
      // พยายามลบข้อมูลรถยนต์ที่เพิ่งเพิ่มเข้าไปเพื่อป้องกันข้อมูลขยะหากการสมัครสมาชิกคนขับล้มเหลว
      try {
        await supabase
          .from('drivercar')
          .delete()
          .eq('drivercarid', insertedCar.drivercarid);
      } catch (cleanupError) {
        console.error("Failed to clean up car record after driver insert error:", cleanupError);
      }
      throw new Error(`ไม่สามารถสมัครสมาชิกได้: ${driverError.message}`);
    }

    // 3. บันทึกทักษะประเภทรถยนต์ลงตาราง driverskill
    if (skillIds && skillIds.length > 0) {
      try {
        await supabase.from('driverskill').delete().eq('driver_id', driverData.username);
        const skillRows = skillIds.map(typeId => ({
          driver_id: driverData.username,
          car_type_id: typeId
        }));
        await supabase.from('driverskill').insert(skillRows);
      } catch (skillErr) {
        console.error("Error inserting driver skills into driverskill:", skillErr);
      }
    }

    return {
      driver: insertedDriver,
      car: insertedCar
    };
  }
}

module.exports = AuthModel;

