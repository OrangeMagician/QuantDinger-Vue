<template>
  <div ref="chart" class="equity-chart" role="img" :aria-label="$t('czsc.equityCurve')" />
</template>

<script>
import * as echarts from 'echarts'

export default {
  name: 'CzscEquityChart',
  props: {
    curve: { type: Array, default: () => [] },
    dark: { type: Boolean, default: false }
  },
  data () {
    return { chart: null }
  },
  watch: {
    curve: { deep: true, handler: 'renderChart' },
    dark: 'renderChart'
  },
  mounted () {
    this.chart = echarts.init(this.$refs.chart)
    this.renderChart()
    window.addEventListener('resize', this.resize)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.resize)
    if (this.chart) this.chart.dispose()
  },
  methods: {
    resize () {
      if (this.chart) this.chart.resize()
    },
    renderChart () {
      if (!this.chart) return
      const text = this.dark ? '#c5cad3' : '#595959'
      const line = this.dark ? '#36cfc9' : '#08979c'
      const grid = this.dark ? '#30343b' : '#e5e7eb'
      this.chart.setOption({
        animation: false,
        backgroundColor: 'transparent',
        grid: { left: 12, right: 18, top: 18, bottom: 28, containLabel: true },
        tooltip: { trigger: 'axis', valueFormatter: value => Number(value).toFixed(2) },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: this.curve.map(item => String(item.datetime || '').replace('T', ' ').slice(0, 16)),
          axisLabel: { color: text, hideOverlap: true },
          axisLine: { lineStyle: { color: grid } }
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: { color: text },
          splitLine: { lineStyle: { color: grid } }
        },
        series: [{
          name: this.$t('czsc.equity'),
          type: 'line',
          data: this.curve.map(item => item.equity),
          symbol: 'none',
          lineStyle: { width: 2, color: line },
          areaStyle: { color: this.dark ? 'rgba(54, 207, 201, 0.12)' : 'rgba(8, 151, 156, 0.10)' }
        }]
      }, true)
    }
  }
}
</script>

<style scoped>
.equity-chart { width: 100%; height: 280px; }
</style>
