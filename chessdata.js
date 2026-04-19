const ChessWebAPI = require('chess-web-api');
const chessAPI = new ChessWebAPI();
const { Chess } = require('chess.js');
const { getStockfishBestMove } = require('./engine');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// returns array of { year, month } for last n months (month: 1-12)
function lastNMonths(n = 3, from = new Date()) {
    const out = [];
    let year = from.getFullYear();
    let month = from.getMonth() + 1; // 1-12
    for (let i = 0; i < n; i++) {
        out.push({ year, month });
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
    }
    return out;
}

async function getAllRecentGames(username, game_id, depth = 15) {
    const lastThree = lastNMonths(3);
    const monthPromises = lastThree.map(({ year, month }) =>
        chessAPI.getPlayerCompleteMonthlyArchives(username, year, month)
            .then(res => (res.body.games || []).map(g => ({ uuid: g.uuid, pgn: g.pgn, orientation: g.black.username === username ? 'b': 'w'})))
            .catch(err => {
                console.error(err);
                return [];
            })
    );

    const monthResults = await Promise.all(monthPromises);
    const games = monthResults.flat().filter(n => n.uuid == game_id);
    const { uuid, pgn, orientation } = games[0];

    const gamePromise = (async () => {
        try {
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

            for (let i = 0; i < moves.length; i++) {
                var fen_before = chess.fen();
                const mv = chess.move(moves[i]);
                positions.push({
                    move: i + 1,
                    fen_before: fen_before,
                    fen: chess.fen(),
                    san: moves[i],
                    coord: mv ? `${mv.from}-${mv.to}` : null,
                    eval_change: null,
                    current_eval: null,
                    eval_after: null,
                    bestline: null,
                    turn: chess.turn()
                });
            }

            // Sequential evaluation: one position at a time
            for (let idx = 0; idx < positions.length; idx++) {
                const pos = positions[idx];
                if (pos.turn != orientation){
                    continue;
                }
                try {
                    //await sleep(200); // adjust ms to match rate limit
                    const bestData = await getStockfishBestMove(pos.fen, depth);
                    if (!bestData || bestData.mate) {
                        continue;
                    }

                    const current_eval = bestData.evaluation;
                    const bestline = bestData.continuation || [];
                    if (!bestline.length) {
                        pos.current_eval = current_eval;
                        continue;
                    }

                    const c = new Chess(pos.fen);
                    c.move(bestline[0]);
                    const nextFen = c.fen();

                    try {
                        const afterData = await getStockfishBestMove(nextFen, depth);
                        if (!afterData || afterData.mate) {
                            pos.current_eval = current_eval;
                            continue;
                        }

                        const eval_after = afterData.evaluation;
                        const eval_change = orientation === 'w'
                            ? eval_after - current_eval
                            : current_eval - eval_after;

                        //console.log("Eval Before ", current_eval);
                        //console.log("Eval After", eval_after);
                        //console.log("Eval Change ", eval_change + "\n");

                        pos.current_eval = current_eval;
                        pos.eval_after = eval_after;
                        pos.eval_change = eval_change;
                        pos.bestline = bestline;
                    } catch (err) {
                        console.error('after eval error', err);
                        pos.current_eval = current_eval;
                    }
                } catch (err) {
                    console.error('best move eval error', err);
                }
            }

            const valid = positions
                .filter(p => typeof p.eval_change === 'number' && !Number.isNaN(p.eval_change));
            if (valid.length === 0) {
                return { uuid, top_position: null };
            }

            valid.sort((a, b) => b.eval_change - a.eval_change);
            const top = valid.slice(0, 10);
            return { uuid, top_position: top };
        } catch (e) {
            console.error('PGN parse error for', uuid, e);
            return { uuid, positions: [] };
        }
    })();

    return Promise.all([gamePromise]);
}

module.exports = { getAllRecentGames };