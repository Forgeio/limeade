Limeade

A Mario Maker-inspired level creation and sharing platform where players can design, play, and share custom levels with a retro-styled UI.
🎨 Design Philosophy

The website features a clean, retro-inspired design similar to Mario Maker's UI:

    Clean retro color palette
    Very slightly squares
    Consistent design language across all pages

📋 Table of Contents

    Roadmap
    Phase 1: Authentication & Layout
    Phase 2: Level Editor
    Phase 3: Backend & Database
    Phase 4: Gameplay Features
    Phase 5: Social Features
    Tech Stack

🗺️ Roadmap
Phase 1: Authentication & Layout

Goal: Create the foundational UI and authentication system.
Login Page

    Google/Discord OAuth authentication required to access the site
    Checkered/blurred background
    White title with black outline and soft drop shadow
    Clean, minimalist design

Main Site Layout

    Checkered background (consistent with login page)
    Top menu bar with rounded-square white buttons and soft drop shadows
    Menu items:
        Discover Levels: Browse and find user-created levels
        Leaderboards: View top players and levels
        Create: Access the level editor
        Profile Icon (top-left corner): Dropdown menu for:
            Profile page
            Settings (controls and preferences)

Phase 2: Level Editor

Goal: Build a fully-featured level creation tool.
UI Design

    Consistent with main site design
    Placeholder shapes for tiles/objects (images to be added later)

Controls

    WASD/Arrow Keys: Move camera
    Mouse:
        Left click and drag: Paint tiles
        Right click: Erase tiles

Features

    Tile Selection: Top bar with categorized icons
        Categories: Tiles, Items, Enemies, Special Objects
        Dropdown menus for object selection
    Level Resizing: Configurable min/max size constraints
    Autosave: Periodic draft saving to prevent data loss
    Play & Publish:
        Quick test button for level testing
        Publish requires completing the level first
        Future: Clear conditions (e.g., collect X coins, defeat Y enemies)
    Advanced Functionality:
        Undo/Redo history
        Copy/paste tile sections

Initial Tile Set

    Ground tiles (multiple variants)
    2 enemy types
    Spikes (hazard)
    Spawn point
    Goal point
    Coin (collectible)
    Diamond (collectible)

Phase 3: Backend & Database

Tech Stack:

    Node.js + Express API
    PostgreSQL database

Features:

    Level storage and retrieval
    Level sharing system
    User authentication management

Phase 4: Gameplay Features

Goal: Implement core platformer mechanics.
Player Controls

    Arrow Keys / WASD: Move player (customizable in settings)
    Space / C: Jump
    Shift / X: Sprint

Core Mechanics

    Player state tracking for animations and events
    Coyote time implementation
    Smooth acceleration/deceleration
    Level boundary constraints (death on bottom boundary)

Player Statistics

    Speedrun timer
    Death counter
    Profile statistics tracking
    Level leaderboard data

Game Events

    Death:
        Short death animation
        Timer reset
        Level reset
    Enemies:
        Activate when in camera view
        Gravity-affected movement
        Bounce physics (walls and other enemies)

Phase 5: Social Features

Goal: Build community and discovery features.
Level Discovery

    Hot levels
    New uploads
    Top-rated levels

Social Interactions

    Like/Dislike system
    Favorite levels
    Player profiles with statistics
    Global and per-level leaderboards

🛠️ Tech Stack
Frontend

    HTML5/CSS3
    JavaScript

Backend

    Node.js
    Express.js

Database

    PostgreSQL

Authentication

    OAuth 2.0 (Google, Discord)

🚀 Getting Started

## Prerequisites

- Node.js (for running the development server)

## Quick Start

Clone the repository:

```bash
git clone https://github.com/Forgeio/limeade.git
cd limeade
```

Start the development server:

```bash
node server.js
```

Open your browser and navigate to:

```
http://localhost:3000
```

