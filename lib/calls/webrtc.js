"use client";

// Minimal mesh WebRTC manager: one RTCPeerConnection per remote participant,
// STUN-only (no TURN, no paid vendor). Negotiation direction is decided by
// the caller (CallRoomView) via the joined_at "elder" rule — this module
// only creates offers/answers when told to, it never decides who initiates.

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export function createCallEngine({ localStream, sendSignal, onRemoteStream, onRemoteStreamRemoved, onConnectionState }) {
  const peers = new Map();
  const pendingCandidates = new Map();
  const makingOffers = new Set();

  function getOrCreatePeer(peerId) {
    let pc = peers.get(peerId);
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: "ice-candidate", to_id: peerId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      onRemoteStream(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      onConnectionState?.(peerId, pc.connectionState);
      if (["failed", "closed"].includes(pc.connectionState)) removePeer(peerId);
    };
    peers.set(peerId, pc);
    return pc;
  }

  async function flushCandidates(peerId, pc) {
    const queued = pendingCandidates.get(peerId);
    if (!queued) return;
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {}
    }
    pendingCandidates.delete(peerId);
  }

  async function offerTo(peerId) {
    const pc = getOrCreatePeer(peerId);
    if (makingOffers.has(peerId) || pc.signalingState !== "stable" || ["connected", "completed"].includes(pc.connectionState)) {
      return false;
    }
    makingOffers.add(peerId);
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== "stable") return false;
      await pc.setLocalDescription(offer);
      sendSignal({ type: "offer", to_id: peerId, sdp: pc.localDescription.sdp });
      return true;
    } finally {
      makingOffers.delete(peerId);
    }
  }

  async function handleOffer(peerId, sdp) {
    const pc = getOrCreatePeer(peerId);
    if (pc.signalingState !== "stable") {
      try {
        await pc.setLocalDescription({ type: "rollback" });
      } catch {
        return;
      }
    }
    await pc.setRemoteDescription({ type: "offer", sdp });
    await flushCandidates(peerId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal({ type: "answer", to_id: peerId, sdp: pc.localDescription.sdp });
  }

  async function handleAnswer(peerId, sdp) {
    const pc = peers.get(peerId);
    if (!pc || pc.signalingState !== "have-local-offer") return;
    await pc.setRemoteDescription({ type: "answer", sdp });
    await flushCandidates(peerId, pc);
  }

  async function handleIceCandidate(peerId, candidate) {
    const pc = peers.get(peerId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {}
    } else {
      const queued = pendingCandidates.get(peerId) || [];
      queued.push(candidate);
      pendingCandidates.set(peerId, queued);
    }
  }

  function removePeer(peerId) {
    const pc = peers.get(peerId);
    if (pc) {
      pc.close();
      peers.delete(peerId);
    }
    pendingCandidates.delete(peerId);
    makingOffers.delete(peerId);
    onConnectionState?.(peerId, "closed");
    onRemoteStreamRemoved(peerId);
  }

  function closeAll() {
    for (const pc of peers.values()) pc.close();
    peers.clear();
    pendingCandidates.clear();
    makingOffers.clear();
  }

  function isConnected(peerId) {
    const state = peers.get(peerId)?.connectionState;
    return state === "connected" || state === "completed";
  }

  function hasPeer(peerId) {
    return peers.has(peerId);
  }

  return { offerTo, handleOffer, handleAnswer, handleIceCandidate, hasPeer, isConnected, removePeer, closeAll };
}
