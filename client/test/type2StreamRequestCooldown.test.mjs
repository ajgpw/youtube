import test from "node:test";
import assert from "node:assert/strict";

import {
  TYPE2_STREAM_REQUEST_COOLDOWN_MS,
  claimType2StreamRequestSlot,
  resetType2StreamRequestCooldown,
} from "../src/utils/type2StreamRequestCooldown.js";

test("type 2 stream request cooldown is shared across all video IDs", () => {
  resetType2StreamRequestCooldown();

  assert.equal(claimType2StreamRequestSlot(1_000), 0);
  assert.equal(
    claimType2StreamRequestSlot(1_001),
    TYPE2_STREAM_REQUEST_COOLDOWN_MS - 1,
  );
  assert.equal(claimType2StreamRequestSlot(30_999), 1);
  assert.equal(claimType2StreamRequestSlot(31_000), 0);
});
