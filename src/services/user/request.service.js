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

        let resolvedDropoffAddress = rawBody.dropoffaddress || rawBody.dropoffname || null;
        let resolvedPickupAddress = rawBody.pickupaddress || rawBody.pickupname || null;

        if (!resolvedDropoffAddress && dropofflatitude && dropofflongitude) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${dropofflatitude}&lon=${dropofflongitude}&accept-language=th`, {
                    headers: { 'User-Agent': 'SafeSeatBackend/1.0' }
                });
                if (res.ok) {
                    const data = await res.json();
                    const name = data.name;
                    const addr = data.address;
                    if (name && name.trim()) {
                        resolvedDropoffAddress = name.trim();
                    } else if (addr) {
                        const road = addr.road || addr.suburb || addr.neighbourhood;
                        const city = addr.city || addr.town || addr.province;
                        if (road && city) resolvedDropoffAddress = `${road}, ${city}`;
                        else if (road) resolvedDropoffAddress = road;
                        else if (city) resolvedDropoffAddress = city;
                    }
                    if (!resolvedDropoffAddress && data.display_name) {
                        resolvedDropoffAddress = data.display_name.split(',').slice(0, 2).join(',').trim();
                    }
                }
            } catch (err) {
                console.error("Reverse geocode dropoff error:", err.message);
            }
        }

        if (!resolvedPickupAddress && pickuplatitude && pickuplongitude) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pickuplatitude}&lon=${pickuplongitude}&accept-language=th`, {
                    headers: { 'User-Agent': 'SafeSeatBackend/1.0' }
                });
                if (res.ok) {
                    const data = await res.json();
                    const name = data.name;
                    const addr = data.address;
                    if (name && name.trim()) {
                        resolvedPickupAddress = name.trim();
                    } else if (addr) {
                        const road = addr.road || addr.suburb || addr.neighbourhood;
                        const city = addr.city || addr.town || addr.province;
                        if (road && city) resolvedPickupAddress = `${road}, ${city}`;
                        else if (road) resolvedPickupAddress = road;
                        else if (city) resolvedPickupAddress = city;
                    }
                    if (!resolvedPickupAddress && data.display_name) {
                        resolvedPickupAddress = data.display_name.split(',').slice(0, 2).join(',').trim();
                    }
                }
            } catch (err) {
                console.error("Reverse geocode pickup error:", err.message);
            }
        }

        const requestPayload = {
            dropofflatitude: parseFloat(dropofflatitude),
            dropofflongitude: parseFloat(dropofflongitude),
            dropoffaddress: resolvedDropoffAddress,
            pickupaddress: resolvedPickupAddress,
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
                // Fetch leader and follower driver profiles
                const { data: leader } = await supabase
                    .from('driver')
                    .select('username, firstname, lastname, phone_no, license_plate')
                    .eq('username', team.leaderid)
                    .maybeSingle();
                const { data: follower } = await supabase
                    .from('driver')
                    .select('username, firstname, lastname, phone_no')
                    .eq('username', team.followerid)
                    .maybeSingle();
                request.leader = leader;
                request.follower = follower;
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
