const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

let clients = {}; // 🔥 id → ws

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

wss.on("connection", (ws) => {
  const id = generateId();
  clients[id] = ws;

  console.log("🟢 New client:", id);

  // 🔥 Send own ID
  ws.send(JSON.stringify({ type: "init", id }));

  // 🔥 Send list of existing users
  ws.send(
    JSON.stringify({
      type: "peers",
      peers: Object.keys(clients).filter((c) => c !== id),
    })
  );

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // 🔥 Send to specific peer
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

console.log("🚀 WebSocket server running...");