// ═══════════════════════════════════════════════════════════════
// middlewares/validate.js — Centralized Input Validation Middleware
// ═══════════════════════════════════════════════════════════════

const PHONE_REGEX = /^0[689][0-9]{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9]{6,50}$/;
const PASSWORD_REGEX = /^(?=.*[!#_.])[a-zA-Z0-9!#_.]{8,50}$/;
const TAX_REGEX = /^[0-9]{13}$/;
const BANK_ACCOUNT_REGEX = /^[0-9]{10,12}$/;
const CAR_BRAND_REGEX = /^[a-zA-Z\s-]{2,50}$/;
const CAR_MODEL_REGEX = /^[a-zA-Z0-9\s-]{1,50}$/;
const CAR_PLATE_REGEX = /^[ก-๙0-9\s-]{2,20}$/;

/**
 * Middleware สำหรับตรวจสอบ payload ในการขอบริการเรียกรถ (Pub request driver)
 */
const validateServiceRequest = (req, res, next) => {
  const {
    pubUsername,
    custName,
    phoneNo,
    phoneEmer,
    carType,
    dropoffLatitude,
    dropoffLongitude,
    paymentMethod
  } = req.body;

  if (!pubUsername || !custName || !phoneNo || !phoneEmer || !carType || dropoffLatitude === undefined || dropoffLongitude === undefined || paymentMethod === undefined) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  if (!PHONE_REGEX.test(phoneNo.trim())) {
    return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ลูกค้าต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0' });
  }

  if (!PHONE_REGEX.test(phoneEmer.trim())) {
    return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ฉุกเฉินต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0' });
  }

  if (phoneNo.trim() === phoneEmer.trim()) {
    return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ลูกค้าและเบอร์โทรฉุกเฉินต้องห้ามซ้ำกัน' });
  }

  const dropLat = parseFloat(dropoffLatitude);
  const dropLng = parseFloat(dropoffLongitude);

  if (isNaN(dropLat) || dropLat < -90 || dropLat > 90) {
    return res.status(400).json({ success: false, message: 'พิกัดละติจูดจุดส่งไม่ถูกต้อง' });
  }

  if (isNaN(dropLng) || dropLng < -180 || dropLng > 180) {
    return res.status(400).json({ success: false, message: 'พิกัดลองจิจูดจุดส่งไม่ถูกต้อง' });
  }

  next();
};

/**
 * Middleware สำหรับตรวจสอบ Search Places Query
 */
const validateSearchQuery = (req, res, next) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  // Sanitize basic control characters
  req.query.q = q.trim().replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, '');
  next();
};

module.exports = {
  validateServiceRequest,
  validateSearchQuery,
  PHONE_REGEX,
  EMAIL_REGEX,
  USERNAME_REGEX,
  PASSWORD_REGEX,
  TAX_REGEX,
  BANK_ACCOUNT_REGEX,
  CAR_BRAND_REGEX,
  CAR_MODEL_REGEX,
  CAR_PLATE_REGEX,
};
