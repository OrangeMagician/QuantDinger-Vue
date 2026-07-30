<template>
  <section class="strategy-panel">
    <div class="panel-controls">
      <label class="field template-field">
        <span>{{ $t('czsc.template') }}</span>
        <a-select :value="templateId" @change="changeTemplate">
          <a-select-option v-for="item in templates" :key="item.id" :value="item.id">
            {{ templateName(item) }}
          </a-select-option>
        </a-select>
      </label>
      <a-button type="primary" icon="experiment" :loading="loading" @click="runEvaluation">
        {{ $t('czsc.evaluateSignal') }}
      </a-button>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.evaluateFailed')" :description="error" />

    <div v-if="selectedTemplate" class="template-definition">
      <div>
        <h2>{{ templateName(selectedTemplate) }}</h2>
        <p>{{ templateDescription(selectedTemplate) }}</p>
      </div>
      <dl>
        <div><dt>{{ $t('czsc.templateVersion') }}</dt><dd>{{ selectedTemplate.version }}</dd></div>
        <div><dt>{{ $t('czsc.retraqStrategyId') }}</dt><dd>{{ selectedTemplate.strategy_id }}</dd></div>
        <div><dt>{{ $t('czsc.executionScope') }}</dt><dd>{{ $t('czsc.researchLongOnly') }}</dd></div>
      </dl>
    </div>

    <div class="system-template-library">
      <div class="system-template-head">
        <div>
          <h2>{{ $t('czsc.systemTemplates') }}</h2>
          <p>{{ $t('czsc.systemTemplatesDesc') }}</p>
        </div>
        <a-tag color="blue">{{ systemTemplates.length }}</a-tag>
      </div>
      <div v-if="systemTemplates.length" class="system-template-grid">
        <article v-for="item in systemTemplates" :key="systemTemplateKey(item)" class="system-template-card">
          <span class="system-template-icon"><a-icon :type="item.icon || 'code'" /></span>
          <div class="system-template-copy">
            <strong>{{ item.title || item.key || item.template_key }}</strong>
            <p>{{ item.desc || item.description || $t('czsc.none') }}</p>
            <div v-if="systemTemplateTags(item).length" class="system-template-tags">
              <a-tag v-for="tag in systemTemplateTags(item).slice(0, 4)" :key="systemTemplateKey(item) + '-' + tag">
                {{ tag }}
              </a-tag>
            </div>
          </div>
        </article>
      </div>
      <a-empty v-else :image="simpleEmptyImage" :description="$t('czsc.noSystemTemplates')" />
    </div>

    <div v-if="evaluation" class="evaluation-result">
      <div class="result-status" :class="evaluation.action">
        <span class="status-icon"><a-icon :type="actionIcon(evaluation.action)" /></span>
        <div>
          <span>{{ $t('czsc.currentEvent') }}</span>
          <strong>{{ actionLabel(evaluation.action) }}</strong>
          <small>{{ factorLabel(evaluation) || $t('czsc.noFactorMatched') }}</small>
        </div>
        <a-button
          v-if="evaluation.matched"
          type="primary"
          icon="audit"
          @click="$emit('prepare-review', evaluation)"
        >
          {{ $t('czsc.prepareRetraq') }}
        </a-button>
      </div>

      <div class="research-grid">
        <section class="enhanced-section">
          <h3>{{ $t('czsc.enhancedSignals') }}</h3>
          <div v-if="evaluation.enhanced_signals && evaluation.enhanced_signals.length" class="enhanced-grid">
            <article v-for="signal in evaluation.enhanced_signals.slice(0, 8)" :key="signal.id" class="enhanced-card">
              <div>
                <a-tag :color="signal.direction === 'bullish' ? 'green' : signal.direction === 'bearish' ? 'volcano' : ''">
                  {{ signal.direction_label }}
                </a-tag>
                <strong>{{ signal.signal_type_label || signal.signal_type }}</strong>
              </div>
              <p>{{ signal.explanation }}</p>
              <small>{{ signal.risk_tip }}</small>
            </article>
          </div>
          <a-empty v-else :image="simpleEmptyImage" :description="$t('czsc.none')" />
        </section>

        <section>
          <h3>{{ $t('czsc.signalOutputs') }}</h3>
          <div class="signal-list">
            <div v-for="signal in evaluation.signals" :key="signal.id" class="signal-row">
              <div>
                <strong>{{ signal.function }}</strong>
                <small>{{ signal.key }}</small>
              </div>
              <span>{{ signal.value1 }}</span>
              <span>{{ signal.value2 }}</span>
            </div>
          </div>
        </section>

        <section>
          <h3>{{ $t('czsc.factorEvents') }}</h3>
          <div v-for="(event, action) in evaluation.events" :key="action" class="event-group">
            <div class="event-heading">
              <a-tag :color="event.matched ? (action === 'open_long' ? 'green' : 'volcano') : ''">
                {{ actionLabel(action) }}
              </a-tag>
              <span>{{ event.operate }}</span>
            </div>
            <div v-for="factor in event.factors" :key="factor.czsc_name" class="factor-row">
              <a-icon :type="factor.matched ? 'check-circle' : 'minus-circle'" />
              <span>{{ localizedFactor(factor) }}</span>
              <small>{{ factor.czsc_name }}</small>
            </div>
          </div>
        </section>
      </div>
    </div>

    <a-empty v-else :description="$t('czsc.noEvaluation')" />
  </section>
