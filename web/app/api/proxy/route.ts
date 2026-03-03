import { ALLOWED_HOSTS, LOOM_HEADERS } from "@/lib/loom";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Validate domain — exact match only, no wildcards
  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(hostname)) {
    return new Response("Domain not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: LOOM_HEADERS,
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": upstream.headers.get("Content-Type") ?? "video/mp2t",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    };

    // Only set Content-Length if upstream provides it
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new Response(upstream.body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return new Response(message, { status: 502 });
  }
}
