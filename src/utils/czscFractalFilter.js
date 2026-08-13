import { normalizeEpochMilliseconds } from './timestamps.js'

export function selectCompletedStrokeFractals (result) {
  const endpointTimestamps = new Set()
  ;(result?.strokes || []).forEach(stroke => {
    const start = normalizeEpochMilliseconds(stroke?.start_timestamp)
    const end = normalizeEpochMilliseconds(stroke?.end_timestamp)
    if (start) endpointTimestamps.add(start)
    if (end) endpointTimestamps.add(end)
  })
  if (!endpointTimestamps.size) return []
  return (result?.fractals || []).filter(fractal => {
    return endpointTimestamps.has(normalizeEpochMilliseconds(fractal?.timestamp))
  })
}
