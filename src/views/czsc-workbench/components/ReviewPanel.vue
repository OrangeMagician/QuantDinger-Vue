<template>
  <section class="review-panel">
    <a-alert
      class="review-boundary"
      type="warning"
      show-icon
      :message="$t('czsc.manualReviewOnly')"
      :description="$t('czsc.noBrokerOrder')"
    />

    <div class="review-grid">
      <section class="candidate-region">
        <div class="section-heading">
          <h2>{{ $t('czsc.retraqReview') }}</h2>
          <a-tag v-if="submission" :color="submission.status === 'PENDING' ? 'gold' : 'red'">
            {{ submission.status }}
          </a-tag>
        </div>

        <template v-if="candidate">
          <dl class="candidate-details">
            <div><dt>{{ $t('czsc.symbol') }}</dt><dd>{{ formatSymbolLabel(candidate) }}</dd></div>
            <div><dt>{{ $t('czsc.timeframe') }}</dt><dd>{{ candidate.timeframe }}</dd></div>
            <div><dt>{{ $t('czsc.template') }}</dt><dd>{{ candidateTemplateName }}</dd></div>
            <div><dt>{{ $t('czsc.retraqStrategyId') }}</dt><dd>{{ candidateStrategyId }}</dd></div>
            <div><dt>{{ $t('czsc.currentEvent') }}</dt><dd><a-tag :color="$marketColor(candidate.action)">{{ actionLabel(candidate.action) }}</a-tag></dd></div>
            <div><dt>{{ $t('czsc.matchedFactor') }}</dt><dd>{{ candidateFactor }}</dd></div>
            <div><dt>{{ $t('czsc.barTime') }}</dt><dd>{{ candidate.bar.datetime }}</dd></div>
            <div><dt>{{ $t('czsc.referencePrice') }}</dt><dd>{{ Number(candidate.bar.close).toFixed(2) }}</dd></div>
          </dl>

          <div class="submit-controls">
            <label class="field">
              <span>{{ $t('czsc.reviewQuantity') }}</span>
              <a-input-number v-model="quantity" :min="1" :max="100000000" :step="100" />
            </label>
            <a-button type="primary" icon="send" :loading="submitting" @click="confirmSubmit">
              {{ $t('czsc.submitForReview') }}
            </a-button>
          </div>
        </template>
        <a-empty v-else :description="$t('czsc.noReviewCandidate')" />

        <div v-if="submission" class="submission-result">
          <dl>
            <div><dt>{{ $t('czsc.submissionState') }}</dt><dd>{{ submission.status }}</dd></div>
            <div><dt>{{ $t('czsc.signalId') }}</dt><dd>{{ submission.signal_id }}</dd></div>
            <div><dt>{{ $t('czsc.created') }}</dt><dd>{{ submission.created ? $t('czsc.yes') : $t('czsc.idempotent') }}</dd></div>
          </dl>
          <a-button class="status-refresh" size="small" icon="sync" :loading="refreshingStatus" @click="refreshSubmissionStatus">
            {{ $t('czsc.refreshReviewStatus') }}
          </a-button>
          <div v-if="submission.risk_checks && submission.risk_checks.length" class="risk-checks">
            <h3>{{ $t('czsc.riskChecks') }}</h3>
            <div v-for="item in submission.risk_checks" :key="item.code" class="risk-row">
              <a-icon type="stop" />
              <div><strong>{{ item.code }}</strong><span>{{ item.message }}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="tradingview-region">
        <div class="section-heading">
          <h2>{{ $t('czsc.tradingViewAdapter') }}</h2>
          <a-tag>{{ $t('czsc.normalizeOnly') }}</a-tag>
        </div>
        <label class="field">
          <span>{{ $t('czsc.webhookJson') }}</span>
          <a-textarea v-model="tradingViewJson" class="json-input" :rows="11" />
        </label>
        <a-button icon="code" :loading="normalizing" @click="normalizeTradingView">
          {{ $t('czsc.normalizeSignal') }}
        </a-button>

        <a-alert v-if="tradingViewError" class="adapter-error" type="error" show-icon :message="tradingViewError" />

        <div v-if="normalized" class="normalized-result">
          <dl>
            <div><dt>{{ $t('czsc.rawPayload') }}</dt><dd><code>{{ compactJson(normalized.raw_payload) }}</code></dd></div>
            <div><dt>{{ $t('czsc.symbol') }}</dt><dd>{{ formatSymbolLabel(normalized) }}</dd></div>
            <div><dt>{{ $t('czsc.timeframe') }}</dt><dd>{{ normalized.timeframe }}</dd></div>
            <div><dt>{{ $t('czsc.currentEvent') }}</dt><dd>{{ actionLabel(normalized.action) }}</dd></div>
            <div><dt>{{ $t('czsc.reviewQuantity') }}</dt><dd>{{ normalized.quantity }}</dd></div>
            <div><dt>{{ $t('czsc.submitReady') }}</dt><dd>{{ normalized.submit_ready ? $t('czsc.yes') : $t('czsc.no') }}</dd></div>
          </dl>
          <div v-if="normalized.risk_checks && normalized.risk_checks.length" class="risk-checks">
            <h3>{{ $t('czsc.riskChecks') }}</h3>
            <div v-for="item in normalized.risk_checks" :key="item.code" class="risk-row">
              <a-icon type="warning" />
              <div><strong>{{ item.code }}</strong><span>{{ item.message }}</span></div>
            </div>
          </div>
          <a-button type="primary" icon="experiment" @click="$emit('import-context', normalized)">
            {{ $t('czsc.evaluateImportedContext') }}
          </a-button>
          <a-button icon="audit" :loading="submittingExternal" @click="submitNormalizedExternal">
            {{ $t('czsc.submitExternalReview') }}
          </a-button>
        </div>
      </section>
    </div>
  </section>
