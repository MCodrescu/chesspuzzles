# Chess Puzzles

Practice positions from your own chess.com games and train yourself to find the moves you missed.

## What It Does

Chess Puzzles connects to your chess.com account, fetches your recent games, and uses the Stockfish chess engine to identify positions where you played a significantly suboptimal move. Those positions are turned into interactive puzzles — you see the board just after your mistake and have to find the move Stockfish recommends.

- **Personalized**: puzzles come from your actual games, not a generic database
- **Targeted**: only positions with a meaningful evaluation swing (≥0.10 pawns) are shown
- **Persistent**: analysed positions are saved to a PostgreSQL database so your backlog grows in the background while you solve

## How to Use

1. Enter your chess.com username and click **Get Recent Games**
2. Select a game from the dropdown and click **Generate Puzzles**
3. Find the best move on the board — the engine will tell you if you're right
4. Use **Solution** to see the engine's recommended continuation, **Retry** to reset the position, or the arrow buttons to navigate between puzzles

The first time you load games, a background job starts analysing your recent history and saving positions to the database. On subsequent visits the puzzles load instantly from the database.

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js / Express 5 |
| Chess engine | Stockfish (UCI protocol, spawned as child process) |
| Game data | chess.com public API (`chess-web-api`) |
| Move validation | chess.js |
| Database | PostgreSQL (`pg`) |
| Frontend board | cm-chessboard (CDN) |
| UI framework | Bootstrap 5 (CDN) |

## Self-Hosting

### Prerequisites

- Node.js 18+
- A running PostgreSQL instance
- `stockfish` available on your system PATH (`apt install stockfish` / `brew install stockfish`)

### Setup

```bash
git clone https://github.com/MCodrescu/chesspuzzles.git
cd chesspuzzles
npm install
```

Create a `.env` file in the project root (see `.env.example`):

```
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Start the server:

```bash
npm start
```

The database table and indexes are created automatically on first run.

### Deploying to Digital Ocean App Platform

1. Fork / push the repo to GitHub
2. Create a new App in Digital Ocean and connect the repo
3. Add a managed PostgreSQL database and attach it to the app
4. Set `DATABASE_URL` to the database connection string in the app's environment variables
5. Set the run command to `npm start`

## Project Structure

```
main.js              # Express server and all API routes
src/
  engine.js          # Singleton Stockfish process manager (UCI queue)
  chessdata.js       # PGN parsing, position evaluation, puzzle ranking
  db.js              # PostgreSQL pool and all database operations
  backgroundJobs.js  # Async backlog builder (analyses games in the background)
public/
  index.html         # Single-page app shell
  js/
    app.js           # Frontend — board rendering, puzzle loading, event handlers
    api.js           # Frontend — all fetch calls to the backend API
```

---

*This project was built using an AI-first development approach. The architecture, feature implementation, debugging, and deployment troubleshooting were all driven primarily through conversation with [Claude](https://claude.ai) (Anthropic), using GitHub Copilot Chat as the interface. Human oversight guided product decisions; Claude handled the majority of the code.*

