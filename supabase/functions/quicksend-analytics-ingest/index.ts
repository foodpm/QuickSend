import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expectedAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!expectedAnon) return json({ error: "server_misconfigured" }, 500);
  const apikey = req.headers.get("apikey") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (apikey !== expectedAnon && bearer !== expectedAnon) return json({ error: "unauthorized" }, 401);

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

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const props = (payload.props && typeof payload.props === "object") ? payload.props : {};
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

  const { error } = await client
    .schema("quicksend_analytics")
    .from("events_raw_v1")
    .insert(row);

  if (error) return json({ error: "insert_failed" }, 500);
  return json({ ok: true });
});
