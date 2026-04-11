// main.js
const express = require('express');
const ChessWebAPI = require('chess-web-api');
const { Chess } = require('chess.js');
const path = require('path');
require('dotenv').config();

const app = express();
const chessAPI = new ChessWebAPI();

app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname));

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
                chess.move(move);
                fenPositions.push({
                    move: index + 1,
                    fen: chess.fen(),
                    san: move
                });
            });

            res.json({ positions: fenPositions });
        }, function (err) {
            res.status(500).json({ error: err });
        });

});