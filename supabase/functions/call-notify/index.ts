import { createClient } from "npm:@supabase/supabase-js@2";

// Database Webhook target for INSERT on public.call_invites. This is the
// bridge that wakes an iPhone with PushKit/CallKit even when HubConnect iOS is
// backgrounded or terminated. Foreground web/iOS clients also use the shared
// Supabase Realtime ring channel for an immediate in-app ring.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  const secret = request.headers.get("x-webhook-secret") ?? "";
  if (!secret || secret !== Deno.env.get("CALL_NOTIFY_SECRET")) {
    return json({ message: "unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await request.json();
    const record = body.record as
      | { id: string; room_id: string; caller_id: string | null; callee_id: string; status: string }
      | undefined;
    if (!record) return json({ message: "no record" }, 400);
    if (record.status !== "ringing") return json({ ok: true, delivered: 0 });

    const { data: room } = await admin.from("call_rooms").select("kind").eq("id", record.room_id).single();
    const kind = room?.kind === "audio" ? "audio" : "video";

    let callerName = "HubConnect";
    if (record.caller_id) {
      const { data: caller } = await admin.from("profiles").select("full_name").eq("id", record.caller_id).single();
      if (caller?.full_name) callerName = caller.full_name;
    }

    const { data: tokens } = await admin
      .from("push_tokens")
      .select("device_token,environment,kind,bundle_id")
      .eq("user_id", record.callee_id);
    const voipTokens = (tokens ?? []).filter((token) => token.kind === "voip");
    const remoteTokens = (tokens ?? []).filter((token) => token.kind !== "voip");

    let delivered = 0;
    for (const token of voipTokens) {
      const result = await sendVoipApns(token.device_token, token.environment, token.bundle_id, {
        roomId: record.room_id,
        fromId: record.caller_id ?? "",
        fromName: callerName,
        kind,
      });
      console.log(JSON.stringify({ delivery: "voip", roomId: record.room_id, status: result.status, reason: result.reason }));
      if (result.ok) delivered += 1;
      else if (result.permanent) await deleteToken(admin, record.callee_id, token.device_token);
    }

    // A regular APNs alert is also a safety net when the VoIP token is absent
    // or APNs rejected it. CallKit remains the preferred path.
    if (delivered === 0) {
      for (const token of remoteTokens) {
        const result = await sendAlertApns(token.device_token, token.environment, token.bundle_id, {
          title: kind === "video" ? "Görüntülü arıyor…" : "Sesli arıyor…",
          body: callerName,
          roomId: record.room_id,
        });
        console.log(JSON.stringify({ delivery: "alert", roomId: record.room_id, status: result.status, reason: result.reason }));
        if (result.ok) delivered += 1;
        else if (result.permanent) await deleteToken(admin, record.callee_id, token.device_token);
      }
    }

    return json({ ok: true, delivered });
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : "call-notify failed" }, 500);
  }
});

async function deleteToken(admin: ReturnType<typeof createClient>, userId: string, deviceToken: string) {
  await admin.from("push_tokens").delete().eq("device_token", deviceToken).eq("user_id", userId);
}

let cachedToken: { token: string; iat: number } | null = null;

function base64url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importApnsKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (character) => character.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function providerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.iat < 1_700) return cachedToken.token;
  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  const authKeyPem = (Deno.env.get("APNS_AUTH_KEY") || "").replace(/\\n/g, "\n");
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: now })));
  const signingInput = `${header}.${payload}`;
  const key = await importApnsKey(authKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  const token = `${signingInput}.${base64url(new Uint8Array(signature))}`;
  cachedToken = { token, iat: now };
  return token;
}

function apnsReady(): boolean {
  return Boolean(
    Deno.env.get("APNS_BUNDLE_ID") &&
      Deno.env.get("APNS_KEY_ID") &&
      Deno.env.get("APNS_TEAM_ID") &&
      Deno.env.get("APNS_AUTH_KEY")
  );
}

type ApnsResult = { ok: boolean; permanent: boolean; status: number; reason: string };

async function apnsResult(response: Response): Promise<ApnsResult> {
  let reason = "";
  try {
    reason = ((await response.json()) as { reason?: string })?.reason ?? "";
  } catch {}
  return {
    ok: response.status === 200,
    permanent: ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(reason),
    status: response.status,
    reason,
  };
}

async function sendVoipApns(
  deviceToken: string,
  environment: string,
  storedBundleId: string | null,
  payload: { roomId: string; fromId: string; fromName: string; kind: string }
): Promise<ApnsResult> {
  if (!apnsReady()) return { ok: false, permanent: false, status: 0, reason: "apns_not_configured" };
  const bundleId = storedBundleId || Deno.env.get("APNS_BUNDLE_ID")!;
  const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  try {
    const token = await providerToken();
    const response = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${token}`,
        "apns-topic": `${bundleId}.voip`,
        "apns-push-type": "voip",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        room_id: payload.roomId,
        from_id: payload.fromId,
        from_name: payload.fromName,
        kind: payload.kind,
      }),
    });
    return apnsResult(response);
  } catch (error) {
    return { ok: false, permanent: false, status: 0, reason: error instanceof Error ? error.message : "request_failed" };
  }
}

async function sendAlertApns(
  deviceToken: string,
  environment: string,
  storedBundleId: string | null,
  payload: { title: string; body: string; roomId: string }
): Promise<ApnsResult> {
  if (!apnsReady()) return { ok: false, permanent: false, status: 0, reason: "apns_not_configured" };
  const bundleId = storedBundleId || Deno.env.get("APNS_BUNDLE_ID")!;
  const host = environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  try {
    const token = await providerToken();
    const response = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${token}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
        roomId: payload.roomId,
      }),
    });
    return apnsResult(response);
  } catch (error) {
    return { ok: false, permanent: false, status: 0, reason: error instanceof Error ? error.message : "request_failed" };
  }
}
