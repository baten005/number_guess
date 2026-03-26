const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = 3000;

const games = new Map();

function createGame() {
  const id = randomUUID();
  const game = {
    id,
    players: {},
    order: [],
    state: 'waiting',
    turn: null,
    history: [],
    winner: null
  };
  games.set(id, game);
  return game;
}

/* HOME */
app.get('/', (req, res) => {
  res.send(`
  <html>
  <body style="font-family:sans-serif;text-align:center;background:#111;color:#fff;padding:50px">
    <h1>🎯 Guess Game</h1>
    <button onclick="start()" style="padding:15px 25px;font-size:20px">Start Game</button>

    <script>
      async function start(){
        const r = await fetch('/new');
        const d = await r.json();
        location.href = '/game/'+d.id;
      }
    </script>
  </body>
  </html>
  `);
});

/* CREATE GAME */
app.get('/new', (req,res)=>{
  const g = createGame();
  res.json({id:g.id});
});

/* GAME PAGE */
app.get('/game/:id',(req,res)=>{
  const id = req.params.id;

  res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="/socket.io/socket.io.js"></script>

<style>
body {
  margin:0;
  font-family: Inter, sans-serif;
  background: linear-gradient(135deg,#1e3a8a,#2563eb);
  color:white;
}

#statusBar {
  text-align:center;
  padding:14px;
  font-size:18px;
  background:rgba(0,0,0,0.2);
}

.container {
  padding:12px;
}

.players {
  display:flex;
  gap:10px;
}

.player {
  flex:1;
  background:rgba(255,255,255,0.1);
  padding:15px;
  border-radius:15px;
  text-align:center;
  position:relative;
}

.name {
  font-size:18px;
  font-weight:bold;
}

.emojiFloat {
  position:absolute;
  top:-10px;
  left:50%;
  transform:translateX(-50%);
  font-size:40px;
  animation: floatUp 1s ease forwards;
}

@keyframes floatUp {
  0% {opacity:0; transform:translate(-50%,20px);}
  50% {opacity:1;}
  100% {opacity:0; transform:translate(-50%,-40px);}
}

.vs {
  text-align:center;
  font-size:22px;
  margin:10px 0;
}

.box {
  background:white;
  color:black;
  margin-top:15px;
  padding:15px;
  border-radius:15px;
}

input {
  width:100%;
  padding:15px;
  font-size:18px;
  border-radius:10px;
  border:1px solid #ccc;
}

button {
  width:100%;
  padding:15px;
  font-size:18px;
  border:none;
  border-radius:10px;
  margin-top:10px;
  background:#2563eb;
  color:white;
}

.emojiBar {
  display:flex;
  justify-content:space-around;
  margin-top:10px;
}

.emojiBar button {
  font-size:28px;
  background:none;
}

.logs {
  display:flex;
  gap:10px;
  margin-top:10px;
}

.logBox {
  flex:1;
  background:rgba(255,255,255,0.1);
  padding:10px;
  border-radius:10px;
  height:120px;
  overflow:auto;
  font-size:14px;
}
</style>
</head>

<body>

<div id="statusBar">Connecting...</div>

<div class="container">

<div class="players">
  <div class="player" id="p1">
    <div class="name" id="p1name">Player 1</div>
  </div>

  <div class="player" id="p2">
    <div class="name" id="p2name">Player 2</div>
  </div>
</div>

<div class="vs">⚔️ VS ⚔️</div>

<div class="box" id="joinBox">
  <input id="name" placeholder="Enter your name">
  <button onclick="join()">Join Game</button>
</div>

<div class="box" id="secretBox" style="display:none">
  <input id="secret" type="number" placeholder="Set secret number">
  <button onclick="setSecret()">Set Secret</button>
</div>

<div class="box" id="gameBox" style="display:none">
  <input id="guess" type="number" placeholder="Enter guess">
  <button onclick="guess()">Guess</button>

  <div class="emojiBar">
    <button onclick="react('😂')">😂</button>
    <button onclick="react('😭')">😭</button>
    <button onclick="react('😡')">😡</button>
    <button onclick="react('😉')">😉</button>
    <button onclick="react('😘')">😘</button>
  </div>
</div>

<div class="logs">
  <div class="logBox" id="log1"></div>
  <div class="logBox" id="log2"></div>
</div>

<button id="rematch" style="display:none" onclick="rematch()">🔁 Rematch</button>

</div>

<audio id="emojiSound" src="https://www.soundjay.com/button/beep-07.mp3"></audio>

<script>
const socket = io();
const gameId = location.pathname.split('/').pop();

let playerId = localStorage.getItem('pid_'+gameId);

/* EMOJI FLOAT */
function showEmoji(target, emoji){
  const el = document.createElement('div');
  el.className = 'emojiFloat';
  el.innerText = emoji;
  document.getElementById(target).appendChild(el);

  setTimeout(()=>{
    document.getElementById('emojiSound').play();
    el.remove();
  },1000);
}

/* JOIN */
function join(){
  const name = document.getElementById('name').value;
  socket.emit('join',{gameId,name});
}

/* SECRET */
function setSecret(){
  const input = document.getElementById('secret');
  const s = Number(input.value);

  socket.emit('secret',{gameId,playerId,secret:s});
  input.value = '';
}

/* GUESS */
function guess(){
  const input = document.getElementById('guess');
  const g = Number(input.value);

  socket.emit('guess',{gameId,playerId,guess:g});
  input.value = '';
}

/* REACT */
function react(e){
  socket.emit('react',{gameId,playerId,emoji:e});
}

/* REMATCH */
function rematch(){
  socket.emit('rematch',{gameId});
}

/* JOIN RESPONSE */
socket.on('joined',(d)=>{
  playerId = d.id;
  localStorage.setItem('pid_'+gameId,playerId);
  document.getElementById('joinBox').style.display='none';
});

/* UPDATE */
socket.on('update',(g)=>{
  window.lastGame = g;

  const ids = Object.keys(g.players);
  const p1 = g.players[ids[0]];
  const p2 = g.players[ids[1]];

  if(p1) document.getElementById('p1name').innerText = p1.name;
  if(p2) document.getElementById('p2name').innerText = p2.name;

  const me = g.players[playerId];

  /* STATE HANDLING */
  if(g.state==='waiting'){
    statusBar.innerText = 'Waiting for opponent...';
  }
  else if(g.state==='ready'){
    if(me && me.secretSet){
      statusBar.innerText = 'Waiting for opponent...';
      document.getElementById('secretBox').style.display='none';
    } else {
      statusBar.innerText = 'Set your secret number';
      document.getElementById('secretBox').style.display='block';
    }
  }
  else if(g.state==='playing'){
    statusBar.innerText =
      g.turn===playerId ? 'Your turn 🔥' : 'Opponent thinking...';
    document.getElementById('gameBox').style.display='block';
    document.getElementById('secretBox').style.display='none';
  }
  else if(g.state==='finished'){
    statusBar.innerText = 'Winner: '+g.winner;
    document.getElementById('rematch').style.display='block';
  } else {
    document.getElementById('rematch').style.display='none';
  }

  /* LOGS */
  const log1 = document.getElementById('log1');
  const log2 = document.getElementById('log2');
  log1.innerHTML='';
  log2.innerHTML='';

  g.history.forEach(h=>{
    const div = document.createElement('div');
    div.innerText = h;

    if(h.includes(p1?.name)) log1.appendChild(div);
    else log2.appendChild(div);
  });
});

/* EMOJI EVENT */
socket.on('emoji',({playerId:pid,emoji})=>{
  const ids = Object.keys(window.lastGame.players);
  const index = ids.indexOf(pid);

  if(index===0) showEmoji('p1',emoji);
  else showEmoji('p2',emoji);
});

/* REJOIN */
if(playerId){
  socket.emit('rejoin',{gameId,playerId});
  document.getElementById('joinBox').style.display='none';
}
</script>

</body>
</html>
`);
});

/* SOCKET */

io.on('connection',(socket)=>{

  socket.on('join',({gameId,name})=>{
    const g = games.get(gameId);

    const id = randomUUID();
    g.players[id] = {id,name,secret:null,secretSet:false};
    g.order.push(id);

    socket.join(gameId);
    socket.emit('joined',{id});

    if(Object.keys(g.players).length===2){
      g.state='ready';
    }

    io.to(gameId).emit('update',g);
  });

  socket.on('rejoin',({gameId})=>{
    socket.join(gameId);
    io.to(gameId).emit('update',games.get(gameId));
  });

  socket.on('secret',({gameId,playerId,secret})=>{
    const g = games.get(gameId);
    const p = g.players[playerId];

    p.secret = secret;
    p.secretSet = true;

    if(Object.values(g.players).every(p=>p.secretSet)){
      g.state='playing';
      g.turn=g.order[0];
    }

    io.to(gameId).emit('update',g);
  });

  socket.on('guess',({gameId,playerId,guess})=>{
    const g = games.get(gameId);

    if(g.turn!==playerId) return;

    const oppId = g.order.find(x=>x!==playerId);
    const opp = g.players[oppId];

    let msg;

    if(guess===opp.secret){
      g.state='finished';
      g.winner=g.players[playerId].name;
      msg='🎉 '+g.winner+' guessed '+guess+'!';
    } else if(guess<opp.secret){
      msg=g.players[playerId].name+' guessed '+guess+' → higher';
    } else {
      msg=g.players[playerId].name+' guessed '+guess+' → lower';
    }

    g.history.push(msg);

    if(g.state==='playing') g.turn=oppId;

    io.to(gameId).emit('update',g);
  });

  socket.on('react',({gameId,playerId,emoji})=>{
    io.to(gameId).emit('emoji', { playerId, emoji });
  });

  socket.on('rematch',({gameId})=>{
    const g = games.get(gameId);

    Object.values(g.players).forEach(p=>{
      p.secret=null;
      p.secretSet=false;
    });

    g.state='ready';
    g.turn=null;
    g.winner=null;
    g.history=[];

    io.to(gameId).emit('update',g);
  });

});

server.listen(PORT,()=>{
  console.log('🔥 Running on http://localhost:'+PORT);
});
