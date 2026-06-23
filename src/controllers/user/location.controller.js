const LocationService = require('../../services/user/location.service.js');

const searchLocation = async (req, res) => {
    try {
        const { q, lat, lng } = req.query;
        const places = await LocationService.searchLocation(q, lat, lng);
        return res.status(200).json({ results: places });
    } catch (error) {
        console.error('Search location error:', error);
        if (error.message === 'Query parameter q is required') {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === 'Server configuration error') {
            return res.status(500).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { searchLocation };

