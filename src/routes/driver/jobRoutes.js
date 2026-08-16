const express = require('express');
const JobController = require('../../controllers/driver/jobController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Route สำหรับรับงานและจบงาน
router.post('/accept', JobController.acceptJob);
router.post('/complete', upload.single('evidenceImage'), JobController.completeJob);

module.exports = router;
