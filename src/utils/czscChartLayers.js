import { registerOverlay } from 'klinecharts'
import { marketPalette } from '@/utils/marketColors'
import { normalizeEpochMilliseconds } from '@/utils/timestamps'
import { createChartAnnotationLaneAllocator } from '@/utils/chartAnnotationLayout'

let overlaysRegistered = false

const buildCzscAnnotationLayout = ({ result, visibility, translate }) => {
  const enabled = { fractals: true, unfinished: true, signals: true, ...(visibility || {}) }
  const allocateLane = createChartAnnotationLaneAllocator(result?.bars || [])
  const lanes = new WeakMap()
  let laneCount = 0
  const assign = (item, timestamp, side, text) => {
    const lane = allocateLane({ timestamp, side, text })
    lanes.set(item, lane)
    laneCount = Math.max(laneCount, lane + 1)
  }

  if (enabled.fractals) {
    ;(result?.fractals || []).forEach(fractal => {
      const text = fractal.kind === 'top' ? translate('czsc.top') : translate('czsc.bottom')
      assign(fractal, normalizeEpochMilliseconds(fractal.timestamp), fractal.kind, text)
    })
  }
  if (enabled.unfinished) {
    ;((result?.unfinished && result.unfinished.fractals) || []).forEach(fractal => {
      assign(fractal, normalizeEpochMilliseconds(fractal.timestamp), fractal.kind, translate('czsc.unfinishedShort'))
    })
  }
  if (enabled.signals) {
    ;(result?.enhanced_signals || []).forEach(signal => {
      const mark = signal.chart_mark || {}
      if (!mark.timestamp || !mark.price) return
      const text = mark.text || signal.signal_type_label || signal.signal_type
      assign(signal, normalizeEpochMilliseconds(mark.timestamp), mark.position, text)
    })
  }
  return { lanes, laneCount }
}

export function getCzscAnnotationLaneCount ({ result, visibility, translate }) {
  if (!result) return 0
  return buildCzscAnnotationLayout({ result, visibility, translate }).laneCount
}

export function registerCzscOverlays () {
  if (overlaysRegistered) return
  try {
    registerOverlay({
      name: 'czscStroke',
      totalStep: 2,
      lock: true,
      needDefaultPointFigure: false,
      needDefaultXAxisFigure: false,
      needDefaultYAxisFigure: false,
      checkEventOn: () => false,
      createPointFigures: ({ coordinates, overlay }) => {
        if (!coordinates[0] || !coordinates[1]) return []
        const data = overlay.extendData || {}
        return [{
          type: 'line',
          attrs: { coordinates: [coordinates[0], coordinates[1]] },
          styles: {
            style: 'stroke',
            color: data.color || '#1677ff',
            size: Number(data.lineWidth || 2),
            dashedValue: data.dashed ? [6, 4] : []
          },
          ignoreEvent: true
        }]
      }
    })
    registerOverlay({
      name: 'czscFractal',
      totalStep: 1,
      lock: true,
      needDefaultPointFigure: false,
      needDefaultXAxisFigure: false,
      needDefaultYAxisFigure: false,
      checkEventOn: () => false,
      createPointFigures: ({ coordinates, overlay }) => {
        if (!coordinates[0]) return []
        const point = coordinates[0]
        const data = overlay.extendData || {}
        const top = data.kind === 'top'
        const color = data.color || (top ? '#52c41a' : '#f5222d')
        const confirmed = data.confirmed !== false
        const lane = Math.max(0, Number(data.lane) || 0)
        const textOffset = 15 + lane * 17
        const textY = point.y + (top ? -textOffset : textOffset)
        return [
          {
            type: 'circle',
            attrs: { x: point.x, y: point.y, r: confirmed ? 3.5 : 4 },
            styles: confirmed ? { style: 'fill', color } : { style: 'stroke', color, lineWidth: 1.5 },
            ignoreEvent: true
          },
          {
            type: 'text',
            attrs: { x: point.x, y: textY, text: String(data.text || ''), align: 'center', baseline: 'middle' },
            styles: { color, size: confirmed ? 10 : 9, weight: confirmed ? '600' : 'normal' },
            ignoreEvent: true
          }
        ]
      }
    })
    registerOverlay({
      name: 'czscSignalMarker',
      totalStep: 1,
      lock: true,
      needDefaultPointFigure: false,
      needDefaultXAxisFigure: false,
      needDefaultYAxisFigure: false,
      checkEventOn: () => false,
      createPointFigures: ({ coordinates, overlay }) => {
        if (!coordinates[0]) return []
        const point = coordinates[0]
        const data = overlay.extendData || {}
        const above = ['above', 'top', 'sell', 'short', 'exit'].some(token => String(data.position || '').toLowerCase().includes(token))
        const color = data.color || '#1677ff'
        const lane = Math.max(0, Number(data.lane) || 0)
        const textOffset = 18 + lane * 18
        const y = point.y + (above ? -textOffset : textOffset)
        return [
          {
            type: 'circle',
            attrs: { x: point.x, y: point.y, r: 4.5 },
            styles: { style: 'fill', color },
            ignoreEvent: true
          },
          {
            type: 'text',
            attrs: { x: point.x, y, text: String(data.text || ''), align: 'center', baseline: 'middle' },
            styles: { color, size: 10, weight: '600' },
            ignoreEvent: true
          }
        ]
      }
    })
    overlaysRegistered = true
  } catch (error) {
    if (String(error && error.message).toLowerCase().includes('register')) overlaysRegistered = true
  }
}

