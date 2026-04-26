/*function getStockfishBestMove(fen, depth) {
    var fen = encodeURIComponent(fen);
    var depth = depth;
    var url = `https://stockfish.online/api/s/v2.php?fen=${fen}&depth=${depth}`;

    return new Promise((resolve, reject) => {
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                //console.log("Best Move by Stockfish ", data)
                resolve ({ 
                    bestmove: data.bestmove, 
                    continuation: data.continuation.split(" "), 
                    evaluation: data.evaluation, 
                    mate: data.mate 
                })
            })
            .catch(
                err => {
                    console.log(err);
                    resolve ({ 
                        bestmove: null, 
                        continuation: null, 
                        evaluation: null,
                        mate: null
                    })
                }
            );
    })
} */

const { spawn } = require('child_process');
const engine = spawn('stockfish');

function getStockfishBestMove(fen, depth, timeoutMs = 5000) {
    if (!engine || !engine.stdout) {
        return Promise.reject(new Error('Invalid engine: spawn Stockfish and pass the child process as "engine"'));
    }

    return new Promise((resolve, reject) => {
        const lines = [];
        let bestmoveLine = null;
        let timedOut = false;
        let lastInfoCp = null;
        let lastInfoPv = null;
        let lastMate = null;

        const onData = chunk => {
            const text = chunk.toString();
            text.split(/\r?\n/).forEach(l => {
                if (!l) return;
                lines.push(l);
                if (l.startsWith('info') & l.includes("depth " + depth)) {
                    const mCp = l.match(/score\s+cp\s+(-?\d+)/);
                    const mate = l.match(/mate\s+(-?\d+)/);
                    const mPv = l.match(/\bpv\b\s+(.+)$/);
                    if (mCp) lastInfoCp = Number(mCp[1]);
                    if (mPv) lastInfoPv = mPv[1].trim().split(/\s+/);
                    if (mate) lastMate = mate;
                }
                if (l.startsWith('bestmove')) {
                    bestmoveLine = l;
                    finish();
                }
            });
        };

        const onError = err => { cleanup(); reject(err); };
        const onExit = (code, sig) => {
            cleanup();
            if (!bestmoveLine && !timedOut) {
                reject(new Error(`engine exited (code=${code},sig=${sig}) before bestmove`));
            }
        };

        const cleanup = () => {
            engine.stdout.off('data', onData);
            engine.stderr.off('data', onError);
            engine.off('error', onError);
            engine.off('exit', onExit);
            clearTimeout(timer);
        };

        const finish = () => {
            if (timedOut) return;
            cleanup();
            const lastLine = lines.length ? lines[lines.length - 1] : '';
            resolve({ bestmove: lastLine, evaluation: lastInfoCp, continuation: lastInfoPv, mate: lastMate });
        };

        const timer = setTimeout(() => {
            timedOut = true;
            cleanup();
            if (bestmoveLine) return finish();
            reject(new Error('Timeout waiting for bestmove from Stockfish'));
        }, timeoutMs);

        engine.stdout.on('data', onData);
        engine.stderr.on('data', onError);
        engine.on('error', onError);
        engine.on('exit', onExit);

        const waitFor = expected => new Promise(res => {
            const handler = chunk => {
                const text = chunk.toString();
                if (text.includes(expected)) {
                    engine.stdout.off('data', handler);
                    res();
                }
            };
            engine.stdout.on('data', handler);
        });

        (async () => {
            engine.stdin.write('ucinewgame\n');
            engine.stdin.write('uci\n');
            await waitFor('uciok');
            engine.stdin.write('isready\n');
            await waitFor('readyok');
            engine.stdin.write(`position fen ${fen}\n`);
            engine.stdin.write(`go depth ${depth}\n`);
        })().catch(err => { cleanup(); reject(err); });
    });
}

module.exports = { getStockfishBestMove };
