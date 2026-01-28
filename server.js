const express = require('express');
const session = require('express-session');
const passport = require('./backend/config/passport');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'limeade-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/auth', require('./backend/routes/auth'));
app.use('/api/users', require('./backend/routes/users'));
app.use('/api/levels', require('./backend/routes/levels'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Limeade API is running' });
});

// Serve discover page as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'discover.html'));
});

// Get available music files
app.get('/api/music', (req, res) => {
  const musicDir = path.join(__dirname, 'public', 'music');
  const fs = require('fs');
  
  fs.readdir(musicDir, (err, files) => {
    if (err) {
      console.error('Error reading music directory:', err);
      return res.status(500).json({ error: 'Failed to list music files' });
    }
    
    // Filter for common audio files
    const validExtensions = ['.wav', '.mp3', '.ogg'];
    const musicFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return validExtensions.includes(ext);
    }).sort(); // Alphabetical order
    
    res.json(musicFiles);
  });
});

// Clean URL routing - serve HTML files without .html extension
const pages = ['discover', 'login', 'profile', 'settings', 'editor', 'play', 'level', 'leaderboards', 'setup-username'];
pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve frontend pages for other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\nAvailable endpoints:');
  console.log('  - GET  /api/health');
  console.log('  - GET  /auth/google');
  console.log('  - GET  /auth/discord');
  console.log('  - GET  /auth/user');
  console.log('  - POST /auth/logout');
  console.log('  - GET  /api/users/:id');
  console.log('  - GET  /api/users/:id/levels');
  console.log('  - GET  /api/users/leaderboard/:type');
  console.log('  - GET  /api/levels');
  console.log('  - GET  /api/levels/:id');
  console.log('  - POST /api/levels');
  console.log('  - PUT  /api/levels/:id');
  console.log('  - DELETE /api/levels/:id');
  console.log('  - POST /api/levels/:id/like');
  console.log('  - POST /api/levels/:id/play');
});

