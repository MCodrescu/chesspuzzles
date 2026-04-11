"use strict";

// main.js
var express = require('express');
var ChessWebAPI = require('chess-web-api');
var _require = require('chess.js'),
  Chess = _require.Chess;
var path = require('path');
var app = express();
var chessAPI = new ChessWebAPI();
app.use(express["static"](__dirname + '/public'));
app.use(express["static"](__dirname));
var port = process.env.PORT;
app.listen(port, function () {
  console.log("Server is running on port ".concat(port));
});
app.get('/chesswebapi/player/:username', function (req, res) {
  chessAPI.getPlayer(req.params.username).then(function (response) {
    res.json(response.body);
  }, function (err) {
    res.status(500).json({
      error: err
    });
  });
});
app.get('/chesswebapi/player/games/:username/:year/:month', function (req, res) {
  chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month).then(function (response) {
    res.json(response.body);
  }, function (err) {
    res.status(500).json({
      error: err
    });
  });
});
app.get('/chesswebapi/gamefen/:username/:year/:month/:format/:gameuuid', function (req, res) {
  chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month).then(function (response) {
    // Find the game with the specified UUID and format, then extract its PGN
    pgn = response.body.games.find(function (game) {
      return game.uuid === req.params.gameuuid && game.time_class === req.params.format;
    }).pgn;
    var chess = new Chess();
    chess.loadPgn(pgn);
    var moves = chess.history();
    var fenPositions = [];

    // Reset to starting position
    chess.reset();

    // Add starting position
    fenPositions.push({
      move: 0,
      fen: chess.fen(),
      san: 'Start'
    });

    // Make each move and record FEN
    moves.forEach(function (move, index) {
      chess.move(move);
      fenPositions.push({
        move: index + 1,
        fen: chess.fen(),
        san: move
      });
    });
    res.json({
      positions: fenPositions
    });
  }, function (err) {
    res.status(500).json({
      error: err
    });
  });
});