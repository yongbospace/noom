import http from "http";
import SocketIO from "socket.io";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = wsServer;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}

wsServer.on("connection", (socket) => {
  socket["nickname"] = "anonymous";
  socket.on("updateNickname", (nickname) => {
    socket.nickname = nickname;
    console.log("send nickname");
  });
  socket.on("join_room", (roomName) => {
    if (wsServer.sockets.adapter.rooms.get(roomName)?.size === 2) {
      socket.emit("dismiss");
    } else {
      socket.join(roomName);
      socket.to(roomName).emit("welcome", socket.nickname);
      socket.to(roomName).emit("peerNickname", socket.nickname);
    }
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer, socket.nickname);
    socket.to(roomName).emit("peerNickname", socket.nickname);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname)
    );
  });
  socket.on("disconnect", () => {
    wsServer.sockets.emit("room_change", publicRooms());
  });
});

const handleListen = () => console.log(`listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);

// socket.leave로 떠기 구현
