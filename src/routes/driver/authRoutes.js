const express = require('express');
const AuthController = require('../../controllers/driver/authController');
const router = express.Router();
const multer = require('multer');

// Configure multer to temporarily hold file attachments in 'uploads/'
const upload = multer({ dest: 'uploads/' });

router.post('/login', AuthController.login);

// POST /api/auth/register
// Form-data: text fields + files
router.post('/register', upload.fields([
  { name: 'regisImagePath', maxCount: 1 },
  { name: 'carImagePath', maxCount: 1 },
  { name: 'driverLicensePath', maxCount: 1 },
  { name: 'criminalRecordPath', maxCount: 1 },
  { name: 'medicalCertificatePath', maxCount: 1 },
  { name: 'trainingCert1Path', maxCount: 1 },
  { name: 'trainingCert2Path', maxCount: 1 },
  { name: 'trainingCert3Path', maxCount: 1 },
  { name: 'trainingCert4Path', maxCount: 1 }
]), AuthController.register);

module.exports = router;

