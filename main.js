// main.js
const express = require('express');
const ChessWebAPI = require('chess-web-api');
const { Chess } = require('chess.js');
require('dotenv').config();
const axios = require('axios');

const app = express();
const chessAPI = new ChessWebAPI();

app.use(express.json());
app.use(express.static(__dirname + '/public', { maxAge: 300000 }));
app.use(express.static(__dirname, { maxAge: 300000 }));

const port = process.env.PORT;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Get basic player information based on username
app.get('/chesswebapi/player/:username', (req, res) => {
    chessAPI.getPlayer(req.params.username)
        .then(function (response) {
            res.json(response.body);
        }, function (err) {
            res.status(500).json({ error: err });
        });
});

// Get all games for a specific player, year, and month
app.get('/chesswebapi/player/games/:username/:year/:month', (req, res) => {
    chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month)
        .then(function (response) {
            res.json(response.body);
        }, function (err) {
            res.status(500).json({ error: err });
        });
});

// Get the FEN positions for every move 
// for a specific game based on username, year, month, format, and game UUID
app.get('/chesswebapi/gamefen/:username/:year/:month/:format/:gameuuid', (req, res) => {
    chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month)
        .then(function (response) {

            // Find the game with the specified UUID and format, then extract its PGN
            pgn = response.body.games.find(
                game => game.uuid === req.params.gameuuid && game.time_class === req.params.format
            ).pgn;

            const chess = new Chess();
            chess.loadPgn(pgn);

            const moves = chess.history();
            const fenPositions = [];

            // Reset to starting position
            chess.reset();

            // Add starting position
            fenPositions.push({
                move: 0,
                fen: chess.fen(),
                san: 'Start'
            });

            // Make each move and record FEN
            moves.forEach((move, index) => {
                mv = chess.move(move);
                fenPositions.push({
                    move: index + 1,
                    fen: chess.fen(),
                    san: move,
                    coord: `${mv.from}-${mv.to}`
                });
            });

            res.json({ positions: fenPositions });
        }, function (err) {
            res.status(500).json({ error: err });
        });

});

// Convert coordinate move to SAN
// Stockfish returns best move in coordinate format, but we want to display it in SAN format
app.post('/chesswebapi/convertCoordtoSAN/', (req, res) => {
    var chess = new Chess(req.body.fen);
    try{
        var mv = chess.move(req.body.coord);
    } catch (err) {
        res.status(400).json({ error: 'Invalid Coordinate move format', details: err.toString() });
        return;
    }
    if (mv) {
        res.json({ san: mv.san });
    } else {
        res.status(400).json({ error: 'Invalid Coordinate move' });
    }
});

// Get the best move from Stockfish API based on the given FEN and depth
app.post('/stockfish/bestmove/', (req, res) => {
    const url = 'https://stockfish.online/api/s/v2.php';

    axios.get(url, { params: { fen: req.body.fen, depth: req.body.depth } })
        .then(response => {
            res.json(response.data);
        })
        .catch(err => res.status(500).json({ error: err }))
});

// Get the change in evaluation based on the best move line
app.post('/stockfish/evaluationChange/', (req, res) => {
    const url = 'https://stockfish.online/api/s/v2.php';

    var chessEval = new Chess(req.body.fen);

    axios.get(url, { params: { fen: req.body.fen, depth: req.body.depth } })
        .then(response => {
            var current_eval = response.data.evaluation;
            var bestline = response.data.continuation.split(" ");

            for (let i = 0; i < bestline.length; i++) {
                var mv = chessEval.move(bestline[i]);
                if (!mv) {
                    res.status(400).json({ error: 'Invalid Coordinate move in Stockfish best line' });
                    return;
                }
            }

            axios.get(url, { params: { fen: chessEval.fen(), depth: req.body.depth } })
                .then(response => {
                    var eval_after_continuation = response.data.evaluation;
                    var eval_change = req.body.orientation === 'white' ? eval_after_continuation - current_eval : current_eval - eval_after_continuation;
                    console.log('Current Eval:', current_eval);
                    console.log('Eval After Continuation:', eval_after_continuation);
                    console.log('Eval Change:', eval_change);
                    res.json({ eval_change: eval_change });
                })
                .catch(err => res.status(500).json({ error: err }))
        })
        .catch(err => res.status(500).json({ error: err }))
});