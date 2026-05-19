const express = require('express');
const AuthController = require('../../controllers/driver/authController');
const router = express.Router();

router.post('/login', AuthController.login);
module.exports = router;
