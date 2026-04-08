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
    console.log("🟢 Connected to signaling server");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    // 🆔 Assign ID
    if (data.type === "init") {
      myId = data.id;
      console.log("🆔 My ID:", myId);
    }

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
      if (data.peerId === myId) return;

      if (!peerConnections[data.peerId]) {
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

      for (const candidate of pcData.pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pcData.pendingCandidates = [];

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
      const pcData = peerConnections[data.from];
      if (!pcData) return;

      const pc = pcData.pc;

      await pc.setRemoteDescription({
        type: "answer",
        sdp: data.sdp,
      });

      for (const candidate of pcData.pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pcData.pendingCandidates = [];
    }

    // ❄️ ICE
    if (data.type === "candidate") {
      const pcData = peerConnections[data.from];

      if (pcData && data.candidate) {
        const pc = pcData.pc;

        if (!pc.remoteDescription) {
          pcData.pendingCandidates.push(data.candidate);
        } else {
          await pc.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        }
      }
    }

    // 🟢 ✅ NEW: BROADCAST CHAT SUPPORT
    if (data.type === "chat") {
      if (typeof window !== "undefined") {
        window.receiveMessage?.(`${data.from}: ${data.message}`);
      }
    }
  };
};

// 🔗 Create peer
function createPeer(peerId, isInitiator) {
  if (peerId === myId) return;
  if (peerConnections[peerId]) return peerConnections[peerId];

  const pc = new RTCPeerConnection(config);

  pc.onconnectionstatechange = () => {
    console.log(`🔗 [${peerId}]`, pc.connectionState);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate && socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "candidate",
          candidate: event.candidate,
          to: peerId,
        })
      );
    }
  };

  peerConnections[peerId] = { pc, pendingCandidates: [] };

  const shouldInitiate = isInitiator && myId < peerId;

  if (shouldInitiate) {
    const channel = pc.createDataChannel("chat");
    setupChannel(peerId, channel);

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
    pc.ondatachannel = (event) => {
      setupChannel(peerId, event.channel);
    };
  }

  return peerConnections[peerId];
}

// 💬 Channel
function setupChannel(peerId, channel) {
  dataChannels[peerId] = channel;

  channel.onopen = () => {
    console.log("🟢 Connected:", peerId);

    if (typeof window !== "undefined") {
      window.onConnected?.();
    }
  };

  channel.onmessage = (e) => {
    if (typeof window !== "undefined") {
      window.receiveMessage?.(`P2P: ${e.data}`);
    }
  };

  channel.onclose = () => {
    console.log("❌ Disconnected:", peerId);
    delete dataChannels[peerId];
    delete peerConnections[peerId];
  };
}

// 📤 Send message (UPDATED)
export const sendMessage = (msg) => {
  // 🟢 Broadcast via server (ALL users)
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "chat",
        message: msg,
      })
    );
  }

  // ⚡ Optional: send via WebRTC
  Object.values(dataChannels).forEach((channel) => {
    if (channel.readyState === "open") {
      channel.send(msg);
    }
  });
};