const { supabase } = require('../../config/supabase.js');

class ReviewService {
    /**
     * Create a review for a driver on a trip.
     * Blocks duplicates: one review per driver per request (trip).
     * @param {object} rawBody
     * @returns {Promise<object>} Inserted review record
     */
    static async createReview(rawBody) {
        const {
            request_id,
            driverusername,
            reviewrate,
            reviewcomment,
        } = rawBody;

        if (!request_id || !driverusername || reviewrate === undefined || reviewrate === null) {
            throw new Error('Please provide request_id, driverusername and reviewrate');
        }

        const rate = parseInt(reviewrate, 10);
        if (isNaN(rate) || rate < 1 || rate > 5) {
            throw new Error('reviewrate must be between 1 and 5');
        }

        const requestId = parseInt(request_id, 10);

        // Block duplicates: check whether this user already reviewed this driver for this trip
        const { data: existing, error: checkError } = await supabase
            .from('review')
            .select('reviewid')
            .eq('request_id', requestId)
            .eq('driverusername', driverusername)
            .maybeSingle();

        if (checkError) {
            console.error("Error checking existing review:", checkError);
            throw new Error(checkError.message);
        }

        if (existing) {
            const err = new Error('คุณได้รีวิวคนขับนี้สำหรับทริปนี้แล้ว');
            err.statusCode = 409;
            throw err;
        }

        const reviewPayload = {
            request_id: requestId,
            driverusername,
            reviewrate: rate,
            reviewcomment: reviewcomment || null,
            reviewdate: new Date().toISOString(),
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
     * Get all reviews for a request (trip) and whether any exist.
     * @param {string|number} requestId
     * @returns {Promise<{hasReviewed: boolean, reviews: Array}>}
     */
    static async getReviewsByRequest(requestId) {
        const { data: reviews, error } = await supabase
            .from('review')
            .select('*')
            .eq('request_id', parseInt(requestId, 10))
            .order('reviewdate', { ascending: false });

        if (error) {
            console.error("Error fetching reviews:", error);
            throw new Error(error.message);
        }

        return {
            hasReviewed: Array.isArray(reviews) && reviews.length > 0,
            reviews: reviews || [],
        };
    }
}

module.exports = ReviewService;
