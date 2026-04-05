let peerConnections = {};
let dataChannels = {};
let myId = null;
let socket;
let allPeers = []; // 🔥 IMPORTANT

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export const initSocket = () => {
  socket = new WebSocket("wss://mesh-connect-production-47f2.up.railway.app");

  socket.onopen = () => {
    console.log("🟢 Connected to signaling server");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "new-peer") {
      console.log("🆕 New peer joined:", data.peerId);
      allPeers.push(data.peerId); // 🔥 store
    }

    if (data.type === "init") {
      myId = data.id;
      console.log("🆔 My ID:", myId);
    }

    if (data.type === "peers") {
      console.log("👥 Peers:", data.peers);
      allPeers = data.peers; // 🔥 store peers
    }

    if (data.type === "offer") {
      console.log("📥 Offer from:", data.from);

      const pcData = createPeer(data.from, false);
      const pc = pcData.pc;

      await pc.setRemoteDescription(new RTCSessionDescription(data));

      for (const candidate of pcData.pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pcData.pendingCandidates = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.send(JSON.stringify({ ...pc.localDescription, to: data.from }));
    }

    if (data.type === "answer") {
      const pcData = peerConnections[data.from];
      if (pcData) {
        const pc = pcData.pc;

        await pc.setRemoteDescription(new RTCSessionDescription(data));

        for (const candidate of pcData.pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pcData.pendingCandidates = [];
      }
    }

    if (data.type === "candidate") {
      const pcData = peerConnections[data.from];

      if (pcData && data.candidate) {
        const pc = pcData.pc;

        if (!pc.remoteDescription) {
          pcData.pendingCandidates.push(data.candidate);
        } else {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    }
  };
};

// 🔗 Create peer
function createPeer(peerId, isInitiator) {
  if (peerConnections[peerId]) return peerConnections[peerId];

  const pc = new RTCPeerConnection(config);

  pc.onconnectionstatechange = () => {
    console.log(`🔗 [${peerId}]`, pc.connectionState);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate && socket.readyState === WebSocket.OPEN) {
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

  let channel;

  if (isInitiator) {
    channel = pc.createDataChannel("chat");
    setupChannel(peerId, channel);

    (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.send(JSON.stringify({ ...pc.localDescription, to: peerId }));
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
    window.onConnected?.();
  };

  channel.onmessage = (e) => {
    window.receiveMessage?.(e.data);
  };
}

// 🚀 START BUTTON FIX (🔥 MAIN FIX)
export const startCall = async () => {
  console.log("🚀 Start clicked");

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    await new Promise((resolve) => {
      socket.onopen = resolve;
    });
  }

  console.log("🔥 Connecting to peers:", allPeers);

  allPeers.forEach((peerId) => {
    createPeer(peerId, true); // 🔥 FORCE connection
  });
};

// 📤 Send
export const sendMessage = (msg) => {
  Object.values(dataChannels).forEach((channel) => {
    if (channel.readyState === "open") {
      channel.send(msg);
    }
  });
};