const express = require('express');
const router = express.Router();
const { createReview, getReviewsByRequest } = require('../../controllers/user/review.controller.js');

// POST /api/user/review — submit a review for a driver on a trip
router.post('/', createReview);

// GET /api/user/review/check/:requestId — fetch reviews for a trip + hasReviewed flag
router.get('/check/:requestId', getReviewsByRequest);

module.exports = router;
