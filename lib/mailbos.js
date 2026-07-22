const MAILBOS_BASE_URL = (process.env.MAILBOS_API_URL || "https://mailbos.app").replace(/\/$/, "");

export function decodeMailbosKey(value) {
  if (!value) return null;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function encodeMailbosKey(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function mailbosRequest(apiKey, path, options = {}) {
  if (!apiKey) throw new Error("mailbos_not_connected");

  const response = await fetch(`${MAILBOS_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "x-api-key": apiKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `mailbos_http_${response.status}`);
  }
  return payload;
}

export async function pingMailbos(apiKey) {
  return mailbosRequest(apiKey, "/api/ext/v1/ping", { method: "POST", body: {} });
}

export async function fetchMailbosSent(apiKey) {
  const payload = await mailbosRequest(apiKey, "/api/ext/v1/sent");
  return payload.records || [];
}

export async function fetchMailbosInbox(apiKey, provider = "gmail") {
  const query = new URLSearchParams({ provider, limit: "30" });
  const payload = await mailbosRequest(apiKey, `/api/ext/v1/inbox?${query}`);
  return payload.messages || [];
}

export async function fetchMailbosMessage(apiKey, id, provider = "gmail") {
  const query = new URLSearchParams({ id, provider });
  return mailbosRequest(apiKey, `/api/ext/v1/inbox-message?${query}`);
}
