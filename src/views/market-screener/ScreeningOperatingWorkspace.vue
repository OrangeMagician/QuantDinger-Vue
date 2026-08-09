<template>
  <section class="operating-workspace">
    <header class="operating-header">
      <a-radio-group :value="mode" button-style="solid" @change="changeMode">
        <a-radio-button value="daily"><a-icon type="schedule" />{{ $t('screenOS.daily') }}</a-radio-button>
        <a-radio-button value="research"><a-icon type="experiment" />{{ $t('screenOS.research') }}</a-radio-button>
        <a-radio-button value="data"><a-icon type="database" />{{ $t('screenOS.data') }}</a-radio-button>
      </a-radio-group>
      <div class="operating-status"><a-tag color="blue">{{ capabilityCount }} {{ $t('screenOS.capabilities') }}</a-tag><a-tooltip :title="$t('screenOS.refresh')"><a-button icon="reload" :loading="loading" @click="loadDashboard" /></a-tooltip></div>
    </header>

    <template v-if="mode === 'daily'">
      <div class="daily-grid">
        <div class="goal-wizard">
          <h3>{{ $t('screenOS.goalWizard') }}</h3>
          <a-select v-model="goal.horizon"><a-select-option value="short">{{ $t('screenOS.shortTerm') }}</a-select-option><a-select-option value="medium">{{ $t('screenOS.mediumTerm') }}</a-select-option><a-select-option value="long">{{ $t('screenOS.longTerm') }}</a-select-option></a-select>
          <a-select v-model="goal.style"><a-select-option value="quality">{{ $t('screenOS.quality') }}</a-select-option><a-select-option value="value">{{ $t('screenOS.value') }}</a-select-option><a-select-option value="momentum">{{ $t('screenOS.momentum') }}</a-select-option><a-select-option value="balanced">{{ $t('screenOS.balanced') }}</a-select-option></a-select>
          <a-select v-model="goal.risk"><a-select-option value="low">{{ $t('screenOS.lowRisk') }}</a-select-option><a-select-option value="medium">{{ $t('screenOS.mediumRisk') }}</a-select-option><a-select-option value="high">{{ $t('screenOS.highRisk') }}</a-select-option></a-select>
          <a-input-number v-model="goal.size" :min="5" :max="100" />
          <a-button type="primary" icon="compass" @click="$emit('apply-goal', goal)">{{ $t('screenOS.applyGoal') }}</a-button>
        </div>
        <div class="inbox-pane">
          <div class="pane-heading"><h3>{{ $t('screenOS.inbox') }}</h3><a-button size="small" icon="sync" :loading="refreshingInbox" @click="refreshInbox">{{ $t('screenOS.refreshInbox') }}</a-button></div>
          <a-empty v-if="!inbox.length" :description="$t('screenOS.emptyInbox')" />
          <a-list v-else :data-source="inbox.slice(0, 6)" size="small"><a-list-item slot="renderItem" slot-scope="item"><a-tag :color="severityColor(item.severity)">{{ item.symbol || item.item_type }}</a-tag><span class="inbox-title">{{ item.title }}</span><a-tooltip :title="$t('screenOS.complete')"><a-button type="link" icon="check" @click="triage(item)" /></a-tooltip></a-list-item></a-list>
        </div>
      </div>
      <div class="rule-canvas">
        <div class="pane-heading"><h3>{{ $t('screenOS.ruleCanvas') }}</h3><a-button icon="funnel-plot" :loading="analyzing" :disabled="!rows.length || !conditions.length" @click="analyzeRules">{{ $t('screenOS.analyzeImpact') }}</a-button></div>
        <div class="rule-track">
          <div v-for="(condition, index) in conditions" :key="condition.key || index" class="rule-node">
            <span>{{ index + 1 }}</span><b>{{ condition.label || condition.catalogKey || condition.factor }}</b><small>{{ condition.operator }} {{ displayValue(condition.value) }}</small>
            <div><a-button type="link" icon="arrow-left" :disabled="index === 0" @click="$emit('move-condition', { from: index, to: index - 1 })" /><a-button type="link" icon="arrow-right" :disabled="index === conditions.length - 1" @click="$emit('move-condition', { from: index, to: index + 1 })" /></div>
          </div>
          <a-empty v-if="!conditions.length" :description="$t('screenOS.buildRulesBelow')" />
        </div>
        <div v-if="funnel.length" class="funnel-strip"><span v-for="item in funnel" :key="item.index"><b>{{ item.after }}</b>{{ $t('screenOS.remaining') }}<small>-{{ item.excluded }}</small></span><a-tag v-if="redundancy.length" color="orange">{{ $t('screenOS.redundant', { count: redundancy.length }) }}</a-tag></div>
      </div>
    </template>

    <template v-else-if="mode === 'research'">
      <div class="research-toolbar">
        <a-select v-model="research.action" @change="resetResearch"><a-select-option value="historical_replay">{{ $t('screenOS.historicalReplay') }}</a-select-option><a-select-option value="walk_forward">{{ $t('screenOS.walkForward') }}</a-select-option><a-select-option value="multiple_testing">{{ $t('screenOS.multipleTesting') }}</a-select-option><a-select-option value="causal_event">{{ $t('screenOS.causalEvent') }}</a-select-option><a-select-option value="scenarios">{{ $t('screenOS.scenarioLab') }}</a-select-option><a-select-option value="factor_lifecycle">{{ $t('screenOS.factorLifecycle') }}</a-select-option></a-select>
        <a-button type="primary" icon="caret-right" :loading="runningResearch" @click="runResearch">{{ $t('screenOS.runResearch') }}</a-button>
      </div>
      <div class="schema-form">
        <label v-if="research.action === 'historical_replay'"><span>{{ $t('screenOS.taskId') }}</span><a-input v-model="research.taskId" /></label>
        <label v-if="research.action === 'walk_forward'"><span>{{ $t('screenOS.trainDays') }}</span><a-input-number v-model="research.train" :min="20" /></label>
        <label v-if="research.action === 'walk_forward'"><span>{{ $t('screenOS.testDays') }}</span><a-input-number v-model="research.test" :min="5" /></label>
        <label v-if="research.action === 'multiple_testing'"><span>{{ $t('screenOS.alpha') }}</span><a-input-number v-model="research.alpha" :min="0.001" :max="0.2" :step="0.01" /></label>
        <label v-if="research.action === 'scenarios'"><span>{{ $t('screenOS.samples') }}</span><a-input-number v-model="research.samples" :min="100" :max="10000" :step="100" /></label>
        <label v-if="research.action === 'factor_lifecycle'"><span>{{ $t('screenOS.factorKey') }}</span><a-input v-model="research.factorKey" /></label>
        <a-alert type="info" show-icon :message="$t(`screenOS.help.${research.action}`)" />
      </div>
      <pre v-if="researchResult" class="structured-result">{{ pretty(researchResult) }}</pre>
    </template>

    <template v-else>
      <a-alert v-if="!isAdmin" type="warning" show-icon :message="$t('screenOS.adminRequired')" />
      <div v-else class="data-grid">
        <div class="data-pane">
          <h3>{{ $t('screenOS.providerRuntime') }}</h3>
          <a-select v-model="provider.provider_key"><a-select-option value="local_parquet">Local Parquet</a-select-option><a-select-option value="akshare">AkShare</a-select-option></a-select>
          <a-select v-model="provider.dataset"><a-select-option value="market_bars">{{ $t('screenOS.marketBars') }}</a-select-option><a-select-option value="financial_statements">{{ $t('screenOS.financialStatements') }}</a-select-option></a-select>
          <a-input v-if="provider.provider_key === 'akshare'" v-model="provider.symbols" :placeholder="$t('screenOS.symbols')" />
          <a-button type="primary" icon="cloud-download" :loading="runningProvider" @click="runProvider">{{ $t('screenOS.runProvider') }}</a-button>
        </div>
        <div class="data-pane">
          <h3>{{ $t('screenOS.dataContract') }}</h3>
          <a-input v-model="contract.dataset" :placeholder="$t('screenOS.dataset')" />
          <a-select v-model="contract.required_fields" mode="tags" :placeholder="$t('screenOS.requiredFields')" />
          <a-button icon="safety-certificate" :loading="savingContract" @click="saveContract">{{ $t('screenOS.saveContract') }}</a-button>
        </div>
        <div class="data-pane lineage-pane">
          <div class="pane-heading"><h3>{{ $t('screenOS.lineage') }}</h3><a-button icon="search" :loading="loadingLineage" @click="loadLineage">{{ $t('screenOS.query') }}</a-button></div>
          <a-input v-model="lineageDataset" :placeholder="$t('screenOS.dataset')" />
          <a-table row-key="id" :columns="lineageColumns" :data-source="lineage" :pagination="{ pageSize: 5 }" size="small" />
        </div>
      </div>
      <pre v-if="providerResult" class="structured-result">{{ pretty(providerResult) }}</pre>
    </template>
  </section>
