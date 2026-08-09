<template>
  <section class="intelligence-band">
    <div class="pipeline-row">
      <h2><a-icon type="deployment-unit" />{{ $t('screenIntelligence.title') }}</h2>
      <div class="pipeline-steps">
        <span class="is-done"><a-icon type="filter" />{{ $t('screenIntelligence.pipelineScreen') }}</span>
        <span :class="{ 'is-done': task && task.status === 'SUCCEEDED' }"><a-icon type="experiment" />{{ $t('screenIntelligence.pipelineValidate') }}</span>
        <span :class="{ 'is-done': portfolioSaved || proposedHoldings.length }"><a-icon type="pie-chart" />{{ $t('screenIntelligence.pipelinePortfolio') }}</span>
        <span><a-icon type="audit" />{{ $t('screenIntelligence.pipelineReview') }}</span>
        <span><a-icon type="line-chart" />{{ $t('screenIntelligence.pipelineTrack') }}</span>
      </div>
      <a-tag :color="qualityTone">{{ $t('screenIntelligence.qualityScore', { score: qualityScore }) }}</a-tag>
    </div>

    <div class="intelligence-controls">
      <a-input-search
        v-model="naturalQuery"
        :placeholder="$t('screenIntelligence.queryPlaceholder')"
        :loading="compiling"
        enter-button
        @search="compileQuery"
      />
      <label><span>{{ $t('screenIntelligence.industryNeutral') }}</span><a-switch :checked="ranking.neutralize_industry" @change="updateRanking" /></label>
      <label><span>{{ $t('screenIntelligence.portfolioSize') }}</span><a-input-number :value="portfolio.size" :min="1" :max="100" @change="value => updatePortfolio('size', value)" /></label>
      <label><span>{{ $t('screenIntelligence.maxWeight') }}</span><a-input-number :value="portfolio.max_weight" :min="0.01" :max="1" :step="0.01" @change="value => updatePortfolio('max_weight', value)" /></label>
      <label><span>{{ $t('screenIntelligence.maxIndustry') }}</span><a-input-number :value="portfolio.max_industry_weight" :min="0.01" :max="1" :step="0.01" @change="value => updatePortfolio('max_industry_weight', value)" /></label>
      <label><span>{{ $t('screenIntelligence.capital') }}</span><a-input-number :value="portfolio.capital" :min="10000" :max="1000000000" :step="100000" @change="value => updatePortfolio('capital', value)" /></label>
      <label><span>{{ $t('screenIntelligence.participationRate') }}</span><a-input-number :value="portfolio.participation_rate" :min="0.001" :max="0.5" :step="0.01" @change="value => updatePortfolio('participation_rate', value)" /></label>
      <a-button icon="pie-chart" :disabled="!task || task.status !== 'SUCCEEDED'" :loading="savingPortfolio" @click="savePortfolio">{{ $t('screenIntelligence.savePortfolio') }}</a-button>
      <a-popover placement="bottomRight" trigger="click">
        <div slot="content" class="schedule-popover">
          <label><span>{{ $t('screenIntelligence.runTime') }}</span><a-time-picker v-model="scheduleTime" format="HH:mm" value-format="HH:mm" :minute-step="5" /></label>
          <label><span>{{ $t('screenIntelligence.enableSchedule') }}</span><a-switch v-model="scheduleEnabled" /></label>
          <a-button type="primary" block :loading="savingSchedule" @click="saveSchedule">{{ $t('screenIntelligence.schedule') }}</a-button>
        </div>
        <a-button icon="clock-circle" :disabled="!planKey">{{ $t('screenIntelligence.schedule') }}</a-button>
      </a-popover>
    </div>

    <div v-if="intelligence" class="intelligence-summary">
      <span><b>{{ marketRegime }}</b>{{ $t('screenIntelligence.regime') }}</span>
      <span><b>{{ eligibleCount }}</b>{{ $t('screenIntelligence.quality') }}</span>
      <span><b>{{ proposedHoldings.length }}</b>{{ $t('screenIntelligence.portfolio') }}</span>
      <div class="holding-strip"><a-tag v-for="item in proposedHoldings.slice(0, 10)" :key="item.symbol">{{ item.symbol }} {{ percent(item.target_weight) }}</a-tag></div>
    </div>
  </section>
</template>

<script>
import {
  compileScreenQuery,
  createScreenPortfolio,
  getScreenDataQuality,
  saveScreenSchedule
} from '@/api/domain'

