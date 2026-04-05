let peerConnections = {};
let dataChannels = {};
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

    // 🆕 New peer joined
    if (data.type === "new-peer") {
      console.log("🆕 New peer joined:", data.peerId);
      createPeer(data.peerId, true);
    }

    // 🆔 My ID
    if (data.type === "init") {
      myId = data.id;
      console.log("🆔 My ID:", myId);
    }

    // 👥 Existing peers
    if (data.type === "peers") {
      console.log("👥 Peers:", data.peers);
      data.peers.forEach((peerId) => {
        createPeer(peerId, true);
      });
    }

    // 📥 Offer
    if (data.type === "offer") {
      console.log("📥 Offer from:", data.from);

      const pcData = createPeer(data.from, false);
      const pc = pcData.pc;

      await pc.setRemoteDescription(new RTCSessionDescription(data));

      // Apply queued ICE
      for (const candidate of pcData.pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pcData.pendingCandidates = [];

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

    // 📥 ICE Candidate
    if (data.type === "candidate") {
      const pcData = peerConnections[data.from];

      if (pcData && data.candidate) {
        const pc = pcData.pc;

        try {
          if (!pc.remoteDescription) {
            pcData.pendingCandidates.push(data.candidate);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
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

  pc.onconnectionstatechange = () => {
    console.log(`🔗 [${peerId}]`, pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 [${peerId}]`, pc.iceConnectionState);
  };

  peerConnections[peerId] = {
    pc,
    pendingCandidates: [],
  };

  // ICE handling
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

  let channel;

  if (isInitiator) {
    channel = pc.createDataChannel("chat");
    setupChannel(peerId, channel);

    // 🔥 CRITICAL FIX: WAIT FOR SOCKET BEFORE OFFER
    const sendOffer = async () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log("⏳ Waiting for socket before sending offer...");
        setTimeout(sendOffer, 300);
        return;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("📤 Sending offer to", peerId);

      socket.send(
        JSON.stringify({
          ...pc.localDescription,
          to: peerId,
        })
      );
    };

    sendOffer();
  } else {
    pc.ondatachannel = (event) => {
      channel = event.channel;
      setupChannel(peerId, channel);
    };
  }

  return peerConnections[peerId];
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

// 🚀 Start
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

// 📤 Send message
export const sendMessage = (msg) => {
  Object.values(dataChannels).forEach((channel) => {
    if (channel.readyState === "open") {
      channel.send(msg);
    }
  });
};