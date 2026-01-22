declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => unknown;
  env: { get: (key: string) => string | undefined };
};

type IncomingEvent = {
  event_name?: string;
  installation_id?: string;
  session_id?: string | null;
  app_version?: string | null;
  platform?: string | null;
  is_frozen?: boolean | null;
  props?: Record<string, unknown> | null;
};

const ALLOWED_EVENTS = new Set([
  "install",
  "app_open",
  "file_upload",
  "text_share",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const safeText = (v: unknown, maxLen: number) => {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const getGeoCountry = (headers: Headers): string | null => {
  const candidates = [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "cloudfront-viewer-country",
    "x-appengine-country",
    "x-country",
    "x-geo-country",
    "x-client-country",
  ];
  for (const key of candidates) {
    const raw = headers.get(key);
    if (!raw) continue;
    const v = raw.trim().toUpperCase();
    if (v.length === 2 && /^[A-Z]{2}$/.test(v)) return v;
  }
  return null;
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const allowedAnonKeys = new Set(
      [Deno.env.get("SUPABASE_ANON_KEY"), Deno.env.get("QS_ANON_KEY")]
        .map((v) => (v || "").trim())
        .filter(Boolean),
    );
    if (allowedAnonKeys.size === 0) return json({ error: "server_misconfigured" }, 500);
    const apikey = req.headers.get("apikey") || "";
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!allowedAnonKeys.has(apikey) && !allowedAnonKeys.has(bearer)) return json({ error: "unauthorized" }, 401);

    let payload: IncomingEvent;
    try {
      payload = (await req.json()) as IncomingEvent;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const event_name = safeText(payload.event_name, 64);
    const installation_id = safeText(payload.installation_id, 128);
    if (!event_name || !ALLOWED_EVENTS.has(event_name)) return json({ error: "invalid_event" }, 400);
    if (!installation_id) return json({ error: "missing_installation_id" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("QS_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_misconfigured" }, 500);

    const geoCountry = getGeoCountry(req.headers);
    const baseProps = (payload.props && typeof payload.props === "object") ? payload.props : {};
    const props = (geoCountry && (baseProps as Record<string, unknown>).geo_country === undefined)
      ? { ...(baseProps as Record<string, unknown>), geo_country: geoCountry }
      : baseProps;
    const propsStr = JSON.stringify(props);
    if (propsStr.length > 16_000) return json({ error: "props_too_large" }, 413);

    const row = {
      event_name,
      installation_id,
      session_id: safeText(payload.session_id, 128),
      app_version: safeText(payload.app_version, 32),
      platform: safeText(payload.platform, 16),
      is_frozen: payload.is_frozen ?? null,
      props,
    };

    const insertUrl = `${supabaseUrl}/rest/v1/rpc/qs_analytics_insert_event`;
    const resp = await fetch(insertUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_row: row }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return json({ error: "insert_failed", details: { status: resp.status, body: safeText(body, 500) } }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    const message = safeText((e as unknown as { message?: unknown })?.message ?? e, 400);
    return json({ error: "internal_error", message }, 500);
  }
});
