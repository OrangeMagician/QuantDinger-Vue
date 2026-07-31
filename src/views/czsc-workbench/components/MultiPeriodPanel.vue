<template>
  <section class="research-panel multi-period-panel">
    <div class="panel-head">
      <div>
        <h2>{{ $t('czsc.multiPeriodCenter') }}</h2>
        <p>{{ $t('czsc.multiPeriodDesc') }}</p>
      </div>
      <div class="panel-actions">
        <a-checkbox-group v-model="selectedTimeframes" :options="timeframeOptions" @change="persistState" />
        <a-button type="primary" icon="branches" :loading="loading" @click="runAnalysis">
          {{ $t('czsc.runMultiPeriod') }}
        </a-button>
      </div>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="$t('czsc.multiPeriodFailed')" :description="error" />

    <template v-if="result">
      <div class="metric-grid">
        <div><span>{{ $t('czsc.direction') }}</span><strong>{{ directionLabel(result.summary.direction) }}</strong></div>
        <div><span>{{ $t('czsc.resonanceLevel') }}</span><strong>{{ resonanceLabel(result.summary.resonance_level) }}</strong></div>
        <div><span>{{ $t('czsc.bullishPeriods') }}</span><strong class="positive">{{ result.summary.bullish_periods }}</strong></div>
        <div><span>{{ $t('czsc.bearishPeriods') }}</span><strong class="negative">{{ result.summary.bearish_periods }}</strong></div>
        <div><span>{{ $t('czsc.confidence') }}</span><strong>{{ percent(result.resonance_signal.confidence) }}</strong></div>
      </div>

      <section class="signal-callout">
        <div>
          <a-tag :color="['bullish', 'bearish'].includes(result.resonance_signal.direction) ? $marketColor(result.resonance_signal.direction) : 'blue'">
            {{ directionLabel(result.resonance_signal.direction) }}
          </a-tag>
          <strong>{{ $t('czsc.multiPeriodSignal') }}</strong>
          <p>{{ result.resonance_signal.explanation }}</p>
          <small>{{ result.resonance_signal.risk_tip }}</small>
        </div>
        <a-button icon="audit" :disabled="!reviewable" @click="prepareReview">
          {{ $t('czsc.prepareRetraq') }}
        </a-button>
      </section>

      <div class="period-grid">
        <article v-for="row in result.signal_tree" :key="row.timeframe" class="period-card">
          <header>
            <strong>{{ row.timeframe }}</strong>
            <a-tag :color="['up', 'bullish', 'down', 'bearish'].includes(row.direction) ? $marketColor(row.direction) : ''">
              {{ directionLabel(row.direction) }}
            </a-tag>
          </header>
          <dl>
            <div><dt>{{ $t('czsc.score') }}</dt><dd>{{ Number(row.score || 0).toFixed(1) }}</dd></div>
            <div><dt>MACD</dt><dd>{{ row.features && row.features.macd_cross }}</dd></div>
            <div><dt>VOL</dt><dd>{{ volumeRatio(row.features) }}</dd></div>
            <div><dt>MA</dt><dd>{{ row.features && row.features.ma_state }}</dd></div>
          </dl>
          <div class="signal-list">
            <span v-for="signal in (row.signals || []).slice(0, 4)" :key="signal.id">
              {{ signal.signal_type_label || signal.signal_type }}
            </span>
          </div>
        </article>
      </div>
    </template>
    <a-empty v-else :description="$t('czsc.noMultiPeriodResult')" />
  </section>
</template>

<script>
import { analyzeCzscMultiPeriod } from '@/api/czsc'

const STORAGE_KEY = 'quantdinger.czsc.multi-period.v1'

