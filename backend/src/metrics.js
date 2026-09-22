const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Enable the collection of default system metrics (CPU, RAM, Event Loop, GC)
client.collectDefaultMetrics({
    app: 'car-serv-backend',
    prefix: 'node_',
    timeout: 10000,
    register
});

// Custom Application Metrics (RED Method)
const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests made to backend',
    labelNames: ['method', 'route', 'status_code']
});

const dbQueriesTotal = new client.Counter({
    name: 'db_queries_total',
    help: 'Total number of database queries executed',
    labelNames: ['operation', 'status']
});

const activeBookingsGauge = new client.Gauge({
    name: 'active_service_bookings_total',
    help: 'Current active car maintenance bookings count'
});

register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(dbQueriesTotal);
register.registerMetric(activeBookingsGauge);

module.exports = {
    register,
    httpRequestDurationMicroseconds,
    httpRequestsTotal,
    dbQueriesTotal,
    activeBookingsGauge
};
