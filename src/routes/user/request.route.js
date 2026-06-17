const express = require('express');
const router = express.Router();
const requestController = require('../../controllers/user/request.controller');

router.post('/', requestController.createRequest);
router.get('/:id', requestController.getRequestStatus);
router.delete('/:id', requestController.cancelRequest);

module.exports = router;
