const SIATUBE_API_ORIGIN = "https://siatube.com";

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

async function proxyApi(request, sourceUrl) {
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, SIATUBE_API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("accept-encoding");
  headers.delete("connection");

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  const location = responseHeaders.get("location");
  if (location) {
    const redirectUrl = new URL(location, targetUrl);
    if (redirectUrl.origin === SIATUBE_API_ORIGIN) {
      redirectUrl.protocol = sourceUrl.protocol;
      redirectUrl.host = sourceUrl.host;
      responseHeaders.set("location", redirectUrl.toString());
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/bridge" && request.method === "POST") {
      let pathAndQuery = "";
      try {
        const body = await request.json();
        pathAndQuery = String(body?.pathAndQuery || "");
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
      if (!(pathAndQuery === "/api" || pathAndQuery.startsWith("/api/") || pathAndQuery.startsWith("/api?"))) {
        return Response.json({ error: "invalid_api_path" }, { status: 400 });
      }
      const targetUrl = new URL(pathAndQuery, url);
      return proxyApi(new Request(targetUrl, { method: "GET" }), targetUrl);
    }
    if (isApiPath(url.pathname)) return proxyApi(request, url);
    return env.ASSETS.fetch(request);
  },
};
