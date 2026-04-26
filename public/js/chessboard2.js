import { INPUT_EVENT_TYPE, COLOR, Chessboard, BORDER_TYPE } from "../node_modules/cm-chessboard/src/Chessboard.js"
import { MARKER_TYPE, Markers } from "../node_modules/cm-chessboard/src/extensions/markers/Markers.js"
import { PROMOTION_DIALOG_RESULT_TYPE, PromotionDialog } from "../node_modules/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"
import { Accessibility } from "../node_modules/cm-chessboard/src/extensions/accessibility/Accessibility.js"
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.mjs@1/src/chess.mjs/Chess.js"
import { RightClickAnnotator } from "../node_modules/cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";

// Import custom functions
import {
  getTopTenGamePositions,
  getStockfishBestMove,
  convertCoordToSan,
  getBasicPlayerInfo,
  fillGameSelect,
  getPlayerRecentGames
} from "./uiFunctions.js";

// Initialize values
var stockfishBestMoveCoord;
var stockfishBestMoveSAN;
const chess = new Chess();
var lastMoveDetails = document.querySelector('#lastMoveDetails');
var puzzle_number = 0;
var board_orientation;
var topPositions = [];
var topPosition;
var playerGames = [];

// Toast Configuration
var toastLiveExample = document.getElementById('liveToast')
var toastLiveWrong = document.getElementById('liveToastWrong')
var toastInfo = document.getElementById('liveToastInfo')

var toastBootstrapCorrect = bootstrap.Toast.getOrCreateInstance(toastLiveExample)
var toastBootstrapIncorrect = bootstrap.Toast.getOrCreateInstance(toastLiveWrong)
var toastBootstrapInfo = bootstrap.Toast.getOrCreateInstance(toastInfo)
var incorrectToastBody = document.querySelector('#incorrectToastBody');
var infoToastBody = document.querySelector('#infoToastBody');

// All Input Elements
var getRecentGamesButton = document.querySelector("#getRecentGamesButton");
var gameSelect = document.querySelector("#gameSelect");
var usernameTextInput = document.querySelector('#chessUsername');
var loadGamesButton = document.querySelector('#generatePuzzleButton');
var nextPuzzleButton = document.querySelector("#nextPuzzle");
var chessUsername = document.querySelector("#chessUsername");

// Puzzle correct or incorrect toast message
function showEngineBestMoveToast(source, target) {
  if (stockfishBestMoveCoord == `${source}${target}`) {
    toastBootstrapCorrect.show();
  } else {
    incorrectToastBody.innerHTML = `Incorrect! Stockfish's Best Move: ${stockfishBestMoveSAN}`
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
  style: { borderType: BORDER_TYPE.none, pieces: { file: "pieces/staunty.svg" }, animationDuration: 1000 },
  extensions: [
    { class: Markers, props: { autoMarkers: MARKER_TYPE.square } },
    { class: RightClickAnnotator },
    { class: PromotionDialog },
    { class: Accessibility, props: { visuallyHidden: true } }
  ]
})

getRecentGamesButton.addEventListener('click', () => {
  (async () => {
    playerGames = await getPlayerRecentGames(usernameTextInput.value, 3);
    await fillGameSelect(playerGames, gameSelect, loadGamesButton);
  })();
})

async function loadPuzzles(selectedGame, username) {
  try {

    // Get basic player info
    var playerInfo = await getBasicPlayerInfo(username);
    console.log("Player Info: ", playerInfo);

    // Clear old toasts
    toastBootstrapCorrect.hide();
    toastBootstrapIncorrect.hide();

    // Show loading message
    infoToastBody.innerHTML = "Processing positions ...";
    toastBootstrapInfo.show();

    // Get the correct board orientation.
    board_orientation = selectedGame.white.username === `${username}` ? COLOR.white : COLOR.black;
    console.log("Board Orientation: ", board_orientation);

    // Load top ten positions from that game
    topPositions = await getTopTenGamePositions(selectedGame.pgn, board_orientation);
    console.log("Top Positions: ", topPositions);

    toastBootstrapInfo.hide();
    topPosition = topPositions[puzzle_number];
    console.log("Top Position: ", topPosition);

    // Update the board and show the last move made before the position
    chess.load(topPosition.fen_before);
    board.setOrientation(board_orientation);
    if (!board.isMoveInputEnabled()) {
      board.enableMoveInput(inputHandler, board_orientation)
    }
    board.setPosition(topPosition.fen_before, true);
    chess.move({ from: topPosition.coord.slice(0, 2), to: topPosition.coord.slice(3, 5) });
    board.setPosition(chess.fen(), true);

    // Get stockfish best move
    stockfishBestMoveCoord = await getStockfishBestMove(topPosition.fen, 15);

    // Convert Stockfish's best move from coordinate format to SAN format for display in the toast message
    stockfishBestMoveSAN = await convertCoordToSan(stockfishBestMoveCoord, topPosition.fen);

    // show game info
    lastMoveDetails.innerHTML = `
        <strong>${board_orientation === COLOR.white ? 'White to Move' : 'Black to Move'}</strong>:
        Last Move: ${topPosition.san}
      `;
  } catch (error) {
    console.log("Error in loading puzzles: ", error);
  }
}

// Generate top ten puzzles
loadGamesButton.addEventListener('click', function () {
  var selectedGame = playerGames.find((game) => game.uuid === gameSelect.value);

  console.log("Selected Game: ", selectedGame);

  loadPuzzles(selectedGame, chessUsername.value);
})

async function loadNextPuzzle() {
  try {
    if (puzzle_number == 10) {
      return;
    } else {
      puzzle_number += 1;
    }

    // Set the board to that position
    topPosition = topPositions[puzzle_number]
    stockfishBestMoveCoord = topPosition.bestline.slice(0, 4)[0];

    // Update the board and show the last move made before the position
    chess.load(topPosition.fen_before);
    if (!board.isMoveInputEnabled()) {
      board.enableMoveInput(inputHandler, board_orientation)
    }
    board.setPosition(topPosition.fen_before, true);
    chess.move({ from: topPosition.coord.slice(0, 2), to: topPosition.coord.slice(3, 5) });
    board.setPosition(chess.fen(), true);

    // Convert Stockfish's best move from coordinate format to SAN format for display in the toast message
    stockfishBestMoveSAN = await convertCoordToSan(stockfishBestMoveCoord, topPosition.fen);

    // show game info
    lastMoveDetails.innerHTML = `
        <strong>${board_orientation === COLOR.white ? 'White to Move' : 'Black to Move'}</strong>:
        Last Move: ${topPosition.san}
      `;

  } catch (error) {
    console.log("Error in loadNextPuzzle: ", error)
  }
}

// Load Next Puzzle
nextPuzzleButton.addEventListener('click', () => {
  loadNextPuzzle();
})

// On button click, show the continuation
var seeContinuationButton = document.querySelector("#seeContinuation");
seeContinuationButton.addEventListener('click', () => {

  // Reset if changed
  chess.load(topPosition.fen_before);
  board.setPosition(topPosition.fen_before, true);
  chess.move({ from: topPosition.coord.slice(0, 2), to: topPosition.coord.slice(3, 5) });
  board.setPosition(chess.fen(), true);

  // Animate through the best line
  for (let i = 0; i < topPosition.bestline.length; i++) {
    chess.move({ from: topPosition.bestline[i].slice(0, 2), to: topPosition.bestline[i].slice(2, 4) });
    board.setPosition(chess.fen(), true);
  }
})