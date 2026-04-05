const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;

const wss = new WebSocket.Server({ port: PORT });

let clients = [];

wss.on("connection", (ws) => {
  console.log("🟢 Client connected");

  clients.push(ws);

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // 🔁 Broadcast to others
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
    clients = clients.filter((c) => c !== ws);
  });
});

console.log("🚀 WebSocket server running on ws://localhost:3001");