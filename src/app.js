const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/driver/authRoutes');
const userRoutes = require('./routes/driver/userRoutes');
const walletRoutes = require('./routes/driver/walletRoutes');
const buddyRequestRoutes = require('./routes/driver/buddyRequestRoutes');
const driverReportRoutes = require('./routes/driver/driverReportRoutes');
const userReportRoutes = require('./routes/driver/userReportRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/buddy-team', buddyRequestRoutes);
app.use('/api/driver-reports', driverReportRoutes);
app.use('/api/user-reports', userReportRoutes);

// Pub routes
const pubRoute = require('./routes/pub/pub.route');
app.use('/api/pub', pubRoute);

// User auth fallback
const userAuthRoute = require('./routes/user/auth.route');
app.use('/api/user/auth', userAuthRoute);

// User profile route
const userProfileRoute = require('./routes/user/profile.route');
app.use('/api/user/profile', userProfileRoute);

// User location route (SerpApi wrapper)
const userLocationRoute = require('./routes/user/location.route');
app.use('/api/user/location', userLocationRoute);

// User request route
const userRequestRoute = require('./routes/user/request.route');
app.use('/api/user/request', userRequestRoute);

// Admin routes
const adminRoutes = require('./routes/admin/adminRoutes');
app.use('/api/admin', adminRoutes);

// Search routes (SerpApi / Nominatim)
const searchRoutes = require('./routes/searchRoute');
app.use('/api/search', searchRoutes);

module.exports = app;


