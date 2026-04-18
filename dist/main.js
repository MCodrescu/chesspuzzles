"use strict";

function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// main.js
var express = require('express');
var ChessWebAPI = require('chess-web-api');
var _require = require('chess.js'),
  Chess = _require.Chess;
require('dotenv').config();
var _require2 = require('./engine'),
  getStockfishBestMove = _require2.getStockfishBestMove;
var app = express();
var chessAPI = new ChessWebAPI();
app.use(express.json());
app.use(express["static"](__dirname + '/public', {
  maxAge: 300000
}));
app.use(express["static"](__dirname, {
  maxAge: 300000
}));
var port = process.env.PORT;
app.listen(port, function () {
  console.log("Server is running on port ".concat(port));
});

// Get basic player information based on username
app.get('/chesswebapi/player/:username', function (req, res) {
  chessAPI.getPlayer(req.params.username).then(function (response) {
    res.json(response.body);
  }, function (err) {
    res.status(500).json({
      error: err
    });
  });
});

// Get all games for a specific player, year, and month
app.get('/chesswebapi/player/games/:username/:year/:month', function (req, res) {
  chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month).then(function (response) {
    res.json(response.body);
  }, function (err) {
    res.status(500).json({
      error: err
    });
  });
});

// Get the FEN positions for every move 
// for a specific game based on username, year, month, format, and game UUID
app.get('/chesswebapi/gamefen/:username/:year/:month/:format/:gameuuid', function (req, res) {
  chessAPI.getPlayerCompleteMonthlyArchives(req.params.username, req.params.year, req.params.month).then(function (response) {
    // Find the game with the specified UUID and format, then extract its PGN
    var pgn;
    try {
      pgn = response.body.games.find(function (game) {
        return game.uuid === req.params.gameuuid && game.time_class === req.params.format;
      }).pgn;
    } catch (_unused) {
      return;
    }
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
      mv = chess.move(move);
      fenPositions.push({
        move: index + 1,
        fen: chess.fen(),
        san: move,
        coord: "".concat(mv.from, "-").concat(mv.to)
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

// Convert coordinate move to SAN
// Stockfish returns best move in coordinate format, but we want to display it in SAN format
app.post('/chesswebapi/convertCoordtoSAN/', function (req, res) {
  var chess = new Chess(req.body.fen);
  try {
    var mv = chess.move(req.body.coord);
  } catch (err) {
    res.status(400).json({
      error: 'Invalid Coordinate move format',
      details: err.toString()
    });
    return;
  }
  if (mv) {
    res.json({
      san: mv.san
    });
  } else {
    res.status(400).json({
      error: 'Invalid Coordinate move'
    });
  }
});

// Get the best move from Stockfish API based on the given FEN and depth
app.post('/stockfish/bestmove/', function (req, res) {
  try {
    var result = getStockfishBestMove(req.body.fen, req.body.depth);
    result.then(function (data) {
      res.json(data);
    });
  } catch (err) {
    res.status(500).json({
      error: err.toString()
    });
  }
});
app.post('/stockfish/evaluationChange/', /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(req, res) {
    var fen, depth, orientation, result;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.n) {
        case 0:
          try {
            fen = req.body.fen;
            depth = req.body.depth;
            orientation = req.body.orientation;
            console.log("FEN for eval change calc ", fen);
            result = getStockfishBestMove(req.body.fen, req.body.depth);
            result.then(function (data) {
              if (data.mate) {
                var response = data.mate;
                return res.json({
                  response: response
                });
              }
              var current_eval = data.evaluation;
              var bestline = data.continuation;
              var chessEval = new Chess(fen);
              console.log("Eval Change calc bestline ", bestline);
              for (var i = 0; i < bestline.length; i++) {
                var mv = chessEval.move(bestline[i]);
                if (!mv) {
                  return res.status(400).json({
                    error: 'Invalid Coordinate move in Stockfish best line'
                  });
                }
              }
              var nextFen = chessEval.fen();
              console.log("FEN After Best Moves ", nextFen);
              var after = getStockfishBestMove(nextFen, depth);
              after.then(function (data) {
                var eval_after_continuation = data.evaluation;
                var eval_change = orientation === 'white' ? eval_after_continuation - current_eval : current_eval - eval_after_continuation;
                res.json({
                  eval_change: eval_change
                });
              });
            });
          } catch (err) {
            res.status(500).json({
              error: err.toString()
            });
          }
        case 1:
          return _context.a(2);
      }
    }, _callee);
  }));
  return function (_x, _x2) {
    return _ref.apply(this, arguments);
  };
}());