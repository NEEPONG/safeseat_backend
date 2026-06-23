class LocationService {
    /**
     * Search coordinates or places using Google Maps SerpApi.
     * @param {string} q 
     * @param {string|number} lat 
     * @param {string|number} lng 
     * @returns {Promise<Array>} List of matching places
     */
    static async searchLocation(q, lat, lng) {
        if (!q) {
            throw new Error('Query parameter q is required');
        }

        const apiKey = process.env.SERP_API_KEY;
        if (!apiKey) {
            console.error('SERP_API_KEY is missing in env');
            throw new Error('Server configuration error');
        }

        // Bias results around coordinates if provided
        let llParam = '';
        if (lat && lng) {
            llParam = `&ll=@${lat},${lng},14z`;
        }

        const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(q)}${llParam}&api_key=${apiKey}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`SerpApi responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract results from Google Maps local_results or place_results
        let places = [];
        if (data.local_results && Array.isArray(data.local_results)) {
            places = data.local_results.map(item => ({
                name: item.title || '',
                address: item.address || '',
                latitude: item.gps_coordinates?.latitude || 0,
                longitude: item.gps_coordinates?.longitude || 0
            }));
        } else if (data.place_results) {
            const item = data.place_results;
            places = [{
                name: item.title || '',
                address: item.address || '',
                latitude: item.gps_coordinates?.latitude || 0,
                longitude: item.gps_coordinates?.longitude || 0
            }];
        }

        return places;
    }
}

module.exports = LocationService;
