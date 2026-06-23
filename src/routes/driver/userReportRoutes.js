const express = require('express');
const UserReportController = require('../../controllers/driver/userReportController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Route to get user reports
router.get('/', UserReportController.getReports);

// Route to create a new user report with optional single image upload
router.post('/', upload.single('reportImage'), UserReportController.createReport);

module.exports = router;
