require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initFirebase } = require('./firebase/config');

const app = express();
const PORT = process.env.PORT || 3000;

// HTTPS redirect for production (Render, Heroku, etc.)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { ok: false, error: 'Demasiadas peticiones. Intenta en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { ok: false, error: 'Demasiadas peticiones destructivas. Espera 1 minuto.' },
});
app.use('/api', (req, res, next) => {
  if (req.method === 'DELETE' || req.method === 'PUT') {
    return strictLimiter(req, res, next);
  }
  next();
});

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes - load after DB is ready
let apiRoutes;
app.use('/api', async (req, res, next) => {
  if (!apiRoutes) {
    apiRoutes = require('./routes/api');
  }
  apiRoutes(req, res, next);
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

const { seedDefaults } = require('./firebase/seed');

async function start() {
  // Initialize Firebase
  initFirebase();
  
  // Seed defaults if needed
  await seedDefaults();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Control Chicha corriendo en http://localhost:${PORT}`);
    console.log(`Accede desde tu celular en la misma red usando la IP local`);
  });
}

start().catch(err => {
  console.log('Error al iniciar:', err.message);
  process.exit(1);
});
