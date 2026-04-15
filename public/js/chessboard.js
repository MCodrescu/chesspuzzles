// Initialize chessboard and chess.js game instance
var board = null
var game = new Chess()
var stockfishBestMove;

// Toast Configuration
var toastTriggerCorrect = document.getElementById('correctAnswerToastBtn')
var toastLiveExample = document.getElementById('liveToast')
var toastTriggerIncorrect = document.getElementById('incorrectAnswerToastBtn')
var toastLiveWrong = document.getElementById('liveToastWrong')

var toastBootstrapCorrect = bootstrap.Toast.getOrCreateInstance(toastLiveExample)
var toastBootstrapIncorrect = bootstrap.Toast.getOrCreateInstance(toastLiveWrong)
var incorrectToastBody = document.querySelector('#incorrectToastBody');

// Button Configuration 
loadGamesButton = document.querySelector('#loadGames');

function onDragStart(source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for current orientation
  if ((orientation === 'white' && piece.search(/^b/) !== -1) ||
    (orientation === 'black' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop(source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  })

  // illegal move
  if (move === null) {
    return 'snapback'

  } else {
    if (stockfishBestMove.includes(`${source}${target}`)) {

      toastBootstrapCorrect.show();
    } else {
      console.log('Incorrect Move');

      incorrectToastBody.innerHTML = `Incorrect! Stockfish's Best Move: ${stockfishBestMove[4]}`

      toastBootstrapIncorrect.show();
    }

  }
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
  board.position(game.fen())
}

var config = {
  draggable: true,
  position: 'start',
  moveSpeed: 'slow',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
}

board = Chessboard('board1', config)


// Load a new puzzle
loadGamesButton.addEventListener('click', function () {
  username = document.querySelector('#chessUsername').value;
  year = document.querySelector('#year').value;
  month = document.querySelector('#month').value;
  format = document.querySelector('#gameFormat').value;
  game_number = document.querySelector('#gameNumber').value;

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

      var board_orientation = data.games[game_number].white.username === `${username}` ? 'white' : 'black';

      // Get the FEN list for the selected game
      // Display a random position from the game
      fetch(`/chesswebapi/gamefen/${username}/${year}/${month}/${format}/` + data.games[game_number].uuid)
        .then(response => response.json())
        .then(data => {
          console.log('Game FENs', data)

          total_moves = data.positions.length - 1;
          position_number = Math.random() * total_moves;
          position_number = Math.ceil(position_number);

          console.log(`Position Number: ${position_number} / Total Moves: ${total_moves}`);

          position_number_is_even = position_number % 2 === 0;
          if (board_orientation === 'black') {
            if (position_number_is_even)
              position_number = position_number - 1;
          } else {
            if (!position_number_is_even)
              position_number = position_number - 1;
          }
          position_number_is_even = position_number % 2 === 0;
          player_to_move = position_number_is_even ? 'white' : 'black';

          console.log(`Position number: ${position_number} / position_number_is_even: ${position_number_is_even} / Player to Move: ${player_to_move} / Board Orientation: ${board_orientation}`);
          console.log(`Move Coord: ${data.positions[position_number].coord}`)

          // Update the board and show the last move made before the position
          game = new Chess(data.positions[position_number - 1].fen);
          board.orientation(board_orientation);
          board.position(data.positions[position_number - 1].fen);
          setTimeout(() => {
            board.move(data.positions[position_number].coord);
            game.move({ from: data.positions[position_number].coord.slice(0, 2), to: data.positions[position_number].coord.slice(3, 5) });
          }, 1000);


          // Get Stockfish's best move for the position
          fetch(`/stockfish/bestmove/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fen: data.positions[position_number - 1].fen, depth: 15 })
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
                  coord: stockfishBestMove[3],
                  fen: data.positions[position_number].fen
                })
              })
                .then(response => response.json())
                .then(sanData => {
                  stockfishBestMove.push(sanData.san);
                })
                .catch(err => console.error(err));

            })
            .catch(err => console.error(err));

          // How much does the evaluation change if the best move is played?
          // This helps determine the puzzle difficulty
          fetch('/stockfish/evaluationChange/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fen: data.positions[position_number].fen,
              depth: 15,
              orientation: board_orientation
            })
          })
            .then(response => response.json())
            .then(evaluationData => {
              console.log('Evaluation Change', evaluationData);
            })
            .catch(err => console.error(err));

          // show game info
          gameInfo.innerHTML = `
          <strong>${board_orientation === 'white' ? 'White to Move' : 'Black to Move'}</strong><br>
          Last Move: ${data.positions[position_number].san}
          `;

        })
        .catch(err => console.error(err));

    })
    .catch(err => console.error(err));

})
