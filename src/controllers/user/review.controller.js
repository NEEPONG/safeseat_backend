const ReviewService = require('../../services/user/review.service.js');

const createReview = async (req, res) => {
    try {
        const review = await ReviewService.createReview(req.body);
        return res.status(201).json({
            success: true,
            message: 'ส่งรีวิวสำเร็จ',
            data: review
        });
    } catch (error) {
        console.error("Create review error:", error);
        if (error.message === 'Please provide request_id, driverusername and reviewrate') {
            return res.status(400).json({ error: error.message });
        }
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

const getReviewsByRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const result = await ReviewService.getReviewsByRequest(requestId);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error("Get reviews error:", error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

module.exports = { createReview, getReviewsByRequest };
