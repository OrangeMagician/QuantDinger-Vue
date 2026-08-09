<template>
  <a-drawer :visible="visible" :title="$t('screenIntelligence.decisionCenter')" width="min(920px, 96vw)" @close="$emit('close')">
    <div class="center-toolbar">
      <a-button icon="reload" :loading="loading" @click="loadAll">{{ $t('marketScreener.refresh') }}</a-button>
      <a-button icon="notification" :disabled="!taskId" :loading="summarizing" @click="createSummary">{{ $t('screenIntelligence.dailySummary') }}</a-button>
      <a-tag :color="governanceTone">{{ $t('screenIntelligence.governanceStatus', { count: openIssues }) }}</a-tag>
    </div>
    <a-spin :spinning="loading">
      <a-tabs v-model="activeTab" size="small">
        <a-tab-pane key="overview" :tab="$t('screenIntelligence.overview')">
          <div class="metric-grid">
            <div><b>{{ center.plans.length }}</b><span>{{ $t('screenIntelligence.plans') }}</span></div>
            <div><b>{{ center.runs.length }}</b><span>{{ $t('screenIntelligence.runs') }}</span></div>
            <div><b>{{ center.portfolios.length }}</b><span>{{ $t('screenIntelligence.savedPortfolios') }}</span></div>
            <div><b>{{ center.experiments.length }}</b><span>{{ $t('screenIntelligence.experiments') }}</span></div>
          </div>
          <h3>{{ $t('screenIntelligence.recentRuns') }}</h3>
          <div class="compare-row">
            <a-select v-model="leftTask" :placeholder="$t('screenIntelligence.leftRun')"><a-select-option v-for="run in center.runs" :key="`l-${run.task_id}`" :value="run.task_id">{{ runLabel(run) }}</a-select-option></a-select>
            <a-select v-model="rightTask" :placeholder="$t('screenIntelligence.rightRun')"><a-select-option v-for="run in center.runs" :key="`r-${run.task_id}`" :value="run.task_id">{{ runLabel(run) }}</a-select-option></a-select>
            <a-button icon="swap" :disabled="!leftTask || !rightTask || leftTask === rightTask" @click="compareRuns">{{ $t('screenIntelligence.compare') }}</a-button>
          </div>
          <a-alert v-if="comparison" type="info" show-icon :message="$t('screenIntelligence.compareResult', { added: comparison.added.length, removed: comparison.removed.length, common: comparison.unchanged.length })" />
          <a-table row-key="task_id" :columns="runColumns" :data-source="center.runs" :pagination="{ pageSize: 8 }" size="small" />
        </a-tab-pane>

        <a-tab-pane key="plans" :tab="$t('screenIntelligence.plans')">
          <a-table row-key="plan_key" :columns="planColumns" :data-source="library" :pagination="{ pageSize: 8 }" size="small">
            <template slot="planAction" slot-scope="value, row"><a-button type="link" icon="history" @click="loadVersions(row)">{{ $t('screenIntelligence.versions') }}</a-button></template>
          </a-table>
          <a-drawer :visible="versionsVisible" :title="$t('screenIntelligence.versions')" width="440" @close="versionsVisible = false">
            <a-timeline><a-timeline-item v-for="item in versions" :key="item.version_no"><b>v{{ item.version_no }}</b> {{ item.change_note || '-' }}<small>{{ formatDate(item.created_at) }}</small></a-timeline-item></a-timeline>
          </a-drawer>
        </a-tab-pane>

        <a-tab-pane key="data" :tab="$t('screenIntelligence.dataFoundation')">
          <a-button class="tab-action" icon="cloud-sync" :loading="syncingFundamentals" @click="syncFundamentals">{{ $t('screenIntelligence.syncFundamentals') }}</a-button>
          <div class="coverage-grid">
            <div v-for="(value, key) in governance.coverage" :key="key"><span>{{ coverageLabel(key) }}</span><b>{{ Number(value.symbols || 0).toLocaleString() }}</b><small>{{ $t('screenIntelligence.symbolCoverage') }}</small></div>
          </div>
          <a-alert :type="openIssues ? 'warning' : 'success'" show-icon :message="$t(openIssues ? 'screenIntelligence.openDataIssues' : 'screenIntelligence.noDataIssues', { count: openIssues })" />
          <a-table row-key="issue_code" :columns="issueColumns" :data-source="governance.issues" :pagination="false" size="small" />
        </a-tab-pane>

        <a-tab-pane key="experiments" :tab="$t('screenIntelligence.experiments')">
          <a-button class="tab-action" type="primary" icon="experiment" :disabled="center.plans.length < 2" @click="experimentVisible = true">{{ $t('screenIntelligence.newExperiment') }}</a-button>
          <a-list :data-source="center.experiments" bordered>
            <a-list-item slot="renderItem" slot-scope="item"><a-list-item-meta :title="item.name" :description="`${item.champion_plan_key} / ${item.challenger_plan_key}`" /><a-tag>{{ item.status }}</a-tag><a-button type="link" @click="loadExperiment(item)">{{ $t('screenIntelligence.report') }}</a-button></a-list-item>
          </a-list>
          <a-alert
            v-if="experimentReport"
            class="result-alert"
            :type="experimentReport.comparison.promotion_eligible ? 'success' : 'info'"
            show-icon
            :message="$t('screenIntelligence.experimentResult', { runs: experimentReport.runs.length, excess: percent(experimentReport.comparison.excess_return) })"
            :description="$t('screenIntelligence.manualPromotion')" />
        </a-tab-pane>

        <a-tab-pane key="feedback" :tab="$t('screenIntelligence.personalization')">
          <a-alert :type="personalization.ready ? 'success' : 'info'" show-icon :message="$t(personalization.ready ? 'screenIntelligence.preferenceReady' : 'screenIntelligence.preferenceNeedsSamples', { samples: personalization.samples || 0, needed: personalization.needed || 0 })" />
          <div v-if="personalization.ready" class="weight-list"><a-tag v-for="(value, key) in personalization.weights" :key="key">{{ key }} {{ Number(value).toFixed(3) }}</a-tag></div>
          <h3>{{ $t('screenIntelligence.alerts') }}</h3>
          <a-list :data-source="center.alerts" size="small" bordered><a-list-item slot="renderItem" slot-scope="item"><a-tag :color="item.alert_type === 'removed' ? 'red' : 'green'">{{ item.alert_type }}</a-tag><b>{{ item.symbol || item.title }}</b><small>{{ formatDate(item.created_at) }}</small></a-list-item></a-list>
        </a-tab-pane>

        <a-tab-pane key="production" :tab="$t('screenIntelligence.productionPlatform')">
          <div class="production-head">
            <a-alert
              :type="advanced.readiness.ready ? 'success' : 'warning'"
              show-icon
              :message="$t(advanced.readiness.ready ? 'screenIntelligence.productionReady' : 'screenIntelligence.productionBlocked')"
              :description="readinessDescription" />
            <a-button icon="database" :loading="bootstrapping" @click="bootstrapPlatform">{{ $t('screenIntelligence.bootstrapData') }}</a-button>
          </div>
          <div class="coverage-grid">
            <div v-for="(item, key) in advanced.readiness.coverage" :key="`advanced-${key}`">
              <span>{{ coverageLabel(key) }}</span><b>{{ percent(item.ratio) }}</b><small>{{ Number(item.symbols || 0).toLocaleString() }} / {{ Number(item.expected || 0).toLocaleString() }}</small>
            </div>
          </div>
          <h3>{{ $t('screenIntelligence.productionCapabilities') }}</h3>
          <div class="capability-list"><a-tag v-for="item in advanced.capabilities" :key="item" color="blue">{{ capabilityLabel(item) }}</a-tag></div>
          <h3>{{ $t('screenIntelligence.modelDrift') }}</h3>
          <a-table row-key="id" :columns="driftColumns" :data-source="advanced.drift" :pagination="{ pageSize: 6 }" size="small" />
          <h3>{{ $t('screenIntelligence.activeLearning') }}</h3>
          <a-list :data-source="advanced.active_learning" size="small" bordered>
            <a-list-item slot="renderItem" slot-scope="item"><b>{{ item.symbol }}</b><a-tag color="orange">{{ Number(item.priority || 0).toFixed(3) }}</a-tag><small>{{ String(item.task_id || '').slice(-8) }}</small></a-list-item>
          </a-list>
        </a-tab-pane>
      </a-tabs>
    </a-spin>

    <a-modal v-model="experimentVisible" :title="$t('screenIntelligence.newExperiment')" :confirm-loading="creatingExperiment" @ok="createExperiment">
      <a-input v-model="experiment.name" :placeholder="$t('screenIntelligence.experimentName')" />
      <a-select v-model="experiment.champion_plan_key" :placeholder="$t('screenIntelligence.champion')"><a-select-option v-for="plan in center.plans" :key="`c-${plan.plan_key}`" :value="plan.plan_key">{{ plan.name }}</a-select-option></a-select>
      <a-select v-model="experiment.challenger_plan_key" :placeholder="$t('screenIntelligence.challenger')"><a-select-option v-for="plan in center.plans" :key="`h-${plan.plan_key}`" :value="plan.plan_key">{{ plan.name }}</a-select-option></a-select>
      <a-input-number v-model="experiment.minimum_runs" :min="2" :max="100" />
      <a-alert type="info" show-icon :message="$t('screenIntelligence.shadowOnly')" />
    </a-modal>
  </a-drawer>
