const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

/**
 * Persist an array of top puzzle positions for a given game to the database.
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

module.exports = { pool, savePuzzlePositions };
