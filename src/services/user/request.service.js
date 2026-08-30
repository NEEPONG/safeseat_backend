const { supabase } = require('../../config/supabase.js');
const { getThaiCurrentISOString } = require('../../utils/thaiDate');

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
            reqdatetime: getThaiCurrentISOString(),
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

        // Fetch customer profile name
        let custName = 'ลูกค้า SafeSeat'
        if (request.user_id) {
            try {
                const { data: userProfile } = await supabase
                    .from('User')
                    .select('name, phoneno')
                    .eq('phoneno', request.user_id)
                    .maybeSingle();
                if (userProfile && userProfile.name) {
                    custName = userProfile.name;
                }
            } catch (errProfile) {
                console.warn("Could not load user name for requestbyuser:", errProfile);
            }
        }
        request.custname = custName;

        // If a driver buddy team is assigned, load its details
        const buddyTeamId = request.buddy_team_id || request.buddyteamid || request.buddyteam_id;
        if (buddyTeamId) {
            try {
                const teamIdNum = parseInt(buddyTeamId, 10);
                const { data: team } = await supabase
                    .from('buddyteam')
                    .select('*')
                    .eq('buddyteamid', teamIdNum)
                    .maybeSingle();
                request.buddyteam = team;
                request.buddy_team_id = teamIdNum;

                if (team) {
                    let leaderRow = null;
                    if (team.leaderid) {
                        const { data: lRow } = await supabase
                            .from('driver')
                            .select('username, firstname, lastname, phoneno')
                            .eq('username', team.leaderid)
                            .maybeSingle();
                        leaderRow = lRow;
                    }

                    let carPlate = '—';
                    if (team.leaderid) {
                        try {
                            const { data: carRow } = await supabase
                                .from('driver_car')
                                .select('carplate')
                                .eq('username', team.leaderid)
                                .maybeSingle();
                            if (carRow && carRow.carplate) {
                                carPlate = carRow.carplate;
                            }
                        } catch (carErr) {
                            console.warn("Could not load car plate for leader", carErr);
                        }
                    }

                    let followerRow = null;
                    if (team.followerid) {
                        const { data: fRow } = await supabase
                            .from('driver')
                            .select('username, firstname, lastname, phoneno')
                            .eq('username', team.followerid)
                            .maybeSingle();
                        followerRow = fRow;
                    }

                    if (leaderRow) {
                        request.leader = {
                            firstname: leaderRow.firstname,
                            lastname: leaderRow.lastname,
                            phoneno: leaderRow.phoneno,
                            phone_no: leaderRow.phoneno,
                            phone: leaderRow.phoneno,
                            license_plate: carPlate
                        };
                    } else {
                        request.leader = null;
                    }

                    if (followerRow) {
                        request.follower = {
                            firstname: followerRow.firstname,
                            lastname: followerRow.lastname,
                            phoneno: followerRow.phoneno,
                            phone_no: followerRow.phoneno,
                            phone: followerRow.phoneno
                        };
                    } else {
                        request.follower = null;
                    }
                }
            } catch (teamErr) {
                console.error("Error populating driver team info for user request:", teamErr);
            }
        }

        return request;
    }

    /**
     * Cancel (delete) a user request.
     * @param {string|number} id Request ID
     * @returns {Promise<object>} Cancelled data
     */
    static async cancelRequest(id) {
        const { data, error } = await supabase
            .from('requestbyuser')
            .delete()
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