</template>

<script>
import {
  analyzeScreenRules,
  getScreenDataLineage,
  getScreenOperatingDashboard,
  getScreenWorkspaceDraft,
  runScreenDecisionAction,
  runScreenOperatingResearch,
  runScreenProvider,
  saveScreenDataContract,
  saveScreenWorkspaceDraft
} from '@/api/domain'

export default {
  name: 'ScreeningOperatingWorkspace',
  props: { mode: { type: String, default: 'daily' }, task: { type: Object, default: null }, rows: { type: Array, default: () => [] }, conditions: { type: Array, default: () => [] } },
  data () {
    return {
      loading: false,
dashboard: {},
refreshingInbox: false,
analyzing: false,
funnel: [],
redundancy: [],
      goal: { horizon: 'medium', style: 'balanced', risk: 'medium', size: 20 },
      research: { action: 'historical_replay', taskId: '', train: 60, test: 20, alpha: 0.05, samples: 1000, factorKey: 'decision_score' },
runningResearch: false,
researchResult: null,
      provider: { provider_key: 'local_parquet', dataset: 'market_bars', symbols: '' },
runningProvider: false,
providerResult: null,
      contract: { dataset: 'financial_statements', required_fields: ['symbol', 'period_end', 'available_at'] },
savingContract: false,
      lineageDataset: 'financial_statements',
lineage: [],
loadingLineage: false,
      lineageColumns: [{ title: this.$t('screenOS.record'), dataIndex: 'record_key' }, { title: this.$t('screenOS.field'), dataIndex: 'field_name' }, { title: this.$t('screenOS.provider'), dataIndex: 'provider_key' }, { title: this.$t('screenOS.observedAt'), dataIndex: 'observed_at' }],
      saveTimer: null
    }
  },
  computed: {
    inbox () { return this.dashboard.inbox || [] },
capabilityCount () { return (this.dashboard.capabilities || []).length },
    isAdmin () {
      const info = (this.$store.getters || {}).userInfo || {}
      const roles = Array.isArray(info.role) ? info.role : [info.role]
      return roles.some(role => role === 'admin' || (role || {}).id === 'admin')
    }
  },
  watch: { goal: { deep: true, handler () { this.scheduleDraftSave() } } },
  created () { this.loadDashboard(); this.restoreDraft() },
  beforeDestroy () { if (this.saveTimer) clearTimeout(this.saveTimer) },
  methods: {
    async loadDashboard () { this.loading = true; try { const response = await getScreenOperatingDashboard(); this.dashboard = response.data || {} } catch (error) { this.dashboard = {} } finally { this.loading = false } },
    changeMode (event) { this.$emit('mode-change', event.target.value) },
    severityColor (value) { return value === 'critical' ? 'red' : value === 'warning' ? 'orange' : 'blue' },
    displayValue (value) { return Array.isArray(value) ? value.join(' - ') : String(value == null ? '' : value) },
    pretty (value) { return JSON.stringify(value, null, 2) },
    conditionTree (condition) { return { type: 'condition', field: condition.factor || condition.catalogKey || '', operator: condition.operator || 'eq', value: condition.value } },
    async analyzeRules () { this.analyzing = true; try { const response = await analyzeScreenRules({ rows: this.rows, trees: this.conditions.map(this.conditionTree) }); const data = response.data || {}; this.funnel = data.funnel || []; this.redundancy = data.redundancy || [] } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.analyzing = false } },
    async refreshInbox () { this.refreshingInbox = true; try { const response = await runScreenDecisionAction('inbox_refresh'); this.$set(this.dashboard, 'inbox', (response.data || {}).items || []) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.refreshingInbox = false } },
    async triage (item) { await runScreenDecisionAction('triage', { item_id: item.id, status: 'handled' }); await this.refreshInbox() },
    resetResearch () { this.researchResult = null },
    researchPayload () {
      if (this.research.action === 'historical_replay') return { task_id: this.research.taskId || (this.task || {}).task_id, as_of_date: new Date().toISOString().slice(0, 10) }
      if (this.research.action === 'walk_forward') return { rows: this.rows.map((row, index) => ({ ...row, date: row.bar_time || `2026-01-${String(index + 1).padStart(2, '0')}` })), train: this.research.train, test: this.research.test, purge: 5 }
      if (this.research.action === 'multiple_testing') return { trials: this.rows.map(row => ({ p_value: Math.max(0.001, 1 - Number(row.match_score || 0) / 100), sharpe: Number(row.decision_score || 0) / 25 })), alpha: this.research.alpha }
      if (this.research.action === 'causal_event') return { treated: this.rows.slice(0, Math.ceil(this.rows.length / 2)).map(row => ({ return: row.forward_return || 0 })), controls: this.rows.slice(Math.ceil(this.rows.length / 2)).map(row => ({ return: row.forward_return || 0 })) }
      if (this.research.action === 'scenarios') return { returns: this.rows.map(row => Number(row.forward_return || 0)), samples: this.research.samples, horizon: 20 }
      return { factor_key: this.research.factorKey, values: this.rows.map(row => Number(row.decision_score || 0)), forward_returns: this.rows.map(row => Number(row.forward_return || 0)) }
    },
    async runResearch () { this.runningResearch = true; try { const response = await runScreenOperatingResearch(this.research.action, this.researchPayload()); this.researchResult = response.data || null } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningResearch = false } },
    async runProvider () { this.runningProvider = true; try { const configuration = this.provider.provider_key === 'akshare' ? { symbols: this.provider.symbols.split(/[\s,;]+/).filter(Boolean) } : { root: '/market' }; const response = await runScreenProvider({ dataset: this.provider.dataset, provider_key: this.provider.provider_key, configuration, persist: true }); this.providerResult = response.data || null; await this.loadDashboard() } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.runningProvider = false } },
    async saveContract () { this.savingContract = true; try { await saveScreenDataContract({ ...this.contract, schema: {}, quality_rules: [] }); this.$message.success(this.$t('screenOS.saved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingContract = false } },
    async loadLineage () { this.loadingLineage = true; try { const response = await getScreenDataLineage({ dataset: this.lineageDataset }); this.lineage = response.data || [] } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.loadingLineage = false } },
    scheduleDraftSave () { if (this.saveTimer) clearTimeout(this.saveTimer); this.saveTimer = setTimeout(this.saveDraft, 600) },
    async saveDraft () { const state = { goal: this.goal }; localStorage.setItem('qd-screen-os-draft', JSON.stringify(state)); try { await saveScreenWorkspaceDraft({ workspace_key: 'market-screener', mode: this.mode, state }) } catch (error) {} },
    async restoreDraft () { try { const response = await getScreenWorkspaceDraft('market-screener'); const state = (response.data || {}).state_json || JSON.parse(localStorage.getItem('qd-screen-os-draft') || '{}'); if (state.goal) this.goal = { ...this.goal, ...state.goal } } catch (error) {} }
  }
}
</script>

<style scoped>
.operating-workspace { margin-bottom: 12px; padding: 12px 14px; border: 1px solid #dfe3e8; background: #fff; }
.operating-header, .operating-status, .pane-heading, .research-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.daily-grid, .data-grid { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(0, 1.7fr); gap: 10px; margin-top: 12px; }
.goal-wizard, .inbox-pane, .rule-canvas, .data-pane { padding: 10px; border: 1px solid #e5e7eb; }
.goal-wizard { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 8px; }
.goal-wizard h3, .goal-wizard button { grid-column: 1 / -1; }.goal-wizard .ant-select, .goal-wizard .ant-input-number { width: 100%; }
h3 { margin: 0; color: inherit; font-size: 13px; }.inbox-title { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-canvas { margin-top: 10px; }.rule-track { display: flex; gap: 8px; margin-top: 9px; overflow-x: auto; }
.rule-node { display: grid; flex: 0 0 180px; grid-template-columns: 24px 1fr; padding: 8px; border: 1px solid #d9d9d9; gap: 2px 6px; }
.rule-node > span { display: grid; width: 22px; height: 22px; border-radius: 50%; background: #1677ff; color: #fff; place-items: center; grid-row: 1 / 3; }.rule-node small { color: #6b7280; }.rule-node > div { grid-column: 1 / -1; text-align: right; }
.funnel-strip { display: flex; align-items: center; gap: 1px; margin-top: 8px; overflow-x: auto; }.funnel-strip span { display: flex; min-width: 90px; padding: 7px 10px; background: #f5f7fa; color: #6b7280; font-size: 10px; flex-direction: column; }.funnel-strip b { color: #111827; font-size: 15px; }.funnel-strip small { color: #cf1322; }
.research-toolbar { justify-content: flex-start; margin-top: 12px; }.research-toolbar .ant-select { min-width: 260px; }
.schema-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }.schema-form label { display: grid; gap: 4px; }.schema-form label span { color: #6b7280; font-size: 11px; }.schema-form .ant-input-number { width: 100%; }.schema-form .ant-alert { grid-column: 1 / -1; }
.structured-result { max-height: 360px; margin: 10px 0 0; padding: 10px; overflow: auto; border: 1px solid #e5e7eb; background: #f7f8fa; white-space: pre-wrap; }
.data-grid { grid-template-columns: 1fr 1fr; }.data-pane { display: grid; align-content: start; gap: 8px; }.lineage-pane { grid-column: 1 / -1; }
body.dark .operating-workspace, body.realdark .operating-workspace, .theme-dark .operating-workspace { border-color: #303030; background: #141414; color: rgba(255,255,255,.85); }
body.dark .operating-workspace .goal-wizard, body.dark .operating-workspace .inbox-pane, body.dark .operating-workspace .rule-canvas, body.dark .operating-workspace .data-pane, body.realdark .operating-workspace .goal-wizard, body.realdark .operating-workspace .inbox-pane, body.realdark .operating-workspace .rule-canvas, body.realdark .operating-workspace .data-pane { border-color: #303030; }
@media (max-width: 900px) { .daily-grid, .data-grid, .schema-form { grid-template-columns: 1fr; }.lineage-pane { grid-column: auto; } }
@media (max-width: 560px) { .operating-header { align-items: flex-start; flex-direction: column; }.goal-wizard { grid-template-columns: 1fr; }.goal-wizard h3, .goal-wizard button { grid-column: auto; }.research-toolbar { align-items: stretch; flex-direction: column; }.research-toolbar .ant-select { width: 100%; min-width: 0; } }
</style>