</template>

<script>
import {
  bootstrapAdvancedScreening,
  compareScreens,
  createScreenDailySummary,
  createScreenExperiment,
  getScreenDataGovernance,
  getScreenDecisionCenter,
  getScreenExperiment,
  getScreenFeedbackAnalytics,
  getScreenPersonalization,
  getAdvancedScreeningDashboard,
  listScreenPlanLibrary,
  listScreenPlanVersions,
  syncScreenFundamentals
} from '@/api/domain'

export default {
  name: 'DecisionCenterDrawer',
  props: { visible: Boolean, taskId: { type: String, default: '' } },
  data () {
    return {
      loading: false,
summarizing: false,
      creatingExperiment: false,
      syncingFundamentals: false,
      bootstrapping: false,
activeTab: 'overview',
      center: { plans: [], schedules: [], portfolios: [], accounts: [], experiments: [], alerts: [], runs: [] },
      governance: { coverage: {}, issues: [] },
personalization: {},
advanced: { readiness: { ready: false, blockers: [], coverage: {} }, capabilities: [], models: [], drift: [], attributions: [], active_learning: [] },
feedback: {},
library: [],
      leftTask: '',
rightTask: '',
comparison: null,
versions: [],
versionsVisible: false,
      experimentVisible: false,
experimentReport: null,
      experiment: { name: '', champion_plan_key: '', challenger_plan_key: '', minimum_runs: 10 },
      runColumns: [
        { title: this.$t('screenIntelligence.runId'), dataIndex: 'task_id', ellipsis: true },
        { title: this.$t('screenIntelligence.status'), dataIndex: 'status', width: 110 },
        { title: this.$t('screenIntelligence.created'), dataIndex: 'created_at', width: 170, customRender: value => this.formatDate(value) }
      ],
      planColumns: [
        { title: this.$t('screenIntelligence.plan'), dataIndex: 'name' },
        { title: this.$t('screenIntelligence.version'), dataIndex: 'current_version', width: 80 },
        { title: this.$t('screenIntelligence.access'), dataIndex: 'access', width: 90 },
        { title: '', key: 'action', width: 100, scopedSlots: { customRender: 'planAction' } }
      ],
      issueColumns: [
        { title: this.$t('screenIntelligence.dataset'), dataIndex: 'dataset' },
        { title: this.$t('screenIntelligence.issue'), dataIndex: 'issue_code' },
        { title: this.$t('screenIntelligence.severity'), dataIndex: 'severity' },
        { title: this.$t('screenIntelligence.count'), dataIndex: 'count' }
      ],
      driftColumns: [
        { title: this.$t('screenIntelligence.model'), dataIndex: 'model_key' },
        { title: this.$t('screenIntelligence.metric'), dataIndex: 'metric_key' },
        { title: this.$t('screenIntelligence.value'), dataIndex: 'value', customRender: value => Number(value || 0).toFixed(3) },
        { title: this.$t('screenIntelligence.status'), dataIndex: 'status' }
      ]
    }
  },
  watch: { visible (value) { if (value) this.loadAll() } },
  methods: {
    async loadAll () {
      this.loading = true
      try {
        const [center, governance, personalization, feedback, library, advanced] = await Promise.all([getScreenDecisionCenter(), getScreenDataGovernance(), getScreenPersonalization(), getScreenFeedbackAnalytics(), listScreenPlanLibrary(), getAdvancedScreeningDashboard()])
        this.center = center.data || this.center; this.governance = governance.data || this.governance
        this.personalization = personalization.data || {}; this.feedback = feedback.data || {}; this.library = library.data || []
        this.advanced = advanced.data || this.advanced
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.loading = false }
    },
    async compareRuns () { try { const response = await compareScreens({ left_task_id: this.leftTask, right_task_id: this.rightTask }); this.comparison = response.data } catch (error) { this.$message.error(error.backendMessage || error.message) } },
    async loadVersions (plan) { try { const response = await listScreenPlanVersions(plan.plan_key); this.versions = response.data || []; this.versionsVisible = true } catch (error) { this.$message.error(error.backendMessage || error.message) } },
    async createSummary () { this.summarizing = true; try { const response = await createScreenDailySummary(this.taskId); this.$message.success(this.$t('screenIntelligence.summaryCreated', { added: response.data.added.length, removed: response.data.removed.length })); await this.loadAll() } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.summarizing = false } },
    async syncFundamentals () { this.syncingFundamentals = true; try { await syncScreenFundamentals({ chunk_size: 50 }); this.$message.success(this.$t('screenIntelligence.fundamentalSyncQueued')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.syncingFundamentals = false } },
    async bootstrapPlatform () { this.bootstrapping = true; try { await bootstrapAdvancedScreening(); this.$message.success(this.$t('screenIntelligence.bootstrapQueued')); await this.loadAll() } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.bootstrapping = false } },
    async createExperiment () { this.creatingExperiment = true; try { await createScreenExperiment(this.experiment); this.experimentVisible = false; await this.loadAll() } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.creatingExperiment = false } },
    async loadExperiment (item) { try { const response = await getScreenExperiment(item.id); this.experimentReport = response.data } catch (error) { this.$message.error(error.backendMessage || error.message) } },
    runLabel (run) { return `${String(run.task_id).slice(-8)} · ${run.status}` },
    coverageLabel (key) { return this.$t(`screenIntelligence.coverage.${key}`) },
    capabilityLabel (key) { const value = `screenIntelligence.capability.${key}`; return this.$te(value) ? this.$t(value) : key.replace(/_/g, ' ') },
    formatDate (value) { return value ? new Date(value).toLocaleString() : '-' },
    percent (value) { return `${(Number(value || 0) * 100).toFixed(2)}%` }
  },
  computed: {
    openIssues () { return (this.governance.issues || []).reduce((sum, item) => sum + Number(item.count || 0), 0) },
    governanceTone () { return this.openIssues ? 'orange' : 'green' },
    readinessDescription () { const blockers = (this.advanced.readiness && this.advanced.readiness.blockers) || []; return blockers.length ? this.$t('screenIntelligence.readinessBlockers', { blockers: blockers.join(', ') }) : this.$t('screenIntelligence.readinessPassed') }
  }
}
</script>

