import test from "node:test";
import assert from "node:assert/strict";

import {
  clearStreamCache,
  comments,
  playlist,
  search,
  stream,
  suggest,
  video,
} from "../src/services/siatubeApi.js";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "content-type": "application/json" },
  });
}

test("resource helpers generate the documented paths and query parameters", async (t) => {
  const urls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(new URL(url));
    return jsonResponse({ items: [] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await search({ q: "猫", token: "next" });
  await suggest("猫");
  await video("dQw4w9WgXcQ", { depth: 2, token: "related" });
  await comments("dQw4w9WgXcQ", { sort: "new", continuation: "comments" });
  await playlist("UUone====PLtwo", { token: "playlist", v: "dQw4w9WgXcQ" });

  assert.equal(urls[0].pathname, "/api/search");
  assert.equal(urls[0].searchParams.get("q"), "猫");
  assert.equal(urls[1].pathname, "/api/suggest/");
  assert.equal(
    decodeURIComponent(urls[2].pathname),
    "/api/video/dQw4w9WgXcQ====token==i==related==p==depth==i==2"
  );
  assert.equal(urls[3].pathname, "/api/comments");
  assert.equal(urls[3].searchParams.get("sort"), "new");
  assert.equal(urls[3].searchParams.get("continuation"), "comments");
  assert.equal(decodeURIComponent(urls[4].pathname), "/api/playlist/UUone====PLtwo");
});

test("same-video stream requests share one in-flight API call and cache", async (t) => {
  clearStreamCache();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    await Promise.resolve();
    return jsonResponse({ streams: { muxed: [] } });
  };
  t.after(() => {
    clearStreamCache();
    globalThis.fetch = originalFetch;
  });

  const [first, second] = await Promise.all([
    stream("dQw4w9WgXcQ"),
    stream("dQw4w9WgXcQ"),
  ]);
  const third = await stream("dQw4w9WgXcQ");

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("Apps Script deployments call SiaTube directly", async (t) => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.window = {
    location: { hostname: "example.script.googleusercontent.com" },
    google: { script: { run: {} } },
  };
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse(["猫", "猫 動画"]);
  };
  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  });

  const result = await suggest("猫");
  assert.deepEqual(result, ["猫", "猫 動画"]);
  assert.equal(
    requestedUrl,
    "https://siatube.com/api/suggest/?keyword=%E7%8C%AB",
  );
});
