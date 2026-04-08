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

    if (data.type === "init") myId = data.id;

    if (data.type === "peers") {
      data.peers.forEach((peerId) => {
        if (peerId !== myId && !peerConnections[peerId]) {
          createPeer(peerId, true);
        }
      });
    }

    if (data.type === "new-peer") {
      if (!peerConnections[data.peerId]) {
        createPeer(data.peerId, true);
      }
    }

    if (data.type === "offer") {
      const pcData = createPeer(data.from, false);
      const pc = pcData.pc;

      await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });

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

    if (data.type === "answer") {
      const pc = peerConnections[data.from]?.pc;
      if (pc) {
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      }
    }

    if (data.type === "candidate") {
      const pc = peerConnections[data.from]?.pc;
      if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    }

    // ✅ ONLY SHOW MESSAGE FROM SERVER
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
};

function createPeer(peerId, isInitiator) {
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
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

    // ❌ DO NOT SHOW MESSAGE FROM P2P
    channel.onmessage = () => {};

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
      e.channel.onmessage = () => {}; // ❌ ignore P2P UI
    };
  }

  return peerConnections[peerId];
}

// ✅ SEND VIA BOTH (BUT UI FROM SERVER ONLY)
export const sendMessage = (msg) => {
  const id = Date.now() + Math.random();

  socket.send(
    JSON.stringify({
      type: "chat",
      message: msg,
      id,
    })
  );

  Object.values(dataChannels).forEach((ch) => {
    if (ch.readyState === "open") {
      ch.send(JSON.stringify({ message: msg, id }));
    }
  });
};

export const sendTyping = () => {
  socket.send(JSON.stringify({ type: "typing" }));
};