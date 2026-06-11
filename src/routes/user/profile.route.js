const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/user/profile.controller');

router.get('/:phoneNo', profileController.getProfile);
router.post('/update', profileController.updateProfile);

// User Car Routes
router.get('/car/:phoneNo', profileController.getUserCars);
router.post('/car', profileController.addUserCar);
router.delete('/car/:usercarid', profileController.deleteUserCar);

// Car Type Route
router.get('/cartype/all', profileController.getCarTypes);

module.exports = router;
