let socket;

export const initSocket = () => {
  if (typeof window === "undefined") return;

  socket = new WebSocket(
    "wss://mesh-connect-backend-production.up.railway.app"
  );

  socket.onopen = () => {
    console.log("🟢 Connected");
    window.onConnected?.();
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "chat") {
      window.receiveMessage?.(data);
    }

    if (data.type === "users-count") {
      window.updateUserCount?.(data.count);
    }

    if (data.type === "typing") {
      window.showTyping?.();
    }
  };

  socket.onerror = (err) => {
    console.log("❌ Socket error:", err);
  };

  socket.onclose = () => {
    console.log("🔴 Disconnected");
  };
};

export const sendMessage = (msg) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  socket.send(
    JSON.stringify({
      type: "chat",
      message: msg,
      id: Date.now() + Math.random(),
    })
  );
};

export const sendTyping = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify({ type: "typing" }));
};