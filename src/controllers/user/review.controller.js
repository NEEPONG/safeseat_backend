const ReviewService = require('../../services/user/review.service.js');

class ReviewController {
    static async createReview(req, res) {
        try {
            const data = await ReviewService.createReview(req.body);
            return res.status(201).json({
                message: 'Review created successfully',
                review: data,
            });
        } catch (error) {
            console.error("Error in createReview controller:", error);
            if (error.message.includes('Please provide')) {
                return res.status(400).json({ error: error.message });
            }
            return res.status(500).json({ error: error.message || 'Internal server error' });
        }
    }

    static async checkReview(req, res) {
        try {
            const { requestId } = req.params;
            if (!requestId) {
                return res.status(400).json({ error: 'Please provide requestId' });
            }
            const reviews = await ReviewService.getReviewsByRequest(requestId);
            return res.status(200).json({
                hasReviewed: reviews.length > 0,
                reviews,
            });
        } catch (error) {
            console.error("Error in checkReview controller:", error);
            return res.status(500).json({ error: error.message || 'Internal server error' });
        }
    }
}

module.exports = ReviewController;
