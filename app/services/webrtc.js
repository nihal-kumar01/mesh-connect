let peerConnections = {};
let dataChannels = {};
let myId = null;
let socket;

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

    // 🆔 Assign ID
    if (data.type === "init") {
      myId = data.id;
      console.log("🆔 My ID:", myId);
    }

    // 👥 Existing peers → connect to all
    if (data.type === "peers") {
      console.log("👥 Peers:", data.peers);

      data.peers.forEach((peerId) => {
        if (peerId !== myId && !peerConnections[peerId]) {
          createPeer(peerId, true); // 🔥 AUTO CONNECT
        }
      });
    }

    // 🆕 New peer joined → connect instantly
    if (data.type === "new-peer") {
      console.log("🆕 New peer joined:", data.peerId);

      if (data.peerId === myId) return;

      if (!peerConnections[data.peerId]) {
        createPeer(data.peerId, true); // 🔥 AUTO CONNECT
      }
    }

    // 📥 Offer received
    if (data.type === "offer") {
      console.log("📥 Offer from:", data.from);

      const pcData = createPeer(data.from, false);
      const pc = pcData.pc;

      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: "offer",
          sdp: data.sdp,
        })
      );

      // Add pending ICE candidates
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

    // 📥 Answer received
    if (data.type === "answer") {
      console.log("📥 Answer from:", data.from);

      const pcData = peerConnections[data.from];
      if (pcData) {
        const pc = pcData.pc;

        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: "answer",
            sdp: data.sdp,
          })
        );

        // Add pending ICE candidates
        for (const candidate of pcData.pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pcData.pendingCandidates = [];
      }
    }

    // ❄️ ICE candidates
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
  };
};

// 🔗 Create peer connection
function createPeer(peerId, isInitiator) {
  if (peerId === myId) return;
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

  if (isInitiator) {
    const channel = pc.createDataChannel("chat");
    setupChannel(peerId, channel);

    (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("📤 Sending offer to", peerId);

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

// 💬 Setup data channel
function setupChannel(peerId, channel) {
  dataChannels[peerId] = channel;

  channel.onopen = () => {
    console.log("🟢 Connected:", peerId);
    window.onConnected?.();
  };

  channel.onmessage = (e) => {
    window.receiveMessage?.(e.data);
  };

  channel.onclose = () => {
    console.log("❌ Disconnected:", peerId);
    delete dataChannels[peerId];
    delete peerConnections[peerId];
  };
}

// 📤 Send message to all
export const sendMessage = (msg) => {
  Object.values(dataChannels).forEach((channel) => {
    if (channel.readyState === "open") {
      channel.send(msg);
    }
  });
};