export default {
  name: 'ScreeningIntelligencePanel',
  props: {
    task: { type: Object, default: null },
    result: { type: Object, default: null },
    planKey: { type: String, default: '' },
    ranking: { type: Object, required: true },
    portfolio: { type: Object, required: true }
  },
  data () {
    return {
      naturalQuery: '',
      compiling: false,
      savingPortfolio: false,
      savingSchedule: false,
      portfolioSaved: false,
      quality: {},
      scheduleTime: '16:30',
      scheduleEnabled: true
    }
  },
  computed: {
    intelligence () { return this.result && this.result.intelligence },
    proposedHoldings () { return (((this.intelligence || {}).portfolio || {}).holdings) || [] },
    marketRegime () { return (((this.intelligence || {}).market_regime || {}).state) || '-' },
    eligibleCount () { return Number((((this.intelligence || {}).data_quality || {}).eligible) || 0) },
    qualityScore () { return Number(this.quality.quality_score || 0).toFixed(1) },
    qualityTone () { const score = Number(this.quality.quality_score || 0); return score >= 99 ? 'green' : score >= 95 ? 'orange' : 'red' }
  },
  created () { this.loadQuality() },
  methods: {
    async loadQuality () {
      try { const response = await getScreenDataQuality(); this.quality = response.data || {} } catch (error) { this.quality = {} }
    },
    async compileQuery () {
      if (!this.naturalQuery.trim()) return
      this.compiling = true
      try {
        const response = await compileScreenQuery(this.naturalQuery)
        this.$emit('apply-query', response.data)
        this.$message.success(this.$t('screenIntelligence.compileSuccess'))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.compiling = false }
    },
    updateRanking (value) { this.$emit('update-ranking', { ...this.ranking, enabled: true, neutralize_industry: value }) },
    updatePortfolio (key, value) { this.$emit('update-portfolio', { ...this.portfolio, [key]: value }) },
    async savePortfolio () {
      this.savingPortfolio = true
      try {
        await createScreenPortfolio(this.task.task_id, this.portfolio)
        this.portfolioSaved = true
        this.$message.success(this.$t('screenIntelligence.portfolioSaved'))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingPortfolio = false }
    },
    async saveSchedule () {
      if (!this.planKey) return this.$message.warning(this.$t('screenIntelligence.savePlanFirst'))
      this.savingSchedule = true
      try {
        await saveScreenSchedule(this.planKey, { enabled: this.scheduleEnabled, run_time: this.scheduleTime, weekdays: [1, 2, 3, 4, 5], notify_on: ['added', 'failed'], notification_channels: ['browser'] })
        this.$message.success(this.$t('screenIntelligence.scheduleSaved'))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingSchedule = false }
    },
    percent (value) { return `${(Number(value || 0) * 100).toFixed(1)}%` }
  }
}
</script>

<style scoped>
.intelligence-band { margin-bottom: 12px; padding: 12px 14px; border: 1px solid #dfe3e8; background: #fff; }
.pipeline-row, .pipeline-steps, .intelligence-controls, .intelligence-summary { display: flex; align-items: center; gap: 10px; }
.pipeline-row h2 { flex: 0 0 auto; margin: 0; font-size: 14px; }
.pipeline-row h2 i { margin-right: 6px; }
.pipeline-steps { flex: 1; justify-content: center; }
.pipeline-steps span { color: #9ca3af; font-size: 12px; white-space: nowrap; }
.pipeline-steps span::after { margin-left: 10px; color: #d1d5db; content: '›'; }
.pipeline-steps span:last-child::after { content: ''; }
.pipeline-steps .is-done { color: #1677ff; }
.pipeline-steps i { margin-right: 4px; }
.intelligence-controls { display: grid; grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(130px, auto)); margin-top: 10px; }
.intelligence-controls label, .schedule-popover label { display: flex; align-items: center; gap: 7px; color: #4b5563; font-size: 12px; white-space: nowrap; }
.intelligence-summary { margin-top: 10px; padding-top: 9px; border-top: 1px solid #edf0f2; }
.intelligence-summary > span { display: flex; flex-direction: column; min-width: 90px; color: #6b7280; font-size: 11px; }
.intelligence-summary b { color: #111827; font-size: 15px; }
.holding-strip { display: flex; min-width: 0; flex: 1; flex-wrap: wrap; gap: 3px; }
.schedule-popover { display: grid; width: 250px; gap: 12px; }
@media (max-width: 1000px) { .pipeline-row { align-items: flex-start; flex-wrap: wrap; }.pipeline-steps { order: 3; width: 100%; justify-content: flex-start; overflow-x: auto; }.intelligence-controls { grid-template-columns: 1fr 1fr; }.intelligence-controls .ant-input-search { grid-column: 1 / -1; } }
@media (max-width: 560px) { .intelligence-controls { grid-template-columns: 1fr; }.intelligence-controls .ant-input-search { grid-column: auto; }.intelligence-summary { align-items: flex-start; flex-wrap: wrap; } }
</style>
