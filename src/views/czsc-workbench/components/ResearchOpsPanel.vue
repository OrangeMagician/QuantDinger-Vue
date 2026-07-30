<template>
  <section class="research-ops-panel">
    <div class="ops-head">
      <div>
        <h2>{{ $t('czsc.researchOpsTitle') }}</h2>
        <p>{{ $t('czsc.researchOpsDesc') }}</p>
      </div>
      <a-button type="primary" icon="control" :loading="loading" @click="runSuite">
        {{ $t('czsc.runResearchOps') }}
      </a-button>
    </div>

    <div class="ops-config">
      <label class="field symbols-field">
        <span>{{ $t('czsc.scanSymbols') }}</span>
        <a-textarea v-model="symbolsText" :rows="4" :placeholder="$t('czsc.scanPlaceholder')" @change="persistState" />
      </label>
      <section class="ai-config-card">
        <div class="section-heading">
          <h3>{{ $t('czsc.aiEndpointConfig') }}</h3>
          <a-tag :color="aiConfig.api_key_configured ? 'green' : ''">{{ aiConfig.api_key_configured ? $t('czsc.configured') : $t('czsc.notConfigured') }}</a-tag>
        </div>
        <div class="ai-grid">
          <label class="field">
            <span>{{ $t('czsc.aiProvider') }}</span>
            <a-input v-model="aiForm.provider" placeholder="sub2api" />
          </label>
          <label class="field">
            <span>{{ $t('czsc.aiBaseUrl') }}</span>
            <a-input v-model="aiForm.base_url" placeholder="https://api.example.com/v1" />
          </label>
          <label class="field">
            <span>{{ $t('czsc.aiModel') }}</span>
            <a-input v-model="aiForm.model" placeholder="gpt-4.1-mini" />
          </label>
          <label class="field">
            <span>{{ $t('czsc.aiApiKey') }}</span>
            <a-input-password v-model="aiForm.api_key" :placeholder="$t('czsc.leaveBlankKeep')" />
          </label>
        </div>
        <a-button icon="save" :loading="savingAi" @click="saveAiConfig">{{ $t('czsc.saveAiConfig') }}</a-button>
      </section>
      <section class="workflow-card">
        <div class="section-heading">
          <h3>{{ $t('czsc.workflowOrchestration') }}</h3>
          <a-button size="small" icon="save" :loading="savingWorkflow" @click="saveWorkflow">{{ $t('czsc.saveWorkflow') }}</a-button>
        </div>
        <label class="field">
          <span>{{ $t('czsc.workflowName') }}</span>
          <a-input v-model="workflow.name" />
        </label>
        <signal-factor-selector v-model="signalFactorConditions" class="workflow-selector" :logic.sync="workflow.logic" @change="persistState" />
      </section>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.researchOpsFailed')" :description="error" />

    <template v-if="result">
      <div class="ops-summary">
        <div><span>{{ $t('czsc.dataFailCount') }}</span><strong :class="{ negative: dashboardSummary.data_fail_count }">{{ dashboardSummary.data_fail_count }}</strong></div>
        <div><span>{{ $t('czsc.topCandidates') }}</span><strong>{{ dashboardSummary.candidate_count }}</strong></div>
        <div><span>{{ $t('czsc.pendingReview') }}</span><strong class="warning">{{ dashboardSummary.pending_review_count }}</strong></div>
        <div><span>{{ $t('czsc.blockedCount') }}</span><strong class="negative">{{ dashboardSummary.blocked_count }}</strong></div>
      </div>

      <div class="direction-grid">
        <article v-for="direction in directionCards" :key="direction.key" class="direction-card">
          <header>
            <a-icon :type="direction.icon" />
            <div>
              <strong>{{ direction.title }}</strong>
              <span>{{ direction.subtitle }}</span>
            </div>
          </header>
          <dl>
            <div v-for="metric in direction.metrics" :key="metric.label">
              <dt>{{ metric.label }}</dt>
              <dd>{{ metric.value }}</dd>
            </div>
          </dl>
        </article>
      </div>

      <section class="ops-table-region">
        <h3>{{ $t('czsc.dataGovernance') }}</h3>
        <a-table
          row-key="symbol"
          size="small"
          :columns="qualityColumns"
          :data-source="dataQualityRows"
          :pagination="{ pageSize: 10, hideOnSinglePage: true }"
        >
          <template slot="status" slot-scope="value">
            <a-tag :color="value === 'PASS' ? 'green' : value === 'WARN' ? 'orange' : 'red'">{{ value }}</a-tag>
          </template>
          <template slot="issues" slot-scope="value, row">
            <span>{{ (row.issues || []).map(item => item.code).join(', ') || '-' }}</span>
          </template>
        </a-table>
      </section>

      <section class="ops-table-region split">
        <div>
          <h3>{{ $t('czsc.factorExperiment') }}</h3>
          <div v-for="row in factorRows" :key="row.symbol" class="mini-row">
            <strong>{{ row.symbol }}</strong>
            <a-tag :color="Number(row.score) >= 70 ? 'green' : 'blue'">{{ Number(row.score || 0).toFixed(1) }}</a-tag>
            <span>{{ topSignalLabel(row) }}</span>
          </div>
        </div>
        <div>
          <h3>{{ $t('czsc.pretradeValidation') }}</h3>
          <div class="pretrade-box">
            <a-tag :color="pretrade.recommended_state === 'PENDING_REVIEW_READY' ? 'green' : 'red'">
              {{ pretrade.recommended_state || '-' }}
            </a-tag>
            <p v-for="check in (pretrade.checks || [])" :key="check.code">{{ check.code }} · {{ check.message }}</p>
            <p v-if="!(pretrade.checks || []).length">{{ $t('czsc.noRiskCheck') }}</p>
          </div>
        </div>
      </section>
    </template>
    <a-empty v-else :description="$t('czsc.noResearchOpsResult')" />
  </section>
