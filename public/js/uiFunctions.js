/**
 * Retrieve basic player info
 * @param  {string} username The chess.com username.
 * @return {json}     Returns json data with the player info.
 */
export async function getBasicPlayerInfo(username) {
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
export async function convertCoordToSan(coord, fen) {
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
export async function getStockfishBestMove(fen, depth) {

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
 * @param  {string} gamePGN The PGN of the game.
 * @param  {string} orientation Which side, white or black, should we evaluate for?
 * @return {array}     The array of the top ten positions.
 */
export async function getTopTenGamePositions(gamePGN, orientation) {
    try {
        const response = await fetch(
            '/stockfish/topTenPositions/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pgn: gamePGN, orientation: orientation, depth: 10 })
        })
        const topTenPositions = await response.json();
        console.log('Top Ten Game Positions: ', topTenPositions);
        return topTenPositions.topPositions;
    } catch (error) {
        console.log("Error in getTopTenGamePositions: ", error)
    }
}

/**
 * Get all the chess.com games for a given year and month.
 * @param  {string} username The chess.com username.
 * @param  {string} year The year to search.
 * @param  {string} month The month to search.
 * @return {array}     The array object the recent games.
 */
async function getPlayerGames(username, year, month) {
    try {
        const response = await fetch(`/chesswebapi/player/games/${username}/${year}/${month}`);
        const playerGames = await response.json();
        console.log("Player Games Data: ", playerGames);
        return playerGames.games;
    } catch (error) {
        console.log("Error in getPlayerGames: ", error)
    }
}

/**
 * Return an array of { year, month } objects covering the last `n` years
 * (including the current month/year), ordered newest → oldest.
 *
 * Each item:
 *  - year  {number}  : 4-digit year (e.g., 2026)
 *  - month {number}  : month number 1-12
 *
 * Behavior:
 *  - Includes the current month in the first entry.
 *  - Covers months going backward for n full years (n * 12 months).
 *  - If n <= 0, returns an empty array.
 *
 * @param {number} n - number of years to go back (positive integer)
 * @returns {{year: number, month: number}[]} Array length = n * 12
 */
function getYearMonthPairsLastNYears(n) {
    if (!Number.isInteger(n) || n <= 0) return [];
    const now = new Date();
    const monthsToGenerate = n * 12;
    const result = [];
    for (let i = 0; i < monthsToGenerate; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return result;
}

/** 
 * Get all the most recent games.
 * @param {string} username The player username.
 * @param {int} n The length of time in years to go back.
 * @returns An array of the players recent games.
 */
export async function getPlayerRecentGames(username, n){

    // Get the year month pairs going back in time
    const yearMonthPairs = getYearMonthPairsLastNYears(n);

    var playerGames = [];
    for (let i = 0; i < n * 12; i++) {
      if (playerGames.length < 1) {
        playerGames = await getPlayerGames(username, yearMonthPairs[i].year, yearMonthPairs[i].month);
      } else {
        break;
      }
    }
    return playerGames;
}

/**
 * Fill in the select options with the users recent games
 * @param {array} playerGames The result of getPlayerRecentGames.
 * @param {HTMLSelectElement} gameSelectElement - The game select element in the DOM.
 * @param {HTMLButtonElement} loadGamesButton - The button to load the games.
 * @returns {{year: number, month: number}[]} Array length = n * 12
 */
export async function fillGameSelect(playerGames, gameSelectElement, loadGamesButton) {
  try {

    // Fill the select
    for (let i = 0; i < playerGames.length; i++) {
      var selectOption = document.createElement("option");
      selectOption.value = playerGames[i].uuid;
      selectOption.innerHTML = playerGames[i].eco;
      gameSelectElement.appendChild(selectOption);
    }

    loadGamesButton.setAttribute("class", "btn btn-primary enabled");
    gameSelectElement.setAttribute("class", "form-select d-inline");

    console.log("Player Games: ", playerGames);

    return playerGames;

  } catch (error) {
    console.log("Error on fillGameSelect: ", error)
  }
}