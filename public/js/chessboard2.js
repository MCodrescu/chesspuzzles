import { INPUT_EVENT_TYPE, COLOR, Chessboard, BORDER_TYPE } from "../node_modules/cm-chessboard/src/Chessboard.js"
import { MARKER_TYPE, Markers } from "../node_modules/cm-chessboard/src/extensions/markers/Markers.js"
import { PROMOTION_DIALOG_RESULT_TYPE, PromotionDialog } from "../node_modules/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"
import { Accessibility } from "../node_modules/cm-chessboard/src/extensions/accessibility/Accessibility.js"
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.mjs@1/src/chess.mjs/Chess.js"
import { RightClickAnnotator } from "../node_modules/cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";

// Initialize values
var stockfishBestMove = [];
const chess = new Chess();
var lastMoveDetails = document.querySelector('#lastMoveDetails');
var top_positions;
var puzzle_number = 0;
var topGamesData;
var board_orientation;

// Toast Configuration
var toastLiveExample = document.getElementById('liveToast')
var toastLiveWrong = document.getElementById('liveToastWrong')
var toastInfo = document.getElementById('liveToastInfo')

var toastBootstrapCorrect = bootstrap.Toast.getOrCreateInstance(toastLiveExample)
var toastBootstrapIncorrect = bootstrap.Toast.getOrCreateInstance(toastLiveWrong)
var toastBootstrapInfo = bootstrap.Toast.getOrCreateInstance(toastInfo)
var incorrectToastBody = document.querySelector('#incorrectToastBody');
var infoToastBody = document.querySelector('#infoToastBody');

// Puzzle correct or incorrect toast message
function showEngineBestMoveToast(source, target) {
  if (stockfishBestMove.includes(`${source}${target}`)) {

    toastBootstrapCorrect.show();
  } else {
    console.log('Incorrect Move');
    console.log(stockfishBestMove);
    incorrectToastBody.innerHTML = `Incorrect! Stockfish's Best Move: ${stockfishBestMove[4]}`

    toastBootstrapIncorrect.show();
  }
}

// Define legal moves, promotions, and move validation for chessboard input
function inputHandler(event) {

  if (event.type === INPUT_EVENT_TYPE.movingOverSquare) {
    return // ignore this event
  }
  if (event.type !== INPUT_EVENT_TYPE.moveInputFinished) {
    event.chessboard.removeLegalMovesMarkers()
  }
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    // mark legal moves
    const moves = chess.moves({ square: event.squareFrom, verbose: true })
    event.chessboard.addLegalMovesMarkers(moves)
    return moves.length > 0

  } else if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
    const move = { from: event.squareFrom, to: event.squareTo, promotion: event.promotion }
    const result = chess.move(move)

    if (result) {
      event.chessboard.state.moveInputProcess.then(() => { // wait for the move input process has finished
        event.chessboard.setPosition(chess.fen(), true).then(() => { // update position, maybe castled and wait for animation has finished
          showEngineBestMoveToast(event.squareFrom, event.squareTo)
        })
      })
    } else {
      // promotion?
      let possibleMoves = chess.moves({ square: event.squareFrom, verbose: true })
      for (const possibleMove of possibleMoves) {
        if (possibleMove.promotion && possibleMove.to === event.squareTo) {
          event.chessboard.showPromotionDialog(event.squareTo, COLOR.white, (result) => {

            if (result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
              chess.move({ from: event.squareFrom, to: event.squareTo, promotion: result.piece.charAt(1) })
              event.chessboard.setPosition(chess.fen(), true)
              showEngineBestMoveToast(event.squareFrom, event.squareTo)

            } else {
              // promotion canceled
              event.chessboard.enableMoveInput(inputHandler, COLOR.white)
              event.chessboard.setPosition(chess.fen(), true)
            }
          })
          return true
        }
      }
    }
    return result
  } else if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
    if (event.legalMove) {
      event.chessboard.disableMoveInput()
    }
  }
}

const board = new Chessboard(document.getElementById("board"), {
  position: chess.fen(),
  assetsUrl: "../node_modules/cm-chessboard/assets/",
  style: { borderType: BORDER_TYPE.none, pieces: { file: "pieces/staunty.svg" }, animationDuration: 300 },
  extensions: [
    { class: Markers, props: { autoMarkers: MARKER_TYPE.square } },
    { class: RightClickAnnotator },
    { class: PromotionDialog },
    { class: Accessibility, props: { visuallyHidden: true } }
  ]
})

// Button Configuration 
var loadGamesButton = document.querySelector('#loadGames');
var nextPuzzleButton = document.querySelector("#nextPuzzle");

