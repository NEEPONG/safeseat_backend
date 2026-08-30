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

        const fee = parseFloat(requestfee || 0);

        // 1. หากผู้ใช้เลือกชำระด้วย SafeSeat Wallet (2) ให้ตรวจสอบและหักเงินทันที
        if (mappedPaymentMethod === 2) {
            const { data: user, error: userErr } = await supabase
                .from('User')
                .select('walletbalance')
                .eq('phoneno', user_id)
                .maybeSingle();

            if (userErr || !user) {
                throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
            }

            const currentBalance = parseFloat(user.walletbalance || 0);
            if (currentBalance < fee) {
                throw new Error(`ยอดเงินใน SafeSeat Wallet ไม่เพียงพอ (คงเหลือ: ฿${currentBalance.toFixed(2)}, ค่าบริการ: ฿${fee.toFixed(2)})`);
            }

            const newBalance = parseFloat((currentBalance - fee).toFixed(2));
            const { error: deductErr } = await supabase
                .from('User')
                .update({ walletbalance: newBalance })
                .eq('phoneno', user_id);

            if (deductErr) {
                console.error("Error deducting user wallet balance:", deductErr);
                throw new Error('เกิดข้อผิดพลาดในการหักเงินจาก SafeSeat Wallet');
            }
            console.log(`[Wallet Payment] Deducted ฿${fee} from user ${user_id}. New balance: ฿${newBalance}`);
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
            requestfee: fee,
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
            // คืนเงินกลับหากเกิดข้อผิดพลาดในการบันทึกคำขอ (Rollback)
            if (mappedPaymentMethod === 2) {
                try {
                    const { data: user } = await supabase.from('User').select('walletbalance').eq('phoneno', user_id).maybeSingle();
                    if (user) {
                        const rollBal = parseFloat((parseFloat(user.walletbalance || 0) + fee).toFixed(2));
                        await supabase.from('User').update({ walletbalance: rollBal }).eq('phoneno', user_id);
                    }
                } catch (_) {}
            }
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
        const cleanId = parseInt(id, 10);

        // 1. Fetch request details to check payment method, status and fee before cancel
        const { data: reqData } = await supabase
            .from('requestbyuser')
            .select('*')
            .eq('requestid', cleanId)
            .maybeSingle();

        const { data, error } = await supabase
            .from('requestbyuser')
            .update({ requeststatus: 'ยกเลิก' })
            .eq('requestid', cleanId)
            .select();

        if (error) {
            console.error("Error canceling request:", error);
            throw new Error(error.message);
        }

        // 2. If paid by SafeSeat Wallet (2) and wasn't already completed/cancelled, refund the wallet
        if (reqData && parseInt(reqData.paymentmethod, 10) === 2 && reqData.user_id && reqData.requeststatus !== 'ยกเลิก' && reqData.requeststatus !== 'เสร็จสิ้น') {
            try {
                const refundAmount = parseFloat(reqData.requestfee || 0);
                if (refundAmount > 0) {
                    const { data: user } = await supabase
                        .from('User')
                        .select('walletbalance')
                        .eq('phoneno', reqData.user_id)
                        .maybeSingle();

                    if (user) {
                        const currentBalance = parseFloat(user.walletbalance || 0);
                        const refundedBalance = parseFloat((currentBalance + refundAmount).toFixed(2));
                        await supabase
                            .from('User')
                            .update({ walletbalance: refundedBalance })
                            .eq('phoneno', reqData.user_id);
                        console.log(`[Wallet Refund] Refunded ฿${refundAmount} to user ${reqData.user_id} due to cancel. New balance: ฿${refundedBalance}`);
                    }
                }
            } catch (refErr) {
                console.error("Error refunding user wallet on cancel:", refErr);
            }
        }

        return data;
    }
}

module.exports = RequestService;
