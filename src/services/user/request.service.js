const { supabase } = require('../../config/supabase.js');
const { getFullStorageUrl } = require('../../utils/supabaseStorage.js');

/**
 * Extracts and normalizes public profile image URL from driver's regisimagepath.
 * @param {string|object|Array} regisimagepath
 * @returns {string|null} Full public image URL
 */
const extractDriverProfileImage = (regisimagepath) => {
    if (!regisimagepath) return null;
    try {
        const parsed = typeof regisimagepath === 'string' ? JSON.parse(regisimagepath) : regisimagepath;
        if (Array.isArray(parsed) && parsed.length > 0) {
            return getFullStorageUrl(parsed[0]);
        }
        if (parsed && typeof parsed === 'object') {
            if (parsed.profile) return getFullStorageUrl(parsed.profile);
            const firstVal = Object.values(parsed)[0];
            if (firstVal) return getFullStorageUrl(firstVal);
        }
        return getFullStorageUrl(regisimagepath);
    } catch (e) {
        return getFullStorageUrl(regisimagepath);
    }
};

/**
 * Fetches actual average rating and review count from review table.
 * @param {string} username Driver username
 * @returns {Promise<{rating: number, total_reviews: number}>}
 */
const fetchDriverRating = async (username) => {
    if (!username) return { rating: 5.0, total_reviews: 0 };
    try {
        const { data: reviews, error } = await supabase
            .from('review')
            .select('reviewrate')
            .eq('driverusername', username);
        if (error || !reviews || reviews.length === 0) {
            return { rating: 5.0, total_reviews: 0 };
        }
        const total = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (Number(r.reviewrate) || 0), 0);
        const avg = parseFloat((sum / total).toFixed(1));
        return { rating: avg, total_reviews: total };
    } catch (e) {
        return { rating: 5.0, total_reviews: 0 };
    }
};

/**
 * Helper to query and enrich driver profile details with avatar, rating, and driver vehicle.
 * @param {string} username
 * @param {boolean} isLeader
 * @returns {Promise<object|null>}
 */
const enrichDriverProfile = async (username, isLeader = false) => {
    if (!username) return null;
    try {
        const selectQuery = 'username, firstname, lastname, phoneno, regisimagepath, drivercar:driver_car(carbrand, carmodel, carcolor, carplate, carimagepath)';

        const { data: driver } = await supabase
            .from('driver')
            .select(selectQuery)
            .eq('username', username)
            .maybeSingle();

        if (!driver) return null;

        const ratingInfo = await fetchDriverRating(driver.username);

        const carInfo = driver.drivercar ? {
            brand: driver.drivercar.carbrand || null,
            model: driver.drivercar.carmodel || null,
            color: driver.drivercar.carcolor || null,
            plate: driver.drivercar.carplate || null,
            image: driver.drivercar.carimagepath ? getFullStorageUrl(driver.drivercar.carimagepath) : null,
        } : null;

        return {
            username: driver.username,
            firstname: driver.firstname,
            lastname: driver.lastname,
            phone_no: driver.phoneno,
            license_plate: driver.drivercar?.carplate || null,
            driver_car: carInfo,
            profile_image: extractDriverProfileImage(driver.regisimagepath),
            rating: ratingInfo.rating,
            total_reviews: ratingInfo.total_reviews,
        };
    } catch (err) {
        console.error(`Error enriching driver profile for ${username}:`, err);
        return null;
    }
};

