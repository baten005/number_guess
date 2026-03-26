const express = require('express');
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
    state: 'waiting',
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

/* ================= HOME ================= */
app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Guess Game</title>
    <style>
      body {
        font-family: Inter;
        background: linear-gradient(135deg,#1e3a8a,#2563eb);
        color:white;
        text-align:center;
        padding:50px;
      }
      button {
        padding:12px 20px;
        font-size:18px;
        border:none;
        border-radius:10px;
        background:#22c55e;
        color:white;
        cursor:pointer;
      }
    </style>
  </head>
  <body>
    <h1>🎯 Number Guess Game</h1>
    <button onclick="start()">Start Game</button>

    <script>
      async function start(){
        const r = await fetch('/new');
        const d = await r.json();
        location.href = '/game/' + d.gameId;
      }
    </script>
  </body>
  </html>
  `);
});

/* ================= GAME PAGE ================= */
app.get('/game/:gameId', (req, res) => {
  const { gameId } = req.params;

  res.send(`
  <html>
  <head>
    <title>Game</title>
    <style>
      body {
        font-family: Inter;
        background: linear-gradient(135deg,#1e3a8a,#2563eb);
        color:#111;
      }

      .card {
        max-width:700px;
        margin:30px auto;
        background:white;
        padding:20px;
        border-radius:15px;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
      }

      input {
        padding:10px;
        width:100%;
        border-radius:8px;
        border:1px solid #ccc;
        margin-top:5px;
      }

      button {
        padding:10px;
        margin-top:10px;
        border:none;
        border-radius:8px;
        background:#2563eb;
        color:white;
        cursor:pointer;
      }

      #log {
        background:#f1f5f9;
        padding:10px;
        margin-top:15px;
        height:200px;
        overflow:auto;
        border-radius:10px;
      }

      .emoji button {
        margin:5px;
        font-size:20px;
      }
    </style>
  </head>

  <body>
    <div class="card">
      <h2>🎮 Game Room</h2>

      <div id="join">
        <input id="name" placeholder="Your name"/>
        <button onclick="join()">Join</button>
      </div>

      <div id="secretBox" style="display:none">
        <input id="secret" type="number" placeholder="Secret (1-1000)">
        <button onclick="setSecret()">Set Secret</button>
      </div>

      <div id="gameBox" style="display:none">
        <p id="turn"></p>
        <input id="guess" type="number" placeholder="Guess">
        <button onclick="guess()">Guess</button>

        <div class="emoji">
          <button onclick="react('😂')">😂</button>
          <button onclick="react('😭')">😭</button>
          <button onclick="react('😡')">😡</button>
          <button onclick="react('😉')">😉</button>
        </div>
      </div>

      <button id="rematchBtn" style="display:none" onclick="rematch()">🔁 Rematch</button>

      <div id="status"></div>
      <div id="log"></div>
    </div>

    <script>
      const gameId = "${gameId}";
      let playerId = localStorage.getItem('pid_'+gameId);
      let playerName = localStorage.getItem('pname_'+gameId);

      async function update(){
        const r = await fetch('/api/game/'+gameId+'/status?playerId='+playerId);
        const d = await r.json();

        document.getElementById('log').innerHTML = d.history.map(h=>'<p>'+h+'</p>').join('');

        if(d.state==='finished'){
          document.getElementById('rematchBtn').style.display='block';
          const secrets = Object.values(d.players).map(p=>p.name+': '+p.secret).join(' | ');
          document.getElementById('status').innerHTML='Winner: '+d.winner+'<br>Secrets: '+secrets;
        }

        if(d.state==='playing'){
          document.getElementById('gameBox').style.display='block';
          document.getElementById('turn').innerText = (d.turn===playerId) ? 'Your turn' : 'Wait...';
        }

        if(d.state==='ready'){
          document.getElementById('secretBox').style.display='block';
        }
      }

      async function join(){
        const name = document.getElementById('name').value;
        const r = await fetch('/api/game/'+gameId+'/join',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({name})
        });
        const d = await r.json();

        playerId = d.playerId;
        playerName = name;

        localStorage.setItem('pid_'+gameId,playerId);
        localStorage.setItem('pname_'+gameId,name);

        document.getElementById('join').style.display='none';
        setInterval(update,1000);
      }

      async function setSecret(){
        const secret = Number(document.getElementById('secret').value);
        await fetch('/api/game/'+gameId+'/set-secret',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({playerId,secret})
        });
      }

      async function guess(){
        const g = Number(document.getElementById('guess').value);
        await fetch('/api/game/'+gameId+'/guess',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({playerId,guess:g})
        });
      }

      async function react(emoji){
        await fetch('/api/game/'+gameId+'/react',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({playerId,emoji})
        });
      }

      async function rematch(){
        await fetch('/api/game/'+gameId+'/rematch',{method:'POST'});
      }

      if(playerId){
        document.getElementById('join').style.display='none';
        setInterval(update,1000);
      }
    </script>
  </body>
  </html>
  `);
});

/* ================= API ================= */

app.get('/new', (req,res)=>{
  const g = createNewGame();
  res.json({gameId:g.id});
});

app.get('/api/game/:id/status',(req,res)=>{
  const g = getGame(req.params.id);

  const players = Object.fromEntries(
    Object.entries(g.players).map(([id,p])=>[
      id,
      {name:p.name, secret:g.state==='finished'?p.secret:null}
    ])
  );

  res.json({
    state:g.state,
    turn:g.turn,
    winner:g.winner,
    history:g.history,
    players
  });
});

app.post('/api/game/:id/join',(req,res)=>{
  const g = getGame(req.params.id);

  const id = randomUUID();
  g.players[id] = {id,name:req.body.name,secret:null};
  g.order.push(id);

  if(Object.keys(g.players).length===2) g.state='ready';

  res.json({playerId:id});
});

app.post('/api/game/:id/set-secret',(req,res)=>{
  const g = getGame(req.params.id);
  const p = g.players[req.body.playerId];

  p.secret = req.body.secret;

  if(Object.values(g.players).every(p=>p.secret)){
    g.state='playing';
    g.turn=g.order[0];
  }

  res.json({});
});

app.post('/api/game/:id/guess',(req,res)=>{
  const g = getGame(req.params.id);
  const pid = req.body.playerId;

  if(g.turn!==pid) return res.json({});

  const oppId = g.order.find(x=>x!==pid);
  const opp = g.players[oppId];

  const guess = req.body.guess;
  let msg = '';

  if(guess===opp.secret){
    g.state='finished';
    g.winner=g.players[pid].name;
    msg = '🎉 '+g.players[pid].name+' guessed '+guess+' correctly!';
  } else if(guess<opp.secret){
    msg = g.players[pid].name+' guessed '+guess+' → higher';
  } else {
    msg = g.players[pid].name+' guessed '+guess+' → lower';
  }

  g.history.push(msg);

  if(g.state==='playing') g.turn=oppId;

  res.json({});
});

app.post('/api/game/:id/react',(req,res)=>{
  const g = getGame(req.params.id);
  const p = g.players[req.body.playerId];

  g.history.push(p.name + ' reacted ' + req.body.emoji);
  res.json({});
});

app.post('/api/game/:id/rematch',(req,res)=>{
  const g = getGame(req.params.id);

  Object.values(g.players).forEach(p=>{
    p.secret=null;
  });

  g.state='ready';
  g.history=[];
  g.turn=null;
  g.winner=null;

  res.json({});
});

app.listen(PORT,()=>{
  console.log('Running on http://localhost:'+PORT);
});
