const express = require('express');
const { login } = require('../../controllers/user/auth.controller.js');

const router = express.Router();

router.post('/login', login);

module.exports = router;

