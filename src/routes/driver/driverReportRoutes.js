const express = require('express');
const DriverReportController = require('../../controllers/driver/driverReportController');

const router = express.Router();

// Route to get all reports or reports for a specific driver
router.get('/', DriverReportController.getReports);

// Route to create a new report
router.post('/', DriverReportController.createReport);

module.exports = router;
