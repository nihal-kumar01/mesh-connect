let peerConnection;
let dataChannel;
let socket;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// 🔌 Init WebSocket
export const initSocket = () => {
  socket = new WebSocket("wss://mesh-connect-production-3e10.up.railway.app");

  socket.onopen = () => {
    console.log("🟢 Connected to signaling server");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    // 📩 OFFER RECEIVED
    if (data.type === "offer") {
      await createConnection();

      await peerConnection.setRemoteDescription(data);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.send(JSON.stringify(peerConnection.localDescription));
    }

    // 📩 ANSWER RECEIVED
    if (data.type === "answer") {
      await peerConnection.setRemoteDescription(data);
    }

    // 📩 ICE CANDIDATE
    if (data.candidate) {
      try {
        await peerConnection.addIceCandidate(data);
      } catch (e) {
        console.error("ICE error:", e);
      }
    }
  };
};

// 🔗 Create connection
export const createConnection = async () => {
  peerConnection = new RTCPeerConnection(config);

  // create channel (only once)
  dataChannel = peerConnection.createDataChannel("chat");
  setupDataChannel();

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };

  // ICE
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify(event.candidate));
    }
  };
};

// 💬 Data channel
function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log("🟢 P2P Connected");
    window.onConnected?.();
  };

  dataChannel.onmessage = (event) => {
    window.receiveMessage?.(event.data);
  };
}

// 🚀 Start call
export const startCall = async () => {
  console.log("🚀 Start button clicked");

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log("⏳ Waiting for socket...");

    await new Promise((resolve) => {
      socket.onopen = () => {
        console.log("🟢 Socket ready");
        resolve();
      };
    });
  }

  console.log("🔗 Creating connection...");
  await createConnection();

  console.log("📡 Creating offer...");
  const offer = await peerConnection.createOffer();

  await peerConnection.setLocalDescription(offer);

  console.log("📤 Sending offer:", offer);

  socket.send(JSON.stringify(offer));
};

// 📤 Send message
export const sendMessage = (msg) => {
  if (dataChannel?.readyState === "open") {
    dataChannel.send(msg);
  } else {
    console.log("❌ Not connected yet");
  }
};