You'll be greeted with the login page. Click either OAuth button to access the main site (currently uses mock authentication).

## Project Structure

```
limeade/
├── public/              # Frontend files
│   ├── css/            # Stylesheets
│   │   └── styles.css  # Main stylesheet
│   ├── js/             # JavaScript files
│   │   ├── auth.js     # Authentication logic
│   │   ├── discover.js # Discover page functionality
│   │   ├── leaderboards.js # Leaderboards page functionality
│   │   └── navigation.js   # Navigation and user menu
│   ├── icons.svg       # SVG icon sprite
│   ├── login.html      # Login page
│   ├── discover.html   # Level discovery page
│   └── leaderboards.html # Leaderboards page
├── backend/            # Backend files
│   ├── config/         # Configuration files
│   │   ├── database.js # PostgreSQL connection
│   │   └── passport.js # OAuth strategies
│   ├── routes/         # API routes
│   │   ├── auth.js     # Authentication endpoints
│   │   ├── users.js    # User endpoints
│   │   └── levels.js   # Level endpoints
│   └── middleware/     # Middleware functions
│       └── auth.js     # Authentication middleware
├── scripts/            # Utility scripts
│   ├── setup-database.js # Database schema setup
│   └── seed-database.js  # Test data seeding
├── server.js           # Express server
├── package.json        # Project metadata
├── .env.example        # Environment variables template
├── BACKEND_SETUP.md    # Backend setup guide
└── README.md           # This file
```

## Backend Setup

The backend uses Node.js with Express and PostgreSQL. For detailed setup instructions, see [BACKEND_SETUP.md](BACKEND_SETUP.md).

### Quick Setup

1. Install PostgreSQL and create database:
```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE DATABASE limeade;"
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Setup database schema and seed test data:
```bash
npm run db:setup
npm run db:seed
```

4. Start the server:
```bash
npm start
```

### API Endpoints

#### Authentication
- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/discord` - Initiate Discord OAuth login
- `GET /auth/user` - Get current authenticated user
- `POST /auth/logout` - Logout user

#### Users & Leaderboards
- `GET /api/users/:id` - Get user profile and stats
- `GET /api/users/:id/levels` - Get levels created by user
- `GET /api/users/leaderboard/:type` - Get leaderboard
  - Types: `clears`, `records`, `playtime`
  - Query params: `page`, `limit`

#### Levels
- `GET /api/levels` - Get levels (discover page)
  - Query params: `filter` (hot/top/new), `page`, `limit`
- `GET /api/levels/:id` - Get single level details
- `POST /api/levels` - Create new level (requires auth)
- `PUT /api/levels/:id` - Update level (requires auth & ownership)
- `DELETE /api/levels/:id` - Delete level (requires auth & ownership)
- `POST /api/levels/:id/like` - Like/dislike level (requires auth)
- `POST /api/levels/:id/play` - Record a play (requires auth)

For complete API documentation and examples, see [BACKEND_SETUP.md](BACKEND_SETUP.md).

## Current Status

✅ **Phase 1 (Complete): Authentication & Layout**

- Login page with OAuth placeholders (Google/Discord)
- Main site layout with navigation bar
- Discover page with Hot/Top/New filters
- Leaderboards page with multiple leaderboard types
- Fully responsive Material Design UI
- SVG-based icon system
- Pagination support on all pages

✅ **Phase 3 (Complete): Backend & Database**

- PostgreSQL database with complete schema
- OAuth authentication (Google & Discord)
- RESTful API for users, levels, and stats
- User profiles and statistics tracking
- Level storage and retrieval
- Leaderboard system (clears, records, playtime)
- Level likes/dislikes and play tracking
- Test data seeding
- Frontend integrated with real APIs

🚧 **Phase 2 (Upcoming): Level Editor**
🚧 **Phase 4 (Upcoming): Gameplay Features**
🚧 **Phase 5 (Upcoming): Social Features**

📝 License

License information coming soon.