class RequestService {
    /**
     * Create a driver request.
     * @param {object} rawBody 
     * @returns {Promise<object>} Inserted request record
     */
    static async createRequest(rawBody) {
        const {
            dropofflatitude,
            dropofflongitude,
            isladymode,
            note,
            paymentmethod,
            pickuplatitude,
            pickuplongitude,
            reqdistance,
            requestfee,
            user_id,
            user_car_id,
        } = rawBody;

        if (!user_id || !user_car_id) {
            throw new Error('Please provide user_id and user_car_id');
        }

        // Map paymentmethod string to integer if necessary
        // 1 = Cash, 2 = SafeSeat Wallet
        let mappedPaymentMethod = 1;
        if (typeof paymentmethod === 'string') {
            if (paymentmethod.startsWith('เงินสด') || paymentmethod.toLowerCase().includes('cash')) {
                mappedPaymentMethod = 1;
            } else if (paymentmethod.toLowerCase().includes('wallet') || paymentmethod.toLowerCase().includes('safeseat')) {
                mappedPaymentMethod = 2;
            }
        } else if (typeof paymentmethod === 'number') {
            mappedPaymentMethod = paymentmethod;
        }

        const requestPayload = {
            dropofflatitude: parseFloat(dropofflatitude),
            dropofflongitude: parseFloat(dropofflongitude),
            isladymode: !!isladymode,
            note: note || null,
            paymentmethod: mappedPaymentMethod,
            pickuplatitude: parseFloat(pickuplatitude),
            pickuplongitude: parseFloat(pickuplongitude),
            reqdistance: parseFloat(reqdistance),
            requestfee: parseFloat(requestfee),
            requeststatus: 'กำลังค้นหาคนขับ',
            user_id: user_id,
            user_car_id: parseInt(user_car_id, 10),
        };

        const { data, error } = await supabase
            .from('requestbyuser')
            .insert([requestPayload])
            .select()
            .maybeSingle();

        if (error) {
            console.error("Error creating request:", error);
            throw new Error(error.message);
        }

        return data;
    }

    /**
     * Get request status and active driver buddy coordinates if assigned.
     * @param {string|number} id Request ID
     * @returns {Promise<object>} Resolving status info
     */
    static async getRequestStatus(id) {
        const { data: request, error } = await supabase
            .from('requestbyuser')
            .select('*')
            .eq('requestid', parseInt(id, 10))
            .maybeSingle();

        if (error) {
            console.error("Error fetching request:", error);
            throw new Error(error.message);
        }

        if (!request) {
            throw new Error('Request not found');
        }

        // If a driver buddy team is assigned, load its details
        if (request.buddy_team_id) {
            const { data: team } = await supabase
                .from('buddyteam')
                .select('*')
                .eq('buddyteamid', request.buddy_team_id)
                .maybeSingle();
            request.buddyteam = team;

            if (team) {
                request.leader = await enrichDriverProfile(team.leaderid, true);
                request.follower = await enrichDriverProfile(team.followerid, false);
            }
        }

        return request;
    }

    /**
     * Get all requests of a user filtered by status type.
     * @param {string} userId User phone number
     * @param {string} type 'active' | 'completed' | 'cancelled' (optional, default all)
     * @returns {Promise<Array>} List of requests enriched with buddy team + driver profiles
     */
    static async getRequestsByUser(userId, type) {
        if (!userId) {
            throw new Error('Please provide user_id');
        }

        let statuses = null;
        if (type === 'active') {
            statuses = ['กำลังค้นหาคนขับ', 'กำลังไปรับ', 'ถึงจุดรับแล้ว', 'ระหว่างเดินทาง'];
        } else if (type === 'completed') {
            statuses = ['เสร็จสิ้น'];
        } else if (type === 'cancelled') {
            statuses = ['ยกเลิก'];
        }

        let query = supabase
            .from('requestbyuser')
            .select('*')
            .eq('user_id', userId)
            .order('reqdatetime', { ascending: false });

        if (statuses && statuses.length === 1) {
            query = query.eq('requeststatus', statuses[0]);
        } else if (statuses && statuses.length > 1) {
            query = query.in('requeststatus', statuses);
        }

        const { data: requests, error } = await query;

        if (error) {
            console.error("Error fetching user requests:", error);
            throw new Error(error.message);
        }

        // Enrich each request with buddy team + driver profiles (same shape as getRequestStatus)
        const enriched = [];
        for (const request of requests || []) {
            if (request.buddy_team_id) {
                const { data: team } = await supabase
                    .from('buddyteam')
                    .select('*')
                    .eq('buddyteamid', request.buddy_team_id)
                    .maybeSingle();
                request.buddyteam = team;

                if (team) {
                    request.leader = await enrichDriverProfile(team.leaderid, true);
                    request.follower = await enrichDriverProfile(team.followerid, false);
                }
            }
            enriched.push(request);
        }

        return enriched;
    }

    /**
     * Cancel a user request by updating its status to 'ยกเลิก'.
     * @param {string|number} id Request ID
     * @returns {Promise<object>} Cancelled data
     */
    static async cancelRequest(id) {
        const { data, error } = await supabase
            .from('requestbyuser')
            .update({ requeststatus: 'ยกเลิก' })
            .eq('requestid', parseInt(id, 10))
            .select();

        if (error) {
            console.error("Error canceling request:", error);
            throw new Error(error.message);
        }

        return data;
    }
}

module.exports = RequestService;
