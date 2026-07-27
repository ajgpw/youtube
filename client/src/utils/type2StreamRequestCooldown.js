export const TYPE2_STREAM_REQUEST_COOLDOWN_MS = 30_000;

let nextRequestAt = 0;

export function claimType2StreamRequestSlot(now = Date.now()) {
  const current = Number(now);
  if (!Number.isFinite(current)) return TYPE2_STREAM_REQUEST_COOLDOWN_MS;

  const remaining = Math.max(0, nextRequestAt - current);
  if (remaining > 0) return remaining;

  nextRequestAt = current + TYPE2_STREAM_REQUEST_COOLDOWN_MS;
  return 0;
}

export function resetType2StreamRequestCooldown() {
  nextRequestAt = 0;
}
