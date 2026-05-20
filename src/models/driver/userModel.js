const supabase = require('./dbClient');
const { formatDriverDocs } = require('../../utils/supabaseStorage');

class UserModel {
  // Get user profile by username (phone number)
  static async getProfileByUsername(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('*')
      .or(`username.eq.${username},phoneno.eq.${username}`)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return formatDriverDocs(data);
  }

  // Update user profile
  static async updateProfile(username, profileData) {
    const { data, error } = await supabase
      .from('driver')
      .update(profileData)
      .eq('username', username)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }
    return formatDriverDocs(data);
  }
  // Search users by name or username
  static async searchUsers(search, category, exclude, lat, lng, radius = 2) {
    let query = supabase.from('driver').select('*').eq('registerstatus', 'อนุมัติแล้ว');

    if (search) {
      query = query.or(`firstname.ilike.%${search}%,lastname.ilike.%${search}%,username.ilike.%${search}%`);
    }

    if (exclude) {
      query = query.neq('username', exclude);
    }

    // Nearby logic (Bounding box approximation for radius in km)
    if (category === 'nearby' && lat && lng) {
      const r = parseFloat(radius);
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      // 1 degree latitude ~ 111km
      // 1 degree longitude ~ 111km * cos(latitude)
      const latDelta = r / 111.0;
      const lngDelta = r / (111.0 * Math.cos(latitude * Math.PI / 180));

      query = query
        .gte('latitude', latitude - latDelta)
        .lte('latitude', latitude + latDelta)
        .gte('longitude', longitude - lngDelta)
        .lte('longitude', longitude + lngDelta);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // If lat/lng provided, calculate distance for each user
    if (data && lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      return data.map(user => {
        const formattedUser = formatDriverDocs(user);
        if (formattedUser.latitude && formattedUser.longitude) {
          const dLat = (formattedUser.latitude - latitude) * Math.PI / 180;
          const dLng = (formattedUser.longitude - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(latitude * Math.PI / 180) * Math.cos(formattedUser.latitude * Math.PI / 180) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = 6371 * c; // Earth radius in km
          return { ...formattedUser, distance: `${distance.toFixed(1)} km` };
        }
        return { ...formattedUser, distance: 'Nearby' };
      });
    }

    return data ? data.map(formatDriverDocs) : data;
  }
}

module.exports = UserModel;
