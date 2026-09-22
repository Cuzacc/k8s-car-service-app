const { Pool } = require('pg');
const { dbQueriesTotal, activeBookingsGauge } = require('./metrics');

const pool = new Pool({
    host: process.env.DB_HOST || 'postgres-svc',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'car_admin',
    password: process.env.DB_PASSWORD || 'car_secure_pass_2025',
    database: process.env.DB_NAME || 'autocare_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 4000
});

// Mock initial data if DB connection is unavailable
const mockServices = [
    { id: 1, name: 'Periodic Maintenance', price: 89.99, tag: 'Popular', description: 'Engine oil replacement, brake inspection, fluid top-up, and full safety audit.' },
    { id: 2, name: 'EV & Battery Diagnostics', price: 149.99, tag: 'Eco Tech', description: 'High-voltage battery diagnostics, thermal management checks, and motor test.' },
    { id: 3, name: 'ECU Tuning & Sensor Calibration', price: 199.99, tag: 'Advanced', description: 'Advanced sensor recalibration, firmware updates, and performance tuning.' }
];

let inMemoryBookings = [
    { id: 101, customer_name: 'Nguyen Van A', vehicle_model: 'VinFast VF8', service_id: 2, status: 'Confirmed', created_at: new Date() }
];

async function initDatabase() {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL Database (Tier 3)');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                tag VARCHAR(50),
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                vehicle_model VARCHAR(255) NOT NULL,
                service_id INT,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed data if empty
        const countRes = await client.query('SELECT COUNT(*) FROM services');
        if (parseInt(countRes.rows[0].count, 10) === 0) {
            for (const s of mockServices) {
                await client.query('INSERT INTO services (name, price, tag, description) VALUES ($1, $2, $3, $4)', [s.name, s.price, s.tag, s.description]);
            }
        }
        client.release();
    } catch (err) {
        console.warn('⚠️ Warning: PostgreSQL not reachable yet. Using In-Memory fallback mode.', err.message);
    }
}

async function getServices() {
    try {
        const res = await pool.query('SELECT * FROM services ORDER BY id ASC');
        dbQueriesTotal.inc({ operation: 'SELECT_SERVICES', status: 'success' });
        return res.rows.length > 0 ? res.rows : mockServices;
    } catch (err) {
        dbQueriesTotal.inc({ operation: 'SELECT_SERVICES', status: 'error' });
        return mockServices;
    }
}

async function getBookings() {
    try {
        const res = await pool.query('SELECT b.*, s.name as service_name FROM bookings b LEFT JOIN services s ON b.service_id = s.id ORDER BY b.id DESC');
        dbQueriesTotal.inc({ operation: 'SELECT_BOOKINGS', status: 'success' });
        activeBookingsGauge.set(res.rows.length);
        return res.rows;
    } catch (err) {
        dbQueriesTotal.inc({ operation: 'SELECT_BOOKINGS', status: 'error' });
        activeBookingsGauge.set(inMemoryBookings.length);
        return inMemoryBookings;
    }
}

async function createBooking(data) {
    try {
        const res = await pool.query(
            'INSERT INTO bookings (customer_name, phone, vehicle_model, service_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [data.customer_name, data.phone || '', data.vehicle_model, data.service_id || 1, 'Confirmed']
        );
        dbQueriesTotal.inc({ operation: 'INSERT_BOOKING', status: 'success' });
        activeBookingsGauge.inc();
        return res.rows[0];
    } catch (err) {
        dbQueriesTotal.inc({ operation: 'INSERT_BOOKING', status: 'error' });
        const newBooking = { id: Date.now(), ...data, status: 'Confirmed', created_at: new Date() };
        inMemoryBookings.push(newBooking);
        activeBookingsGauge.set(inMemoryBookings.length);
        return newBooking;
    }
}

module.exports = {
    pool,
    initDatabase,
    getServices,
    getBookings,
    createBooking
};
