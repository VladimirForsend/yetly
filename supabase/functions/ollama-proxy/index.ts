const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Yetly-Ollama-Proxy, X-Yetly-Error-Source",
  "X-Yetly-Ollama-Proxy": "1",
};

const allowedEndpoints = new Set(["tags", "show", "chat"]);

function json(body: unknown, status = 200, source = "proxy") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Yetly-Error-Source": source },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "proxy configuration missing" }, 500);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: serviceKey },
  });
  if (!userResponse.ok) return json({ error: "invalid Yetly session" }, 401);

  let input: { endpoint?: string; ollamaApiKey?: string; payload?: unknown };
  try { input = await request.json(); }
  catch { return json({ error: "invalid json" }, 400); }

  if (!input.endpoint || !allowedEndpoints.has(input.endpoint)) return json({ error: "endpoint not allowed" }, 400);
  if (!input.ollamaApiKey?.trim()) return json({ error: "missing Ollama API key" }, 400);

  const isTags = input.endpoint === "tags";
  const upstream = await fetch(`https://ollama.com/api/${input.endpoint}`, {
    method: isTags ? "GET" : "POST",
    signal: request.signal,
    headers: {
      Authorization: `Bearer ${input.ollamaApiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: isTags ? undefined : JSON.stringify(input.payload ?? {}),
  });

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Yetly-Error-Source", "ollama");
  return new Response(upstream.body, { status: upstream.status, headers });
});