<style scoped>
.center-toolbar, .compare-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.center-toolbar .ant-tag { margin-left: auto; }
.metric-grid, .coverage-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-bottom: 16px; background: #e5e7eb; border: 1px solid #e5e7eb; }
.metric-grid > div, .coverage-grid > div { display: flex; min-width: 0; padding: 12px; background: #fff; flex-direction: column; }
.metric-grid b, .coverage-grid b { font-size: 20px; color: #111827; }
.metric-grid span, .coverage-grid span, .coverage-grid small { color: #6b7280; }
.compare-row .ant-select { min-width: 210px; }
h3 { margin: 14px 0 8px; font-size: 13px; }
.tab-action { margin-bottom: 10px; }
.result-alert, .weight-list { margin-top: 12px; }
.production-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 10px; margin-bottom: 12px; }
.capability-list { display: flex; flex-wrap: wrap; gap: 6px; }
.ant-timeline small, .ant-list-item small { display: block; margin-left: auto; color: #9ca3af; }
.ant-modal .ant-select, .ant-modal .ant-input, .ant-modal .ant-input-number, .ant-modal .ant-alert { width: 100%; margin-bottom: 10px; }
@media (max-width: 720px) { .metric-grid, .coverage-grid { grid-template-columns: 1fr 1fr; }.compare-row { align-items: stretch; flex-direction: column; }.compare-row .ant-select { width: 100%; }.center-toolbar { flex-wrap: wrap; } }
</style>
