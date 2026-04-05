let peerConnections = {}; // 🔥 multiple peers
let dataChannels = {}; // 🔥 store channels per peer
let myId = null;
let socket;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// 🔌 Init WebSocket
export const initSocket = () => {
  socket = new WebSocket("wss://mesh-connect-production-c44a.up.railway.app");

  socket.onopen = () => {
    console.log("🟢 Connected to signaling server");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    // 🆔 My ID
    if (data.type === "init") {
      myId = data.id;
      console.log("🆔 My ID:", myId);
    }

    // 👥 Existing peers → initiate connections
    if (data.type === "peers") {
      console.log("👥 Peers:", data.peers);

      data.peers.forEach((peerId) => {
        createPeer(peerId, true);
      });
    }

    // 📥 Offer
    if (data.type === "offer") {
      console.log("📥 Offer from:", data.from);

      const pc = createPeer(data.from, false);

      await pc.setRemoteDescription(data);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.send(
        JSON.stringify({
          ...pc.localDescription,
          to: data.from,
        })
      );
    }

    // 📥 Answer
    if (data.type === "answer") {
      console.log("📥 Answer from:", data.from);

      const pc = peerConnections[data.from];
      if (pc) {
        await pc.setRemoteDescription(data);
      }
    }

    // 📥 ICE Candidate
    if (data.type === "candidate") {
      const pc = peerConnections[data.from];

      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (e) {
          console.error("❌ ICE error:", e);
        }
      }
    }
  };

  socket.onerror = (e) => {
    console.error("❌ WebSocket error:", e);
  };

  socket.onclose = () => {
    console.log("🔴 WebSocket closed");
  };
};

// 🔗 Create peer connection
function createPeer(peerId, isInitiator) {
  if (peerConnections[peerId]) return peerConnections[peerId];

  const pc = new RTCPeerConnection(config);
  peerConnections[peerId] = pc;

  // ICE handling
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        type: "candidate",
        candidate: event.candidate,
        to: peerId,
      }));
    }
  };

  // Data channel
  let channel;

  if (isInitiator) {
    channel = pc.createDataChannel("chat");
    setupChannel(peerId, channel);

    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);

      socket.send(
        JSON.stringify({
          ...offer,
          to: peerId,
        })
      );
    });
  } else {
    pc.ondatachannel = (event) => {
      channel = event.channel;
      setupChannel(peerId, channel);
    };
  }

  return pc;
}

// 💬 Setup data channel
function setupChannel(peerId, channel) {
  dataChannels[peerId] = channel;

  channel.onopen = () => {
    console.log("🟢 Connected to peer:", peerId);
    window.onConnected?.();
  };

  channel.onmessage = (event) => {
    window.receiveMessage?.(event.data);
  };
}

// 🚀 Start (no manual offer anymore)
export const startCall = async () => {
  console.log("🚀 Start clicked");

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log("⏳ Waiting for socket...");

    await new Promise((resolve) => {
      socket.onopen = () => resolve();
    });
  }

  console.log("✅ Ready for peers");
};

// 📤 Send message to ALL peers
export const sendMessage = (msg) => {
  Object.values(dataChannels).forEach((channel) => {
    if (channel.readyState === "open") {
      channel.send(msg);
    }
  });
};