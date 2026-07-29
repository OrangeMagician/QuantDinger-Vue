<template>
  <section class="scan-panel">
    <div class="scan-controls">
      <label class="field symbols-field">
        <span>{{ $t('czsc.scanSymbols') }}</span>
        <a-textarea v-model="symbolsText" :rows="4" :placeholder="$t('czsc.scanPlaceholder')" />
      </label>
      <div class="scan-options">
        <label class="field">
          <span>{{ $t('czsc.template') }}</span>
          <a-select :value="templateId" @change="$emit('update:templateId', $event)">
            <a-select-option v-for="item in templates" :key="item.id" :value="item.id">
              {{ templateName(item) }}
            </a-select-option>
          </a-select>
        </label>
        <a-button type="primary" icon="scan" :loading="loading" @click="runScan">
          {{ $t('czsc.runScan') }}
        </a-button>
      </div>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.scanFailed')" :description="error" />

    <div v-if="result" class="scan-summary">
      <div><span>{{ $t('czsc.requested') }}</span><strong>{{ result.summary.requested }}</strong></div>
      <div><span>{{ $t('czsc.evaluated') }}</span><strong>{{ result.summary.evaluated }}</strong></div>
      <div><span>{{ $t('czsc.matched') }}</span><strong>{{ result.summary.matched }}</strong></div>
      <div><span>{{ $t('czsc.failed') }}</span><strong>{{ result.summary.failed }}</strong></div>
    </div>

    <a-table
      v-if="result"
      class="scan-table"
      row-key="symbol"
      size="small"
      :columns="columns"
      :data-source="result.results"
      :pagination="{ pageSize: 20, hideOnSinglePage: true }"
      :scroll="{ x: 760 }"
    >
      <template slot="symbol" slot-scope="value, row">
        <strong>{{ value }}</strong><small>{{ row.name || '' }}</small>
      </template>
      <template slot="action" slot-scope="value">
        <a-tag :color="actionColor(value)">{{ actionLabel(value) }}</a-tag>
      </template>
      <template slot="price" slot-scope="value, row">
        {{ row.bar ? formatPrice(row.bar.close) : '-' }}
      </template>
      <template slot="factor" slot-scope="value, row">
        <span v-if="row.error" class="row-error">{{ row.error }}</span>
        <span v-else>{{ factorLabel(row) || '-' }}</span>
      </template>
      <template slot="operation" slot-scope="value, row">
        <a-tooltip v-if="row.matched" :title="$t('czsc.prepareRetraq')">
          <a-button size="small" icon="audit" :aria-label="$t('czsc.prepareRetraq')" @click="prepare(row)" />
        </a-tooltip>
      </template>
    </a-table>

    <a-empty v-else :description="$t('czsc.noScanResult')" />
  </section>
</template>

<script>
import { scanCzsc } from '@/api/czsc'

export default {
  name: 'CzscScanPanel',
  props: {
    timeframe: { type: String, required: true },
    limit: { type: Number, required: true },
    templates: { type: Array, default: () => [] },
    templateId: { type: String, required: true }
  },
  data () {
    return {
      symbolsText: '000333.SZ\n600519.SH\n000001.SZ',
      loading: false,
      error: '',
      result: null,
      columns: [
        { title: this.$t('czsc.symbol'), dataIndex: 'symbol', key: 'symbol', scopedSlots: { customRender: 'symbol' }, width: 150 },
        { title: this.$t('czsc.currentEvent'), dataIndex: 'action', key: 'action', scopedSlots: { customRender: 'action' }, width: 110 },
        { title: this.$t('czsc.referencePrice'), key: 'price', scopedSlots: { customRender: 'price' }, width: 105 },
        { title: this.$t('czsc.matchedFactor'), key: 'factor', scopedSlots: { customRender: 'factor' } },
        { title: '', key: 'operation', scopedSlots: { customRender: 'operation' }, width: 54 }
      ]
    }
  },
  computed: {
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    }
  },
  methods: {
    parsedSymbols () {
      return Array.from(new Set(String(this.symbolsText || '').toUpperCase().split(/[\s,;]+/).filter(Boolean)))
    },
    async runScan () {
      const symbols = this.parsedSymbols()
      if (!symbols.length || symbols.length > 50) {
        this.error = this.$t('czsc.scanSymbolLimit')
        return
      }
      this.loading = true
      this.error = ''
      try {
        const response = await scanCzsc({
          symbols,
          timeframe: this.timeframe,
          limit: this.limit,
          template_id: this.templateId
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.scanFailed'))
        }
        this.result = response.data
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.scanFailed')
      } finally {
        this.loading = false
      }
    },
    prepare (row) {
      this.$emit('prepare-review', {
        symbol: row.symbol,
        name: row.name,
        timeframe: this.timeframe,
        template_id: this.templateId,
        template: this.templates.find(item => item.id === this.templateId),
        bar: row.bar,
        action: row.action,
        matched: row.matched,
        matched_factor_zh: row.matched_factor_zh,
        matched_factor_en: row.matched_factor_en
      })
    },
    templateName (item) {
      return this.isChinese ? item.name_zh : item.name_en
    },
    factorLabel (row) {
      return this.isChinese ? row.matched_factor_zh : row.matched_factor_en
    },
    actionLabel (action) {
      if (action === 'open_long') return this.$t('czsc.openLong')
      if (action === 'close_long') return this.$t('czsc.closeLong')
      if (action === 'error') return this.$t('czsc.failed')
      return this.$t('czsc.hold')
    },
    actionColor (action) {
      if (action === 'open_long') return 'green'
      if (action === 'close_long') return 'volcano'
      if (action === 'error') return 'red'
      return ''
    },
    formatPrice (value) {
      return Number(value).toFixed(2)
    }
  }
}
</script>

<style scoped>
.scan-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.scan-controls { display: grid; grid-template-columns: minmax(320px, 1fr) 320px; gap: 22px; align-items: end; padding-bottom: 18px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.scan-options { display: flex; flex-direction: column; gap: 12px; }
.scan-summary { display: grid; grid-template-columns: repeat(4, minmax(90px, 1fr)); margin: 18px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.scan-summary > div { display: flex; min-height: 62px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.scan-summary span { color: #8c8c8c; font-size: 10px; }
.scan-summary strong { font-size: 19px; }
.scan-table strong, .scan-table small { display: block; }
.scan-table small { color: #8c8c8c; font-size: 10px; }
.row-error { color: #cf1322; font-size: 11px; }
.theme-dark .scan-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .field { color: #c5cad3; }
.theme-dark .scan-summary, .theme-dark .scan-summary > div { border-color: #30343b; }
@media (max-width: 760px) {
  .scan-panel { padding: 14px 12px 24px; }
  .scan-controls { grid-template-columns: 1fr; }
  .scan-summary { grid-template-columns: repeat(2, 1fr); }
}
</style>
