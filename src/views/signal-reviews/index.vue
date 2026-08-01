<template>
  <div class="review-page">
    <header>
      <div><h1>{{ $t('signalReviews.title') }}</h1><p>{{ $t('signalReviews.subtitle') }}</p></div>
      <div><a-select v-model="status" allow-clear @change="load"><a-select-option value="PENDING">PENDING</a-select-option><a-select-option value="APPROVED">APPROVED</a-select-option><a-select-option value="REJECTED">REJECTED</a-select-option></a-select><a-button icon="reload" :loading="loading" @click="load" /></div>
    </header>
    <a-alert type="warning" show-icon :message="$t('signalReviews.reviewBoundary')" />
    <section v-if="canEvaluate" class="candidate-runner">
      <div><strong>{{ $route.query.strategyName || `#${$route.query.strategyId}` }}</strong><span>{{ $t('signalReviews.generateHint') }}</span></div>
      <a-input v-model="candidateSymbol" placeholder="000333.SZ" />
      <a-select v-model="candidateTimeframe"><a-select-option value="5m">5m</a-select-option><a-select-option value="30m">30m</a-select-option><a-select-option value="1d">1D</a-select-option></a-select>
      <a-button type="primary" icon="thunderbolt" :loading="evaluating" @click="generateCandidate">{{ $t('signalReviews.generate') }}</a-button>
    </section>
    <a-table row-key="signal_id" :columns="columns" :data-source="signals" :loading="loading" :pagination="{ pageSize: 20 }">
      <template slot="strategy" slot-scope="value, row"><strong>{{ row.strategy_name || `#${row.strategy_id}` }}</strong><small>#{{ row.strategy_id }} · v{{ row.version_no || row.strategy_version_id }}</small></template>
      <template slot="signal" slot-scope="value, row"><strong>{{ row.symbol }} · {{ row.timeframe }}</strong><small>{{ row.action }}</small></template>
      <template slot="status" slot-scope="value"><a-tag :color="statusColor(value)">{{ value }}</a-tag></template>
      <template slot="time" slot-scope="value">{{ formatTime(value) }}</template>
      <template slot="operation" slot-scope="value, row">
        <template v-if="row.status === 'PENDING'">
          <a-tooltip :title="$t('signalReviews.approve')"><a-button type="link" icon="check" @click="decide(row, 'APPROVED')" /></a-tooltip>
          <a-tooltip :title="$t('signalReviews.reject')"><a-button type="link" icon="close" @click="decide(row, 'REJECTED')" /></a-tooltip>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script>
import moment from 'moment'
import { evaluateStrategySignal, getTask, listSignals, reviewSignal } from '@/api/domain'

export default {
  name: 'SignalReviews',
  data () {
    return {
      status: 'PENDING',
      candidateSymbol: '000333.SZ',
      candidateTimeframe: '1d',
      evaluating: false,
      signals: [],
      loading: false,
      columns: [
        { title: this.$t('signalReviews.strategy'), key: 'strategy', scopedSlots: { customRender: 'strategy' }, width: 130 },
        { title: this.$t('signalReviews.signal'), key: 'signal', scopedSlots: { customRender: 'signal' } },
        { title: this.$t('signalReviews.status'), dataIndex: 'status', scopedSlots: { customRender: 'status' }, width: 120 },
        { title: this.$t('signalReviews.time'), dataIndex: 'bar_time', scopedSlots: { customRender: 'time' }, width: 180 },
        { title: '', key: 'operation', scopedSlots: { customRender: 'operation' }, width: 110 }
      ]
    }
  },
  computed: {
    canEvaluate () {
      return this.$route.query.engine === 'czsc' && this.$route.query.strategyId && this.$route.query.strategyVersionId
    }
  },
  mounted () { this.load() },
  methods: {
    async generateCandidate () {
      this.evaluating = true
      try {
        const response = await evaluateStrategySignal(this.$route.query.strategyId, {
          strategy_version_id: Number(this.$route.query.strategyVersionId),
          symbol: this.candidateSymbol.trim().toUpperCase(),
          timeframe: this.candidateTimeframe,
          limit: 1000
        }, `signal-${this.$route.query.strategyVersionId}-${this.candidateSymbol}-${Date.now()}`)
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        const task = await this.waitTask(response.data.task_id)
        const result = task.result && task.result.payload || {}
        if (['open_long', 'close_long'].includes(result.action)) {
          this.$message.success(this.$t('signalReviews.generated'))
          await this.load()
        } else {
          this.$message.info(this.$t('signalReviews.noCandidate'))
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('signalReviews.generateFailed'))
      } finally {
        this.evaluating = false
      }
    },
    async waitTask (taskId) {
      const deadline = Date.now() + 180000
      while (Date.now() < deadline) {
        const response = await getTask(taskId)
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        if (response.data.status === 'SUCCEEDED') return response.data
        if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(response.data.status)) throw new Error(response.data.error_message || response.data.status)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      throw new Error(this.$t('trendChart.taskTimeout'))
    },
    async load () {
      this.loading = true
      try {
        const response = await listSignals({ status: this.status, strategy_id: this.$route.query.strategyId || undefined, limit: 100 })
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        this.signals = response.data || []
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('signalReviews.loadFailed'))
      } finally { this.loading = false }
    },
    decide (row, decision) {
      this.$confirm({
        title: decision === 'APPROVED' ? this.$t('signalReviews.approveConfirm') : this.$t('signalReviews.rejectConfirm'),
        content: `${row.symbol} · ${row.action}`,
        onOk: async () => {
          await reviewSignal(row.signal_id, { decision })
          this.$message.success(this.$t('signalReviews.saved'))
          await this.load()
        }
      })
    },
    statusColor (value) { return value === 'PENDING' ? 'orange' : value === 'APPROVED' ? 'green' : 'red' },
    formatTime (value) { return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-' }
  }
}
</script>

<style scoped>
.review-page { min-height: calc(100vh - 64px); padding: 18px 20px; background: #f5f7fa; }
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
header h1 { margin: 0; font-size: 20px; } header p { margin: 3px 0 0; color: #8c8c8c; font-size: 12px; }
header > div:last-child { display: flex; gap: 8px; } header .ant-select { width: 150px; }
.ant-alert { margin-bottom: 12px; }
.candidate-runner { display: grid; grid-template-columns: minmax(220px, 1fr) 180px 100px auto; align-items: center; gap: 8px; margin-bottom: 12px; padding: 11px 12px; border: 1px solid #e5e7eb; background: #fff; }
.candidate-runner div { display: flex; min-width: 0; flex-direction: column; }.candidate-runner span { color: #8c8c8c; font-size: 11px; }
/deep/ td small { display: block; color: #8c8c8c; font-size: 11px; }
@media (max-width: 760px) { .candidate-runner { grid-template-columns: 1fr; } }
</style>
