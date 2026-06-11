const express = require('express');
const { searchLocation } = require('../../controllers/user/location.controller.js');

const router = express.Router();

router.get('/search', searchLocation);

module.exports = router;
