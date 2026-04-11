var game_number = 10;
var position_number = 10;

var config = {
  draggable: true,
  position: 'start'
}

var board = Chessboard('board1', config);

loadGamesButton = document.querySelector('#loadGames');

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

      fetch(`/chesswebapi/gamefen/${username}/${year}/${month}/${format}/` + data.games[game_number].uuid)
        .then(response => response.json())
        .then(data => {
          console.log('Game FENs', data)

          board.orientation(orientation);
          board.position(data.positions[position_number].fen);

        })
        .catch(err => console.error(err));

    })
    .catch(err => console.error(err));

})

