const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const db = require('./database');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          const existingUser = await db.query(
            'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
            ['google', profile.id]
          );

          if (existingUser.rows.length > 0) {
            // User exists, update last login
            const updated = await db.query(
              'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *',
              [existingUser.rows[0].id]
            );
            return done(null, updated.rows[0]);
          }

          // Create new user
          const newUser = await db.query(
            `INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url, created_at, last_login)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [
              profile.displayName || profile.emails[0].value.split('@')[0],
              profile.emails[0].value,
              'google',
              profile.id,
              profile.photos[0]?.value || null,
            ]
          );

          done(null, newUser.rows[0]);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
}

// Discord OAuth Strategy
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL,
        scope: ['identify', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          const existingUser = await db.query(
            'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
            ['discord', profile.id]
          );

          if (existingUser.rows.length > 0) {
            // User exists, update last login
            const updated = await db.query(
              'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *',
              [existingUser.rows[0].id]
            );
            return done(null, updated.rows[0]);
          }

          // Create new user
          const avatarUrl = profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null;

          const newUser = await db.query(
            `INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url, created_at, last_login)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [
              profile.username,
              profile.email,
              'discord',
              profile.id,
              avatarUrl,
            ]
          );

          done(null, newUser.rows[0]);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          const existingUser = await db.query(
            'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
            ['github', profile.id]
          );

          if (existingUser.rows.length > 0) {
            // User exists, update last login
            const updated = await db.query(
              'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *',
              [existingUser.rows[0].id]
            );
            return done(null, updated.rows[0]);
          }

          // Create new user
          const newUser = await db.query(
            `INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url, created_at, last_login)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [
              profile.username,
              profile.emails && profile.emails[0] ? profile.emails[0].value : null,
              'github',
              profile.id,
              profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            ]
          );

          done(null, newUser.rows[0]);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
}

module.exports = passport;
