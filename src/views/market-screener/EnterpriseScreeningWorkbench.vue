<template>
  <section class="enterprise-workbench">
    <header class="workbench-header">
      <div><h2><a-icon type="control" />{{ $t('screenEnterprise.title') }}</h2><span>{{ capabilityCount }} {{ $t('screenEnterprise.capabilities') }}</span></div>
      <div class="workbench-actions">
        <a-tag :color="sloTone">{{ $t('screenEnterprise.slo') }} {{ successRate }}</a-tag>
        <a-tooltip :title="$t('screenEnterprise.refresh')"><a-button icon="reload" :loading="loading" @click="loadDashboard" /></a-tooltip>
      </div>
    </header>

    <a-tabs v-model="activeTab" size="small">
      <a-tab-pane key="data" :tab="$t('screenEnterprise.data')">
        <div class="metric-strip">
          <span v-for="(value, key) in datasets" :key="key"><b>{{ value }}</b>{{ datasetLabel(key) }}</span>
          <span><b>{{ openIssues }}</b>{{ $t('screenEnterprise.openIssues') }}</span>
        </div>
        <div class="split-toolbar">
          <h3>{{ $t('screenEnterprise.providers') }}</h3>
          <a-button icon="plus" @click="providerVisible = true">{{ $t('screenEnterprise.addProvider') }}</a-button>
        </div>
        <a-table row-key="id" :columns="providerColumns" :data-source="dashboard.providers || []" :pagination="false" size="small" />
        <h3>{{ $t('screenEnterprise.ingestionJobs') }}</h3>
        <a-table row-key="job_key" :columns="jobColumns" :data-source="dashboard.ingestion_jobs || []" :pagination="{ pageSize: 5 }" size="small" />
      </a-tab-pane>

      <a-tab-pane key="builder" :tab="$t('screenEnterprise.builder')">
        <div class="builder-grid">
          <div class="tool-pane">
            <h3>{{ $t('screenEnterprise.copilot') }}</h3>
            <a-input-search v-model="copilotQuery" :placeholder="$t('screenEnterprise.copilotPlaceholder')" enter-button :loading="runningCopilot" @search="runCopilot" />
            <a-alert v-if="copilotResult" :type="copilotResult.ready_to_run ? 'success' : 'warning'" show-icon :message="copilotStatus" />
            <div v-if="copilotResult" class="tag-list"><a-tag v-for="(item, index) in copilotResult.explanation || []" :key="index">{{ item }}</a-tag></div>
          </div>
          <div class="tool-pane">
            <h3>{{ $t('screenEnterprise.formulaIde') }}</h3>
            <a-input v-model="formula.factor_key" :placeholder="$t('screenEnterprise.factorKey')" />
            <a-textarea v-model="formula.expression" :rows="3" :placeholder="$t('screenEnterprise.formulaPlaceholder')" />
            <a-input v-model="formulaValues" :placeholder="$t('screenEnterprise.previewValues')" />
            <div class="button-row"><a-button icon="check" :loading="runningFormula" @click="runFormula(false)">{{ $t('screenEnterprise.validate') }}</a-button><a-button type="primary" icon="save" :loading="runningFormula" @click="runFormula(true)">{{ $t('screenEnterprise.saveVersion') }}</a-button></div>
            <a-alert v-if="formulaResult" :type="formulaResult.validation && formulaResult.validation.valid ? 'success' : 'error'" show-icon :message="formulaStatus" />
          </div>
        </div>
        <div class="tool-pane rule-pane">
          <div class="split-toolbar"><h3>{{ $t('screenEnterprise.ruleTree') }}</h3><a-button icon="check-circle" :loading="runningRule" @click="validateRule">{{ $t('screenEnterprise.validate') }}</a-button></div>
          <a-textarea v-model="ruleText" :rows="9" class="code-input" />
          <a-alert v-if="ruleResult" :type="ruleResult.valid ? 'success' : 'error'" show-icon :message="ruleStatus" />
        </div>
      </a-tab-pane>

      <a-tab-pane key="research" :tab="$t('screenEnterprise.research')">
        <div class="action-toolbar">
          <a-select v-model="researchAction"><a-select-option v-for="item in researchActions" :key="item" :value="item">{{ $t(`screenEnterprise.research.${item}`) }}</a-select-option></a-select>
          <a-button type="primary" icon="experiment" :loading="runningResearch" @click="runResearch">{{ $t('screenEnterprise.run') }}</a-button>
          <a-button icon="fund" :disabled="!selectedRows.length" @click="loadSelectedRows">{{ $t('screenEnterprise.useSelection') }}</a-button>
        </div>
        <a-textarea v-model="researchPayload" :rows="11" class="code-input" />
        <pre v-if="researchResult" class="result-json">{{ pretty(researchResult) }}</pre>
      </a-tab-pane>

      <a-tab-pane key="portfolio" :tab="$t('screenEnterprise.portfolio')">
        <div class="action-toolbar">
          <a-select v-model="portfolioAction"><a-select-option v-for="item in portfolioActions" :key="item" :value="item">{{ $t(`screenEnterprise.portfolio.${item}`) }}</a-select-option></a-select>
          <a-button type="primary" icon="pie-chart" :loading="runningPortfolio" @click="runPortfolio">{{ $t('screenEnterprise.run') }}</a-button>
          <a-tag color="orange">{{ $t('screenEnterprise.researchOnly') }}</a-tag>
        </div>
        <a-textarea v-model="portfolioPayload" :rows="11" class="code-input" />
        <pre v-if="portfolioResult" class="result-json">{{ pretty(portfolioResult) }}</pre>
      </a-tab-pane>

      <a-tab-pane key="operations" :tab="$t('screenEnterprise.operations')">
        <div class="operations-grid">
          <div class="tool-pane">
            <h3>{{ $t('screenEnterprise.candidateDossier') }}</h3>
            <a-input-search v-model="candidateSymbol" :placeholder="$t('screenEnterprise.symbol')" enter-button :loading="loadingCandidate" @search="loadCandidate" />
            <div v-if="candidate" class="dossier-summary"><b>{{ candidate.symbol }}</b><a-tag>{{ (candidate.events || []).length }} {{ $t('screenEnterprise.events') }}</a-tag><a-tag>{{ (candidate.financials || []).length }} {{ $t('screenEnterprise.financials') }}</a-tag><a-tag color="orange">{{ (candidate.risk_flags || []).length }} {{ $t('screenEnterprise.risks') }}</a-tag></div>
          </div>
          <div class="tool-pane">
            <h3>{{ $t('screenEnterprise.alertCenter') }}</h3>
            <a-input v-model="alertName" :placeholder="$t('screenEnterprise.alertName')" />
            <a-button type="primary" icon="bell" :loading="savingAlert" @click="saveAlert">{{ $t('screenEnterprise.createAlert') }}</a-button>
            <div class="tag-list"><a-tag v-for="item in dashboard.alerts || []" :key="item.id" :color="item.enabled ? 'green' : 'default'">{{ item.name }}</a-tag></div>
          </div>
          <div class="tool-pane">
            <h3>{{ $t('screenEnterprise.labelWorkbench') }}</h3>
            <a-radio-group v-model="labelValue" button-style="solid"><a-radio-button value="accept">{{ $t('screenIntelligence.feedbackAccepted') }}</a-radio-button><a-radio-button value="watch">{{ $t('screenIntelligence.feedbackWatching') }}</a-radio-button><a-radio-button value="reject">{{ $t('screenIntelligence.feedbackRejected') }}</a-radio-button></a-radio-group>
            <a-button icon="tags" :disabled="!selectedRows.length" :loading="savingLabels" @click="saveLabels">{{ $t('screenEnterprise.labelSelection', { count: selectedRows.length }) }}</a-button>
          </div>
          <div class="tool-pane">
            <h3>{{ $t('screenEnterprise.reports') }}</h3>
            <a-input v-model="reportTitle" :placeholder="$t('screenEnterprise.reportTitle')" />
            <a-button icon="file-pdf" :loading="creatingReport" @click="createReport">{{ $t('screenEnterprise.generateReport') }}</a-button>
            <div class="tag-list"><a-tag v-for="item in dashboard.reports || []" :key="item.id">{{ item.title }}</a-tag></div>
          </div>
          <div class="tool-pane governance-pane">
            <h3>{{ $t('screenEnterprise.governanceActions') }}</h3>
            <a-select v-model="governanceAction" @change="loadGovernanceExample"><a-select-option v-for="item in governanceActions" :key="item" :value="item">{{ $t(`screenEnterprise.action.${item}`) }}</a-select-option></a-select>
            <a-textarea v-model="governancePayload" :rows="6" class="code-input" />
            <a-button type="primary" icon="tool" :loading="runningGovernance" @click="runGovernanceAction">{{ $t('screenEnterprise.run') }}</a-button>
            <pre v-if="governanceResult" class="result-json compact-result">{{ pretty(governanceResult) }}</pre>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>

    <a-modal v-model="providerVisible" :title="$t('screenEnterprise.addProvider')" :confirm-loading="savingProvider" @ok="saveProvider">
      <a-form-model layout="vertical"><a-form-model-item :label="$t('screenEnterprise.dataset')"><a-input v-model="provider.dataset" /></a-form-model-item><a-form-model-item :label="$t('screenEnterprise.providerKey')"><a-input v-model="provider.provider_key" /></a-form-model-item><a-form-model-item :label="$t('screenEnterprise.priority')"><a-input-number v-model="provider.priority" :min="1" :max="1000" /></a-form-model-item></a-form-model>
    </a-modal>
  </section>