// Generate top ten puzzles
loadGamesButton.addEventListener('click', function () {
  var username = document.querySelector('#chessUsername').value;
  var year = document.querySelector('#year').value;
  var month = document.querySelector('#month').value;
  var format = document.querySelector('#gameFormat').value;
  var game_number = document.querySelector('#gameNumber').value;

  // Clear old toasts
  toastBootstrapCorrect.hide();
  toastBootstrapIncorrect.hide();

  // Get basic player info
  fetch(`/chesswebapi/player/${username}`)
    .then(response => response.json())
    .then(data => console.log('Player Profile', data))
    .catch(err => console.error(err));

  // Load recent games
  fetch(`/chesswebapi/player/games/${username}/${year}/${month}`)
    .then(response => response.json())
    .then(data => {

      console.log('Player Games', data)

      board_orientation = data.games[game_number].white.username === `${username}` ? COLOR.white : COLOR.black;

      // Get the FEN list for the selected game
      // Display a random position from the game
      fetch('/stockfish/topTenPositions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gameId: data.games[game_number].uuid, username: username })
      })
        .then(response => response.json())
        .then(data => {
          console.log('Game FENs', data)

          //var total_moves = data.positions.length - 1;
          topGamesData = data;
          var topGame = data.topGames[0].top_position[puzzle_number]
          top_positions = data.topGames[0];
          //var position_number = Math.random() * total_moves;
          var position_number = topGame.move;

          //console.log(`Position Number: ${position_number} / Total Moves: ${total_moves}`);

          position_number_is_even = position_number % 2 === 0;
          if (board_orientation === COLOR.black) {
            if (position_number_is_even)
              position_number = position_number - 1;
          } else {
            if (!position_number_is_even)
              position_number = position_number - 1;
          }
          var position_number_is_even = position_number % 2 === 0;
          var player_to_move = position_number_is_even ? 'white' : 'black';

          console.log(`Position number: ${position_number} / position_number_is_even: ${position_number_is_even} / Player to Move: ${player_to_move} / Board Orientation: ${board_orientation}`);
          //console.log(`Move Coord: ${data.positions[position_number].coord}`)

          // Update the board and show the last move made before the position
          chess.load(topGame.fen_before);
          board.setOrientation(board_orientation);
          if (!board.isMoveInputEnabled()) {
            board.enableMoveInput(inputHandler, board_orientation)
          }
          board.setPosition(topGame.fen_before, true);
          setTimeout(() => {
            chess.move({ from: topGame.coord.slice(0, 2), to: topGame.coord.slice(3, 5) });
            board.setPosition(chess.fen(), true);
          }, 1000);


          // Get Stockfish's best move for the position
          fetch(`/stockfish/bestmove/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fen: topGame.fen, depth: 15 })
          })
            .then(response => response.json())
            .then(stockfishData => {
              console.log('Stockfish Data', stockfishData);
              console.log('Stockfish Best Move Coord', stockfishData.bestmove);
              stockfishBestMove = stockfishData.bestmove.split(" ");

              // Convert Stockfish's best move from coordinate format to SAN format for display in the toast message
              fetch('/chesswebapi/convertCoordtoSAN/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  coord: stockfishBestMove[1],
                  fen: topGame.fen
                })
              })
                .then(response => response.json())
                .then(sanData => {
                  stockfishBestMove.push(sanData.san);
                })
                .catch(err => console.error(err));

            })
            .catch(err => console.error(err));

          // show game info
          lastMoveDetails.innerHTML = `
          <strong>${board_orientation === COLOR.white ? 'White to Move' : 'Black to Move'}</strong>:
          Last Move: ${topGame.san}
          `;

        })
        .catch(err => console.error(err));

    })
    .catch(err => console.error(err));

})

// Load Next Puzzle
nextPuzzleButton.addEventListener('click', () => {

  if (puzzle_number == 10) {
    return;
  } else {
    puzzle_number += 1;
  }

  // Set the board to that position
  var topGame = topGamesData.topGames[0].top_position[puzzle_number]
  top_positions = topGamesData.topGames[0];
  var position_number = topGame.move;
  stockfishBestMove = topGame.bestline.slice(0, 4);

  position_number_is_even = position_number % 2 === 0;
  if (board_orientation === COLOR.black) {
    if (position_number_is_even)
      position_number = position_number - 1;
  } else {
    if (!position_number_is_even)
      position_number = position_number - 1;
  }
  var position_number_is_even = position_number % 2 === 0;

  // Update the board and show the last move made before the position
  chess.load(topGame.fen_before);
  board.setOrientation(board_orientation);
  if (!board.isMoveInputEnabled()) {
    board.enableMoveInput(inputHandler, board_orientation)
  }
  board.setPosition(topGame.fen_before, true);
  setTimeout(() => {
    chess.move({ from: topGame.coord.slice(0, 2), to: topGame.coord.slice(3, 5) });
    board.setPosition(chess.fen(), true);
  }, 1000);

  // Convert Stockfish's best move from coordinate format to SAN format for display in the toast message
  fetch('/chesswebapi/convertCoordtoSAN/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coord: stockfishBestMove[0],
      fen: topGame.fen
    })
  })
    .then(response => response.json())
    .then(sanData => {
      stockfishBestMove.push(sanData.san);
    })
    .catch(err => console.error(err));
})