export function clearCzscOverlays (chart, overlayIds = []) {
  if (!chart) return []
  overlayIds.forEach(id => {
    try {
      chart.removeOverlay(id)
    } catch (error) {}
  })
  return []
}

export function renderCzscOverlays ({ chart, result, visibility, dark, marketColorConvention, translate }) {
  if (!chart || !result) return []
  const overlayIds = []
  const market = marketPalette(dark, marketColorConvention)
  const enabled = { fractals: true, strokes: true, unfinished: true, signals: true, ...(visibility || {}) }
  const annotationLayout = buildCzscAnnotationLayout({ result, visibility: enabled, translate })
  const add = config => {
    try {
      const id = chart.createOverlay(config, 'candle_pane')
      if (id) overlayIds.push(id)
    } catch (error) {}
  }

  if (enabled.strokes) {
    ;(result.strokes || []).forEach(stroke => add({
      name: 'czscStroke',
      points: [
        { timestamp: normalizeEpochMilliseconds(stroke.start_timestamp), value: Number(stroke.start_price) },
        { timestamp: normalizeEpochMilliseconds(stroke.end_timestamp), value: Number(stroke.end_price) }
      ],
      extendData: { color: stroke.direction === 'up' ? market.rise : market.fall, lineWidth: 2 },
      lock: true
    }))
  }

  if (enabled.fractals) {
    ;(result.fractals || []).forEach(fractal => {
      const text = fractal.kind === 'top' ? translate('czsc.top') : translate('czsc.bottom')
      const timestamp = normalizeEpochMilliseconds(fractal.timestamp)
      add({
        name: 'czscFractal',
        points: [{ timestamp, value: Number(fractal.price) }],
        extendData: {
          kind: fractal.kind,
          text,
          lane: annotationLayout.lanes.get(fractal) || 0,
          confirmed: true,
          color: fractal.kind === 'top' ? market.fall : market.rise
        },
        lock: true
      })
    })
  }

  const unfinished = (result.unfinished && result.unfinished.fractals) || []
  if (enabled.unfinished) {
    unfinished.forEach(fractal => {
      const text = translate('czsc.unfinishedShort')
      const timestamp = normalizeEpochMilliseconds(fractal.timestamp)
      add({
        name: 'czscFractal',
        points: [{ timestamp, value: Number(fractal.price) }],
        extendData: {
          kind: fractal.kind,
          text,
          lane: annotationLayout.lanes.get(fractal) || 0,
          confirmed: false,
          color: '#d4a017'
        },
        lock: true
      })
    })
    const lastStroke = (result.strokes || [])[result.strokes.length - 1]
    const candidate = unfinished[unfinished.length - 1]
    if (lastStroke && candidate) {
      add({
        name: 'czscStroke',
        points: [
          { timestamp: normalizeEpochMilliseconds(lastStroke.end_timestamp), value: Number(lastStroke.end_price) },
          { timestamp: normalizeEpochMilliseconds(candidate.timestamp), value: Number(candidate.price) }
        ],
        extendData: { color: '#d4a017', lineWidth: 1.5, dashed: true },
        lock: true
      })
    }
  }

  if (enabled.signals) {
    ;(result.enhanced_signals || []).forEach(signal => {
      const mark = signal.chart_mark || {}
      if (!mark.timestamp || !mark.price) return
      const text = mark.text || signal.signal_type_label || signal.signal_type
      const timestamp = normalizeEpochMilliseconds(mark.timestamp)
      add({
        name: 'czscSignalMarker',
        points: [{ timestamp, value: Number(mark.price) }],
        extendData: {
          text,
          color: mark.color,
          position: mark.position,
          lane: annotationLayout.lanes.get(signal) || 0
        },
        lock: true
      })
    })
  }
  return overlayIds
}
