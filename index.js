const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = async () => {
  const conn = require('./config/db');
  await conn();
};

const { initSocket } = require('./socket/socketHandler');
const { initCrons } = require('./services/cronService');
const errorMiddleware = require('./middleware/errorMiddleware');
const ApiError = require('./utils/apiError');

// Initialize database connection
connectDB();

const app = express();
const server = http.createServer(app);

// 1. Middlewares
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'https://rent-nest-eu5p.onrender.com'];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:') || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 2. Static File Serving (for uploads, lease agreements, and receipts)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/leases', express.static(path.join(__dirname, 'public/leases')));
app.use('/receipts', express.static(path.join(__dirname, 'public/receipts')));

// 3. Socket.io Initialization
const io = initSocket(server);
app.set('socketio', io);

// 4. Register API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/leases', require('./routes/leaseRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/dashboards', require('./routes/dashboardRoutes'));

// 5. Fallback Route for non-existent endpoints
// app.all('*', (req, res, next) => {
//   next(new ApiError(404, `Can't find ${req.originalUrl} on this server!`));
// });

// 6. Global Error Handler Middleware
app.use(errorMiddleware);

// 7. Initialize Cron Jobs
initCrons();

// 8. Start Server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

module.exports = { app, server };
