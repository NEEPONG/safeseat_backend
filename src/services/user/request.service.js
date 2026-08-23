const { supabase } = require('../../config/supabase.js');

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
                // Fetch leader and follower driver profiles.
                // NOTE: driver table stores phone in `phoneno` and the license plate
                // lives in the `drivercar` table (`carplate`) joined via `driver_car`.
                // Map them to the `phone_no` / `license_plate` keys the mini app expects.
                const { data: leader } = await supabase
                    .from('driver')
                    .select('username, firstname, lastname, phoneno, drivercar:driver_car(carplate)')
                    .eq('username', team.leaderid)
                    .maybeSingle();
                const { data: follower } = await supabase
                    .from('driver')
                    .select('username, firstname, lastname, phoneno')
                    .eq('username', team.followerid)
                    .maybeSingle();
                if (leader) {
                    request.leader = {
                        username: leader.username,
                        firstname: leader.firstname,
                        lastname: leader.lastname,
                        phone_no: leader.phoneno,
                        license_plate: leader.drivercar?.carplate || null,
                    };
                }
                if (follower) {
                    request.follower = {
                        username: follower.username,
                        firstname: follower.firstname,
                        lastname: follower.lastname,
                        phone_no: follower.phoneno,
                    };
                }
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
                    // Same enrichment as getRequestStatus (see note above about phoneno / drivercar.carplate)
                    const { data: leader } = await supabase
                        .from('driver')
                        .select('username, firstname, lastname, phoneno, drivercar:driver_car(carplate)')
                        .eq('username', team.leaderid)
                        .maybeSingle();
                    const { data: follower } = await supabase
                        .from('driver')
                        .select('username, firstname, lastname, phoneno')
                        .eq('username', team.followerid)
                        .maybeSingle();
                    if (leader) {
                        request.leader = {
                            username: leader.username,
                            firstname: leader.firstname,
                            lastname: leader.lastname,
                            phone_no: leader.phoneno,
                            license_plate: leader.drivercar?.carplate || null,
                        };
                    }
                    if (follower) {
                        request.follower = {
                            username: follower.username,
                            firstname: follower.firstname,
                            lastname: follower.lastname,
                            phone_no: follower.phoneno,
                        };
                    }
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
