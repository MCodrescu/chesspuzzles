const { Chess } = require('chess.js');
const { getStockfishBestMove } = require('./engine');

/**
 * Normalize a Stockfish evaluation to a given side's perspective.
 * Stockfish always evaluates from White's perspective, so negate for Black.
 * @param {number} evaluation Raw Stockfish centipawn evaluation.
 * @param {string} orientation 'w' or 'b'.
 * @returns {number} Normalized evaluation.
 */
function normalizeEval(evaluation, orientation) {
    return orientation === 'b' ? -evaluation : evaluation;
}

/**
 * Parse a PGN string into an array of position objects representing each move.
 * @param {string} pgn The PGN of the game.
 * @returns {array} Array of position objects with fen, san, coord, turn, etc.
 */
function parseGamePositions(pgn) {
    const chess = new Chess();
    chess.loadPgn(pgn || '');
    const moves = chess.history();
    const positions = [];

    chess.reset();
    positions.push({
        move: 0,
        fen: chess.fen(),
        san: 'Start',
        coord: null,
        eval_change: null,
        current_eval: null,
        eval_after: null,
        bestline: null,
        turn: chess.turn()
    });

    for (const [i, move] of moves.entries()) {
        const fen_before = chess.fen();
        const mv = chess.move(move);
        positions.push({
            move: i + 1,
            fen_before: fen_before,
            fen: chess.fen(),
            san: move,
            coord: mv ? `${mv.from}-${mv.to}` : null,
            eval_change: null,
            current_eval: null,
            eval_after: null,
            bestline: null,
            turn: chess.turn()
        });
    }

    return positions;
}

/**
 * Apply the first two moves of a continuation (our best move + opponent's
 * best response) to a position and return the resulting FEN.
 * @param {string} fen The starting FEN.
 * @param {array} bestline The continuation moves from Stockfish.
 * @returns {string|null} The resulting FEN, or null if moves are invalid.
 */
function applyTwoPlyMoves(fen, bestline) {
    if (!bestline || bestline.length < 2) {
        return null;
    }

    const chess = new Chess(fen);
    const move1 = chess.move(bestline[0]);
    const move2 = chess.move(bestline[1]);

    if (!move1 || !move2) {
        return null;
    }

    return chess.fen();
}

/**
 * Trim a bestline to an even number of moves (always ending after
 * the opponent's response, so it's the original side's turn again).
 * @param {array} bestline The continuation moves from Stockfish.
 * @returns {array} The trimmed bestline with an even number of moves.
 */
function trimBestlineToEvenLength(bestline) {
    if (!bestline || bestline.length < 2) {
        return null;
    }
    return bestline.length % 2 === 0 ? bestline : bestline.slice(0, bestline.length - 1);
}

/**
 * Evaluate a single position using the two-ply method:
 * 1. Evaluate the current position.
 * 2. Play our best move + opponent's best response (from the continuation).
 * 3. Evaluate the resulting position (same side to move).
 * 4. The eval change measures how much the best move improved things.
 *
 * @param {string} fen The FEN of the position to evaluate.
 * @param {string} orientation 'w' or 'b'.
 * @param {number} depth Stockfish search depth.
 * @returns {object|null} Object with current_eval, eval_after, eval_change, bestline, or null if evaluation failed.
 */
async function evaluatePosition(fen, orientation, depth) {
    const bestData = await getStockfishBestMove(fen, depth, 10000);
    if (!bestData || bestData.mate) {
        return null;
    }

    const currentEval = normalizeEval(bestData.evaluation, orientation);

    const bestline = trimBestlineToEvenLength(bestData.continuation);
    const finalFen = applyTwoPlyMoves(fen, bestline);
    if (!finalFen) {
        return null;
    }

    const afterData = await getStockfishBestMove(finalFen, depth, 10000);
    if (!afterData || afterData.mate) {
        return null;
    }

    const evalAfter = normalizeEval(afterData.evaluation, orientation);

    return {
        current_eval: currentEval,
        eval_after: evalAfter,
        eval_change: evalAfter - currentEval,
        bestline: bestline
    };
}


/**
 * Filter and rank evaluated positions, returning the top N by eval change.
 * Only includes positions where:
 * - The eval after the best move is winning for the given orientation.
 * - The eval change is at least 10 centipawns in favor of the player.
 * @param {array} positions All position objects.
 * @param {string} orientation 'w' or 'b'.
 * @param {number} topN Number of top positions to return.
 * @returns {array} The top N positions sorted by eval_change descending.
 */
function rankPositions(positions, orientation, topN) {
    return positions
        .filter(p => typeof p.eval_change === 'number' && !Number.isNaN(p.eval_change))
        .filter(p => orientation === 'w' ? p.eval_after > 0 : p.eval_after < 0)
        .filter(p => p.eval_change >= 10)
        .sort((a, b) => b.eval_change - a.eval_change)
        .slice(0, topN);
}



/**
 * Get the top ten positions in a game by the positive change in evaluation
 * from playing the best move (two-ply: best move + opponent's best response).
 * @param {string} pgn The PGN of the game.
 * @param {string} orientation Which side, 'w' or 'b', should we evaluate for?
 * @param {number} depth The depth of Stockfish calculation.
 * @returns {array} The array of the top ten positions.
 */
async function getTopTenPositions(pgn, orientation, depth) {
    try {
        const positions = parseGamePositions(pgn);

        for (const pos of positions.slice(4)) {
            if (pos.turn !== orientation) {
                continue;
            }
            try {
                const result = await evaluatePosition(pos.fen, orientation, depth);
                if (result) {
                    pos.current_eval = result.current_eval;
                    pos.eval_after = result.eval_after;
                    pos.eval_change = result.eval_change;
                    pos.bestline = result.bestline;
                }
            } catch (err) {
                console.error('eval error at position', idx, err);
            }
        }

        return rankPositions(positions, orientation, 10);
    } catch (e) {
        console.error('PGN parse error', e);
        return [];
    }
}

module.exports = { getTopTenPositions };
