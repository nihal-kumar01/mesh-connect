let peerConnections = {};
let dataChannels = {};
let myId = null;
let socket;

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export const initSocket = () => {
  if (typeof window === "undefined") return;

  socket = new WebSocket(
    "wss://mesh-connect-backend-production.up.railway.app"
  );

  // ✅ FIX: Proper connection trigger
  socket.onopen = () => {
    console.log("🟢 Connected to server");
    window.onConnected?.(); // 🔥 CRITICAL FIX
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    // 🆔 INIT
    if (data.type === "init") {
      myId = data.id;
    }

    // 👥 EXISTING PEERS
    if (data.type === "peers") {
      data.peers.forEach((peerId) => {
        if (peerId !== myId && !peerConnections[peerId]) {
          createPeer(peerId, true);
        }
      });
    }

    // 🆕 NEW PEER
    if (data.type === "new-peer") {
      if (data.peerId !== myId && !peerConnections[data.peerId]) {
        createPeer(data.peerId, true);
      }
    }

    // 📥 OFFER
    if (data.type === "offer") {
      const pcData = createPeer(data.from, false);
      const pc = pcData.pc;

      await pc.setRemoteDescription({
        type: "offer",
        sdp: data.sdp,
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.send(
        JSON.stringify({
          type: "answer",
          sdp: pc.localDescription.sdp,
          to: data.from,
        })
      );
    }

    // 📥 ANSWER
    if (data.type === "answer") {
      const pc = peerConnections[data.from]?.pc;
      if (pc) {
        await pc.setRemoteDescription({
          type: "answer",
          sdp: data.sdp,
        });
      }
    }

    // ❄️ ICE
    if (data.type === "candidate") {
      const pc = peerConnections[data.from]?.pc;
      if (pc && data.candidate) {
        await pc.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    }

    // 💬 SERVER MESSAGE (ONLY SOURCE OF TRUTH)
    if (data.type === "chat") {
      window.receiveMessage?.(data);
    }

    // 👥 USERS COUNT
    if (data.type === "users-count") {
      window.updateUserCount?.(data.count);
    }

    // ✍️ TYPING
    if (data.type === "typing") {
      window.showTyping?.();
    }
  };

  socket.onerror = (err) => {
    console.log("❌ WebSocket error:", err.message);
  };

  socket.onclose = () => {
    console.log("🔴 Disconnected from server");
  };
};

// 🔗 CREATE PEER
function createPeer(peerId, isInitiator) {
  if (peerConnections[peerId]) return peerConnections[peerId];

  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (e) => {
    if (e.candidate && socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "candidate",
          candidate: e.candidate,
          to: peerId,
        })
      );
    }
  };

  peerConnections[peerId] = { pc };

  if (isInitiator) {
    const channel = pc.createDataChannel("chat");

    // ❌ BLOCK P2P UI MESSAGES (PREVENT DUPLICATES)
    channel.onmessage = () => {};

    dataChannels[peerId] = channel;

    (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.send(
        JSON.stringify({
          type: "offer",
          sdp: pc.localDescription.sdp,
          to: peerId,
        })
      );
    })();
  } else {
    pc.ondatachannel = (e) => {
      const channel = e.channel;

      // ❌ BLOCK P2P UI MESSAGES
      channel.onmessage = () => {};

      dataChannels[peerId] = channel;
    };
  }

  return peerConnections[peerId];
}

// 📤 SEND MESSAGE (SERVER ONLY)
export const sendMessage = (msg) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const id = Date.now() + Math.random();

  socket.send(
    JSON.stringify({
      type: "chat",
      message: msg,
      id,
    })
  );
};

// ✍️ SEND TYPING
export const sendTyping = () => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "typing" }));
  }
};