</template>

<script>
import { getRetraqSignalStatus, normalizeTradingViewSignal, submitCzscToRetraq, submitExternalSignalToRetraq } from '@/api/czsc'
import { formatCzscSymbolLabel } from '@/utils/czscSymbols'

export default {
  name: 'CzscReviewPanel',
  props: {
    candidate: { type: Object, default: null },
    templates: { type: Array, default: () => [] }
  },
  data () {
    return {
      quantity: 100,
      submitting: false,
      submittingExternal: false,
      refreshingStatus: false,
      submission: null,
      tradingViewJson: JSON.stringify({
        ticker: 'SZSE:000333',
        action: 'buy',
        price: 85.8,
        timeframe: '30',
        quantity: 100,
        template_id: 'classic_bs_v1'
      }, null, 2),
      normalizing: false,
      normalized: null,
      tradingViewError: ''
    }
  },
  computed: {
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    },
    candidateTemplate () {
      if (!this.candidate) return null
      return this.candidate.template || this.templates.find(item => item.id === this.candidate.template_id) || null
    },
    candidateTemplateName () {
      if (!this.candidateTemplate) return '-'
      return this.isChinese ? this.candidateTemplate.name_zh : this.candidateTemplate.name_en
    },
    candidateStrategyId () {
      return this.candidateTemplate ? this.candidateTemplate.strategy_id : '-'
    },
    candidateFactor () {
      if (!this.candidate) return '-'
      return (this.isChinese ? this.candidate.matched_factor_zh : this.candidate.matched_factor_en) || '-'
    }
  },
  watch: {
    candidate () {
      this.submission = null
      this.quantity = 100
    }
  },
  methods: {
    actionLabel (action) {
      return action === 'open_long' ? this.$t('czsc.openLong') : this.$t('czsc.closeLong')
    },
    confirmSubmit () {
      if (!this.candidate || this.submitting) return
      this.$confirm({
        title: this.$t('czsc.confirmReviewSubmit'),
        content: `${this.formatSymbolLabel(this.candidate)} · ${this.actionLabel(this.candidate.action)} · ${this.quantity}`,
        okText: this.$t('czsc.confirmSubmit'),
        cancelText: this.$t('czsc.cancel'),
        onOk: () => this.submit()
      })
    },
    async submit () {
      this.submitting = true
      try {
        const response = this.candidate.external_source
          ? await submitExternalSignalToRetraq({
            source: this.candidate.external_source,
            raw_payload: this.candidate.raw_payload || {},
            normalized: {
              symbol: this.candidate.symbol,
              timeframe: this.candidate.timeframe,
              bar_time: this.candidate.bar.datetime,
              action: this.candidate.action,
              reference_price: Number(this.candidate.bar.close),
              quantity: Number(this.quantity),
              reason: this.candidateFactor
            }
          })
          : await submitCzscToRetraq({
            symbol: this.candidate.symbol,
            timeframe: this.candidate.timeframe,
            template_id: this.candidateTemplate.id || this.candidate.template_id,
            bar_time: this.candidate.bar.datetime,
            action: this.candidate.action,
            quantity: Number(this.quantity)
          })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.submitFailed'))
        }
        this.submission = response.data
        this.$message.success(this.$t(response.data.status === 'PENDING' ? 'czsc.submittedPending' : 'czsc.submittedBlocked'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.submitFailed'))
        throw error
      } finally {
        this.submitting = false
      }
    },
    async normalizeTradingView () {
      this.normalizing = true
      this.tradingViewError = ''
      try {
        const parsed = JSON.parse(this.tradingViewJson)
        const response = await normalizeTradingViewSignal(parsed)
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.normalizeFailed'))
        }
        this.normalized = response.data
      } catch (error) {
        this.normalized = null
        this.tradingViewError = error.backendMessage || error.message || this.$t('czsc.normalizeFailed')
      } finally {
        this.normalizing = false
      }
    },
    async submitNormalizedExternal () {
      if (!this.normalized || this.submittingExternal) return
      this.submittingExternal = true
      try {
        const response = await submitExternalSignalToRetraq({
          source: 'tradingview',
          raw_payload: this.normalized.raw_payload
        })
        if (!response || response.code !== 1 || !response.data) {
          throw new Error((response && response.msg) || this.$t('czsc.submitFailed'))
        }
        this.submission = response.data
        this.$message.success(this.$t(response.data.status === 'PENDING' ? 'czsc.submittedPending' : 'czsc.submittedBlocked'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.submitFailed'))
      } finally {
        this.submittingExternal = false
      }
    },
    async refreshSubmissionStatus () {
      if (!this.submission || !this.submission.signal_id || this.refreshingStatus) return
      this.refreshingStatus = true
      try {
        const response = await getRetraqSignalStatus({ signal_id: this.submission.signal_id })
        if (!response || response.code !== 1 || !response.data || !response.data.signal) {
          throw new Error((response && response.msg) || this.$t('czsc.statusRefreshFailed'))
        }
        this.submission = {
          ...this.submission,
          status: response.data.signal.status,
          signal: response.data.signal,
          risk_checks: response.data.risk_checks || response.data.signal.risk_checks || []
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('czsc.statusRefreshFailed'))
      } finally {
        this.refreshingStatus = false
      }
    },
    compactJson (value) {
      try {
        return JSON.stringify(value || {})
      } catch (error) {
        return '{}'
      }
    },
    formatSymbolLabel (item) {
      return formatCzscSymbolLabel(item)
    }
  }
}
</script>

<style scoped>
.review-panel { min-height: 620px; padding: 18px 20px 32px; background: #fff; }
.review-boundary { margin-bottom: 18px; }
.review-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr); gap: 32px; }
.candidate-region { padding-right: 32px; border-right: 1px solid #e5e7eb; }
.section-heading { display: flex; min-height: 32px; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.section-heading h2 { margin: 0; font-size: 14px; letter-spacing: 0; }
.candidate-details, .normalized-result dl, .submission-result dl { margin: 0; border-top: 1px solid #e5e7eb; }
.candidate-details > div, .normalized-result dl > div, .submission-result dl > div { display: grid; grid-template-columns: 145px minmax(0, 1fr); gap: 12px; min-height: 39px; align-items: center; border-bottom: 1px solid #eceef1; }
.candidate-details dt, .normalized-result dt, .submission-result dt { color: #8c8c8c; font-size: 11px; }
.candidate-details dd, .normalized-result dd, .submission-result dd { min-width: 0; margin: 0; overflow-wrap: anywhere; text-align: right; font-size: 12px; }
.submit-controls { display: flex; align-items: flex-end; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.field { display: flex; flex-direction: column; gap: 5px; color: #595959; font-size: 11px; }
.field .ant-input-number { width: 150px; }
.json-input { margin-bottom: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.adapter-error { margin-top: 12px; }
.normalized-result, .submission-result { margin-top: 18px; padding-top: 14px; border-top: 1px solid #d9dce1; }
.normalized-result .ant-btn { width: 100%; margin-top: 12px; }
.status-refresh { margin-top: 10px; }
.normalized-result code { display: block; max-height: 54px; overflow: auto; color: #595959; text-align: left; white-space: normal; word-break: break-all; }
.risk-checks { margin-top: 16px; }
.risk-checks h3 { margin: 0 0 8px; font-size: 12px; }
.risk-row { display: grid; grid-template-columns: 18px 1fr; gap: 6px; padding: 8px; color: #cf1322; background: #fff1f0; }
.risk-row strong, .risk-row span { display: block; font-size: 11px; }
.theme-dark .review-panel { color: #e5e7eb; background: #171a20; }
.theme-dark .field,
.theme-dark .section-heading h2,
.theme-dark .risk-checks h3 { color: #c5cad3; }
.theme-dark .candidate-region, .theme-dark .candidate-details, .theme-dark .candidate-details > div, .theme-dark .normalized-result, .theme-dark .normalized-result dl, .theme-dark .normalized-result dl > div, .theme-dark .submission-result, .theme-dark .submission-result dl, .theme-dark .submission-result dl > div { border-color: #30343b; }
.theme-dark .risk-row { background: #2b1d1d; }
@media (max-width: 860px) {
  .review-grid { grid-template-columns: 1fr; }
  .candidate-region { padding-right: 0; padding-bottom: 24px; border-right: 0; border-bottom: 1px solid #e5e7eb; }
}
@media (max-width: 560px) {
  .review-panel { padding: 14px 12px 24px; }
  .candidate-details > div, .normalized-result dl > div, .submission-result dl > div { grid-template-columns: 110px minmax(0, 1fr); }
  .submit-controls { align-items: stretch; flex-direction: column; }
  .field .ant-input-number, .submit-controls .ant-btn { width: 100%; }
}
</style>
