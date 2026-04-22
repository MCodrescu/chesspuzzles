import { INPUT_EVENT_TYPE, COLOR, Chessboard, BORDER_TYPE } from "../node_modules/cm-chessboard/src/Chessboard.js"
import { MARKER_TYPE, Markers } from "../node_modules/cm-chessboard/src/extensions/markers/Markers.js"
import { PROMOTION_DIALOG_RESULT_TYPE, PromotionDialog } from "../node_modules/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"
import { Accessibility } from "../node_modules/cm-chessboard/src/extensions/accessibility/Accessibility.js"
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.mjs@1/src/chess.mjs/Chess.js"
import { RightClickAnnotator } from "../node_modules/cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";

// Initialize values
var stockfishBestMoveCoord;
var stockfishBestMoveSAN;
var top_positions;
const chess = new Chess();
var lastMoveDetails = document.querySelector('#lastMoveDetails');
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
  console.log(stockfishBestMoveCoord);
  console.log(stockfishBestMoveSAN);
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
  style: { borderType: BORDER_TYPE.none, pieces: { file: "pieces/staunty.svg" }, animationDuration: 300 },
  extensions: [
    { class: Markers, props: { autoMarkers: MARKER_TYPE.square } },
    { class: RightClickAnnotator },
    { class: PromotionDialog },
    { class: Accessibility, props: { visuallyHidden: true } }
  ]
})

/**
 * Retrieve basic player info
 * @param  {string} username The chess.com username.
 * @return {json}     Returns json data with the player info.
 */
async function getBasicPlayerInfo(username) {
  try {
    const response = await fetch(`/chesswebapi/player/${username}`);
    const basicPlayerInfo = await response.json()
    console.log("Basic Player Info: ", basicPlayerInfo);
    return basicPlayerInfo;
  } catch (error) {
    console.log("Error in getBasicPlayerInfo: ", error);
  }
}

/**
 * Convert Coord notation to SAN notation
 * @param  {string} coord The coord notation like c2c4
 * @param  {string} fen The FEN notation of the current game position.
 * @return {string}     Returns the equivalent notation in SAN like Qc4.
 */
async function convertCoordToSan(coord, fen) {
  try {
    const response = await fetch(
      '/chesswebapi/convertCoordtoSAN/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coord: coord,
        fen: fen
      })
    })
    const sanData = await response.json();
    return sanData.san;
  } catch (error) {
    console.log("Error in convertCoordToSan: ", error);
  }
}

/**
 * Get stockfish best move in the position.
 * @param  {string} fen The FEN notation of the current game position.
 * @param  {int} depth The depth of calculation.
 * @return {string}     The coord notation of stockfish best move.
 */
async function getStockfishBestMove(fen, depth) {

  try {
    const response = await fetch(
      `/stockfish/bestmove/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fen: fen, depth: depth })
    })
    const stockfishData = await response.json();
    console.log('Stockfish Data: ', stockfishData);
    var stockfishBestMove = stockfishData.bestmove.split(" ");
    console.log('Stockfish Best Move Coord: ', stockfishBestMove);
    return stockfishBestMove[1];
  } catch (error) {
    console.log("Error in getStockfishBestMove: ", error);
  }
}

/**
 * Get top ten positions in a game by the positive change in evaluation 
 * from playing the best move.
 * @param  {string} gameId The FEN notation of the current game position.
 * @param  {string} username The chess.com username.
 * @return {json}     The json object of the top ten positions.
 */
async function getTopTenGamePositions(gameId, username) {
  try {
    const response = await fetch(
      '/stockfish/topTenPositions/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gameId: gameId, username: username })
    })
    const topTenPositions = await response.json();
    console.log('Top Ten Game Positions: ', topTenPositions);
    return topTenPositions.topGames[0];
  } catch (error) {
    console.log("Error in getTopTenGamePositions: ", error)
  }
}

/**
 * Get all the chess.com games for a given year and month.
 * @param  {string} username The chess.com username.
 * @param  {string} year The year to search.
 * @param  {string} month The month to search.
 * @return {json}     The json object of the player games.
 */
async function getPlayerGames(username, year, month) {
  try {
    const response = await fetch(`/chesswebapi/player/games/${username}/${year}/${month}`);
    const playerGames = await response.json();
    console.log("Player Games Data: ", playerGames);
    return playerGames;
  } catch (error) {
    console.log("Error in getPlayerGames: ", error)
  }
}

async function loadGames() {
  try {
    var username = document.querySelector('#chessUsername').value;
    var year = document.querySelector('#year').value;
    var month = document.querySelector('#month').value;
    var format = document.querySelector('#gameFormat').value;
    var game_number = document.querySelector('#gameNumber').value;
    game_number = parseInt(game_number);

    console.log("Username: ", username);
    console.log("Year: ", year);
    console.log("Month: ", month);
    console.log("Format: ", format);
    console.log("Game Number: ", game_number);

    // Clear old toasts
    toastBootstrapCorrect.hide();
    toastBootstrapIncorrect.hide();

    // Show loading message
    infoToastBody.innerHTML = "Processing positions ...";
    toastBootstrapInfo.show();

    // Get basic player info
    await getBasicPlayerInfo();

    // Load recent games
    var playerGames = await getPlayerGames(username, year, month);

    // Get the correct board orientation.
    var board_orientation = playerGames.games[game_number].white.username === `${username}` ? COLOR.white : COLOR.black;

    // Load top ten positions from that game
    top_positions = await getTopTenGamePositions(playerGames.games[game_number].uuid, username);
    toastBootstrapInfo.hide();
    var topGame = top_positions.top_position[puzzle_number]
    var position_number = topGame.move;

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

    // Get stockfish best move
    stockfishBestMoveCoord = await getStockfishBestMove(topGame.fen, 15);

    // Convert Stockfish's best move from coordinate format to SAN format for display in the toast message
    stockfishBestMoveSAN = await convertCoordToSan(stockfishBestMoveCoord, topGame.fen);

    // show game info
    lastMoveDetails.innerHTML = `
        <strong>${board_orientation === COLOR.white ? 'White to Move' : 'Black to Move'}</strong>:
        Last Move: ${topGame.san}
      `;
  } catch (error) {
    console.log("Error in loading puzzles: ", error);
  }
}

// Button Configuration 
var loadGamesButton = document.querySelector('#loadGames');
var nextPuzzleButton = document.querySelector("#nextPuzzle");

// Generate top ten puzzles
loadGamesButton.addEventListener('click', function () {
  loadGames();
})

async function loadNextPuzzle() {
  try {
    if (puzzle_number == 10) {
      return;
    } else {
      puzzle_number += 1;
    }

    // Set the board to that position
    var topGame = top_positions.top_position[puzzle_number]
    var position_number = topGame.move;
    stockfishBestMoveCoord = topGame.bestline.slice(0, 4)[0];

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
    stockfishBestMoveSAN = await convertCoordToSan(stockfishBestMoveCoord, topGame.fen);
  } catch (error) {
    console.log("Error in loadNextPuzzle: ", error)
  }
}

// Load Next Puzzle
nextPuzzleButton.addEventListener('click', () => {
  loadNextPuzzle();


})