export default {
  name: 'CzscMultiPeriodPanel',
  props: {
    symbol: { type: String, required: true },
    limit: { type: Number, required: true }
  },
  data () {
    return {
      selectedTimeframes: ['1d', '30m', '5m'],
      timeframeOptions: [
        { label: '1D', value: '1d' },
        { label: '30m', value: '30m' },
        { label: '5m', value: '5m' },
        { label: '1m', value: '1m' }
      ],
      loading: false,
      error: '',
      result: null
    }
  },
  computed: {
    reviewable () {
      const signal = this.result && this.result.resonance_signal
      return Boolean(signal && signal.trigger_bar && ['bullish', 'bearish'].includes(signal.direction))
    }
  },
  created () {
    this.restoreState()
  },
  methods: {
    restoreState () {
      try {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        if (Array.isArray(state.selectedTimeframes) && state.selectedTimeframes.length >= 2) this.selectedTimeframes = state.selectedTimeframes
        if (state.result) this.result = state.result
      } catch (error) {}
    },
    persistState () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedTimeframes: this.selectedTimeframes, result: this.result }))
      } catch (error) {}
    },
    async runAnalysis () {
      if (!this.selectedTimeframes || this.selectedTimeframes.length < 2) {
        this.error = this.$t('czsc.multiPeriodNeedTwo')
        return
      }
      this.loading = true
      this.error = ''
      try {
        const response = await analyzeCzscMultiPeriod({
          symbol: this.symbol,
          timeframes: this.selectedTimeframes,
          limit: this.limit
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.multiPeriodFailed'))
        }
        this.result = response.data
        this.persistState()
      } catch (error) {
        this.error = error.backendMessage || error.message || this.$t('czsc.multiPeriodFailed')
      } finally {
        this.loading = false
      }
    },
    prepareReview () {
      if (!this.reviewable) return
      const signal = this.result.resonance_signal
      this.$emit('prepare-review', {
        symbol: this.result.symbol,
        name: this.result.name,
        timeframe: signal.timeframes[0] || '1d',
        template_id: 'multi_period_resonance',
        bar: signal.trigger_bar,
        action: signal.direction === 'bullish' ? 'open_long' : 'close_long',
        matched: true,
        matched_factor_zh: this.$t('czsc.multiPeriodSignal'),
        matched_factor_en: 'multi_period_resonance',
        external_source: 'czsc_multi_period',
        raw_payload: signal
      })
    },
    directionLabel (direction) {
      if (['bullish', 'up'].includes(direction)) return this.$t('czsc.up')
      if (['bearish', 'down'].includes(direction)) return this.$t('czsc.down')
      return this.$t('czsc.none')
    },
    resonanceLabel (level) {
      return this.$t(`czsc.resonance.${level || 'weak'}`)
    },
    percent (value) {
      const number = Number(value)
      return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : '-'
    },
    volumeRatio (features) {
      const number = Number(features && features.volume_ratio)
      return Number.isFinite(number) ? `${number.toFixed(2)}x` : '-'
    }
  }
}
</script>

<style scoped>
.research-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
.panel-head h2 { margin: 0 0 4px; font-size: 15px; }
.panel-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.panel-actions { display: flex; align-items: center; gap: 12px; }
.metric-grid { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); margin: 14px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.metric-grid > div { display: flex; min-height: 62px; flex-direction: column; justify-content: center; padding: 8px 14px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.metric-grid span, .period-card dt, .signal-callout small { color: #8c8c8c; font-size: 10px; }
.metric-grid strong { font-size: 17px; }
.positive { color: var(--market-rise-color); }
.negative { color: var(--market-fall-color); }
.signal-callout { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; padding: 14px; border: 1px solid #d9f7be; border-radius: 8px; background: #fcfff7; }
.signal-callout strong { margin-left: 6px; }
.signal-callout p { margin: 8px 0 4px; color: #434343; font-size: 12px; }
.period-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.period-card { padding: 13px; border: 1px solid #eceef1; border-radius: 8px; background: #fbfbfc; }
.period-card header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.period-card dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 10px; }
.period-card dd { margin: 2px 0 0; font-size: 12px; }
.signal-list { display: flex; flex-wrap: wrap; gap: 6px; }
.signal-list span { padding: 2px 6px; border-radius: 4px; color: #08979c; font-size: 10px; background: #e6fffb; }
.theme-dark .research-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .period-card { border-color: #30343b; background: #1c2027; }
.theme-dark .metric-grid, .theme-dark .metric-grid > div, .theme-dark .signal-callout { border-color: #30343b; }
.theme-dark .signal-callout { background: #1c2027; }
@media (max-width: 760px) {
  .panel-head, .panel-actions, .signal-callout { flex-direction: column; align-items: stretch; }
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
