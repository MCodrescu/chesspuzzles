const { spawn } = require('child_process');

let engine = null;
let engineReady = false;
let requestQueue = [];
let isProcessing = false;

/**
 * Spawn a new Stockfish process and perform one-time UCI initialization.
 * Resolves when the engine has confirmed 'uciok' and 'readyok'.
 * @returns {Promise<void>}
 */
async function initEngine() {
    return new Promise((resolve, reject) => {
        engine = spawn('stockfish');
        engineReady = false;

        engine.on('error', err => {
            reject(new Error(`Failed to spawn Stockfish: ${err.message}`));
        });

        engine.stderr.on('data', chunk => {
            console.warn('stockfish stderr:', chunk.toString());
        });

        engine.on('exit', (code, signal) => {
            console.warn(`Stockfish exited (code=${code}, signal=${signal})`);
            engineReady = false;
            engine = null;
        });

        let buffer = '';
        const onData = chunk => {
            buffer += chunk.toString();
            if (buffer.includes('readyok')) {
                engine.stdout.off('data', onData);
                engineReady = true;
                resolve();
            }
        };

        engine.stdout.on('data', onData);
        engine.stdin.write('uci\n');
        engine.stdin.write('isready\n');
    });
}

/**
 * Ensure the Stockfish engine is running and ready.
 * If the engine has crashed or was never started, reinitialize it.
 * @returns {Promise<void>}
 */
async function ensureEngine() {
    if (!engine || !engineReady) {
        await initEngine();
    }
}

/**
 * Gracefully shut down the Stockfish engine.
 * @returns {Promise<void>}
 */
async function closeEngine() {
    if (engine) {
        engine.stdin.write('quit\n');
        engine.kill();
        engine = null;
        engineReady = false;
    }
}

/**
 * Wait for Stockfish stdout to contain a specific string.
 * Rejects if the timeout expires before the string is found.
 * @param {string} expected The string to wait for.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {Promise<void>}
 */
function waitFor(expected, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        let buffer = '';

        const handler = chunk => {
            buffer += chunk.toString();
            if (buffer.includes(expected)) {
                cleanup();
                resolve();
            }
        };

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout waiting for "${expected}" from Stockfish`));
        }, timeoutMs);

        const cleanup = () => {
            engine.stdout.off('data', handler);
            clearTimeout(timer);
        };

        engine.stdout.on('data', handler);
    });
}

/**
 * Parse the last 'info' line at the target depth to extract evaluation
 * and principal variation data.
 * @param {string[]} lines All lines collected during analysis.
 * @param {number} depth The target depth to look for.
 * @returns {object} Object with evaluation, continuation, and mate fields.
 */
function parseAnalysisInfo(lines, depth) {
    let evaluation = null;
    let continuation = null;
    let mate = null;

    for (const line of lines) {
        if (!line.startsWith('info') || !line.includes(`depth ${depth}`)) {
            continue;
        }

        const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
        const pvMatch = line.match(/\bpv\b\s+(.+)$/);

        if (cpMatch) evaluation = Number(cpMatch[1]);
        if (mateMatch) mate = Number(mateMatch[1]);
        if (pvMatch) continuation = pvMatch[1].trim().split(/\s+/);
    }

    return { evaluation, continuation, mate };
}

/**
 * Parse the bestmove line to extract the move string.
 * @param {string} bestmoveLine The raw 'bestmove ...' line from Stockfish.
 * @returns {string|null} The best move (e.g. 'e2e4'), or null if unparseable.
 */
function parseBestMove(bestmoveLine) {
    const match = bestmoveLine.match(/^bestmove\s+(\S+)/);
    return match ? match[1] : null;
}

/**
 * Send a position to Stockfish and collect analysis up to a given depth.
 * Returns the best move, evaluation, continuation line, and mate info.
 * @param {string} fen The FEN string of the position.
 * @param {number} depth The search depth.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {Promise<object>} Analysis result with bestmove, evaluation, continuation, mate.
 */
function performAnalysis(fen, depth, timeoutMs) {
    return new Promise((resolve, reject) => {
        const lines = [];
        let bestmoveLine = null;
        let timedOut = false;

        const onData = chunk => {
            chunk.toString().split(/\r?\n/).forEach(line => {
                if (!line) return;
                lines.push(line);
                if (line.startsWith('bestmove')) {
                    bestmoveLine = line;
                    finish();
                }
            });
        };

        const onError = err => {
            cleanup();
            reject(err);
        };

        const onExit = (code, signal) => {
            cleanup();
            if (!bestmoveLine && !timedOut) {
                reject(new Error(`Engine exited (code=${code}, signal=${signal}) before bestmove`));
            }
        };

        const cleanup = () => {
            engine.stdout.off('data', onData);
            engine.off('error', onError);
            engine.off('exit', onExit);
            clearTimeout(timer);
        };

        const finish = () => {
            if (timedOut) return;
            cleanup();

            const bestmove = parseBestMove(bestmoveLine);
            const { evaluation, continuation, mate } = parseAnalysisInfo(lines, depth);

            resolve({ bestmove, evaluation, continuation, mate });
        };

        const timer = setTimeout(() => {
            timedOut = true;
            cleanup();
            engine.stdin.write('stop\n');
            reject(new Error('Timeout waiting for bestmove from Stockfish'));
        }, timeoutMs);

        engine.stdout.on('data', onData);
        engine.on('error', onError);
        engine.on('exit', onExit);

        engine.stdin.write('ucinewgame\n');
        engine.stdin.write(`position fen ${fen}\n`);
        engine.stdin.write('isready\n');

        waitFor('readyok', timeoutMs)
            .then(() => {
                engine.stdin.write(`go depth ${depth}\n`);
            })
            .catch(err => {
                cleanup();
                reject(err);
            });
    });
}

/**
 * Process the request queue sequentially, one analysis at a time.
 * Automatically advances to the next request when the current one completes.
 */
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;

    isProcessing = true;
    try {
        const request = requestQueue.shift();
        try {
            const result = await request.execute();
            request.resolve(result);
        } catch (err) {
            request.reject(err);
        }
    } finally {
        isProcessing = false;
        if (requestQueue.length > 0) {
            processQueue();
        }
    }
}

/**
 * Public API: queue a Stockfish analysis for a given position.
 * Ensures the engine is running, then queues the request.
 * @param {string} fen The FEN string of the position to analyse.
 * @param {number} depth The search depth.
 * @param {number} [timeoutMs=5000] Timeout in milliseconds.
 * @returns {Promise<object>} Analysis result with bestmove, evaluation, continuation, mate.
 */
async function getStockfishBestMove(fen, depth, timeoutMs = 5000) {
    await ensureEngine();

    return new Promise((resolve, reject) => {
        requestQueue.push({
            execute: () => performAnalysis(fen, depth, timeoutMs),
            resolve,
            reject
        });
        processQueue();
    });
}

module.exports = { getStockfishBestMove, closeEngine };
