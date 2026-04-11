// main.js
const express = require('express');
const ChessWebAPI = require('chess-web-api');
const { Chess } = require('chess.js');
const path = require('path');
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


app.get('/chesswebapi/player/:username', (req, res) => {
    chessAPI.getPlayer(req.params.username)
        .then(function (response) {
            res.json(response.body);
        }, function (err) {
            res.status(500).json({ error: err });
        });
});

app.get('/chesswebapi/player/games/:username/:year/:month', (req, res) => {
    chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month)
        .then(function (response) {
            res.json(response.body);
        }, function (err) {
            res.status(500).json({ error: err });
        });
});

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

app.post('/chesswebapi/legalmoves/', (req, res) => {
    const chess = new Chess();

    if (req.body.pgn) {
        chess.loadPgn(req.body.pgn);
        all_moves = chess.history();
        chess.reset();

        // Make moves up to the current position
        for (let i = 0; i < req.body.position_number; i++) {
            chess.move(all_moves[i]);
        }

    }

    var movesVerbose = chess.moves({ verbose: true });
    var coordMoves = movesVerbose.map(m => `${m.from}-${m.to}`);

    res.json({ legalMoves: coordMoves });
});

// Convert between SAN and coordinate notation
function coordToSan(fen, coord) {
  var from = coord.slice(0,2);
  var to = coord.slice(2,4);
  var clone = new Chess(fen);
  var mv = clone.move({ from, to });
  return mv ? mv.san : null;
}

app.post('/stockfish/bestmove/', (req, res) => {
    const url = 'https://stockfish.online/api/s/v2.php';

    axios.get(url, { params: { fen: req.body.fen, depth: req.body.depth } })
        .then(response => {
            var bestmove = response.data.bestmove.split(" ");
            //var bestMoveSANBlack = coordToSan(req.body.fen, bestmove[3]);
            //var bestMoveSANWhite = coordToSan(req.body.fen, bestmove[1]);
            res.json(response.data);
        })
        .catch(err => res.status(500).json({ error: err }))
});