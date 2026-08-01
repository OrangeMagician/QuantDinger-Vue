export function normalizeEpochMilliseconds (value) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return 0
  return Math.abs(timestamp) < 1e12 ? timestamp * 1000 : timestamp
}
