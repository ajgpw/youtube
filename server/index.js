import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "../client/dist"); 
const PROXY_BASE = (process.env.SIATUBE_API_ORIGIN || "https://siatube.com").replace(/\/$/, "");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// GAS HtmlService cannot send very long continuation tokens with UrlFetchApp
// GET requests. This short POST relay keeps the upstream request a SiaTube GET.
app.post("/api/bridge", async (req, res) => {
  const pathAndQuery = String(req.body?.pathAndQuery || "");
  if (!(pathAndQuery === "/api" || pathAndQuery.startsWith("/api/") || pathAndQuery.startsWith("/api?"))) {
    return res.status(400).json({ error: "invalid_api_path" });
  }

  try {
    const response = await fetch(PROXY_BASE + pathAndQuery, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "follow",
    });
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch (error) {
    res.status(502).json({ error: "proxy_error", message: String(error) });
  }
});

app.use("/api", async (req, res) => {
  const targetUrl = PROXY_BASE + req.originalUrl;
  console.log(`[PROXY] ${req.method} ${targetUrl}`);

  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (["host", "accept-encoding", "connection"].includes(key.toLowerCase())) continue;
      headers[key] = value;
    }

    const options = {
      method: req.method,
      headers: headers,
      redirect: "follow",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      }
    }

    const response = await fetch(targetUrl, options);
    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }

    console.log(`[PROXY OK] ${response.status}`);
  } catch (err) {
    console.error("[PROXY ERROR]", err);
    res.status(500).json({
      error: "proxy_error",
      message: String(err),
    });
  }
});

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running`);
  console.log(`http://localhost:${PORT}`);
});
