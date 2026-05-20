const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL is not set. Database operations will fail.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

/**
 * Create the puzzle_positions table and its indexes if they do not already
 * exist. Safe to call on every startup — all statements are idempotent.
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS puzzle_positions (
            id              SERIAL          PRIMARY KEY,
            username        VARCHAR(50)     NOT NULL,
            game_uuid       VARCHAR(100)    NOT NULL,
            orientation     CHAR(1)         NOT NULL CHECK (orientation IN ('w', 'b')),
            move_number     INTEGER         NOT NULL,
            san             VARCHAR(10)     NOT NULL,
            coord           VARCHAR(10)     NOT NULL,
            fen_before      TEXT            NOT NULL,
            fen             TEXT            NOT NULL,
            current_eval    INTEGER         NOT NULL,
            eval_after      INTEGER         NOT NULL,
            eval_change     INTEGER         NOT NULL,
            bestline        TEXT[]          NOT NULL,
            solved          BOOLEAN         NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_puzzle_positions_username
            ON puzzle_positions (username)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_puzzle_positions_username_solved
            ON puzzle_positions (username, solved)
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_puzzle_position
            ON puzzle_positions (game_uuid, move_number, orientation)
    `);

    console.log('Database initialized.');
}

/** 
 * Runs inside a transaction; skips positions that already exist for the same
 * game, move, and orientation (ON CONFLICT DO NOTHING).
 * @param {string} username - The chess.com username.
 * @param {string} gameUuid - The chess.com game UUID.
 * @param {string} orientation - 'w' or 'b'.
 * @param {object[]} positions - Top positions returned by getTopTenPositions.
 * @returns {Promise<void>}
 */
async function savePuzzlePositions(username, gameUuid, orientation, positions) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const pos of positions) {
            await client.query(
                `INSERT INTO puzzle_positions
                    (username, game_uuid, orientation, move_number, san, coord,
                     fen_before, fen, current_eval, eval_after, eval_change, bestline, solved)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
                 ON CONFLICT (game_uuid, move_number, orientation) DO NOTHING`,
                [
                    username,
                    gameUuid,
                    orientation,
                    pos.move,
                    pos.san,
                    pos.coord,
                    pos.fen_before,
                    pos.fen,
                    pos.current_eval,
                    pos.eval_after,
                    pos.eval_change,
                    pos.bestline,
                ]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Returns the number of stored puzzle positions for a user.
 * @param {string} username
 * @returns {Promise<number>}
 */
async function getUserPuzzleCount(username) {
    const result = await pool.query(
        'SELECT COUNT(*) FROM puzzle_positions WHERE username = $1',
        [username]
    );
    return parseInt(result.rows[0].count, 10);
}

/**
 * Returns a Set of game UUIDs that have already been analysed for a user.
 * @param {string} username
 * @returns {Promise<Set<string>>}
 */
async function getAnalyzedGameUuids(username) {
    const result = await pool.query(
        'SELECT DISTINCT game_uuid FROM puzzle_positions WHERE username = $1',
        [username]
    );
    return new Set(result.rows.map((row) => row.game_uuid));
}

/**
 * Returns up to `limit` puzzle positions for a user, unsolved first.
 * @param {string} username
 * @param {number} [limit=10]
 * @returns {Promise<object[]>}
 */
async function getUserPuzzles(username, limit = 10) {
    const result = await pool.query(
        `SELECT * FROM puzzle_positions
         WHERE username = $1
         ORDER BY solved ASC, RANDOM()
         LIMIT $2`,
        [username, limit]
    );
    return result.rows;
}

module.exports = { pool, initializeDatabase, getUserPuzzleCount, getAnalyzedGameUuids, getUserPuzzles, savePuzzlePositions };
