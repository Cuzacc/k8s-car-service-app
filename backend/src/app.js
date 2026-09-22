const express = require('express');
const cors = require('cors');
const { register, httpRequestDurationMicroseconds, httpRequestsTotal } = require('./metrics');
const { initDatabase, getServices, getBookings, createBooking, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Intercept all requests for RED Method Prometheus Metrics
app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationInSeconds = diff[0] + diff[1] / 1e9;
        const route = req.route ? req.route.path : req.path;
        
        httpRequestDurationMicroseconds
            .labels(req.method, route, res.statusCode)
            .observe(durationInSeconds);

        httpRequestsTotal
            .labels(req.method, route, res.statusCode)
            .inc();
    });
    next();
});

// ==========================================
// 1. Prometheus Telemetry Endpoint
// ==========================================
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err.message);
    }
});

// ==========================================
// 2. Kubernetes Probes (Health / Readiness)
// ==========================================
app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        tier: 'Tier-2-Backend'
    });
});

app.get('/readyz', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'READY', db: 'CONNECTED' });
    } catch (err) {
        // Still return 200 ready if in fallback mode
        res.status(200).json({ status: 'READY', db: 'STANDBY_FALLBACK' });
    }
});

// ==========================================
// 3. Business REST APIs
// ==========================================
app.get('/api/v1/services', async (req, res) => {
    const services = await getServices();
    res.json({ success: true, count: services.length, data: services });
});

app.get('/api/v1/bookings', async (req, res) => {
    const bookings = await getBookings();
    res.json({ success: true, count: bookings.length, data: bookings });
});

app.post('/api/v1/bookings', async (req, res) => {
    const { customer_name, vehicle_model, service_id, phone } = req.body;
    if (!customer_name || !vehicle_model) {
        return res.status(400).json({ success: false, error: 'Customer name and vehicle model are required' });
    }
    const booking = await createBooking({ customer_name, vehicle_model, service_id, phone });
    res.status(201).json({ success: true, message: 'Booking created successfully', data: booking });
});

app.get('/api/v1/system-info', (req, res) => {
    res.json({
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        env: process.env.NODE_ENV || 'production'
    });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Car Service Backend API listening on port ${PORT}`);
    await initDatabase();
});
