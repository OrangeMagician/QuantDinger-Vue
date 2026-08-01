<template>
  <div ref="chartContainer" class="czsc-chart" />
</template>

<script>
import { init } from 'klinecharts'
import { klineChartMarketStyles } from '@/utils/marketColors'
import { normalizeEpochMilliseconds } from '@/utils/timestamps'
import { clearCzscOverlays, registerCzscOverlays, renderCzscOverlays } from '@/utils/czscChartLayers'

export default {
  name: 'StructureChart',
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
  computed: {
    marketColorConvention () {
      return this.$store.state.app.marketColorConvention
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
    },
    marketColorConvention () {
      this.applyTheme()
      this.renderOverlays()
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
      const marketStyles = klineChartMarketStyles(dark, this.marketColorConvention)
      this.chart.setStyles({
        grid: {
          horizontal: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(31,41,55,0.08)', style: 'dashed' },
          vertical: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(31,41,55,0.05)' }
        },
        candle: {
          bar: marketStyles.candleBar,
          priceMark: { last: marketStyles.lastPriceMark },
          tooltip: { showRule: 'always', showType: 'standard' }
        },
        indicator: marketStyles.indicator,
        xAxis: { axisLine: { color: dark ? '#30363d' : '#d9d9d9' }, tickText: { color: dark ? '#9ca3af' : '#595959' } },
        yAxis: { axisLine: { color: dark ? '#30363d' : '#d9d9d9' }, tickText: { color: dark ? '#9ca3af' : '#595959' } },
        separator: { color: dark ? '#30363d' : '#e8e8e8' }
      })
    },
    clearOverlays () {
      this.overlayIds = clearCzscOverlays(this.chart, this.overlayIds)
    },
    renderAnalysis () {
      if (!this.chart) return
      const bars = this.analysis && Array.isArray(this.analysis.bars) ? this.analysis.bars : []
      this.chart.applyNewData(bars.map(bar => ({
        timestamp: normalizeEpochMilliseconds(bar.timestamp),
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
      this.overlayIds = renderCzscOverlays({
        chart: this.chart,
        result,
        visibility: this.visibility,
        dark: this.dark,
        marketColorConvention: this.marketColorConvention,
        translate: key => this.$t(key)
      })
    }
  }
}
</script>

<style scoped>
.czsc-chart {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
