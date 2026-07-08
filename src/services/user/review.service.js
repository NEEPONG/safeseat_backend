const { supabase } = require('../../config/supabase.js');

class ReviewService {
    /**
     * Create a review for a driver on a specific request.
     * @param {object} reviewData
     * @returns {Promise<object>} Created review record
     */
    static async createReview(reviewData) {
        const { request_id, driverusername, reviewrate, reviewcomment } = reviewData;

        if (!request_id || !driverusername || reviewrate === undefined) {
            throw new Error('Please provide request_id, driverusername, and reviewrate');
        }

        const reviewPayload = {
            request_id: parseInt(request_id, 10),
            driverusername,
            reviewrate: parseInt(reviewrate, 10),
            reviewcomment: reviewcomment || null,
        };

        const { data, error } = await supabase
            .from('review')
            .insert([reviewPayload])
            .select()
            .maybeSingle();

        if (error) {
            console.error("Error creating review:", error);
            throw new Error(error.message);
        }

        return data;
    }

    /**
     * Check if a request has already been reviewed.
     * @param {number} requestId
     * @returns {Promise<boolean>}
     */
    static async hasReviewed(requestId) {
        const reviews = await this.getReviewsByRequest(requestId);
        return reviews.length > 0;
    }

    /**
     * Get all reviews for a request.
     * @param {number} requestId
     * @returns {Promise<Array>}
     */
    static async getReviewsByRequest(requestId) {
        const { data, error } = await supabase
            .from('review')
            .select('reviewid, reviewrate, reviewcomment, driverusername, reviewdate')
            .eq('request_id', parseInt(requestId, 10));

        if (error) {
            console.error("Error fetching reviews:", error);
            throw new Error(error.message);
        }

        return data || [];
    }
}

module.exports = ReviewService;
