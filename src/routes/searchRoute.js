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

    const isWithinThailand = (lat, lng) => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      return lat >= 5.5 && lat <= 20.5 && lng >= 97.0 && lng <= 106.0;
    };

    // Use SerpApi Google Maps search with Thailand context (gl=th, hl=th)
    const searchQuery = q.includes('ไทย') || q.toLowerCase().includes('thailand') ? q : `${q} ประเทศไทย`;
    const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(searchQuery)}&gl=th&hl=th&api_key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    let results = [];

    // Extract from place_results (single exact match)
    if (data.place_results && data.place_results.gps_coordinates) {
      const lat = data.place_results.gps_coordinates.latitude;
      const lng = data.place_results.gps_coordinates.longitude;
      if (isWithinThailand(lat, lng)) {
        results.push({
          title: data.place_results.title || q,
          address: data.place_results.address || '',
          latitude: lat,
          longitude: lng,
          source: 'serpapi_google_maps'
        });
      }
    }

    // Extract from local_results (multiple matches)
    if (data.local_results && Array.isArray(data.local_results)) {
      data.local_results.forEach(item => {
        if (item.gps_coordinates) {
          const lat = item.gps_coordinates.latitude;
          const lng = item.gps_coordinates.longitude;
          if (isWithinThailand(lat, lng)) {
            results.push({
              title: item.title || '',
              address: item.address || '',
              latitude: lat,
              longitude: lng,
              source: 'serpapi_google_maps'
            });
          }
        }
      });
    }

    // Fallback: OpenStreetMap Nominatim restricted to Thailand (countrycodes=th)
    if (results.length === 0) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=th&limit=5&addressdetails=1`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'SafeSeat-App/1.0' }
        });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData)) {
            nomData.forEach(item => {
              const lat = parseFloat(item.lat);
              const lng = parseFloat(item.lon);
              if (isWithinThailand(lat, lng)) {
                results.push({
                  title: item.name || item.display_name?.split(',')[0] || q,
                  address: item.display_name || '',
                  latitude: lat,
                  longitude: lng,
                  source: 'nominatim_thailand'
                });
              }
            });
          }
        }
      } catch (nomErr) {
        console.error('Nominatim fallback error:', nomErr);
      }
    }

    return res.json({ results });
  } catch (error) {
    console.error('Error searching places:', error);
    return res.status(500).json({ error: 'Failed to search places', details: error.message });
  }
});

module.exports = router;
