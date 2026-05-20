const AuthModel = require('../../models/driver/authModel');
const { uploadToSupabase, getRelativePath, formatDriverDocs } = require('../../utils/supabaseStorage');

class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      const user = await AuthModel.login(username, password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async register(req, res) {
    try {
      // ── Validation 1: Check File Attachments ──────────────────
      const validateFile = (file, label) => {
        if (!file) {
          throw new Error(`กรุณาแนบไฟล์: ${label}`);
        }
        // Limit size: 10 MB = 10 * 1024 * 1024 bytes
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`ไฟล์ ${label} มีขนาดใหญ่เกินไป (ต้องไม่เกิน 10 MB)`);
        }
        // Allowed mime types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.mimetype)) {
          throw new Error(`ไฟล์ ${label} ต้องเป็นไฟล์ประเภท JPG หรือ PNG เท่านั้น`);
        }
      };

      if (!req.files) {
        return res.status(400).json({ error: 'กรุณาแนบไฟล์ประกอบการสมัครสมาชิกให้ครบถ้วน' });
      }

      try {
        validateFile(req.files.regisImagePath ? req.files.regisImagePath[0] : null, 'รูปภาพใบหน้าตนเอง');
        validateFile(req.files.carImagePath ? req.files.carImagePath[0] : null, 'รูปภาพรถยนต์');
        validateFile(req.files.driverLicensePath ? req.files.driverLicensePath[0] : null, 'รูปภาพใบขับขี่');
        validateFile(req.files.criminalRecordPath ? req.files.criminalRecordPath[0] : null, 'รูปภาพประวัติอาชญากรรม');
        validateFile(req.files.medicalCertificatePath ? req.files.medicalCertificatePath[0] : null, 'ใบรับรองแพทย์ตรวจสุขภาพ');
      } catch (fileError) {
        return res.status(400).json({ error: fileError.message });
      }

      const driverData = { ...req.body };

      const {
        username,
        password,
        firstName,
        lastName,
        email,
        phoneNo,
        idCard,
        bankAccountNo,
        gender,
        carBrand,
        carModel,
        carColor,
        carPlate,
        driverSkills
      } = driverData;

      // ── Validation 2: Check Text Fields Presence & Format ────
      if (!firstName || firstName.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกชื่อ (firstName)' });
      }
      if (!/^[a-zA-Z0-9]{2,50}$/.test(firstName)) {
        return res.status(400).json({ error: 'ชื่อ (firstName) ต้องเป็นตัวอักษรอังกฤษหรือตัวเลขเท่านั้น ความยาว 2 - 50 ตัวอักษร และไม่มีช่องว่าง' });
      }

      if (!lastName || lastName.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกนามสกุล (lastName)' });
      }
      if (!/^[ก-๙a-zA-Z]{2,50}$/.test(lastName)) {
        return res.status(400).json({ error: 'นามสกุล (lastName) ต้องเป็นตัวอักษรภาษาไทยหรืออังกฤษเท่านั้น ความยาว 2 - 50 ตัวอักษร' });
      }

      if (!idCard || idCard.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกหมายเลขบัตรประชาชน (idCard)' });
      }
      if (!/^[0-9]{13}$/.test(idCard)) {
        return res.status(400).json({ error: 'หมายเลขบัตรประชาชนต้องเป็นตัวเลข 13 หลักเท่านั้น' });
      }

      if (!email || email.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกอีเมล (email)' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'อีเมลไม่ถูกต้องตามรูปแบบมาตรฐาน' });
      }

      if (!gender) {
        return res.status(400).json({ error: 'กรุณาเลือกเพศ (gender)' });
      }

      if (!bankAccountNo || bankAccountNo.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกเลขบัญชีธนาคาร (bankAccountNo)' });
      }
      if (!/^[0-9]{12}$/.test(bankAccountNo)) {
        return res.status(400).json({ error: 'เลขบัญชีธนาคารกสิกรไทยต้องเป็นตัวเลข 12 หลัก และไม่มีช่องว่าง' });
      }

      if (!phoneNo || phoneNo.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกหมายเลขโทรศัพท์มือถือ (phoneNo)' });
      }
      if (!/^[0-9]{10}$/.test(phoneNo)) {
        return res.status(400).json({ error: 'หมายเลขโทรศัพท์มือถือต้องเป็นตัวเลข 10 หลัก และไม่มีช่องว่าง' });
      }

      if (!password || password.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกรหัสผ่าน (password)' });
      }
      if (!/^[a-zA-Z0-9!#_.]{6,50}$/.test(password)) {
        return res.status(400).json({ error: 'รหัสผ่านต้องเป็นภาษาอังกฤษ ตัวเลข และอักขระพิเศษ [!#_.] เท่านั้น ความยาว 6 - 50 ตัวอักษร และไม่มีช่องว่าง' });
      }

      if (!driverSkills || 
          (Array.isArray(driverSkills) && driverSkills.length === 0) || 
          (typeof driverSkills === 'string' && driverSkills.trim() === '')) {
        return res.status(400).json({ error: 'กรุณาเลือกความสามารถในการขับรถยนต์ (driverSkills) อย่างน้อย 1 ประเภท' });
      }

      if (!carBrand || carBrand.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกยี่ห้อยานพาหนะ (carBrand)' });
      }
      if (!/^[a-zA-Z]{2,50}$/.test(carBrand)) {
        return res.status(400).json({ error: 'ยี่ห้อยานพาหนะ (carBrand) ต้องเป็นตัวอักษรอังกฤษเท่านั้น ความยาว 2 - 50 ตัวอักษร และไม่มีช่องว่าง' });
      }

      if (!carModel || carModel.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกรุ่นยานพาหนะ (carModel)' });
      }
      if (!/^[a-zA-Z0-9]{2,50}$/.test(carModel)) {
        return res.status(400).json({ error: 'รุ่นยานพาหนะ (carModel) ต้องเป็นภาษาอังกฤษและตัวเลขเท่านั้น ความยาว 2 - 50 ตัวอักษร และไม่มีช่องว่าง' });
      }

      if (!carColor || carColor.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกสียานพาหนะ (carColor)' });
      }
      if (!/^[ก-๙]{2,50}$/.test(carColor)) {
        return res.status(400).json({ error: 'สียานพาหนะ (carColor) ต้องเป็นภาษาไทยเท่านั้น ความยาว 2 - 50 ตัวอักษร และไม่มีช่องว่าง' });
      }

      if (!carPlate || carPlate.trim() === '') {
        return res.status(400).json({ error: 'กรุณากรอกทะเบียนยานพาหนะ (carPlate)' });
      }
      // Allow optional dash - for plates like กข-1234
      if (!/^[ก-๙0-9-]{2,20}$/.test(carPlate)) {
        return res.status(400).json({ error: 'ทะเบียนยานพาหนะ (carPlate) ต้องเป็นภาษาไทย ตัวเลข หรือขีด (-) เท่านั้น ความยาว 2 - 20 ตัวอักษร และไม่มีช่องว่าง' });
      }

      // If username is not provided, use phoneNo as username
      const finalUsername = username && username.trim() !== '' ? username : phoneNo;

      const usernameRegex = /^[a-zA-Z0-9_]{2,50}$/;
      if (!usernameRegex.test(finalUsername)) {
        return res.status(400).json({ error: 'ชื่อผู้ใช้ไม่ถูกต้อง (ต้องเป็นภาษาอังกฤษ ตัวเลข หรือขีดล่าง 2–50 ตัว)' });
      }

      // ── Validation 3: Duplicate checks in DB ─────────────────
      const usernameDup = await AuthModel.checkDuplicateUsername(finalUsername);
      if (usernameDup) {
        return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
      }

      const emailDup = await AuthModel.checkDuplicateEmail(email);
      if (emailDup) {
        return res.status(400).json({ error: 'อีเมลนี้มีในระบบแล้ว' });
      }

      const phoneDup = await AuthModel.checkDuplicatePhone(phoneNo);
      if (phoneDup) {
        return res.status(400).json({ error: 'หมายเลขโทรศัพท์นี้สมัครสมาชิกแล้ว' });
      }

      // ── Validation 4: Upload Files to Supabase Storage ───────
      const regisImagePath = await uploadToSupabase(req.files.regisImagePath[0], 'images', 'drivers/profile');
      const carImagePath = await uploadToSupabase(req.files.carImagePath[0], 'images', 'drivers/cars');
      const driverLicensePath = await uploadToSupabase(req.files.driverLicensePath[0], 'images', 'drivers/documents');
      const criminalRecordPath = await uploadToSupabase(req.files.criminalRecordPath[0], 'images', 'drivers/documents');
      const medicalCertificatePath = await uploadToSupabase(req.files.medicalCertificatePath[0], 'images', 'drivers/documents');

      // Pack all driver documents into a single JSON string for the 'regisimagepath' column
      const regisImagePathJson = JSON.stringify({
        profile: getRelativePath(regisImagePath),
        driverLicense: getRelativePath(driverLicensePath),
        criminalRecord: getRelativePath(criminalRecordPath),
        medicalCertificate: getRelativePath(medicalCertificatePath)
      });

      // Prepare database records
      const finalDriverData = {
        username: finalUsername,
        password: password, // Matching existing plain text comparison in AuthModel
        firstname: firstName,
        lastname: lastName,
        email: email,
        phoneno: phoneNo,
        idcard: idCard,
        bankaccountno: bankAccountNo,
        gender: parseInt(gender, 10) || 1,
        walletbalance: 0.0,
        registerstatus: 'รอดำเนินการ', // default state
        regisimagepath: regisImagePathJson,
        regisdate: new Date().toISOString(),
        latitude: 0.0, // default coordinates
        longitude: 0.0
      };

      const finalCarData = {
        carbrand: carBrand,
        carmodel: carModel,
        carcolor: carColor,
        carplate: carPlate,
        carimagepath: getRelativePath(carImagePath) // Also save relative path for car image path
      };

      // Perform transaction-like insert via Model
      const result = await AuthModel.register(finalDriverData, finalCarData);

      // Convert relative paths in returned data to full URLs for response consistency
      if (result && result.driver) {
        formatDriverDocs(result.driver);
      }
      if (result && result.car && result.car.carimagepath) {
        const { getFullStorageUrl } = require('../../utils/supabaseStorage');
        result.car.carimagepath = getFullStorageUrl(result.car.carimagepath);
      }

      return res.status(201).json({
        success: true,
        message: 'สมัครสมาชิกสำเร็จ รอการอนุมัติจากผู้ดูแลระบบ',
        data: result,
        uploadedDocuments: {
          driverLicense: driverLicensePath,
          criminalRecord: criminalRecordPath,
          medicalCertificate: medicalCertificatePath
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = AuthController;


