const express = require('express');
const router = express.Router();
const reviewController = require('../../controllers/user/review.controller');

router.post('/', reviewController.createReview);
router.get('/check/:requestId', reviewController.checkReview);

module.exports = router;
