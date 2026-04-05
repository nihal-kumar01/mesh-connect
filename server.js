const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3001;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clients = {};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

wss.on("connection", (ws) => {
  const id = generateId();
  clients[id] = ws;

  console.log("🟢 New client:", id);

  // 🔥 Notify existing users
  Object.keys(clients).forEach((clientId) => {
    if (clientId !== id) {
      clients[clientId].send(
        JSON.stringify({
          type: "new-peer",
          peerId: id,
        })
      );
    }
  });

  ws.send(JSON.stringify({ type: "init", id }));

  ws.send(
    JSON.stringify({
      type: "peers",
      peers: Object.keys(clients).filter((c) => c !== id),
    })
  );

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    console.log("📩 Message:", data.type, "from", id);

    if (data.to && clients[data.to]) {
      clients[data.to].send(
        JSON.stringify({
          ...data,
          from: id,
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("🔴 Disconnected:", id);
    delete clients[id];
  });
});

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});