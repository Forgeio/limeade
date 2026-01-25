# Backend Setup Guide

This guide will help you set up the PostgreSQL database and backend for Limeade.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Step 1: Install PostgreSQL

### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### On macOS:
```bash
brew install postgresql
brew services start postgresql
```

### On Windows:
Download and install from https://www.postgresql.org/download/windows/

## Step 2: Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE limeade;

# Create user (optional, or use default postgres user)
CREATE USER limeade_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE limeade TO limeade_user;

# Exit PostgreSQL
\q
```

## Step 3: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and update the database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=limeade
DB_USER=postgres
DB_PASSWORD=your_password
```

## Step 4: Set up OAuth (Optional for Development)

For local development, you can skip OAuth setup and use mock authentication. To enable real OAuth:

### Google OAuth:
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Secret to `.env`

### Discord OAuth:
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Add OAuth2 redirect: `http://localhost:3000/auth/discord/callback`
4. Copy Client ID and Secret to `.env`

## Step 5: Setup Database Schema

```bash
npm run db:setup
```

This will create all necessary tables and indexes.

## Step 6: Seed Test Data

```bash
npm run db:seed
```

This will populate the database with test users, levels, and statistics.

## Step 7: Start the Server

```bash
npm start
```

The server will run on http://localhost:3000

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/discord` - Initiate Discord OAuth
- `GET /auth/user` - Get current user
- `POST /auth/logout` - Logout

### Users
- `GET /api/users/:id` - Get user profile
- `GET /api/users/:id/levels` - Get user's levels
- `GET /api/users/leaderboard/:type` - Get leaderboard (clears, records, playtime)

### Levels
- `GET /api/levels?filter=hot&page=1&limit=12` - Get levels (hot, top, new)
- `GET /api/levels/:id` - Get single level
- `POST /api/levels` - Create level (requires auth)
- `PUT /api/levels/:id` - Update level (requires auth + ownership)
- `DELETE /api/levels/:id` - Delete level (requires auth + ownership)
- `POST /api/levels/:id/like` - Like/dislike level (requires auth)
- `POST /api/levels/:id/play` - Record a play (requires auth)

## Database Schema

### users
- id, username, email, oauth_provider, oauth_id, avatar_url, created_at, last_login

### user_stats
- user_id, total_clears, total_records, total_playtime, levels_created, total_likes_received

### levels
- id, title, description, creator_id, level_data (JSONB), created_at, updated_at, published, published_at

### level_stats
- level_id, total_plays, total_clears, total_likes, total_dislikes, world_record_time, world_record_holder_id, clear_rate

### level_plays
- id, level_id, user_id, completed, completion_time, played_at

### level_likes
- id, level_id, user_id, is_like, created_at

## Troubleshooting

### Connection Error
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### Permission Error
- Grant proper permissions: `GRANT ALL PRIVILEGES ON DATABASE limeade TO your_user;`

### Port Already in Use
- Change PORT in `.env` file
- Kill process using port 3000: `lsof -ti:3000 | xargs kill`
