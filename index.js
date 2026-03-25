const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const games = new Map();

function createNewGame() {
  const id = randomUUID();
  const game = {
    id,
    players: {},
    order: [],
    state: 'waiting', // waiting, ready, playing, finished
    turn: null,
    winner: null,
    history: [],
  };
  games.set(id, game);
  return game;
}

function getGame(id) {
  return games.get(id);
}

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Number Guessing Game</title>
  <style>body{font-family:Arial,sans-serif;margin:0;padding:1rem;background:#f4f8ff;color:#0f172a;} .card{max-width:680px;margin:1rem auto;padding:1rem 1.2rem;background:#fff;border-radius:8px;box-shadow:0 3px 10px rgba(0,0,0,.1);} button{padding:10px 16px;font-size:1rem;cursor:pointer;background:#2563eb;border:0;border-radius:6px;color:#fff;} input{padding:8px 10px;font-size:1rem;border:1px solid #cbd5e1;border-radius:6px;} code{background:#f1f5f9;padding:.2rem .4rem;border-radius:4px;}</style>
</head>
<body>
  <div class="card">
    <h1>Number Guessing Game</h1>
    <p>1) Click "Start Game" to generate a shareable link.<br/>2) Send the link to your friend.<br/>3) Each enters a secret number (1-1000).<br/>4) Take turns guessing opponent's number.</p>
    <button id="startBtn">Start Game</button>
    <div id="result" style="margin-top:1rem;"></div>
  </div>
  <script>
    const startBtn = document.getElementById('startBtn');
    const result = document.getElementById('result');
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startBtn.textContent = 'Creating...';
      try {
        const res = await fetch('/new');
        const data = await res.json();
        const url = new URL(window.location.href);
        url.pathname = '/game/' + data.gameId;
        result.innerHTML = '<p>Share this link with your friend:</p>' +
          '<p><code>' + url.toString() + '</code></p>' +
          '<p>Open it now or wait for your friend to join.</p>';
      } catch (err) {
        result.textContent = 'Error creating game. Please refresh and retry.';
      } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Game';
      }
    });
  </script>
</body>
</html>`);
});

app.get('/new', (req, res) => {
  const game = createNewGame();
  res.json({ gameId: game.id });
});

app.get('/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  const game = getGame(gameId);
  if (!game) {
    return res.status(404).send('Game not found');
  }
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Game ${gameId}</title>
<style>body{font-family:Arial,sans-serif;background:#f5f7fb;color:#111;margin:0;padding:1rem;} .card{max-width:760px;margin:1rem auto;padding:1rem 1.2rem;background:#fff;border-radius:8px;box-shadow:0 4px 14px rgba(15,23,42,.09);} input, button{font-size:1rem;padding:.6rem .9rem;border-radius:6px;border:1px solid #cbd5e1;} button{background:#2563eb;color:white;border:none;outline:none;} .hidden{display:none;} .small{font-size:.94rem;color:#475569;}</style>
</head>
<body>
  <div class="card">
    <h1>Number Guessing Game</h1>
    <div id="status"></div>
    <div id="nameForm">
      <label>Name: <input id="playerName" placeholder="Your name" /></label>
      <button id="joinBtn">Join Game</button>
    </div>
    <div id="secretForm" class="hidden">
      <p>Set secret number for opponent to guess (1-1000):</p>
      <input id="secretInput" type="number" min="1" max="1000" />
      <button id="setSecretBtn">Set Secret</button>
    </div>
    <div id="guessForm" class="hidden">
      <p id="turnText"></p>
      <p id="prompt">Guess opponent's number (1-1000):</p>
      <input id="guessInput" type="number" min="1" max="1000" />
      <button id="guessBtn">Guess</button>
    </div>
    <div id="log" style="margin-top:1rem;"></div>
  </div>
  <script>
    const gameId = '${gameId}';
    let playerId = null;
    let playerName = '';

    const statusEl = document.getElementById('status');
    const nameForm = document.getElementById('nameForm');
    const playerNameInput = document.getElementById('playerName');
    const joinBtn = document.getElementById('joinBtn');
    const secretForm = document.getElementById('secretForm');
    const secretInput = document.getElementById('secretInput');
    const setSecretBtn = document.getElementById('setSecretBtn');
    const guessForm = document.getElementById('guessForm');
    const turnText = document.getElementById('turnText');
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const log = document.getElementById('log');

    function logMessage(message) {
      const p = document.createElement('p');
      p.textContent = message;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    }

    async function updateStatus() {
      const qs = playerId ? '?playerId=' + encodeURIComponent(playerId) : '';
      const resp = await fetch('/api/game/' + gameId + '/status' + qs);
      const data = await resp.json();
      const { state, order, turn, winner, players } = data;

      if (state === 'waiting') {
        statusEl.innerHTML = '<p class="small">Waiting for players to join...</p>';
      } else if (state === 'ready') {
        statusEl.innerHTML = '<p class="small">Both players joined. Waiting for secrets...</p>';
      } else if (state === 'playing') {
        statusEl.innerHTML = '<p class="small">Game in progress</p>';
      } else if (state === 'finished') {
        statusEl.innerHTML = '<p class="small">Game over: ' + winner + ' wins!</p>';
      }

      if (players && Object.keys(players).length > 0) {
        const joined = Object.values(players).map(p => p.name + (p.secretSet ? ' ✔' : ' ✱')).join(' • ');
        statusEl.innerHTML += '<p class="small">Players: ' + joined + '</p>';
      }

      if (!playerId) return;

      if (state === 'ready') {
        if (!data.me.secretSet) {
          secretForm.classList.remove('hidden');
          guessForm.classList.add('hidden');
        } else {
          secretForm.classList.add('hidden');
          guessForm.classList.add('hidden');
        }
      }
      if (state === 'playing') {
        secretForm.classList.add('hidden');
        guessForm.classList.remove('hidden');
        turnText.textContent = (turn === playerId) ? 'Your turn to guess.' : 'Opponent turn, please wait.';
        guessInput.disabled = turn !== playerId;
        guessBtn.disabled = turn !== playerId;
      }
      if (state === 'finished') {
        secretForm.classList.add('hidden');
        guessForm.classList.add('hidden');
      }
    }

    async function postJson(url, body) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.text()) || r.statusText);
      return r.json();
    }

    joinBtn.addEventListener('click', async () => {
      playerName = playerNameInput.value.trim();
      if (!playerName) {
        alert('Enter your name.');
        return;
      }
      try {
        const data = await postJson('/api/game/' + gameId + '/join', { name: playerName });
        playerId = data.playerId;
        nameForm.classList.add('hidden');
        secretForm.classList.remove('hidden');
        logMessage('Joined as ' + playerName + '. Share this link with your opponent.');
        setInterval(updateStatus, 1200);
        await updateStatus();
      } catch (err) {
        alert('Join failed: ' + err.message);
      }
    });

    setSecretBtn.addEventListener('click', async () => {
      const value = Number(secretInput.value);
      if (!Number.isInteger(value) || value < 1 || value > 1000) {
        alert('Secret must be 1-1000');
        return;
      }
      try {
        await postJson('/api/game/' + gameId + '/set-secret', { playerId, secret: value });
        secretForm.classList.add('hidden');
        logMessage('Secret number set. Waiting for opponent.');
        await updateStatus();
      } catch (err) {
        alert('Error setting secret: ' + err.message);
      }
    });

    guessBtn.addEventListener('click', async () => {
      const guess = Number(guessInput.value);
      if (!Number.isInteger(guess) || guess < 1 || guess > 1000) {
        alert('Guess must be 1-1000');
        return;
      }
      try {
        const data = await postJson('/api/game/' + gameId + '/guess', { playerId, guess });
        logMessage('You guessed ' + guess + ': ' + data.result);
        if (data.result === 'correct') {
          logMessage('🎉 You win!');
          guessForm.classList.add('hidden');
        }
        await updateStatus();
      } catch (err) {
        alert('Error guessing: ' + err.message);
      }
    });

    updateStatus();
  </script>
</body>
</html>`);
});

