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
  games.set(id, {
    id,
    players: {},
    order: [],
    state: 'waiting',
    turn: null,
    history: [],
    winner: null
  });
  return games.get(id);
}

app.get('/', (req, res) => {
  res.send(`
  <html>
  <body style="font-family:sans-serif;text-align:center;background:#111;color:#fff;padding:50px">
    <h1>🎯 Guess Game</h1>
    <button onclick="start()">Start</button>

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

app.get('/new', (req,res)=>{
  const g = createGame();
  res.json({id:g.id});
});

app.get('/game/:id',(req,res)=>{
  const id = req.params.id;

  res.send(`
  <html>
  <head>
    <script src="/socket.io/socket.io.js"></script>

    <style>
      body {
        font-family: Inter;
        background: linear-gradient(135deg,#1e3a8a,#2563eb);
      }

      .card {
        max-width:700px;
        margin:30px auto;
        background:white;
        padding:20px;
        border-radius:15px;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
      }

      button {
        padding:10px;
        margin:5px;
        border:none;
        border-radius:8px;
        background:#2563eb;
        color:white;
        cursor:pointer;
      }

      input {
        padding:10px;
        width:100%;
        margin-top:5px;
      }

      #log {
        height:200px;
        overflow:auto;
        background:#f1f5f9;
        padding:10px;
        border-radius:10px;
      }

      .msg {
        animation: fade 0.3s ease;
      }

      @keyframes fade {
        from {opacity:0; transform:translateY(10px);}
        to {opacity:1; transform:translateY(0);}
      }

    </style>
  </head>

  <body>
    <div class="card">
      <h2>🎮 Game Room</h2>

      <div id="join">
        <input id="name" placeholder="Name">
        <button onclick="join()">Join</button>
      </div>

      <div id="secretBox" style="display:none">
        <input id="secret" type="number" placeholder="Secret">
        <button onclick="setSecret()">Set</button>
      </div>

      <div id="gameBox" style="display:none">
        <p id="turn"></p>
        <input id="guess" type="number">
        <button onclick="guess()">Guess</button>

        <div>
          <button onclick="react('😂')">😂</button>
          <button onclick="react('😭')">😭</button>
          <button onclick="react('😡')">😡</button>
          <button onclick="react('😉')">😉</button>
        </div>
      </div>

      <button id="rematch" style="display:none" onclick="rematch()">Rematch</button>

      <div id="status"></div>
      <div id="log"></div>
    </div>

    <audio id="click" src="https://www.soundjay.com/buttons/button-16.mp3"></audio>
    <audio id="win" src="https://www.soundjay.com/human/applause-8.mp3"></audio>

    <script>
      const socket = io();
      const gameId = "${id}";

      let playerId = localStorage.getItem('pid_'+gameId);
      let name = localStorage.getItem('name_'+gameId);

      function play(id){
        document.getElementById(id).play();
      }

      function log(msg){
        const div = document.createElement('div');
        div.className='msg';
        div.innerText=msg;
        document.getElementById('log').appendChild(div);
      }

      function join(){
        name = document.getElementById('name').value;

        socket.emit('join',{gameId,name});

        socket.on('joined',(data)=>{
          playerId = data.id;

          localStorage.setItem('pid_'+gameId,playerId);
          localStorage.setItem('name_'+gameId,name);

          document.getElementById('join').style.display='none';
        });
      }

      function setSecret(){
        const secret = Number(document.getElementById('secret').value);
        socket.emit('secret',{gameId,playerId,secret});
      }

      function guess(){
        play('click');
        const g = Number(document.getElementById('guess').value);
        socket.emit('guess',{gameId,playerId,guess:g});
      }

      function react(e){
        socket.emit('react',{gameId,playerId,emoji:e});
      }

      function rematch(){
        socket.emit('rematch',{gameId});
      }

      socket.on('update',(g)=>{

        document.getElementById('log').innerHTML='';
        g.history.forEach(log);

        if(g.state==='ready'){
          document.getElementById('secretBox').style.display='block';
        }

        if(g.state==='playing'){
          document.getElementById('gameBox').style.display='block';
          document.getElementById('turn').innerText =
            g.turn===playerId ? 'Your turn' : 'Wait...';
        }

        if(g.state==='finished'){
          document.getElementById('rematch').style.display='block';
          play('win');

          const secrets = Object.values(g.players)
            .map(p=>p.name+': '+p.secret).join(' | ');

          document.getElementById('status').innerText =
            'Winner: '+g.winner + ' | ' + secrets;
        }
      });

      if(playerId){
        socket.emit('rejoin',{gameId,playerId});
        document.getElementById('join').style.display='none';
      }

    </script>
  </body>
  </html>
  `);
});

/* ================= SOCKET ================= */

io.on('connection',(socket)=>{

  socket.on('join',({gameId,name})=>{
    const g = games.get(gameId);

    const id = randomUUID();
    g.players[id] = {id,name,secret:null};
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
    g.players[playerId].secret = secret;

    if(Object.values(g.players).every(p=>p.secret)){
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
    const g = games.get(gameId);
    const p = g.players[playerId];

    g.history.push(p.name+' reacted '+emoji);
    io.to(gameId).emit('update',g);
  });

  socket.on('rematch',({gameId})=>{
    const g = games.get(gameId);

    Object.values(g.players).forEach(p=>p.secret=null);

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