</template>

<script>
import {
  getCzscResearchOpsAiConfig,
  runCzscResearchOpsSuite,
  saveCzscResearchOpsAiConfig,
  saveCzscResearchOpsWorkflow
} from '@/api/czsc'
import SignalFactorSelector from './SignalFactorSelector.vue'

const STORAGE_KEY = 'quantdinger.czsc.research-ops.v1'

export default {
  name: 'CzscResearchOpsPanel',
  components: { SignalFactorSelector },
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true }
  },
  data () {
    return {
      symbolsText: '000333.SZ\n600519.SH\n000001.SZ\n300750.SZ\n301280.SZ',
      workflowFactors: ['recent_return', 'ma_bullish'],
      workflow: { id: 'default_research_ops', name: 'ResearchOps 默认流程', logic: 'and' },
      signalFactorConditions: [
        { source: 'feature', factor: 'recent_return_pct', operator: 'gte', value: -1, label: 'Recent return' },
        { source: 'feature', factor: 'ma_bullish', operator: 'truthy', value: true, label: 'Bullish MA' }
      ],
      aiConfig: {},
      aiForm: { provider: 'sub2api', base_url: '', model: '', api_key: '' },
      result: null,
      loading: false,
      savingAi: false,
      savingWorkflow: false,
      error: '',
      qualityColumns: [
        { title: this.$t('czsc.symbol'), dataIndex: 'symbol', key: 'symbol', width: 120 },
        { title: this.$t('czsc.timeframe'), dataIndex: 'timeframe', key: 'timeframe', width: 90 },
        { title: this.$t('czsc.status'), dataIndex: 'status', key: 'status', scopedSlots: { customRender: 'status' }, width: 100 },
        { title: this.$t('czsc.qualityScore'), dataIndex: 'quality_score', key: 'quality_score', width: 110 },
        { title: this.$t('czsc.barLimit'), dataIndex: 'bar_count', key: 'bar_count', width: 100 },
        { title: this.$t('czsc.riskChecks'), key: 'issues', scopedSlots: { customRender: 'issues' } }
      ]
    }
  },
  computed: {
    dashboardSummary () {
      return (this.result && this.result.ops_dashboard && this.result.ops_dashboard.summary) || {}
    },
    dataQualityRows () {
      return (this.result && this.result.data_governance && this.result.data_governance.rows) || []
    },
    factorRows () {
      return (this.result && this.result.factor_experiment && this.result.factor_experiment.results) || []
    },
    pretrade () {
      return (this.result && this.result.pretrade_validation) || {}
    },
    directionCards () {
      const result = this.result || {}
      return [
        this.card('data_governance', 'database', this.$t('czsc.dataGovernance'), this.$t('czsc.dataGovernanceDesc'), [
          [this.$t('czsc.checked'), result.data_governance && result.data_governance.summary.checked],
          [this.$t('czsc.failed'), result.data_governance && result.data_governance.summary.fail_count]
        ]),
        this.card('signal_knowledge', 'book', this.$t('czsc.signalKnowledge'), this.$t('czsc.signalKnowledgeDesc'), [
          [this.$t('czsc.signalTypes'), result.signal_knowledge && result.signal_knowledge.summary.catalog_count],
          [this.$t('czsc.enhancedSignals'), result.signal_knowledge && result.signal_knowledge.summary.active_signal_count]
        ]),
        this.card('factor_experiment', 'experiment', this.$t('czsc.factorExperiment'), this.$t('czsc.factorExperimentDesc'), [
          [this.$t('czsc.evaluated'), result.factor_experiment && result.factor_experiment.summary.evaluated],
          [this.$t('czsc.bestQualityScore'), result.factor_experiment && result.factor_experiment.summary.top_score]
        ]),
        this.card('strategy_workflow', 'deployment-unit', this.$t('czsc.workflowOrchestration'), this.$t('czsc.workflowDesc'), [
          [this.$t('czsc.nodes'), result.strategy_workflow && result.strategy_workflow.summary.nodes],
          [this.$t('czsc.topCandidates'), result.strategy_workflow && result.strategy_workflow.summary.candidates]
        ]),
        this.card('review_cockpit', 'audit', this.$t('czsc.retraqReviewStates'), this.$t('czsc.reviewCockpitDesc'), [
          [this.$t('czsc.pendingReview'), result.review_cockpit && result.review_cockpit.pending_count],
          [this.$t('czsc.blockedCount'), result.review_cockpit && result.review_cockpit.blocked_count]
        ]),
        this.card('smart_watchlist_v2', 'star', this.$t('czsc.smartWatchlist'), this.$t('czsc.smartWatchlistV2Desc'), [
          [this.$t('czsc.trendEnhanced'), result.smart_watchlist_v2 && result.smart_watchlist_v2.summary.trend_enhanced],
          [this.$t('czsc.riskExclusion'), result.smart_watchlist_v2 && result.smart_watchlist_v2.summary.risk_exclusion]
        ]),
        this.card('external_signal_center', 'api', this.$t('czsc.externalSignalCenter'), this.$t('czsc.externalSignalCenterDesc'), [
          [this.$t('czsc.rawPayload'), result.external_signal_center && result.external_signal_center.summary.payload_count],
          [this.$t('czsc.submitReady'), result.external_signal_center && result.external_signal_center.summary.submit_ready]
        ]),
        this.card('pretrade_validation', 'safety-certificate', this.$t('czsc.pretradeValidation'), this.$t('czsc.pretradeValidationDesc'), [
          [this.$t('czsc.submissionState'), result.pretrade_validation && result.pretrade_validation.recommended_state],
          [this.$t('czsc.riskChecks'), result.pretrade_validation && (result.pretrade_validation.checks || []).length]
        ]),
        this.card('ai_research_assistant', 'robot', this.$t('czsc.aiResearchAssistant'), this.$t('czsc.aiResearchAssistantDesc'), [
          [this.$t('czsc.configured'), result.ai_research_assistant && result.ai_research_assistant.ai_config.api_key_configured ? this.$t('czsc.yes') : this.$t('czsc.no')],
          [this.$t('czsc.aiModel'), result.ai_research_assistant && result.ai_research_assistant.ai_config.model]
        ]),
        this.card('ops_dashboard', 'dashboard', this.$t('czsc.unifiedOpsDashboard'), this.$t('czsc.unifiedOpsDashboardDesc'), [
          [this.$t('czsc.scheduledTasks'), result.ops_dashboard && result.ops_dashboard.scheduled_tasks && result.ops_dashboard.scheduled_tasks.length],
          [this.$t('czsc.pendingReview'), this.dashboardSummary.pending_review_count]
        ])
      ]
    }
  },
  created () {
    this.restoreState()
    this.loadAiConfig()
  },
  methods: {
    restoreState () {
      try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        if (state.symbolsText) this.symbolsText = state.symbolsText
        if (Array.isArray(state.workflowFactors)) this.workflowFactors = state.workflowFactors
        if (Array.isArray(state.signalFactorConditions)) this.signalFactorConditions = state.signalFactorConditions
        else if (Array.isArray(state.workflowFactors)) this.signalFactorConditions = this.legacyWorkflowConditions()
        if (state.workflowLogic) this.workflow.logic = state.workflowLogic
        if (state.result) this.result = state.result
      } catch (error) {}
    },
    persistState () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ symbolsText: this.symbolsText, workflowFactors: this.workflowFactors, signalFactorConditions: this.signalFactorConditions, workflowLogic: this.workflow.logic, result: this.result }))
      } catch (error) {}
    },
    parsedSymbols () {
      return Array.from(new Set(String(this.symbolsText || this.symbol).toUpperCase().split(/[\s,;]+/).map(this.normalizeSymbol).filter(Boolean))).slice(0, 50)
    },
    normalizeSymbol (value) {
      const raw = String(value || '').trim().toUpperCase()
      if (/^[0-9]{6}\.(SH|SZ|BJ)$/.test(raw)) return raw
      const code = raw.replace(/[^0-9]/g, '')
      if (!/^[0-9]{6}$/.test(code)) return ''
      if (/^(600|601|603|605|688|689|900)/.test(code) || code.startsWith('6')) return `${code}.SH`
      if (/^(000|001|002|003|159|200|300|301)/.test(code) || /^[023]/.test(code)) return `${code}.SZ`
      return `${code}.BJ`
    },
    async loadAiConfig () {
      try {
        const response = await getCzscResearchOpsAiConfig()
        this.aiConfig = response && response.data ? response.data : {}
        this.aiForm.provider = this.aiConfig.provider || 'sub2api'
        this.aiForm.base_url = this.aiConfig.base_url || ''
        this.aiForm.model = this.aiConfig.model || ''
      } catch (error) {}
    },
    async saveAiConfig () {
      this.savingAi = true
      try {
        const response = await saveCzscResearchOpsAiConfig({ enabled: true, ...this.aiForm })
        this.aiConfig = response && response.data ? response.data : {}
        this.aiForm.api_key = ''
        this.$message.success(this.$t('czsc.aiConfigSaved'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.aiConfigFailed'))
      } finally {
        this.savingAi = false
      }
    },
    legacyWorkflowConditions () {
      const out = []
      if (this.workflowFactors.includes('recent_return')) out.push({ source: 'feature', factor: 'recent_return_pct', operator: 'gte', value: -1 })
      if (this.workflowFactors.includes('ma_bullish')) out.push({ source: 'feature', factor: 'ma_bullish', operator: 'truthy', value: true })
      if (this.workflowFactors.includes('volume_expand')) out.push({ source: 'feature', factor: 'volume_expand', operator: 'truthy', value: true })
      if (this.workflowFactors.includes('breakout')) out.push({ source: 'feature', factor: 'breakout_high', operator: 'truthy', value: true })
      return out
    },
    workflowConditions () {
      return Array.isArray(this.signalFactorConditions) ? this.signalFactorConditions : this.legacyWorkflowConditions()
    },
    async saveWorkflow () {
      this.savingWorkflow = true
      try {
        await saveCzscResearchOpsWorkflow({
          ...this.workflow,
          conditions: this.workflowConditions(),
          logic: this.workflow.logic || 'and',
          actions: ['watchlist', 'pretrade', 'review']
        })
        this.$message.success(this.$t('czsc.workflowSaved'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.workflowFailed'))
      } finally {
        this.savingWorkflow = false
      }
    },
    async runSuite () {
      const symbols = this.parsedSymbols()
      if (!symbols.length) return
      this.loading = true
      this.error = ''
      try {
        const response = await runCzscResearchOpsSuite({
          symbols,
          timeframe: this.timeframe,
          limit: Math.max(160, Number(this.limit || 1000)),
          workflow: {
            ...this.workflow,
            conditions: this.workflowConditions(),
            logic: this.workflow.logic || 'and',
            actions: ['watchlist', 'pretrade', 'review']
          },
          external_payloads: [
            { source: 'tradingview', ticker: symbols[0].endsWith('.SH') ? `SSE:${symbols[0].slice(0, 6)}` : `SZSE:${symbols[0].slice(0, 6)}`, action: 'buy', timeframe: this.timeframe }
          ]
        })
        if (!response || response.code !== 1 || !response.data) throw new Error((response && response.msg) || this.$t('czsc.researchOpsFailed'))
        this.result = response.data
        this.persistState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.researchOpsFailed')
      } finally {
        this.loading = false
      }
    },
    card (key, icon, title, subtitle, metrics) {
      return {
        key,
        icon,
        title,
        subtitle,
        metrics: metrics.map(([label, value]) => ({ label, value: value === undefined || value === null || value === '' ? '-' : value }))
      }
    },
    topSignalLabel (row) {
      const signal = row && Array.isArray(row.enhanced_signals) ? row.enhanced_signals[0] : null
      return signal ? (signal.signal_type_label || signal.signal_type) : '-'
    }
  }
}
</script>

<style scoped>
.research-ops-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.ops-head, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.ops-head h2, .section-heading h3, .ops-table-region h3 { margin: 0 0 4px; font-size: 15px; }
.ops-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.ops-config { display: grid; grid-template-columns: 300px minmax(0, 1fr) 320px; gap: 14px; margin-bottom: 16px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.ai-config-card, .workflow-card { padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfbfc; }
.ai-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.workflow-selector { margin-top: 10px; }
.ops-summary { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); margin: 14px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.ops-summary > div { display: flex; min-height: 62px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.ops-summary span, .direction-card dt { color: #8c8c8c; font-size: 10px; }
.ops-summary strong { font-size: 17px; }
.warning { color: #d48806; }
.negative { color: #fa541c; }
.direction-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 18px; }
.direction-card { padding: 12px; border: 1px solid #eceef1; border-radius: 8px; background: #fbfbfc; }
.direction-card header { display: flex; gap: 10px; margin-bottom: 10px; }
.direction-card header > .anticon { margin-top: 2px; color: #08979c; font-size: 18px; }
.direction-card strong, .direction-card span { display: block; }
.direction-card span { color: #8c8c8c; font-size: 11px; }
.direction-card dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; }
.direction-card dd { margin: 2px 0 0; font-size: 13px; }
.ops-table-region { margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr); gap: 24px; }
.mini-row { display: grid; grid-template-columns: 120px 80px minmax(0, 1fr); gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid #eceef1; }
.mini-row span { overflow: hidden; color: #8c8c8c; text-overflow: ellipsis; white-space: nowrap; }
.pretrade-box { padding: 12px; border: 1px solid #eceef1; border-radius: 8px; background: #fbfbfc; }
.pretrade-box p { margin: 8px 0 0; color: #595959; font-size: 12px; }
.theme-dark .research-ops-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .ai-config-card, .theme-dark .workflow-card, .theme-dark .direction-card, .theme-dark .pretrade-box { border-color: #30343b; background: #1c2027; }
.theme-dark .ops-summary, .theme-dark .ops-summary > div, .theme-dark .ops-table-region, .theme-dark .mini-row { border-color: #30343b; }
@media (max-width: 1100px) {
  .ops-config { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .ops-head, .section-heading { flex-direction: column; }
  .ops-summary, .split { grid-template-columns: 1fr; }
  .ai-grid { grid-template-columns: 1fr; }
}
</style>
