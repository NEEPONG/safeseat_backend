const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/driver/authRoutes');
const userRoutes = require('./routes/driver/userRoutes');
const walletRoutes = require('./routes/driver/walletRoutes');
const buddyRequestRoutes = require('./routes/driver/buddyRequestRoutes');
const driverReportRoutes = require('./routes/driver/driverReportRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/buddy-team', buddyRequestRoutes);
app.use('/api/driver-reports', driverReportRoutes);

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

module.exports = app;