const express = require('express');
const router = express.Router();
const profileController = require('../../controllers/user/profile.controller');

router.get('/:phoneNo', profileController.getProfile);
router.post('/update', profileController.updateProfile);

module.exports = router;
