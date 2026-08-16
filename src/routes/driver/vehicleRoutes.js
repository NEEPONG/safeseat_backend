const express = require('express');
const VehicleController = require('../../controllers/driver/vehicleController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// GET /api/vehicles/:username
router.get('/:username', VehicleController.getVehicle);

// PUT /api/vehicles/:username
router.put('/:username', upload.fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'sideImage', maxCount: 1 }
]), VehicleController.updateVehicle);

module.exports = router;
