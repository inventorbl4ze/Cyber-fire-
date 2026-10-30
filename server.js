
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const rooms = new Map();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", socket => {
  socket.on("joinGame", ({ name, roomCode }) => {
    if (!name || !roomCode) return;

    const code = String(roomCode).trim().toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(code)) return;

    if (!rooms.has(code)) rooms.set(code, new Map());

    const room = rooms.get(code);

    if (room.size >= 20) {
      socket.emit("gameError", "Room is full");
      return;
    }

    const player = {
      id: socket.id,
      name: String(name).slice(0, 16),
      x: Math.random() * 500 + 100,
      y: Math.random() * 300 + 100,
      hp: 100,
      alive: true
    };

    socket.join(code);
    socket.data.roomCode = code;
    room.set(socket.id, player);

    socket.emit("joined", {
      id: socket.id,
      players: Array.from(room.values())
    });

    io.to(code).emit("playerJoined", player);
  });

  socket.on("move", data => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.get(socket.id);

    if (!player || !player.alive) return;

    const x = Number(data?.x);
    const y = Number(data?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    player.x = Math.max(0, Math.min(2000, x));
    player.y = Math.max(0, Math.min(1200, y));

    socket.to(socket.data.roomCode).emit("playerMoved", {
      id: socket.id,
      x: player.x,
      y: player.y
    });
  });

  socket.on("shoot", data => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.get(socket.id);

    if (!player || !player.alive) return;

    const target = room.get(String(data?.target || ""));

    if (!target || !target.alive || target.id === player.id) return;

    target.hp = Math.max(0, target.hp - 20);

    if (target.hp === 0) {
      target.alive = false;
      player.kills = (player.kills || 0) + 1;
    }

    io.to(socket.data.roomCode).emit("playerHit", {
      attacker: player.id,
      target: target.id,
      hp: target.hp,
      alive: target.alive,
      kills: player.kills || 0
    });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    if (!room) return;

    room.delete(socket.id);
    io.to(code).emit("playerLeft", socket.id);

    if (room.size === 0) rooms.delete(code);
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "online", game: "CYBER FIRE" });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("CYBER FIRE server running on port " + PORT);
});

