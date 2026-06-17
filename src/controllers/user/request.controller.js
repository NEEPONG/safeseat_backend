const { supabase } = require('../../config/supabase.js');

class RequestController {
  // POST /api/user/request
  static async createRequest(req, res) {
    try {
      const {
        dropofflatitude,
        dropofflongitude,
        isladymode,
        note,
        paymentmethod, // can be string or integer
        pickuplatitude,
        pickuplongitude,
        reqdistance,
        requestfee,
        user_id,
        user_car_id,
      } = req.body;

      if (!user_id || !user_car_id) {
        return res.status(400).json({ error: 'Please provide user_id and user_car_id' });
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
        requeststatus: 'pending',
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
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({
        message: 'Request created successfully',
        request: data,
      });
    } catch (error) {
      console.error("Error in createRequest:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/user/request/:id
  static async getRequestStatus(req, res) {
    try {
      const { id } = req.params;

      const { data: request, error } = await supabase
        .from('requestbyuser')
        .select('*')
        .eq('requestid', parseInt(id, 10))
        .maybeSingle();

      if (error) {
        console.error("Error fetching request:", error);
        return res.status(500).json({ error: error.message });
      }

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
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

      return res.status(200).json({ request });
    } catch (error) {
      console.error("Error in getRequestStatus:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE /api/user/request/:id
  static async cancelRequest(req, res) {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('requestbyuser')
        .delete()
        .eq('requestid', parseInt(id, 10))
        .select();

      if (error) {
        console.error("Error canceling request:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        message: 'Request canceled (deleted) successfully',
        data: data,
      });
    } catch (error) {
      console.error("Error in cancelRequest:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = RequestController;