</template>

<script>
import { evaluateCzsc } from '@/api/czsc'
import { Empty } from 'ant-design-vue'

export default {
  name: 'CzscStrategyPanel',
  props: {
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true },
    templates: { type: Array, default: () => [] },
    systemTemplates: { type: Array, default: () => [] },
    templateId: { type: String, required: true }
  },
  data () {
    return { loading: false, error: '', evaluation: null, simpleEmptyImage: Empty.PRESENTED_IMAGE_SIMPLE }
  },
  computed: {
    selectedTemplate () {
      return this.templates.find(item => item.id === this.templateId) || null
    },
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    }
  },
  methods: {
    changeTemplate (value) {
      this.evaluation = null
      this.$emit('update:templateId', value)
    },
    async runEvaluation () {
      if (this.loading) return
      this.loading = true
      this.error = ''
      try {
        const response = await evaluateCzsc({
          symbol: this.symbol,
          timeframe: this.timeframe,
          limit: this.limit,
          template_id: this.templateId
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.evaluateFailed'))
        }
        this.evaluation = response.data
        this.$emit('evaluated', response.data)
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.evaluateFailed')
      } finally {
        this.loading = false
      }
    },
    templateName (item) {
      return this.isChinese ? item.name_zh : item.name_en
    },
    templateDescription (item) {
      return this.isChinese ? item.description_zh : item.description_en
    },
    systemTemplateKey (item) {
      return String((item && (item.key || item.template_key || item.id)) || '')
    },
    systemTemplateTags (item) {
      return Array.isArray(item && item.tags) ? item.tags : []
    },
    localizedFactor (factor) {
      return this.isChinese ? factor.name_zh : factor.name_en
    },
    factorLabel (evaluation) {
      return this.isChinese ? evaluation.matched_factor_zh : evaluation.matched_factor_en
    },
    actionLabel (action) {
      if (action === 'open_long') return this.$t('czsc.openLong')
      if (action === 'close_long') return this.$t('czsc.closeLong')
      return this.$t('czsc.hold')
    },
    actionIcon (action) {
      if (action === 'open_long') return 'arrow-up'
      if (action === 'close_long') return 'arrow-down'
      return 'pause'
    }
  }
}
</script>

