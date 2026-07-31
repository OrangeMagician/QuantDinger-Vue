<template>
  <div ref="chartContainer" class="czsc-chart" />
</template>

<script>
import { init, registerOverlay } from 'klinecharts'
import { marketPalette } from '@/utils/marketColors'

let overlaysRegistered = false

function registerCzscOverlays () {
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
        const color = data.color || (top ? '#389e0d' : '#cf1322')
        const confirmed = data.confirmed !== false
        const textY = point.y + (top ? -13 : 13)
        return [
          {
            type: 'circle',
            attrs: { x: point.x, y: point.y, r: confirmed ? 3.5 : 4 },
            styles: confirmed
              ? { style: 'fill', color }
              : { style: 'stroke', color, lineWidth: 1.5 },
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

export default {
  name: 'CzscChart',
  props: {
    analysis: {
      type: Object,
      default: null
    },
    visibility: {
      type: Object,
      default: () => ({ fractals: true, strokes: true, unfinished: true })
    },
    dark: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      chart: null,
      overlayIds: [],
      volumePaneId: null,
      macdPaneId: null,
      resizeObserver: null
    }
  },
  watch: {
    analysis: {
      handler () {
        this.renderAnalysis()
      },
      deep: false
    },
    visibility: {
      handler () {
        this.renderOverlays()
      },
      deep: true
    },
    dark () {
      this.applyTheme()
    }
  },
  mounted () {
    registerCzscOverlays()
    this.chart = init(this.$refs.chartContainer)
    this.applyTheme()
    try {
      this.volumePaneId = this.chart.createIndicator('VOL', false, { height: 104, dragEnabled: true })
    } catch (error) {}
    try {
      this.macdPaneId = this.chart.createIndicator('MACD', false, { height: 118, dragEnabled: true })
    } catch (error) {}
    this.renderAnalysis()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.chart) this.chart.resize()
      })
      this.resizeObserver.observe(this.$refs.chartContainer)
    }
  },
  beforeDestroy () {
    if (this.resizeObserver) this.resizeObserver.disconnect()
    this.clearOverlays()
    if (this.chart) this.chart.destroy()
    this.chart = null
  },
  methods: {
    applyTheme () {
      if (!this.chart) return
      const dark = this.dark
      const market = marketPalette(dark)
      this.chart.setStyles({
        grid: {
          horizontal: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(31,41,55,0.08)', style: 'dashed' },
          vertical: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(31,41,55,0.05)' }
        },
        candle: {
          bar: {
            upColor: market.rise,
            downColor: market.fall,
            noChangeColor: '#8c8c8c',
            upBorderColor: market.rise,
            downBorderColor: market.fall,
            upWickColor: market.rise,
            downWickColor: market.fall
          },
          tooltip: { showRule: 'always', showType: 'standard' }
        },
        xAxis: { axisLine: { color: dark ? '#30363d' : '#d9d9d9' }, tickText: { color: dark ? '#9ca3af' : '#595959' } },
        yAxis: { axisLine: { color: dark ? '#30363d' : '#d9d9d9' }, tickText: { color: dark ? '#9ca3af' : '#595959' } },
        separator: { color: dark ? '#30363d' : '#e8e8e8' }
      })
    },
    clearOverlays () {
      if (!this.chart) return
      this.overlayIds.forEach(id => {
        try {
          this.chart.removeOverlay(id)
        } catch (error) {}
      })
      this.overlayIds = []
    },
    addOverlay (config) {
      try {
        const id = this.chart.createOverlay(config, 'candle_pane')
        if (id) this.overlayIds.push(id)
      } catch (error) {}
    },
    renderAnalysis () {
      if (!this.chart) return
      const bars = this.analysis && Array.isArray(this.analysis.bars) ? this.analysis.bars : []
      this.chart.applyNewData(bars.map(bar => ({
        timestamp: Number(bar.timestamp),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume || 0),
        turnover: Number(bar.turnover || 0)
      })))
      this.renderOverlays()
    },
    renderOverlays () {
      if (!this.chart) return
      this.clearOverlays()
      const result = this.analysis
      if (!result) return
      const market = marketPalette(this.dark)

      if (this.visibility.strokes) {
        ;(result.strokes || []).forEach(stroke => {
          this.addOverlay({
            name: 'czscStroke',
            points: [
              { timestamp: Number(stroke.start_timestamp), value: Number(stroke.start_price) },
              { timestamp: Number(stroke.end_timestamp), value: Number(stroke.end_price) }
            ],
            extendData: {
              color: stroke.direction === 'up' ? market.rise : market.fall,
              lineWidth: 2
            },
            lock: true
          })
        })
      }

      if (this.visibility.fractals) {
        ;(result.fractals || []).forEach(fractal => {
          this.addOverlay({
            name: 'czscFractal',
            points: [{ timestamp: Number(fractal.timestamp), value: Number(fractal.price) }],
            extendData: {
              kind: fractal.kind,
              text: fractal.kind === 'top' ? this.$t('czsc.top') : this.$t('czsc.bottom'),
              confirmed: true
            },
            lock: true
          })
        })
      }

      if (this.visibility.unfinished) {
        const unfinished = (result.unfinished && result.unfinished.fractals) || []
        unfinished.forEach(fractal => {
          this.addOverlay({
            name: 'czscFractal',
            points: [{ timestamp: Number(fractal.timestamp), value: Number(fractal.price) }],
            extendData: {
              kind: fractal.kind,
              text: this.$t('czsc.unfinishedShort'),
              confirmed: false,
              color: '#d4a017'
            },
            lock: true
          })
        })
        const lastStroke = (result.strokes || [])[result.strokes.length - 1]
        const candidate = unfinished[unfinished.length - 1]
        if (lastStroke && candidate) {
          this.addOverlay({
            name: 'czscStroke',
            points: [
              { timestamp: Number(lastStroke.end_timestamp), value: Number(lastStroke.end_price) },
              { timestamp: Number(candidate.timestamp), value: Number(candidate.price) }
            ],
            extendData: { color: '#d4a017', lineWidth: 1.5, dashed: true },
            lock: true
          })
        }
      }

      if (this.visibility.signals) {
        ;(result.enhanced_signals || []).forEach(signal => {
          const mark = signal.chart_mark || {}
          if (!mark.timestamp || !mark.price) return
          this.addOverlay({
            name: 'czscSignalMarker',
            points: [{ timestamp: Number(mark.timestamp), value: Number(mark.price) }],
            extendData: {
              text: mark.text || signal.signal_type_label || signal.signal_type,
              color: mark.color,
              position: mark.position
            },
            lock: true
          })
        })
      }
    }
  }
}
</script>

<style scoped>
.czsc-chart {
  width: 100%;
  height: 100%;
  min-height: 520px;
}

@media (max-width: 720px) {
  .czsc-chart {
    min-height: 460px;
  }
}
</style>