</template>

<script>
import {
  approveEnterpriseModel,
  compileEnterpriseCopilot,
  createEnterpriseIngestionJob,
  createEnterpriseReport,
  diffEnterprisePlans,
  getEnterpriseCandidate,
  getEnterpriseObservability,
  getEnterpriseScreeningDashboard,
  manageEnterpriseAlerts,
  manageEnterpriseCollaboration,
  manageEnterpriseLabels,
  manageEnterprisePlugins,
  manageEnterpriseProviders,
  manageEnterpriseViews,
  repairEnterpriseData,
  runEnterpriseFormula,
  runEnterpriseMonitor,
  runEnterprisePortfolio,
  runEnterpriseResearch,
  validateEnterpriseRuleTree,
  visualizeEnterpriseFactors
} from '@/api/domain'

export default {
  name: 'EnterpriseScreeningWorkbench',
  props: {
    task: { type: Object, default: null },
    rows: { type: Array, default: () => [] },
    selectedRows: { type: Array, default: () => [] }
  },
  data () {
    return {
      activeTab: 'data',
loading: false,
dashboard: {},
providerVisible: false,
savingProvider: false,
      provider: { dataset: 'fundamentals', provider_key: '', priority: 100 },
      copilotQuery: '',
runningCopilot: false,
copilotResult: null,
      formula: { factor_key: '', expression: '' },
formulaValues: '{"close": 10, "roe": 0.15}',
runningFormula: false,
formulaResult: null,
      ruleText: JSON.stringify({ type: 'group', operator: 'AND', children: [{ type: 'condition', field: 'decision_score', operator: 'gte', value: 70 }] }, null, 2),
runningRule: false,
ruleResult: null,
      researchAction: 'tear_sheet',
researchPayload: '{"factor":"decision_score","observations":[]}',
runningResearch: false,
researchResult: null,
      portfolioAction: 'backtest',
portfolioPayload: '{"sessions":[],"initial_cash":1000000}',
runningPortfolio: false,
portfolioResult: null,
      candidateSymbol: '',
loadingCandidate: false,
candidate: null,
alertName: '',
savingAlert: false,
      labelValue: 'watch',
savingLabels: false,
reportTitle: '',
creatingReport: false,
      governanceAction: 'observability',
governancePayload: '{}',
runningGovernance: false,
governanceResult: null,
      researchActions: ['labels', 'event_study', 'leakage_audit', 'tear_sheet', 'robustness', 'ranker', 'automl', 'regime'],
      portfolioActions: ['risk_model', 'optimize', 'backtest', 'transition', 'execution', 'crowding', 'hedge'],
      governanceActions: ['observability', 'ingestion_job', 'repair', 'saved_view', 'plan_diff', 'visualize', 'monitor', 'collaboration', 'model_approval', 'plugin'],
      providerColumns: [
        { title: this.$t('screenEnterprise.dataset'), dataIndex: 'dataset' },
        { title: this.$t('screenEnterprise.provider'), dataIndex: 'provider_key' },
        { title: this.$t('screenEnterprise.priority'), dataIndex: 'priority' },
        { title: this.$t('screenIntelligence.status'), dataIndex: 'health_status' },
        { title: this.$t('screenEnterprise.circuit'), dataIndex: 'circuit_state' }
      ],
      jobColumns: [
        { title: this.$t('screenEnterprise.job'), dataIndex: 'job_key', ellipsis: true },
        { title: this.$t('screenEnterprise.dataset'), dataIndex: 'dataset' },
        { title: this.$t('screenIntelligence.status'), dataIndex: 'status' },
        { title: this.$t('screenEnterprise.accepted'), dataIndex: 'accepted_count' },
        { title: this.$t('screenEnterprise.rejected'), dataIndex: 'rejected_count' }
      ]
    }
  },
  computed: {
    datasets () { return this.dashboard.datasets || {} },
    capabilityCount () { return (this.dashboard.capabilities || []).length },
    openIssues () { return Number(((this.dashboard.observability || {}).open_issues) || 0) },
    successRateValue () { return Number(((((this.dashboard.observability || {}).slos) || {}).task_success_rate) || 0) },
    successRate () { return `${(this.successRateValue * 100).toFixed(1)}%` },
    sloTone () { return this.successRateValue >= 0.99 ? 'green' : this.successRateValue >= 0.9 ? 'orange' : 'red' },
    copilotStatus () { if (!this.copilotResult) return ''; return this.copilotResult.ready_to_run ? this.$t('screenEnterprise.readyToApply') : (this.copilotResult.ambiguities || []).map(item => item.question).join(' ') },
    formulaStatus () { const result = this.formulaResult || {}; return result.validation && result.validation.valid ? `${this.$t('screenEnterprise.validFormula')} ${result.preview == null ? '' : result.preview}` : ((result.validation || {}).errors || []).join(', ') },
    ruleStatus () { return this.ruleResult && this.ruleResult.valid ? this.$t('screenEnterprise.validRule', { count: this.ruleResult.nodes }) : ((this.ruleResult || {}).errors || []).map(item => item.error).join(', ') }
  },
  created () { this.loadDashboard() },
  methods: {
    async loadDashboard () { this.loading = true; try { const response = await getEnterpriseScreeningDashboard(); this.dashboard = response.data || {} } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.loading = false } },
    datasetLabel (key) { return this.$t(`screenEnterprise.dataset.${key}`) },
    pretty (value) { return JSON.stringify(value, null, 2) },
    parseJson (value) { try { return JSON.parse(value || '{}') } catch (error) { this.$message.error(this.$t('screenEnterprise.invalidJson')); throw error } },
    async saveProvider () { this.savingProvider = true; try { await manageEnterpriseProviders(this.provider); this.providerVisible = false; await this.loadDashboard(); this.$message.success(this.$t('screenEnterprise.saved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingProvider = false } },
    async runCopilot () { if (!this.copilotQuery.trim()) return; this.runningCopilot = true; try { const response = await compileEnterpriseCopilot(this.copilotQuery); this.copilotResult = response.data || null; if (this.copilotResult && this.copilotResult.condition_tree) this.ruleText = this.pretty(this.copilotResult.condition_tree) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningCopilot = false } },
    async runFormula (save) { this.runningFormula = true; try { const values = this.parseJson(this.formulaValues); const response = await runEnterpriseFormula({ ...this.formula, name: this.formula.factor_key, values, available_fields: Object.keys(values), save }); this.formulaResult = response.data || null; if (save) this.$message.success(this.$t('screenEnterprise.saved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningFormula = false } },
    async validateRule () { this.runningRule = true; try { const response = await validateEnterpriseRuleTree(this.parseJson(this.ruleText)); this.ruleResult = response.data || null } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningRule = false } },
    loadSelectedRows () { const rows = this.selectedRows.map(row => ({ symbol: row.symbol, decision_score: Number(row.decision_score || 0), forward_return: Number(row.forward_return || 0), factors: row.factors || { decision_score: Number(row.decision_score || 0) } })); this.researchPayload = this.pretty({ factor: 'decision_score', observations: rows, rows, factors: ['decision_score'] }) },
    async runResearch () { this.runningResearch = true; try { const response = await runEnterpriseResearch({ action: this.researchAction, ...this.parseJson(this.researchPayload) }); this.researchResult = response.data || null } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningResearch = false } },
    async runPortfolio () { this.runningPortfolio = true; try { const response = await runEnterprisePortfolio({ action: this.portfolioAction, ...this.parseJson(this.portfolioPayload) }); this.portfolioResult = response.data || null } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningPortfolio = false } },
    async loadCandidate () { if (!this.candidateSymbol.trim()) return; this.loadingCandidate = true; try { const response = await getEnterpriseCandidate(this.candidateSymbol); this.candidate = response.data || null } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.loadingCandidate = false } },
    async saveAlert () { if (!this.alertName.trim()) return; this.savingAlert = true; try { await manageEnterpriseAlerts({ name: this.alertName, condition_tree: this.parseJson(this.ruleText), channels: ['browser'], severity: 'info' }); this.alertName = ''; await this.loadDashboard(); this.$message.success(this.$t('screenEnterprise.saved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingAlert = false } },
    async saveLabels () { this.savingLabels = true; try { await manageEnterpriseLabels({ labels: this.selectedRows.map(row => ({ task_id: (this.task || {}).task_id || '', symbol: row.symbol, label: this.labelValue, confidence: 1 })) }); this.$message.success(this.$t('screenEnterprise.saved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingLabels = false } },
    async createReport () { this.creatingReport = true; try { await createEnterpriseReport({ title: this.reportTitle || this.$t('screenEnterprise.defaultReport'), report_type: 'research', sections: [{ title: this.$t('screenEnterprise.selection'), content: this.selectedRows }, { title: this.$t('screenEnterprise.research'), content: this.researchResult }, { title: this.$t('screenEnterprise.portfolio'), content: this.portfolioResult }] }); this.reportTitle = ''; await this.loadDashboard(); this.$message.success(this.$t('screenEnterprise.saved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.creatingReport = false } },
    loadGovernanceExample () {
      const examples = {
        observability: {},
        ingestion_job: { dataset: 'financial_statements', provider_key: 'manual', configuration: { records: [] } },
        repair: { issue_ids: [], action: 'retry', note: '' },
        saved_view: { name: this.$t('screenEnterprise.defaultView'), view_type: 'results', configuration: { columns: ['symbol', 'decision_score'], sort: 'decision_score' } },
        plan_diff: { left: {}, right: {} },
        visualize: { factors: ['decision_score'], rows: this.selectedRows },
        monitor: { previous: [], current: this.rows, condition_tree: this.parseJson(this.ruleText) },
        collaboration: { resource_type: 'screen_plan', resource_key: '', permission: 'comment', comment: '' },
        model_approval: { model_id: 0, decision: 'approve', comment: '', risk_acceptance: {} },
        plugin: { manifest: { key: '', type: 'factor', version: '1.0.0', capabilities: [] } }
      }
      this.governancePayload = this.pretty(examples[this.governanceAction] || {})
    },
    async runGovernanceAction () {
      this.runningGovernance = true
      try {
        const payload = this.parseJson(this.governancePayload)
        let response
        if (this.governanceAction === 'observability') response = await getEnterpriseObservability()
        else if (this.governanceAction === 'ingestion_job') response = await createEnterpriseIngestionJob(payload)
        else if (this.governanceAction === 'repair') response = await repairEnterpriseData(payload)
        else if (this.governanceAction === 'saved_view') response = await manageEnterpriseViews(payload)
        else if (this.governanceAction === 'plan_diff') response = await diffEnterprisePlans(payload)
        else if (this.governanceAction === 'visualize') response = await visualizeEnterpriseFactors(payload)
        else if (this.governanceAction === 'monitor') response = await runEnterpriseMonitor(payload)
        else if (this.governanceAction === 'collaboration') response = await manageEnterpriseCollaboration(payload)
        else if (this.governanceAction === 'model_approval') response = await approveEnterpriseModel(payload.model_id, payload)
        else if (this.governanceAction === 'plugin') response = await manageEnterprisePlugins(payload)
        this.governanceResult = (response || {}).data || null
        await this.loadDashboard()
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningGovernance = false }
    }
  }
}
</script>

<style scoped>
.enterprise-workbench { margin: 0 0 12px; padding: 12px 14px; border: 1px solid #dfe3e8; background: #fff; }
.workbench-header, .workbench-actions, .split-toolbar, .action-toolbar, .button-row, .tag-list, .dossier-summary { display: flex; align-items: center; gap: 8px; }
.workbench-header { justify-content: space-between; }
.workbench-header h2 { margin: 0; font-size: 15px; }
.workbench-header h2 i { margin-right: 6px; }
.workbench-header span { color: #6b7280; font-size: 11px; }
.metric-strip { display: grid; grid-template-columns: repeat(5, minmax(100px, 1fr)); margin-bottom: 12px; border: 1px solid #e5e7eb; }
.metric-strip span { display: flex; padding: 9px 12px; border-right: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; flex-direction: column; }
.metric-strip span:last-child { border-right: 0; }
.metric-strip b { color: #111827; font-size: 16px; }
.split-toolbar { justify-content: space-between; margin: 10px 0 7px; }
.split-toolbar h3, .tool-pane h3, .enterprise-workbench > .ant-tabs h3 { margin: 0; font-size: 13px; }
.builder-grid, .operations-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tool-pane { display: grid; align-content: start; gap: 8px; padding: 10px; border: 1px solid #e5e7eb; }
.rule-pane { margin-top: 10px; }
.code-input, .result-json { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.action-toolbar { margin-bottom: 8px; }
.action-toolbar .ant-select { min-width: 220px; }
.result-json { max-height: 440px; margin-top: 10px; padding: 10px; overflow: auto; border: 1px solid #e5e7eb; background: #f7f8fa; white-space: pre-wrap; }
.tag-list { flex-wrap: wrap; }
.dossier-summary b { font-size: 16px; }
.governance-pane { grid-column: 1 / -1; }
.governance-pane .ant-select { width: min(360px, 100%); }
.compact-result { max-height: 240px; }
body.dark .enterprise-workbench,
body.realdark .enterprise-workbench,
.theme-dark .enterprise-workbench {
  border-color: #303030;
  background: #141414;
  color: rgba(255, 255, 255, 0.85);
}
body.dark .enterprise-workbench .metric-strip,
body.dark .enterprise-workbench .tool-pane,
body.realdark .enterprise-workbench .metric-strip,
body.realdark .enterprise-workbench .tool-pane,
.theme-dark .enterprise-workbench .metric-strip,
.theme-dark .enterprise-workbench .tool-pane {
  border-color: #303030;
}
body.dark .enterprise-workbench .metric-strip span,
body.realdark .enterprise-workbench .metric-strip span,
.theme-dark .enterprise-workbench .metric-strip span {
  border-color: #303030;
  color: rgba(255, 255, 255, 0.45);
}
body.dark .enterprise-workbench .metric-strip b,
body.realdark .enterprise-workbench .metric-strip b,
.theme-dark .enterprise-workbench .metric-strip b {
  color: rgba(255, 255, 255, 0.85);
}
body.dark .enterprise-workbench .workbench-header span,
body.realdark .enterprise-workbench .workbench-header span,
.theme-dark .enterprise-workbench .workbench-header span {
  color: rgba(255, 255, 255, 0.45);
}
body.dark .enterprise-workbench .result-json,
body.realdark .enterprise-workbench .result-json,
.theme-dark .enterprise-workbench .result-json {
  border-color: #303030;
  background: #1f1f1f;
  color: rgba(255, 255, 255, 0.85);
}
@media (max-width: 900px) { .metric-strip { grid-template-columns: repeat(2, 1fr); }.builder-grid, .operations-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .enterprise-workbench { padding: 10px; }.workbench-header, .action-toolbar { align-items: flex-start; flex-direction: column; }.metric-strip { grid-template-columns: 1fr; }.action-toolbar .ant-select { width: 100%; } }
</style>
