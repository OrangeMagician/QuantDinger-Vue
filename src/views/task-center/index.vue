<template>
  <div class="task-page" :class="{ 'task-page--dark': isDarkTheme }">
    <header class="task-header">
      <div>
        <h1>{{ $t('taskCenter.title') }}</h1>
        <p>{{ $t('taskCenter.subtitle') }}</p>
      </div>
      <div class="task-actions">
        <a-select v-model="taskType" allow-clear :placeholder="$t('taskCenter.allTypes')" @change="loadTasks">
          <a-select-option v-for="item in taskTypes" :key="item" :value="item">{{ taskTypeLabel(item) }}</a-select-option>
        </a-select>
        <a-select v-model="status" allow-clear :placeholder="$t('taskCenter.allStatuses')" @change="loadTasks">
          <a-select-option v-for="item in statuses" :key="item" :value="item">{{ statusLabel(item) }}</a-select-option>
        </a-select>
        <a-button icon="reload" :loading="loading" @click="loadTasks">{{ $t('taskCenter.refresh') }}</a-button>
      </div>
    </header>

    <section class="task-summary">
      <div><span>{{ $t('taskCenter.total') }}</span><strong>{{ tasks.length }}</strong></div>
      <div><span>{{ $t('taskCenter.active') }}</span><strong>{{ activeCount }}</strong></div>
      <div><span>{{ $t('taskCenter.succeeded') }}</span><strong>{{ succeededCount }}</strong></div>
      <div><span>{{ $t('taskCenter.failed') }}</span><strong>{{ failedCount }}</strong></div>
    </section>

    <a-table
      row-key="task_id"
      :columns="columns"
      :data-source="tasks"
      :loading="loading"
      :pagination="{ pageSize: 20, showSizeChanger: false }"
      size="middle"
      @row="row => ({ on: { click: () => openTask(row) } })"
    >
      <template slot="task" slot-scope="value, row">
        <strong>{{ taskTypeLabel(row.task_type) }}</strong>
        <small>{{ row.task_id }}</small>
      </template>
      <template slot="engine" slot-scope="value">
        <a-tag :color="value === 'czsc' ? 'cyan' : 'blue'">{{ value === 'czsc' ? 'CZSC' : 'Native' }}</a-tag>
      </template>
      <template slot="status" slot-scope="value">
        <a-badge :status="badgeStatus(value)" :text="statusLabel(value)" />
      </template>
      <template slot="created" slot-scope="value">{{ formatTime(value) }}</template>
      <template slot="operation" slot-scope="value, row">
        <a-tooltip v-if="canCancel(row)" :title="$t('taskCenter.cancel')">
          <a-button type="link" icon="stop" @click.stop="cancel(row)" />
        </a-tooltip>
        <a-tooltip v-if="canRetry(row)" :title="$t('taskCenter.retry')">
          <a-button type="link" icon="redo" @click.stop="retry(row)" />
        </a-tooltip>
        <a-tooltip :title="$t('taskCenter.detail')">
          <a-button type="link" icon="eye" @click.stop="openTask(row)" />
        </a-tooltip>
      </template>
    </a-table>

    <a-drawer
      :visible="drawerVisible"
      :title="$t('taskCenter.detail')"
      width="520"
      :destroy-on-close="false"
      @close="drawerVisible = false"
    >
      <template v-if="selectedTask">
        <div class="detail-status">
          <a-badge :status="badgeStatus(selectedTask.status)" :text="statusLabel(selectedTask.status)" />
          <a-tag>{{ selectedTask.engine === 'czsc' ? 'CZSC' : 'Native' }}</a-tag>
        </div>
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item :label="$t('taskCenter.taskId')">{{ selectedTask.task_id }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskCenter.taskType')">{{ taskTypeLabel(selectedTask.task_type) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskCenter.createdAt')">{{ formatTime(selectedTask.created_at) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('taskCenter.strategyVersion')">{{ selectedTask.strategy_version_id || '-' }}</a-descriptions-item>
        </a-descriptions>
        <a-alert
          v-if="selectedTask.error_message"
          class="detail-error"
          type="error"
          show-icon
          :message="selectedTask.error_code || $t('taskCenter.failed')"
          :description="selectedTask.error_message"
        />
        <h3>{{ $t('taskCenter.attempts') }}</h3>
        <div v-for="attempt in selectedTask.attempts || []" :key="attempt.id" class="attempt-row">
          <span>#{{ attempt.attempt_no }} · {{ attempt.adapter_version }}</span>
          <a-badge :status="badgeStatus(attempt.status)" :text="statusLabel(attempt.status)" />
        </div>
        <template v-if="selectedTask.result">
          <h3>{{ $t('taskCenter.provenance') }}</h3>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item :label="$t('taskCenter.dataset')">{{ selectedTask.result.dataset_snapshot.version || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="$t('taskCenter.engineVersion')">{{ selectedTask.result.engine.version || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="$t('taskCenter.adapterVersion')">{{ selectedTask.result.engine.adapter_version || '-' }}</a-descriptions-item>
            <a-descriptions-item :label="$t('taskCenter.inputDigest')"><code>{{ selectedTask.result.input_digest }}</code></a-descriptions-item>
          </a-descriptions>
        </template>
      </template>
    </a-drawer>
  </div>
</template>

<script>
import moment from 'moment'
import { mapState } from 'vuex'
import { cancelTask, getTask, listTasks, retryTask } from '@/api/domain'

export default {
  name: 'TaskCenter',
  data () {
    return {
      tasks: [],
      loading: false,
      status: undefined,
      taskType: this.$route.query.task_type || undefined,
      taskTypes: ['analyze', 'multi_period', 'backtest', 'factor_lab', 'signal_quality', 'signal_factor_screener', 'watchlist_scan', 'evaluate', 'research_ops'],
      statuses: ['QUEUED', 'DISPATCHING', 'RUNNING', 'CANCEL_REQUESTED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
      selectedTask: null,
      drawerVisible: false,
      refreshTimer: null,
      columns: [
        { title: this.$t('taskCenter.task'), key: 'task', scopedSlots: { customRender: 'task' } },
        { title: this.$t('taskCenter.engine'), dataIndex: 'engine', width: 100, scopedSlots: { customRender: 'engine' } },
        { title: this.$t('taskCenter.status'), dataIndex: 'status', width: 150, scopedSlots: { customRender: 'status' } },
        { title: this.$t('taskCenter.createdAt'), dataIndex: 'created_at', width: 180, scopedSlots: { customRender: 'created' } },
        { title: '', key: 'operation', width: 130, scopedSlots: { customRender: 'operation' } }
      ]
    }
  },
  computed: {
    ...mapState({ theme: state => state.app.theme }),
    isDarkTheme () {
      return ['dark', 'realdark'].includes(this.theme)
    },
    activeCount () {
      return this.tasks.filter(item => !['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(item.status)).length
    },
    succeededCount () {
      return this.tasks.filter(item => item.status === 'SUCCEEDED').length
    },
    failedCount () {
      return this.tasks.filter(item => ['FAILED', 'TIMED_OUT'].includes(item.status)).length
    }
  },
  mounted () {
    this.loadTasks()
    this.refreshTimer = setInterval(() => {
      if (this.activeCount) this.loadTasks(false)
    }, 5000)
  },
  beforeDestroy () {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
  },
  methods: {
    async loadTasks (showLoading = true) {
      if (showLoading) this.loading = true
      try {
        const response = await listTasks({ status: this.status, task_type: this.taskType, limit: 100 })
        if (!response || response.code !== 1) throw new Error(response && response.msg || this.$t('taskCenter.loadFailed'))
        this.tasks = response.data || []
        if (this.selectedTask) {
          const current = this.tasks.find(item => item.task_id === this.selectedTask.task_id)
          if (current) this.selectedTask = { ...this.selectedTask, ...current }
        }
      } catch (error) {
        if (showLoading) this.$message.error(error.backendMessage || error.message || this.$t('taskCenter.loadFailed'))
      } finally {
        this.loading = false
      }
    },
    async openTask (row) {
      this.drawerVisible = true
      this.selectedTask = row
      try {
        const response = await getTask(row.task_id)
        if (response && response.code === 1) this.selectedTask = response.data
      } catch (error) {}
    },
    async cancel (row) {
      try {
        await cancelTask(row.task_id)
        this.$message.success(this.$t('taskCenter.cancelRequested'))
        await this.loadTasks(false)
      } catch (error) {
        this.$message.error(error.backendMessage || error.message)
      }
    },
    async retry (row) {
      try {
        await retryTask(row.task_id)
        this.$message.success(this.$t('taskCenter.retryRequested'))
        await this.loadTasks(false)
      } catch (error) {
        this.$message.error(error.backendMessage || error.message)
      }
    },
    canCancel (row) {
      return ['QUEUED', 'DISPATCHING', 'RUNNING'].includes(row.status)
    },
    canRetry (row) {
      return row.task_type !== 'backtest' && ['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(row.status)
    },
    badgeStatus (status) {
      if (status === 'SUCCEEDED') return 'success'
      if (['FAILED', 'TIMED_OUT'].includes(status)) return 'error'
      if (status === 'CANCELLED') return 'default'
      if (status === 'CANCEL_REQUESTED') return 'warning'
      return 'processing'
    },
    statusLabel (status) {
      return this.$t(`taskCenter.statuses.${String(status || '').toLowerCase()}`)
    },
    taskTypeLabel (type) {
      const key = `taskCenter.types.${String(type || '').toLowerCase()}`
      const value = this.$t(key)
      return value === key ? type : value
    },
    formatTime (value) {
      return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-'
    }
  }
}
</script>

<style scoped>
.task-page { min-height: calc(100vh - 64px); padding: 18px 20px; background: #f5f7fa; }
.task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.task-header h1 { margin: 0; font-size: 20px; }
.task-header p { margin: 3px 0 0; color: #8c8c8c; font-size: 12px; }
.task-actions { display: flex; gap: 8px; }
.task-actions .ant-select { width: 180px; }
.task-summary { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 12px; border: 1px solid #e5e7eb; background: #fff; }
.task-summary div { padding: 13px 16px; border-right: 1px solid #e5e7eb; }
.task-summary div:last-child { border-right: 0; }
.task-summary span, .task-summary strong { display: block; }
.task-summary span { color: #8c8c8c; font-size: 11px; }
.task-summary strong { font-size: 20px; }
.task-page /deep/ .ant-table-row { cursor: pointer; }
.task-page /deep/ td small { display: block; color: #8c8c8c; font-size: 10px; }
.detail-status { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.detail-error { margin: 14px 0; }
h3 { margin: 20px 0 8px; font-size: 14px; }
.attempt-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
code { overflow-wrap: anywhere; font-size: 10px; }
.task-page--dark { color: #e5e7eb; background: #111827; }
.task-page--dark .task-summary { border-color: #30363d; background: #171b22; }
.task-page--dark .task-summary div, .task-page--dark .attempt-row { border-color: #30363d; }
@media (max-width: 700px) {
  .task-header { align-items: stretch; flex-direction: column; gap: 10px; }
  .task-summary { grid-template-columns: 1fr 1fr; }
  .task-summary div:nth-child(2) { border-right: 0; }
}
</style>
