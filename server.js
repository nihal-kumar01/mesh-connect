const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

let clients = [];
let latestOffer = null; // 🔥 STORE OFFER

wss.on("connection", (ws) => {
  console.log("🟢 Client connected");

  clients.push(ws);

  // 🔥 If offer exists → send to new user
  if (latestOffer) {
    console.log("📤 Sending stored offer to new client");
    ws.send(JSON.stringify(latestOffer));
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // 🔥 STORE OFFER
    if (data.type === "offer") {
      latestOffer = data;
      console.log("💾 Offer stored");
    }

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

console.log("🚀 WebSocket server running...");