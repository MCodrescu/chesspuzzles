var config = {
  draggable: true,
  position: 'start',
  moveSpeed: 'slow'
}

var board = Chessboard('board1', config);

loadGamesButton = document.querySelector('#loadGames');
gameInfo = document.querySelector('#gameInfo');

loadGamesButton.addEventListener('click', function () {
  username = document.querySelector('#chessUsername').value;
  year = document.querySelector('#year').value;
  month = document.querySelector('#month').value;
  format = document.querySelector('#gameFormat').value;
  game_number = document.querySelector('#gameNumber').value;

  fetch(`/chesswebapi/player/${username}`)
    .then(response => response.json())
    .then(data => console.log('Player Profile', data))
    .catch(err => console.error(err));

  fetch(`/chesswebapi/player/games/${username}/${year}/${month}`)
    .then(response => response.json())
    .then(data => {

      console.log('Player Games', data)

      var orientation = data.games[game_number].white.username === `${username}` ? 'white' : 'black';
      var game_info = data

      fetch(`/chesswebapi/gamefen/${username}/${year}/${month}/${format}/` + data.games[game_number].uuid)
        .then(response => response.json())
        .then(data => {
          console.log('Game FENs', data)

          total_moves = data.positions.length - 1;
          position_number = Math.random() * total_moves;
          position_number = Math.ceil(position_number);

          console.log(`Position Number: ${position_number} / Total Moves: ${total_moves}`);

          position_number_is_even = position_number % 2 === 0;
          if (orientation === 'black') {
            if (position_number_is_even)
              position_number = position_number - 1;
          } else {
            if (!position_number_is_even)
              position_number = position_number - 1;
          }
          position_number_is_even = position_number % 2 === 0;
          player_to_move = position_number_is_even ? 'white' : 'black';

          console.log(`Position number: ${position_number} / position_number_is_even: ${position_number_is_even} / Player to Move: ${player_to_move} / Board Orientation: ${orientation}`);
          console.log(`Move Coord: ${data.positions[position_number].coord}`)

          board.orientation(orientation);
          board.position(data.positions[position_number - 1].fen);
          setTimeout(() => {
            board.move(data.positions[position_number].coord);
          }, 1000);
          

          gameInfo.innerHTML = `
          Player To Move: ${player_to_move}<br>
          Black Player: ${game_info.games[game_number].black.username} (${game_info.games[game_number].black.rating})<br>
          White Player: ${game_info.games[game_number].white.username} (${game_info.games[game_number].white.rating})<br>
          Time Class: ${game_info.games[game_number].time_class}<br>
          Last Move: ${data.positions[position_number].san}
          `;

        })
        .catch(err => console.error(err));

    })
    .catch(err => console.error(err));

})

