import test from "node:test";
import assert from "node:assert/strict";

import { loadAutoplay } from "../src/utils/settingsManager.js";

test("自動再生は未設定の場合オンになる", () => {
  globalThis.localStorage = {
    getItem: () => null,
  };

  assert.equal(loadAutoplay(), true);
});

test("明示的にオフへ設定した値は維持する", () => {
  globalThis.localStorage = {
    getItem: () => "0",
  };

  assert.equal(loadAutoplay(), false);
});
