const ChessWebAPI = require('chess-web-api');
const { getTopTenPositions } = require('./chessdata');
const { getUserPuzzleCount, getAnalyzedGameUuids, savePuzzlePositions } = require('./db');

const chessAPI = new ChessWebAPI();

const BACKGROUND_DEPTH = 12;
const TARGET_BACKLOG = 100;
const MAX_MONTHS_BACK = 24;

/**
 * Asynchronously analyse a user's recent games and persist puzzle positions
 * to the database until the user has at least TARGET_BACKLOG positions stored.
 * Already-analysed games are skipped via the game_uuid index.
 * Safe to call concurrently for different usernames.
 * @param {string} username - The chess.com username.
 * @returns {Promise<void>}
 */
async function buildUserBacklog(username) {
    try {
        let count = await getUserPuzzleCount(username);
        if (count >= TARGET_BACKLOG) {
            console.log(`Backlog sufficient for ${username}: ${count} positions.`);
            return;
        }

        const analyzedUuids = await getAnalyzedGameUuids(username);
        const now = new Date();

        for (let monthsBack = 0; monthsBack < MAX_MONTHS_BACK && count < TARGET_BACKLOG; monthsBack++) {
            const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');

            let games;
            try {
                const response = await chessAPI.getPlayerCompleteMonthlyArchives(username, year, month);
                games = response.body?.games ?? [];
            } catch {
                continue; // Month has no archive — skip
            }

            for (const game of games) {
                if (count >= TARGET_BACKLOG) break;
                if (analyzedUuids.has(game.uuid)) continue;

                const orientation = game.white.username.toLowerCase() === username.toLowerCase() ? 'w' : 'b';

                try {
                    const positions = await getTopTenPositions(game.pgn, orientation, BACKGROUND_DEPTH);
                    if (positions.length > 0) {
                        await savePuzzlePositions(username, game.uuid, orientation, positions);
                        count += positions.length;
                        analyzedUuids.add(game.uuid);
                    }
                } catch (err) {
                    console.error(`Error analysing game ${game.uuid}:`, err.message);
                }
            }
        }

        console.log(`Backlog complete for ${username}: ${count} positions.`);
    } catch (err) {
        console.error(`Backlog job failed for ${username}:`, err.message);
    }
}

module.exports = { buildUserBacklog };
