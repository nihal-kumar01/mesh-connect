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

  // Send own ID
  ws.send(JSON.stringify({ type: "init", id }));

  // Send peers
  ws.send(
    JSON.stringify({
      type: "peers",
      peers: Object.keys(clients).filter((c) => c !== id),
    })
  );

  // 🔥 Notify others
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

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    console.log("📩 Incoming:", data.type, "from", id);

    // 🔥 RELAY TO TARGET
    if (data.to && clients[data.to]) {
      console.log("➡️ Sending to", data.to);

      clients[data.to].send(
        JSON.stringify({
          ...data,
          from: id,
        })
      );
    } else {
      console.log("⚠️ Target not found:", data.to);
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