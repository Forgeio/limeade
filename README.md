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
├── server.js           # Simple development server
├── package.json        # Project metadata
└── README.md           # This file
```

## Current Status

✅ **Phase 1 (Complete): Authentication & Layout**

- Login page with OAuth placeholders (Google/Discord)
- Main site layout with navigation bar
- Discover page with Hot/Top/New filters
- Leaderboards page with multiple leaderboard types
- Fully responsive Material Design UI
- SVG-based icon system
- Mock data structures ready for backend
- Pagination support on all pages

🚧 Phase 2 (Upcoming): Level Editor 🚧 Phase 3 (Upcoming): Backend & Database 🚧 Phase 4 (Upcoming): Gameplay Features 🚧 Phase 5 (Upcoming): Social Features
📝 License

License information coming soon.
