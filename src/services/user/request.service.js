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

/**
 * Helper to query and enrich user car details for a request.
 * @param {number|string} userCarId
 * @returns {Promise<object|null>}
 */
const enrichUserCar = async (userCarId) => {
    if (!userCarId) return null;
    try {
        const { data: car, error } = await supabase
            .from('usercar')
            .select(`
                *,
                cartype (
                    cartypename
                )
            `)
            .eq('usercarid', parseInt(userCarId, 10))
            .maybeSingle();

        if (error) {
            console.error(`Error fetching user car ${userCarId}:`, error);
            return null;
        }
        return car || null;
    } catch (err) {
        console.error(`Error in enrichUserCar for car ${userCarId}:`, err);
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

        // Load user's car details
        if (request.user_car_id) {
            request.usercar = await enrichUserCar(request.user_car_id);
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
     * Get all requests of a user filtered by status type with batch performance optimization & pagination.
     * @param {string} userId User phone number
     * @param {string} type 'active' | 'completed' | 'cancelled' (optional, default all)
     * @param {object} pagination { page, limit }
     * @returns {Promise<Array>} List of requests enriched with buddy team + driver profiles
     */
    static async getRequestsByUser(userId, type, pagination = {}) {
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

        // Apply pagination if limit is specified
        const pageNum = pagination.page ? parseInt(pagination.page, 10) : null;
        const limitNum = pagination.limit ? parseInt(pagination.limit, 10) : null;
        if (limitNum && limitNum > 0) {
            const page = pageNum && pageNum > 0 ? pageNum : 1;
            const from = (page - 1) * limitNum;
            const to = from + limitNum - 1;
            query = query.range(from, to);
        }

        const { data: requests, error } = await query;

        if (error) {
            console.error("Error fetching user requests:", error);
            throw new Error(error.message);
        }

        if (!requests || requests.length === 0) {
            return [];
        }

        // 1. Batch fetch user cars
        const carIds = [...new Set(requests.map(r => r.user_car_id).filter(Boolean))];
        let carMap = new Map();
        if (carIds.length > 0) {
            try {
                const { data: cars } = await supabase
                    .from('usercar')
                    .select('*, cartype(cartypename)')
                    .in('usercarid', carIds);
                if (cars) {
                    carMap = new Map(cars.map(c => [c.usercarid, c]));
                }
            } catch (cErr) {
                console.error("Error batch fetching user cars:", cErr);
            }
        }

        // 2. Batch fetch buddy teams
        const teamIds = [...new Set(requests.map(r => r.buddy_team_id).filter(Boolean))];
        let teamMap = new Map();
        const allDriverUsernames = new Set();
        if (teamIds.length > 0) {
            try {
                const { data: teams } = await supabase
                    .from('buddyteam')
                    .select('*')
                    .in('buddyteamid', teamIds);
                if (teams) {
                    for (const t of teams) {
                        teamMap.set(t.buddyteamid, t);
                        if (t.leaderid) allDriverUsernames.add(t.leaderid);
                        if (t.followerid) allDriverUsernames.add(t.followerid);
                    }
                }
            } catch (tErr) {
                console.error("Error batch fetching buddy teams:", tErr);
            }
        }

        // 3. Batch fetch drivers and reviews in parallel
        const driverMap = new Map();
        const driverList = [...allDriverUsernames];
        if (driverList.length > 0) {
            try {
                const [driversRes, reviewsRes] = await Promise.all([
                    supabase
                        .from('driver')
                        .select('username, firstname, lastname, phoneno, regisimagepath, drivercar:driver_car(carbrand, carmodel, carcolor, carplate, carimagepath)')
                        .in('username', driverList),
                    supabase
                        .from('review')
                        .select('driverusername, reviewrate')
                        .in('driverusername', driverList)
                ]);

                // Aggregate reviews in memory
                const ratingMap = new Map();
                if (reviewsRes.data) {
                    for (const r of reviewsRes.data) {
                        const u = (r.driverusername || '').toLowerCase();
                        if (!ratingMap.has(u)) ratingMap.set(u, []);
                        const rate = typeof r.reviewrate === 'number' ? r.reviewrate : parseFloat(r.reviewrate);
                        if (!isNaN(rate)) ratingMap.get(u).push(rate);
                    }
                }

                if (driversRes.data) {
                    for (const d of driversRes.data) {
                        const uLower = (d.username || '').toLowerCase();
                        const rates = ratingMap.get(uLower) || [];
                        const rating = rates.length > 0 ? parseFloat((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1)) : 5.0;

                        const carInfo = d.drivercar ? {
                            brand: d.drivercar.carbrand || null,
                            model: d.drivercar.carmodel || null,
                            color: d.drivercar.carcolor || null,
                            plate: d.drivercar.carplate || null,
                            image: d.drivercar.carimagepath ? getFullStorageUrl(d.drivercar.carimagepath) : null,
                        } : null;

                        driverMap.set(d.username, {
                            username: d.username,
                            firstname: d.firstname,
                            lastname: d.lastname,
                            phone_no: d.phoneno,
                            license_plate: d.drivercar?.carplate || null,
                            driver_car: carInfo,
                            profile_image: extractDriverProfileImage(d.regisimagepath),
                            rating: rating,
                            total_reviews: rates.length,
                        });
                    }
                }
            } catch (dErr) {
                console.error("Error batch fetching driver profiles:", dErr);
            }
        }

        // 4. Assemble each request in memory without extra network overhead
        const enriched = [];
        for (const request of requests) {
            if (request.user_car_id && carMap.has(request.user_car_id)) {
                request.usercar = carMap.get(request.user_car_id);
            }

            if (request.buddy_team_id && teamMap.has(request.buddy_team_id)) {
                const team = teamMap.get(request.buddy_team_id);
                request.buddyteam = team;
                if (team) {
                    request.leader = driverMap.get(team.leaderid) || null;
                    request.follower = driverMap.get(team.followerid) || null;
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
