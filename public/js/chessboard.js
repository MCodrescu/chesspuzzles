var username = 'MCodrescu';
var year = 2026;
var month = 3;
var format = 'blitz';
var game_number = 10;
var position_number = 10;

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
        
        var config = {
          draggable: true,
          orientation: orientation,
          position: data.positions[position_number].fen
        }

        var board = Chessboard('board1', config); 
        
      })
      .catch(err => console.error(err));

  })
  .catch(err => console.error(err));