<style scoped>
.strategy-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.panel-controls { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 18px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.template-field { width: min(420px, 100%); }
.template-definition { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; padding: 15px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.template-definition h2 { margin: 0 0 4px; font-size: 16px; letter-spacing: 0; }
.template-definition p { max-width: 720px; margin: 0; color: #595959; font-size: 12px; }
.template-definition dl { display: grid; min-width: 320px; grid-template-columns: repeat(3, minmax(90px, 1fr)); margin: 0; }
.template-definition dl > div { padding: 0 12px; border-left: 1px solid #e5e7eb; }
.template-definition dt { color: #8c8c8c; font-size: 10px; }
.template-definition dd { margin: 4px 0 0; color: #262626; font-size: 12px; font-weight: 600; }
.system-template-library { margin-top: 18px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfbfc; }
.system-template-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.system-template-head h2 { margin: 0 0 4px; font-size: 15px; }
.system-template-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.system-template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; max-height: 320px; overflow: auto; }
.system-template-card { display: flex; gap: 10px; min-width: 0; padding: 12px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; }
.system-template-icon { display: grid; flex: 0 0 30px; width: 30px; height: 30px; place-items: center; border-radius: 6px; color: #08979c; background: #e6fffb; }
.system-template-copy { min-width: 0; }
.system-template-copy strong { display: block; overflow: hidden; color: #262626; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.system-template-copy p { display: -webkit-box; margin: 4px 0 8px; overflow: hidden; color: #595959; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 12px; }
.system-template-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.evaluation-result { margin-top: 18px; }
.result-status { display: flex; align-items: center; gap: 12px; min-height: 70px; padding: 10px 14px; border-left: 3px solid #bfbfbf; background: #fafafa; }
.result-status.open_long { border-color: #08979c; }
.result-status.close_long { border-color: #fa541c; }
.status-icon { display: grid; width: 34px; height: 34px; place-items: center; color: #595959; font-size: 18px; }
.result-status > div { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.result-status span, .result-status small { color: #8c8c8c; font-size: 10px; }
.result-status strong { color: #262626; font-size: 17px; }
.research-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; margin-top: 22px; }
.enhanced-section { grid-column: 1 / -1; }
.enhanced-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.enhanced-card { padding: 10px; border: 1px solid #eceef1; border-radius: 7px; background: #fbfbfc; }
.enhanced-card > div { display: flex; align-items: center; gap: 6px; }
.enhanced-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.enhanced-card p { margin: 6px 0 4px; color: #595959; font-size: 11px; }
.enhanced-card small { color: #8c8c8c; font-size: 10px; }
.research-grid h3 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0; }
.signal-row { display: grid; grid-template-columns: minmax(0, 1fr) 78px 78px; gap: 8px; align-items: center; min-height: 46px; border-bottom: 1px solid #eceef1; font-size: 12px; }
.signal-row > div { min-width: 0; }
.signal-row strong, .signal-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.signal-row small, .factor-row small { color: #8c8c8c; font-size: 10px; }
.event-group { padding: 8px 0 12px; border-bottom: 1px solid #eceef1; }
.event-heading { display: flex; align-items: center; justify-content: space-between; color: #8c8c8c; font-size: 11px; }
.factor-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 3px 6px; align-items: center; padding: 7px 4px; font-size: 12px; }
.factor-row small { grid-column: 2; overflow-wrap: anywhere; }
.theme-dark .strategy-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .field,
.theme-dark .research-grid h3 { color: #c5cad3; }
.theme-dark .template-definition, .theme-dark .template-definition dl > div, .theme-dark .signal-row, .theme-dark .event-group { border-color: #30343b; }
.theme-dark .template-definition h2, .theme-dark .template-definition dd, .theme-dark .result-status strong { color: #f3f4f6; }
.theme-dark .template-definition p { color: #c5cad3; }
.theme-dark .result-status { background: #1c2027; }
.theme-dark .system-template-library, .theme-dark .system-template-card, .theme-dark .enhanced-card { border-color: #30343b; background: #1c2027; }
.theme-dark .system-template-copy strong, .theme-dark .system-template-head h2 { color: #f3f4f6; }
.theme-dark .system-template-copy p, .theme-dark .system-template-head p, .theme-dark .enhanced-card p { color: #c5cad3; }
@media (max-width: 760px) {
  .strategy-panel { padding: 14px 12px 24px; }
  .panel-controls { align-items: stretch; flex-direction: column; }
  .template-field { width: 100%; }
  .template-definition { flex-direction: column; gap: 14px; }
  .template-definition dl { width: 100%; min-width: 0; }
  .research-grid { grid-template-columns: 1fr; gap: 22px; }
  .result-status { align-items: flex-start; flex-wrap: wrap; }
  .result-status .ant-btn { width: 100%; }
}
</style>
