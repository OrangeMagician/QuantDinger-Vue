import { registerOverlay } from 'klinecharts'
import { marketPalette } from '@/utils/marketColors'
import { normalizeEpochMilliseconds } from '@/utils/timestamps'

let overlaysRegistered = false

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
        const textY = point.y + (top ? -13 : 13)
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
        const above = data.position === 'above'
        const color = data.color || '#1677ff'
        const y = point.y + (above ? -22 : 22)
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
    ;(result.fractals || []).forEach(fractal => add({
      name: 'czscFractal',
      points: [{ timestamp: normalizeEpochMilliseconds(fractal.timestamp), value: Number(fractal.price) }],
      extendData: {
        kind: fractal.kind,
        text: fractal.kind === 'top' ? translate('czsc.top') : translate('czsc.bottom'),
        confirmed: true,
        color: fractal.kind === 'top' ? market.fall : market.rise
      },
      lock: true
    }))
  }

  const unfinished = (result.unfinished && result.unfinished.fractals) || []
  if (enabled.unfinished) {
    unfinished.forEach(fractal => add({
      name: 'czscFractal',
      points: [{ timestamp: normalizeEpochMilliseconds(fractal.timestamp), value: Number(fractal.price) }],
      extendData: { kind: fractal.kind, text: translate('czsc.unfinishedShort'), confirmed: false, color: '#d4a017' },
      lock: true
    }))
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
      add({
        name: 'czscSignalMarker',
        points: [{ timestamp: normalizeEpochMilliseconds(mark.timestamp), value: Number(mark.price) }],
        extendData: {
          text: mark.text || signal.signal_type_label || signal.signal_type,
          color: mark.color,
          position: mark.position
        },
        lock: true
      })
    })
  }
  return overlayIds
}
