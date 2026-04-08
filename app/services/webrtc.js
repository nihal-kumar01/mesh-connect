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

  socket = new WebSocket("wss://mesh-connect-backend-production.up.railway.app");

  socket.onopen = () => {
    console.log("🟢 Connected");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    // 🆔 Init
    if (data.type === "init") myId = data.id;

    // 👥 Existing peers
    if (data.type === "peers") {
      data.peers.forEach((peerId) => {
        if (peerId !== myId && !peerConnections[peerId]) {
          createPeer(peerId, true);
        }
      });
    }

    // 🆕 New peer
    if (data.type === "new-peer") {
      if (data.peerId !== myId && !peerConnections[data.peerId]) {
        createPeer(data.peerId, true);
      }
    }

    // 📥 Offer
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

    // 📥 Answer
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

    // 💬 SERVER MESSAGE ONLY (SOURCE OF TRUTH)
    if (data.type === "chat") {
      window.receiveMessage?.(data);
    }

    // 👥 Users count
    if (data.type === "users-count") {
      window.updateUserCount?.(data.count);
    }

    // ✍️ Typing
    if (data.type === "typing") {
      window.showTyping?.();
    }
  };
};

// 🔗 Create peer
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

    // ❌ DO NOT SHOW P2P MESSAGE
    channel.onmessage = () => {};

    // store (optional future use)
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

      // ❌ ignore UI messages
      channel.onmessage = () => {};

      dataChannels[peerId] = channel;
    };
  }

  return peerConnections[peerId];
}

// 📤 SEND MESSAGE (SERVER ONLY FOR UI)
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

  // OPTIONAL: still send via WebRTC (but ignored on receive)
  Object.values(dataChannels).forEach((ch) => {
    if (ch.readyState === "open") {
      ch.send(JSON.stringify({ message: msg, id }));
    }
  });
};

// ✍️ Typing
export const sendTyping = () => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "typing" }));
  }
};