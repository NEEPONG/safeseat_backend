const express = require('express');
const router = express.Router();
const { validateSearchQuery } = require('../middlewares/validate');

// Route for searching places using SerpApi (with Nominatim fallback)
router.get('/places', validateSearchQuery, async (req, res) => {
  try {
    const { q } = req.query;

    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'SerpApi API key is not configured in the system environment variables.' });
    }

    // Use SerpApi Google Maps search
    const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(q)}&api_key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: 'SerpApi error: ' + data.error });
    }

    let results = [];

    // Extract from place_results (single exact match)
    if (data.place_results && data.place_results.gps_coordinates) {
      results.push({
        title: data.place_results.title || q,
        address: data.place_results.address || '',
        latitude: data.place_results.gps_coordinates.latitude,
        longitude: data.place_results.gps_coordinates.longitude,
        source: 'serpapi_google_maps'
      });
    }

    // Extract from local_results (multiple matches)
    if (data.local_results && Array.isArray(data.local_results)) {
      data.local_results.forEach(item => {
        if (item.gps_coordinates) {
          results.push({
            title: item.title || '',
            address: item.address || '',
            latitude: item.gps_coordinates.latitude,
            longitude: item.gps_coordinates.longitude,
            source: 'serpapi_google_maps'
          });
        }
      });
    }

    return res.json({ results });
  } catch (error) {
    console.error('Error searching places:', error);
    return res.status(500).json({ error: 'Failed to search places', details: error.message });
  }
});

module.exports = router;
