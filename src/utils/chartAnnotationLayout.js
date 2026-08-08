const normalizeTimestamp = (value) => {
  let timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null
  if (timestamp < 1e10) timestamp *= 1000
  return timestamp
}

const visualTextWidth = (text, fontSize = 10) => {
  return String(text || '').split('').reduce((width, char) => {
    return width + (char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.62)
  }, 0)
}

export const normalizeAnnotationSide = (side) => {
  const value = String(side || '').toLowerCase()
  return ['above', 'top', 'sell', 'short', 'exit'].some(token => value.includes(token)) ? 'above' : 'below'
}

export function createChartAnnotationLaneAllocator (bars = [], options = {}) {
  const baseLane = Math.max(0, Number(options.baseLane) || 0)
  const assumedBarWidth = Math.max(12, Number(options.assumedBarWidth) || 16)
  const timestampIndex = new Map()

  bars.forEach((bar, index) => {
    const timestamp = normalizeTimestamp(bar?.timestamp ?? bar?.time)
    if (timestamp != null) timestampIndex.set(timestamp, index)
  })

  const occupied = { above: [], below: [] }
  const fallbackTimestampIndex = new Map()
  let fallbackIndex = bars.length

  return ({ timestamp, side, text, fontSize = 10 }) => {
    const normalizedSide = normalizeAnnotationSide(side)
    const normalizedTimestamp = normalizeTimestamp(timestamp)
    let index = normalizedTimestamp != null ? timestampIndex.get(normalizedTimestamp) : null
    if (!Number.isFinite(index)) {
      if (normalizedTimestamp != null && fallbackTimestampIndex.has(normalizedTimestamp)) {
        index = fallbackTimestampIndex.get(normalizedTimestamp)
      } else {
        index = fallbackIndex++
        if (normalizedTimestamp != null) fallbackTimestampIndex.set(normalizedTimestamp, index)
      }
    }
    const widthInBars = Math.max(1, Math.ceil((visualTextWidth(text, fontSize) + 16) / assumedBarWidth))
    const start = index - widthInBars / 2
    const end = index + widthInBars / 2
    const lanes = occupied[normalizedSide]

    let lane = baseLane
    while (lanes[lane]?.some(range => start <= range.end && end >= range.start)) {
      lane += 1
    }
    if (!lanes[lane]) lanes[lane] = []
    lanes[lane].push({ start, end })
    return lane
  }
}