app.get('/api/game/:gameId/status', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.query;
  const game = getGame(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const players = Object.fromEntries(
    Object.entries(game.players).map(([pid, p]) => [pid, { name: p.name, secretSet: !!p.secret }])
  );
  const me = playerId && game.players[playerId] ? { ...game.players[playerId], secretSet: !!game.players[playerId].secret } : null;

  res.json({
    id: game.id,
    state: game.state,
    order: game.order,
    turn: game.turn,
    winner: game.winner,
    players,
    me,
  });
});

app.post('/api/game/:gameId/join', (req, res) => {
  const { gameId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const game = getGame(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.state === 'finished') return res.status(400).json({ error: 'Game already finished' });

  const existing = Object.values(game.players).find(p => p.name === name);
  if (existing) return res.status(400).json({ error: 'Name already taken' });
  if (Object.keys(game.players).length >= 2) {
    return res.status(400).json({ error: 'Game already has 2 players' });
  }

  const playerId = randomUUID();
  game.players[playerId] = { id: playerId, name, secret: null, secretSet: false };
  game.order.push(playerId);

  if (Object.keys(game.players).length === 2) {
    game.state = 'ready';
  }

  res.json({ playerId });
});

app.post('/api/game/:gameId/set-secret', (req, res) => {
  const { gameId } = req.params;
  const { playerId, secret } = req.body;

  const game = getGame(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const player = game.players[playerId];
  if (!player) return res.status(400).json({ error: 'Invalid player' });

  const n = Number(secret);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    return res.status(400).json({ error: 'Secret must be an integer from 1 to 1000' });
  }

  player.secret = n;
  player.secretSet = true;

  if (Object.values(game.players).length === 2 && Object.values(game.players).every(p => p.secretSet)) {
    game.state = 'playing';
    game.turn = game.order[0];
    game.history.push('Game started. Player ' + game.players[game.turn].name + ' begins.');
  }

  res.json({ status: 'secret set' });
});

app.post('/api/game/:gameId/guess', (req, res) => {
  const { gameId } = req.params;
  const { playerId, guess } = req.body;

  const game = getGame(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.state !== 'playing') {
    return res.status(400).json({ error: 'Game not ready or already finished' });
  }
  if (playerId !== game.turn) {
    return res.status(400).json({ error: 'Not your turn' });
  }

  const n = Number(guess);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    return res.status(400).json({ error: 'Guess must be an integer from 1 to 1000' });
  }

  const opponentId = game.order.find(id => id !== playerId);
  const opponent = game.players[opponentId];
  if (!opponent || opponent.secret == null) {
    return res.status(400).json({ error: 'Opponent secret not set' });
  }

  let result = 'wrong';
  if (n === opponent.secret) {
    game.state = 'finished';
    game.winner = game.players[playerId].name;
    result = 'correct';
    game.history.push(game.players[playerId].name + ' guessed ' + n + ' and won!');
  } else if (n < opponent.secret) {
    result = 'higher';
    game.history.push(game.players[playerId].name + ' guessed ' + n + ' -> higher');
  } else {
    result = 'lower';
    game.history.push(game.players[playerId].name + ' guessed ' + n + ' -> lower');
  }

  if (game.state === 'playing') {
    game.turn = opponentId;
  }

  res.json({ result, winner: game.winner, nextTurn: game.turn, history: game.history });
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Number guessing game running on http://localhost:${PORT}`);
});
