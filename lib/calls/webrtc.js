"use client";

// Minimal mesh WebRTC manager: one RTCPeerConnection per remote participant.
// Negotiation direction is decided by the caller (CallRoomView) via the
// joined_at "elder" rule — this module only creates offers/answers when
// told to, it never decides who initiates.
//
// STUN alone can't traverse every NAT combination (symmetric NAT, cellular
// CGNAT, restrictive firewalls) — confirmed in practice: ICE sat in
// "checking" for a full minute and never connected between a phone on
// cellular and a laptop on Wi-Fi. Open Relay Project is a free, no-signup
// public TURN relay (openrelay.metered.ca) — these are its published,
// shared credentials, not a per-account secret.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:openrelay.metered.ca:80" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
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
    // CallRoomView re-checks the "elder" rule against durable participant
    // rows a few times as a late-subscriber safety net. Every one of those
    // must only ever start a fresh offer/answer round ONCE per peer for the
    // life of this call — signalingState returns to "stable" both right
    // after a successful negotiation and while one is still mid-flight (ICE
    // not yet connected), so it can't tell "done" from "in progress" on its
    // own. Confirmed via a real device log: repeated re-offers while ICE was
    // still "checking" corrupted the DTLS/SSL role negotiation entirely
    // ("Failed to set SSL role for the transport") and the call never came
    // up. Whether a peer connection already exists is the real "already
    // engaged this peer" signal — removePeer() is the only thing that
    // should ever clear it.
    if (peers.has(peerId)) return false;
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

  // CallRoomView's 2.5s/5s safety-net retries used to call offerTo directly,
  // which refuses to touch a peer connection that already exists — including
  // one whose very first offer never got a reply at all (the other side
  // hadn't subscribed to the room topic yet, so the offer was broadcast into
  // the void and lost). onconnectionstatechange only removes a peer once it
  // reaches failed/closed, but an unanswered offer with no remote description
  // just sits at iceConnectionState "new" forever — never failing, never
  // retried. Only reset and retry when nothing has actually happened yet;
  // anything further along is a real negotiation in flight and must be left
  // alone, or this reintroduces the glare bug offerTo's guard exists to
  // prevent.
  function reofferIfNeverConnected(peerId) {
    const pc = peers.get(peerId);
    if (!pc) return offerTo(peerId);
    if (pc.iceConnectionState !== "new" || isConnected(peerId)) return false;
    removePeer(peerId);
    return offerTo(peerId);
  }

  return { offerTo, reofferIfNeverConnected, handleOffer, handleAnswer, handleIceCandidate, hasPeer, isConnected, removePeer, closeAll };
}
