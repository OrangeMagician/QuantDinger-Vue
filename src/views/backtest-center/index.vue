<template>
  <div class="backtest-page" :class="{ 'theme-dark': isDarkTheme }" data-testid="backtest-center">
    <section class="hero-card">
      <div>
        <div class="eyebrow">{{ $t('strategyV2.apiBadge') }}</div>
        <h1>{{ $t('backtest-center.title') }}</h1>
        <p>{{ $t('strategyV2.manifestHint') }}</p>
      </div>
      <div class="hero-actions">
        <a-radio-group v-model="mode" button-style="solid" data-testid="research-mode-switch">
          <a-radio-button value="portfolio">{{ $t('strategyV2.backtest.mode.portfolio') }}</a-radio-button>
          <a-radio-button value="factor">{{ $t('strategyV2.backtest.mode.factor') }}</a-radio-button>
        </a-radio-group>
        <span class="hero-stat"><strong>{{ availableSources.length }}</strong>{{ mode === 'factor' ? $t('strategyV2.factorResearch.eligibleSources') : $t('strategyV2.backtest.sources') }}</span>
        <span class="hero-stat"><strong>{{ history.length }}</strong>{{ mode === 'factor' ? $t('strategyV2.factorResearch.runs') : $t('strategyV2.backtest.runs') }}</span>
        <a-button icon="reload" :loading="historyLoading" @click="refreshPage">
          {{ $t('backtest-center.refreshHistory') }}
        </a-button>
        <a-button icon="history" @click="historyVisible = true">
          {{ mode === 'factor' ? $t('strategyV2.factorResearch.historyTitle') : $t('strategyV2.backtest.historyTitle') }}
        </a-button>
      </div>
    </section>

    <div class="workspace-grid">
      <section class="panel config-panel">
        <div class="config-scroll">
          <div class="panel-heading">
            <div>
              <span class="step-badge">1</span>
              <h2>{{ $t('strategyV2.sourceTitle') }}</h2>
            </div>
            <a-tag v-if="manifest" color="green">{{ $t('strategyV2.backtest.ready') }}</a-tag>
          </div>
          <a-select
            v-model="form.sourceId"
            class="full-width"
            show-search
            option-filter-prop="children"
            data-testid="backtest-source-select"
            :placeholder="$t('backtest-center.strategyPlaceholder')"
            @change="selectSource"
          >
            <a-select-option v-for="item in availableSources" :key="item.id" :value="item.id">
              {{ item.name }} · {{ sourceTypeLabel(item) }}
            </a-select-option>
          </a-select>

          <div v-if="needsChartSymbol" class="form-grid engine-fields">
            <a-form-item :label="$t('unifiedBacktest.symbol')">
              <a-select
                v-model="form.symbol"
                class="full-width"
                show-search
                allow-clear
                option-label-prop="label"
                :filter-option="false"
                :loading="symbolSearching"
                :placeholder="$t('unifiedBacktest.symbol')"
                @search="searchBacktestSymbols"
                @focus="searchBacktestSymbols('')"
                @change="handleBacktestSymbolChange"
              >
                <a-select-option
                  v-for="item in symbolOptions"
                  :key="item.symbol"
                  :value="item.symbol"
                  :label="symbolOptionLabel(item)"
                >
                  {{ symbolOptionLabel(item) }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="$t('unifiedBacktest.timeframe')">
              <a-select v-model="form.timeframe">
                <a-select-option value="1m">1m</a-select-option>
                <a-select-option value="5m">5m</a-select-option>
                <a-select-option value="30m">30m</a-select-option>
                <a-select-option value="1d">1D</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item :label="$t('unifiedBacktest.limit')">
              <a-input-number v-model="form.limit" :min="100" :max="5000" :step="100" class="full-width" />
            </a-form-item>
          </div>

          <div v-if="manifest" class="manifest-card">
            <div class="manifest-title">
              <a-icon type="safety-certificate" />
              {{ $t('strategyV2.manifestTitle') }}
            </div>
            <div class="manifest-grid">
              <div><span>{{ $t('strategyV2.strategyType') }}</span><strong>{{ strategyTypeLabel }}</strong></div>
              <div><span>{{ $t('strategyV2.frequency') }}</span><strong>{{ manifestFrequency }}</strong></div>
              <div><span>{{ $t('strategyV2.markets') }}</span><strong>{{ (manifest.markets || []).join(', ') || '-' }}</strong></div>
              <div><span>{{ $t('strategyV2.universe') }}</span><strong>{{ universeLabel }}</strong></div>
            </div>
            <p v-if="universeContractHint" class="universe-contract-hint">
              <a-icon type="info-circle" />
              {{ universeContractHint }}
            </p>
          </div>

          <div class="panel-heading runtime-heading">
            <div>
              <span class="step-badge">2</span>
              <h2>{{ mode === 'factor' ? $t('strategyV2.factorResearch.runtimeTitle') : $t('strategyV2.runtimeTitle') }}</h2>
            </div>
          </div>
          <p class="section-hint">{{ mode === 'factor' ? $t('strategyV2.factorResearch.runtimeHint') : $t('strategyV2.runtimeHint') }}</p>
          <a-form layout="vertical">
            <div class="form-grid">
              <a-form-item :label="$t('backtest-center.startDate')">
                <a-date-picker v-model="form.startDate" :disabled-date="disabledStartDate" class="full-width" />
              </a-form-item>
              <a-form-item :label="$t('backtest-center.endDate')">
                <a-date-picker v-model="form.endDate" :disabled-date="disabledEndDate" class="full-width" />
              </a-form-item>
              <a-form-item v-if="mode === 'portfolio'" :label="$t('backtest-center.initialCapital')">
                <a-input-number v-model="form.initialCapital" :min="10" class="full-width" />
              </a-form-item>
              <a-form-item :label="$t('backtest-center.commission')">
                <a-input-number v-model="form.commission" :min="0" :max="1" :step="0.0001" class="full-width" />
              </a-form-item>
              <a-form-item :label="$t('backtest-center.slippage')">
                <a-input-number v-model="form.slippage" :min="0" :max="1" :step="0.0001" class="full-width" />
              </a-form-item>
              <a-form-item v-if="mode === 'portfolio' && !isCzscSource" :label="$t('strategyV2.leverageEnabled')">
                <div class="switch-row">
                  <a-switch v-model="form.leverageEnabled" :disabled="!leverageAllowed" />
                  <span>{{ leverageAllowed ? $t('strategyV2.backtest.optional') : $t('strategyV2.codeOwned') }}</span>
                </div>
              </a-form-item>
              <a-form-item v-if="mode === 'portfolio' && !isCzscSource && form.leverageEnabled" :label="$t('strategyV2.leverageMultiplier')">
                <a-input-number v-model="form.leverage" :min="1" :max="maxLeverage" :step="0.5" class="full-width" />
              </a-form-item>
            </div>

            <a-alert
              v-if="backtestRangePolicy"
              class="range-limit-alert"
              :type="backtestRangeExceeded ? 'error' : 'info'"
              show-icon
              :message="backtestRangeAlertTitle"
              :description="backtestRangeAlertDescription"
            />

            <div v-if="mode === 'portfolio' && !isCzscSource && paramDefinitions.length" class="params-section">
              <div class="subheading">
                <h3>{{ $t('backtest-center.codeParams') }}</h3>
                <span>{{ $t('strategyV2.backtest.paramCount', { count: paramDefinitions.length }) }}</span>
              </div>
              <div class="form-grid">
                <a-form-item v-for="item in paramDefinitions" :key="item.name" :label="parameterLabel(item)">
                  <a-switch
                    v-if="item.type === 'boolean'"
                    :checked="Boolean(params[item.name])"
                    @change="value => setParam(item.name, value)"
                  />
                  <a-input-number
                    v-else
                    :value="params[item.name]"
                    :min="item.min"
                    :max="item.max"
                    :step="item.step || 1"
                    class="full-width"
                    @change="value => setParam(item.name, value)"
                  />
                </a-form-item>
              </div>
            </div>

            <div v-if="mode === 'factor'" class="params-section factor-settings">
              <div class="subheading">
                <h3>{{ $t('strategyV2.factorResearch.settings') }}</h3>
                <span>{{ $t('strategyV2.factorResearch.independentMode') }}</span>
              </div>
              <a-alert
                class="factor-contract-alert"
                type="info"
                show-icon
                :message="$t('strategyV2.factorResearch.universeContractTitle')"
                :description="$t('strategyV2.factorResearch.universeContractDesc')" />
              <div class="form-grid">
                <a-form-item v-if="!isCzscSource || factorForm.researchType === 'factor'" :label="$t('strategyV2.factorResearch.factor')">
                  <a-select v-if="isCzscSource" v-model="factorForm.factorId" class="full-width" show-search option-filter-prop="children">
                    <a-select-option v-for="item in czscFactors" :key="item.factor_id || item.id" :value="item.factor_id || item.id">{{ item.name_zh || item.name_en || item.factor_id }}</a-select-option>
                  </a-select>
                  <a-select v-else v-model="factorForm.factorId" class="full-width">
                    <a-select-option value="momentum_20">{{ $t('strategyV2.factorResearch.factors.momentum20') }}</a-select-option>
                    <a-select-option value="volatility_20">{{ $t('strategyV2.factorResearch.factors.volatility20') }}</a-select-option>
                    <a-select-option value="reversal_5">{{ $t('strategyV2.factorResearch.factors.reversal5') }}</a-select-option>
                    <a-select-option value="value">{{ $t('strategyV2.factorResearch.factors.value') }}</a-select-option>
                    <a-select-option value="quality">{{ $t('strategyV2.factorResearch.factors.quality') }}</a-select-option>
                    <a-select-option value="size">{{ $t('strategyV2.factorResearch.factors.size') }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="isCzscSource" :label="$t('unifiedFactor.researchType')">
                  <a-radio-group v-model="factorForm.researchType" button-style="solid" size="small">
                    <a-radio-button value="factor">{{ $t('unifiedFactor.experiment') }}</a-radio-button>
                    <a-radio-button value="quality">{{ $t('unifiedFactor.quality') }}</a-radio-button>
                  </a-radio-group>
                </a-form-item>
                <a-form-item v-if="!isCzscSource" :label="$t('strategyV2.factorResearch.groups')">
                  <a-input-number v-model="factorForm.groups" :min="2" :max="10" class="full-width" />
                </a-form-item>
                <a-form-item v-if="!isCzscSource" :label="$t('strategyV2.factorResearch.holdingPeriod')">
                  <a-input-number v-model="factorForm.holdingPeriod" :min="1" :max="60" class="full-width" />
                </a-form-item>
                <a-form-item v-if="!isCzscSource" :label="$t('strategyV2.factorResearch.industryNeutralization')">
                  <div class="switch-row"><a-switch v-model="factorForm.neutralizeIndustry" /><span>{{ $t('strategyV2.factorResearch.neutralizationHint') }}</span></div>
                </a-form-item>
                <a-form-item v-if="isCzscSource && factorForm.researchType === 'quality'" :label="$t('unifiedFactor.forwardBars')">
                  <a-select v-model="factorForm.forwardBars" mode="multiple" class="full-width">
                    <a-select-option v-for="item in [5, 10, 20, 30]" :key="item" :value="item">{{ item }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="isCzscSource && factorForm.researchType === 'quality'" :label="$t('unifiedFactor.sampleStep')">
                  <a-input-number v-model="factorForm.sampleStep" :min="1" :max="50" class="full-width" />
                </a-form-item>
              </div>
            </div>

          </a-form>
        </div>
        <div class="run-action-bar">
          <a-button
            type="primary"
            block
            size="large"
            icon="thunderbolt"
            data-testid="run-backtest"
            :disabled="runDisabled"
            :loading="running"
            @click="runActive"
          >
            {{ mode === 'portfolio' ? $t('backtest-center.runBacktest') : $t('strategyV2.factorResearch.run') }}
          </a-button>
        </div>
      </section>

      <section class="panel result-panel">
        <div class="panel-heading">
          <div>
            <span class="step-badge">3</span>
            <h2>{{ mode === 'factor' ? $t('strategyV2.factorResearch.workspace') : $t('backtest-center.resultOverview') }}</h2>
          </div>
          <span v-if="selectedRun" class="run-id">{{ mode === 'factor' ? 'FR-' : '#' }}{{ selectedRun.id || selectedRun.runId }}</span>
        </div>

        <div v-if="running" class="result-running" data-testid="backtest-running" aria-live="polite">
          <div class="running-icon"><a-icon type="loading" /></div>
          <h3>{{ mode === 'factor' ? $t('strategyV2.factorResearch.runningTitle') : $t('strategyV2.backtest.runningTitle') }}</h3>
          <p>{{ mode === 'factor' ? $t('strategyV2.factorResearch.runningDesc') : $t('strategyV2.backtest.runningDesc') }}</p>
          <strong>{{ $t('strategyV2.backtest.elapsed', { seconds: runElapsedSeconds }) }}</strong>
          <div class="running-contract">
            <span><a-icon type="check-circle" />{{ $t('strategyV2.backtest.sourceCheck') }}</span>
            <span><a-icon type="database" />{{ mode === 'factor' ? $t('strategyV2.factorResearch.pointInTimeExecution') : $t('strategyV2.backtest.serverExecution') }}</span>
            <span><a-icon type="safety-certificate" />{{ mode === 'factor' ? $t('strategyV2.factorResearch.metricsBeforeReturn') : $t('strategyV2.backtest.auditBeforeReturn') }}</span>
          </div>
        </div>

        <div v-else-if="!activeResult" class="result-empty" data-testid="backtest-empty">
          <div class="empty-hero-card">
            <div class="empty-orbit"><a-icon type="line-chart" /></div>
            <h3>{{ emptyResultTitle }}</h3>
            <p>{{ emptyResultDescription }}</p>
            <div class="empty-checks">
              <span :class="{ done: manifest }"><a-icon :type="manifest ? 'check-circle' : 'clock-circle'" />{{ $t('strategyV2.backtest.sourceCheck') }}</span>
              <span><a-icon type="safety-certificate" />{{ mode === 'factor' ? $t('strategyV2.factorResearch.crossSectionCheck') : $t('strategyV2.backtest.safeFill') }}</span>
              <span><a-icon type="database" />{{ $t('strategyV2.backtest.persisted') }}</span>
            </div>
          </div>
          <div v-if="manifest" class="empty-preview-grid">
            <div class="empty-preview-card">
              <a-icon type="code" />
              <span>{{ $t('strategyV2.sourceTitle') }}</span>
              <strong>{{ source && source.name }}</strong>
            </div>
            <div class="empty-preview-card">
              <a-icon type="global" />
              <span>{{ $t('strategyV2.universe') }}</span>
              <strong>{{ universeLabel }}</strong>
            </div>
            <div class="empty-preview-card">
              <a-icon type="clock-circle" />
              <span>{{ $t('strategyV2.frequency') }}</span>
              <strong>{{ manifestFrequency }}</strong>
            </div>
          </div>
        </div>

        <portfolio-result v-else-if="mode === 'portfolio'" :result="result" :is-dark="isDarkTheme" />
        <engine-factor-result v-else-if="isCzscSource" :result="factorResult" :is-dark="isDarkTheme" />
        <factor-research-result v-else :result="factorResult" :is-dark="isDarkTheme" />
      </section>
    </div>

    <a-drawer
      :visible="historyVisible"
      :title="mode === 'factor' ? $t('strategyV2.factorResearch.historyTitle') : $t('strategyV2.backtest.historyTitle')"
      placement="right"
      width="430"
      :wrap-class-name="isDarkTheme ? 'backtest-history-drawer theme-dark' : 'backtest-history-drawer'"
      :destroy-on-close="false"
      @close="historyVisible = false"
    >
      <div class="drawer-history-header" data-testid="backtest-history">
        <p>{{ mode === 'factor' ? $t('strategyV2.factorResearch.historyDesc') : $t('strategyV2.backtest.historyDesc') }}</p>
        <a-button icon="reload" size="small" :loading="historyLoading" @click="loadHistory">
          {{ $t('backtest-center.refreshHistory') }}
        </a-button>
      </div>
      <div v-if="historyDetailLoading" class="drawer-detail-loading" role="status" aria-live="polite">
        <a-icon type="loading" />
        <span>{{ mode === 'factor'
          ? $t('strategyV2.factorResearch.historyLoading', { id: historyDetailRunId })
          : $t('strategyV2.backtest.historyLoading', { id: historyDetailRunId }) }}</span>
      </div>
      <a-empty v-if="!historyLoading && !history.length" :description="mode === 'factor' ? $t('strategyV2.factorResearch.noHistory') : $t('strategyV2.backtest.noHistory')" />
      <div v-else class="drawer-run-list">
        <button
          v-for="item in history"
          :key="item.id"
          type="button"
          class="run-card"
          :class="{
            active: selectedRun && String(selectedRun.id || selectedRun.runId) === String(item.id),
            loading: historyDetailLoading && String(historyDetailRunId) === String(item.id)
          }"
          :disabled="historyDetailLoading"
          @click="openRun(item)"
        >
          <span class="run-card__top">
            <strong><a-icon v-if="historyDetailLoading && String(historyDetailRunId) === String(item.id)" type="loading" />{{ mode === 'factor' ? (item.source_name || item.factor_id) : historySymbolLabel(item) }}</strong>
            <em>{{ mode === 'factor' ? 'FR-' : '#' }}{{ item.id }}</em>
          </span>
          <span class="run-card__meta">{{ item.market }} · {{ item.timeframe }} · {{ formatDate(item.created_at) }}</span>
          <template v-if="mode === 'factor'">
            <span v-if="item.unified_result" class="run-card__status status-complete">{{ item.research_type === 'quality' ? $t('unifiedFactor.quality') : $t('unifiedFactor.experiment') }} · {{ factorLabel(item.factor_id) }}</span>
            <span v-else class="run-card__status status-complete">{{ factorLabel(item.factor_id) }} · {{ item.groups_count }}Q · {{ item.holding_period }}{{ $t('strategyV2.factorResearch.bars') }}</span>
            <span class="run-card__metrics factor-history-metrics">
              <b v-if="item.unified_result">{{ item.research_type === 'quality' ? $t('unifiedFactor.bestScore') : $t('unifiedFactor.latestValue') }} {{ formatNumber(item.rank_ic, item.research_type === 'quality' ? 2 : 4) }}</b>
              <b v-else :class="factorTone(item.rank_ic)">IC {{ formatSignedNumber(item.rank_ic, 4) }}</b>
              <small v-if="item.unified_result">{{ item.groups_count }} {{ item.research_type === 'quality' ? $t('unifiedFactor.signalTypes') : $t('unifiedFactor.factorCount') }} · {{ item.holding_period }} {{ item.research_type === 'quality' ? $t('unifiedFactor.samples') : $t('unifiedFactor.points') }}</small>
              <small v-else>{{ $t('strategyV2.factorResearch.icir') }} {{ formatNumber(item.icir, 3) }} · {{ $t('strategyV2.factorResearch.netLongShort') }} {{ formatRate(item.net_long_short_return) }}</small>
            </span>
          </template>
          <template v-else>
            <span class="run-card__status" :class="`status-${item.result_status || 'unknown'}`">{{ historyStatusLabel(item) }}</span>
            <span class="run-card__metrics">
              <b :class="historyReturnTone(item)">{{ formatPercent(item.total_return) }}</b>
              <small>{{ $t('strategyV2.backtest.executions') }} {{ item.total_executions || 0 }} · {{ $t('strategyV2.backtest.closedTrades') }} {{ item.total_trades || 0 }}</small>
            </span>
          </template>
        </button>
      </div>
    </a-drawer>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import moment from 'moment'
import { mapState } from 'vuex'
import { calculateTradeValueUsd } from '@/utils/tradeReview'
import { timestampMillisecondsUtc } from '@/utils/utcInstant'
import { formatBacktestTime } from '@/utils/userTime'
import {
  compileScriptSource,
  getScriptSourceDetail,
  getScriptSourceList,
  getStrategyFactorResearchHistory,
  getStrategyFactorResearchRun,
  getStrategyBacktestHistory,
  getStrategyBacktestRun,
  runStrategyFactorResearch,
  runStrategyBacktest
} from '@/api/strategy'
import {
  createCzscBacktest,
  createFactorResearch,
  getFactorCatalog,
  getTask,
  listResearchResults,
  listUnifiedStrategies,
  registerCzscStrategies,
  searchMarketSymbols
} from '@/api/domain'
import {
  DEFAULT_CZSC_SYMBOL_ITEMS,
  czscSymbolDisplayItem,
  formatCzscSymbolLabel,
  normalizeCzscSymbol
} from '@/utils/czscSymbols'
import PortfolioResult from './PortfolioResult.vue'
import FactorResearchResult from './FactorResearchResult.vue'
import EngineFactorResult from './EngineFactorResult.vue'

export default {
  name: 'BacktestCenter',
  components: { PortfolioResult, FactorResearchResult, EngineFactorResult },
  data () {
    return {
      mode: ['factor', 'factor-research'].includes(String(this.$route.query.view || '')) ? 'factor' : 'portfolio',
      sources: [],
      czscFactors: [],
      portfolioHistory: [],
      factorHistory: [],
      source: null,
      manifest: null,
      backtestRangePolicy: null,
      params: {},
      result: null,
      factorResult: null,
      selectedRun: null,
      running: false,
      runElapsedSeconds: 0,
      runTimer: null,
      historyLoading: false,
      historyVisible: false,
      historyDetailLoading: false,
      historyDetailRunId: null,
      equityChart: null,
      chartResizeObserver: null,
      symbolOptions: DEFAULT_CZSC_SYMBOL_ITEMS.map(item => ({ ...item })),
      symbolNames: DEFAULT_CZSC_SYMBOL_ITEMS.reduce((output, item) => {
        output[item.symbol] = item.name
        return output
      }, {}),
      symbolSearching: false,
      symbolSearchTimer: null,
      form: {
        sourceId: null,
        startDate: moment().subtract(1, 'year'),
        endDate: moment(),
        initialCapital: 10000,
        commission: 0.0005,
        slippage: 0.0005,
        leverageEnabled: false,
        leverage: 1,
        symbol: '000333.SZ',
        timeframe: '1d',
        limit: 2000
      },
      factorForm: {
        factorId: 'momentum_20',
        researchType: this.$route.query.researchType === 'quality' ? 'quality' : 'factor',
        groups: 5,
        holdingPeriod: 5,
        neutralizeIndustry: false,
        forwardBars: [5, 10, 20],
        sampleStep: 5
      }
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () {
      return this.navTheme === 'dark' || this.navTheme === 'realdark'
    },
    activeResult () {
      return this.mode === 'portfolio' ? this.result : this.factorResult
    },
    availableSources () {
      const runnable = item => item.engine === 'czsc' || item.asset_type === 'graph_strategy' || item.code_hidden || String(item.code || '').trim()
      if (this.mode !== 'factor') return this.sources.filter(item => !item.research_asset && runnable(item))
      return this.sources.filter(item => item.research_asset || (item.engine !== 'czsc' && item.asset_type === 'portfolio_strategy' && runnable(item)))
    },
    isCzscSource () {
      return Boolean(this.source && this.source.engine === 'czsc' && this.source.source_kind !== 'graph' && this.source.asset_type !== 'graph_strategy')
    },
    isGraphSource () {
      return Boolean(this.source && (this.source.source_kind === 'graph' || this.source.asset_type === 'graph_strategy'))
    },
    needsChartSymbol () {
      return this.isCzscSource || this.isGraphSource
    },
    history () {
      return this.mode === 'factor' ? this.factorHistory : this.portfolioHistory
    },
    factorCompatible () {
      if (this.source && this.source.research_asset) return true
      if (!this.manifest || this.manifest.strategyType !== 'portfolio') return false
      const universe = this.manifest.universe || {}
      return Boolean(universe.reference) || (universe.instruments || []).length >= 3
    },
    emptyResultTitle () {
      if (this.mode === 'factor') {
        if (!this.manifest) return this.$t('strategyV2.factorResearch.selectPortfolioTitle')
        if (!this.factorCompatible) return this.$t('strategyV2.factorResearch.incompatibleTitle')
        return this.$t('strategyV2.factorResearch.readyTitle')
      }
      return this.manifest ? this.$t('strategyV2.backtest.readyTitle') : this.$t('strategyV2.backtest.selectTitle')
    },
    emptyResultDescription () {
      if (this.mode === 'factor') {
        if (!this.manifest) return this.$t('strategyV2.factorResearch.selectPortfolioDesc')
        if (!this.factorCompatible) return this.$t('strategyV2.factorResearch.incompatibleDesc')
        return this.$t('strategyV2.factorResearch.readyDesc')
      }
      return this.manifest ? this.$t('strategyV2.backtest.readyDesc') : this.$t('backtest-center.emptyResult')
    },
    leverageAllowed () {
      return Boolean(this.manifest && this.manifest.leverageAllowed)
    },
    maxLeverage () {
      return Number((this.manifest && this.manifest.maxLeverage) || 1)
    },
    manifestFrequency () {
      const subscriptions = (this.manifest && this.manifest.subscriptions) || []
      return (this.manifest && this.manifest.primaryFrequency) || (subscriptions[0] && subscriptions[0].frequency) || '-'
    },
    backtestRangeLimitDays () {
      if (!this.backtestRangePolicy) return null
      const value = Number(this.mode === 'factor'
        ? this.backtestRangePolicy.factorMaxSelectedDays
        : this.backtestRangePolicy.maxSelectedDays)
      return Number.isFinite(value) ? Math.max(0, value) : null
    },
    selectedRangeDays () {
      if (!this.form.startDate || !this.form.endDate) return null
      return this.form.endDate.clone().startOf('day').diff(this.form.startDate.clone().startOf('day'), 'days')
    },
    estimatedBacktestBars () {
      if (!this.backtestRangePolicy || this.selectedRangeDays === null || this.selectedRangeDays < 0) return 0
      const seconds = Number(this.backtestRangePolicy.timeframeSeconds || 86400)
      const warmupBars = Number(this.mode === 'factor'
        ? this.backtestRangePolicy.factorWarmupBars
        : this.backtestRangePolicy.warmupBars) || 0
      return Math.ceil((this.selectedRangeDays * 86400) / Math.max(1, seconds)) + warmupBars
    },
    backtestRangeExceeded () {
      if (this.selectedRangeDays === null || this.selectedRangeDays < 0) return true
      return this.backtestRangeLimitDays !== null && this.selectedRangeDays > this.backtestRangeLimitDays
    },
    backtestRangeAlertTitle () {
      return this.$t('strategyV2.backtest.rangeLimitTitle', {
        timeframe: this.manifestFrequency,
        maxDays: this.backtestRangeLimitDays
      })
    },
    backtestRangeAlertDescription () {
      const key = this.backtestRangeExceeded
        ? 'strategyV2.backtest.rangeLimitExceeded'
        : 'strategyV2.backtest.rangeLimitEstimate'
      return this.$t(key, {
        timeframe: this.manifestFrequency,
        maxDays: this.backtestRangeLimitDays,
        bars: this.estimatedBacktestBars.toLocaleString(),
        maxBars: Number(this.backtestRangePolicy && this.backtestRangePolicy.maxBars || 0).toLocaleString()
      })
    },
    runDisabled () {
      return !this.manifest || this.backtestRangeExceeded || (this.isCzscSource && !this.form.symbol) || (this.mode === 'factor' && !this.factorCompatible)
    },
    strategyTypeLabel () {
      const type = String((this.manifest && this.manifest.strategyType) || 'cta')
      return this.$t(type === 'portfolio' ? 'strategyV2.portfolio' : 'strategyV2.cta')
    },
    universeLabel () {
      const universe = (this.manifest && this.manifest.universe) || {}
      if (universe.reference) return this.$t('strategyV2.referenceUniverse', { reference: universe.reference })
      const instruments = Array.isArray(universe.instruments) ? universe.instruments : []
      if (this.manifest && this.manifest.strategyType === 'cta' && instruments.length) {
        return instruments.map(this.formatInstrument).join(', ')
      }
      return this.$t('strategyV2.symbolCount', { count: instruments.length })
    },
    universeContractHint () {
      const universe = (this.manifest && this.manifest.universe) || {}
      if (universe.reference) return this.$t('strategyV2.referenceUniverseHint')
      const instruments = Array.isArray(universe.instruments) ? universe.instruments : []
      if (!this.isCzscSource && instruments.length) return this.$t('strategyV2.fixedUniverseHint')
      return ''
    },
    paramDefinitions () {
      const schema = this.parseObject(this.source && this.source.param_schema)
      return Array.isArray(schema.params) ? schema.params : []
    },
    metrics () {
      if (!this.result) return []
      return [
        { key: 'return', label: this.$t('backtest-center.metrics.totalReturn'), value: this.formatPercent(this.result.totalReturn), tone: Number(this.result.totalReturn) >= 0 ? 'positive' : 'negative' },
        { key: 'benchmark', label: this.$t('strategyV2.backtest.benchmarkReturn'), value: this.result.benchmarkStatus === 'available' ? this.formatPercent(this.result.benchmarkTotalReturn) : '-', tone: Number(this.result.benchmarkTotalReturn) >= 0 ? 'positive' : 'negative' },
        { key: 'excess', label: this.$t('strategyV2.backtest.excessReturn'), value: this.result.benchmarkStatus === 'available' ? this.formatPercent(this.result.excessReturn) : '-', tone: Number(this.result.excessReturn) >= 0 ? 'positive' : 'negative' },
        { key: 'drawdown', label: this.$t('backtest-center.metrics.maxDrawdown'), value: this.formatPercent(this.result.maxDrawdown), tone: 'negative' },
        { key: 'executions', label: this.$t('strategyV2.backtest.executions'), value: Number(this.result.totalExecutions || 0), tone: '' },
        { key: 'trades', label: this.$t('strategyV2.backtest.closedTrades'), value: Number(this.result.totalTrades || 0), tone: '' },
        { key: 'win', label: this.$t('backtest-center.metrics.winRate'), value: this.formatPercent(this.result.winRate, false), tone: '' },
        { key: 'sharpe', label: this.$t('backtest-center.metrics.sharpe'), value: this.formatNumber(this.result.sharpeRatio), tone: '' }
      ]
    },
    equityPoints () {
      return (this.result && this.result.equityCurve) || []
    },
    executionRows () {
      return (this.result && (this.result.executions || this.result.rawTrades)) || []
    },
    tradeRows () {
      return (this.result && (this.result.closedTrades || this.result.trades)) || []
    },
    tradeColumns () {
      return [
        { title: this.$t('backtest-center.symbol'), dataIndex: 'symbol', key: 'symbol', width: 150 },
        { title: this.$t('backtest-center.tradeColumns.side'), dataIndex: 'side', key: 'side', width: 80 },
        { title: this.$t('backtest-center.tradeColumns.entryTime'), dataIndex: 'entry_time', key: 'entry_time', width: 170, customRender: value => this.formatDate(value) },
        { title: this.$t('backtest-center.tradeColumns.exitTime'), dataIndex: 'exit_time', key: 'exit_time', width: 170, customRender: value => this.formatDate(value) },
        { title: this.$t('backtest-center.tradeColumns.quantity'), dataIndex: 'quantity', key: 'quantity', width: 110, customRender: value => this.formatNumber(value, 4) },
        { title: this.$t('backtest-center.tradeColumns.valueUsd'), key: 'value_usd', width: 130, customRender: (value, row) => { const total = calculateTradeValueUsd(row); return total === null ? '-' : this.formatNumber(total) } },
        { title: this.$t('backtest-center.tradeColumns.entryPrice'), dataIndex: 'entry_price', key: 'entry_price', width: 120, customRender: value => this.formatNumber(value, 4) },
        { title: this.$t('backtest-center.tradeColumns.exitPrice'), dataIndex: 'exit_price', key: 'exit_price', width: 120, customRender: value => this.formatNumber(value, 4) },
        {
          title: this.$t('backtest-center.tradeColumns.profit'),
          dataIndex: 'profit',
          key: 'profit',
          width: 110,
          customRender: value => this.$createElement('span', { class: ['trade-profit', this.profitTone(value)] }, this.formatSignedNumber(value))
        },
        { title: this.$t('backtest-center.tradeColumns.balance'), dataIndex: 'balance', key: 'balance', width: 130, customRender: value => this.formatNumber(value) },
        { title: this.$t('backtest-center.tradeColumns.closeReason'), dataIndex: 'close_reason', key: 'close_reason', width: 160 }
      ]
    },
    executionColumns () {
      return [
        { title: this.$t('strategyV2.backtest.signalTime'), dataIndex: 'signal_time', key: 'signal_time', width: 160, customRender: value => this.formatDate(value) },
        { title: this.$t('strategyV2.backtest.fillTime'), dataIndex: 'time', key: 'time', width: 160, customRender: value => this.formatDate(value) },
        { title: this.$t('backtest-center.symbol'), dataIndex: 'symbol', key: 'symbol', width: 160 },
        { title: this.$t('strategyV2.backtest.side'), dataIndex: 'side', key: 'side', width: 70 },
        { title: this.$t('backtest-center.quantity'), dataIndex: 'quantity', key: 'quantity', customRender: value => this.formatNumber(value, 6) },
        { title: this.$t('backtest-center.price'), dataIndex: 'price', key: 'price', customRender: value => this.formatNumber(value, 4) },
        { title: this.$t('backtest-center.commission'), dataIndex: 'commission', key: 'commission', customRender: value => this.formatNumber(value, 4) },
        { title: this.$t('strategyV2.backtest.reason'), dataIndex: 'reason', key: 'reason', width: 150 }
      ]
    },
    resultTrustTone () {
      if (!this.result || (this.result.audit && !this.result.audit.passed)) return 'is-error'
      if (this.result.resultStatus === 'no_signals' || this.result.resultStatus === 'open_position_only') return 'is-warning'
      return 'is-success'
    },
    resultTrustIcon () {
      return this.resultTrustTone === 'is-success' ? 'check-circle' : this.resultTrustTone === 'is-warning' ? 'exclamation-circle' : 'close-circle'
    },
    resultStatusLabel () {
      return this.$t(`strategyV2.backtest.status.${(this.result && this.result.resultStatus) || 'unknown'}`)
    },
    resultStatusHint () {
      return this.$t(`strategyV2.backtest.status.${(this.result && this.result.resultStatus) || 'unknown'}Hint`)
    },
    auditLabel () {
      return this.$t(this.result && this.result.audit && this.result.audit.passed ? 'strategyV2.backtest.auditPassed' : 'strategyV2.backtest.auditFailed')
    },
    provenanceLabel () {
      const provenance = (this.result && this.result.dataProvenance) || {}
      return this.$t(provenance.kind === 'market' ? 'strategyV2.backtest.marketData' : 'strategyV2.backtest.fixtureData')
    },
    benchmarkCaption () {
      if (!this.result || this.result.benchmarkStatus !== 'available') return this.$t('strategyV2.backtest.benchmarkUnavailable')
      const benchmark = this.result.benchmark || {}
      return this.$t('strategyV2.backtest.comparedWith', { symbol: benchmark.symbol || '-' })
    },
    curveRange () {
      const curve = (this.result && this.result.equityCurve) || []
      if (!curve.length) return ''
      return `${this.formatNumber(curve[0].value)} → ${this.formatNumber(curve[curve.length - 1].value)}`
    }
  },
  watch: {
    result () {
      this.$nextTick(this.renderEquityChart)
    },
    isDarkTheme () {
      this.$nextTick(this.renderEquityChart)
    },
    mode (value) {
      this.handleModeChange(value)
    }
  },
  async mounted () {
    await this.refreshPage()
    const routeSourceId = this.$route.query.sourceId
    const routeSourceAvailable = this.availableSources.some(item => String(item.id) === String(routeSourceId || ''))
    const sourceId = routeSourceAvailable ? routeSourceId : (this.availableSources[0] && this.availableSources[0].id)
    if (sourceId) {
      this.form.sourceId = sourceId
      await this.selectSource(sourceId)
    }
    window.addEventListener('resize', this.resizeEquityChart)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.resizeEquityChart)
    this.stopRunTimer()
    if (this.symbolSearchTimer) clearTimeout(this.symbolSearchTimer)
    if (this.chartResizeObserver) this.chartResizeObserver.disconnect()
    if (this.equityChart) this.equityChart.dispose()
  },
  methods: {
    renderEquityChart () {
      if (!this.$refs.equityChart || !this.equityPoints.length) {
        if (this.equityChart) this.equityChart.clear()
        return
      }
      if (!this.equityChart) {
        this.equityChart = echarts.init(this.$refs.equityChart)
        if (typeof ResizeObserver !== 'undefined') {
          this.chartResizeObserver = new ResizeObserver(this.resizeEquityChart)
          this.chartResizeObserver.observe(this.$refs.equityChart)
        }
      }
      const strategyData = this.equityPoints.map(item => [timestampMillisecondsUtc(item.time), Number(item.value)])
      const benchmarkData = ((this.result && this.result.benchmarkCurve) || []).map(item => [timestampMillisecondsUtc(item.time), Number(item.value)])
      const textColor = this.isDarkTheme ? '#a3a3a3' : '#64748b'
      const gridColor = this.isDarkTheme ? '#292929' : '#e9eef4'
      const strategyName = this.$t('strategyV2.backtest.strategyEquity')
      const benchmarkName = this.$t('strategyV2.backtest.spotBenchmark')
      const valueLabel = this.$t('strategyV2.backtest.equityValue')
      const series = [{
        name: strategyName,
        type: 'line',
        data: strategyData,
        showSymbol: false,
        smooth: false,
        sampling: 'lttb',
        lineStyle: { width: 2.2 },
        areaStyle: { opacity: 0.08 },
        emphasis: { focus: 'series' }
      }]
      if (benchmarkData.length) {
        series.push({
          name: benchmarkName,
          type: 'line',
          data: benchmarkData,
          showSymbol: false,
          smooth: false,
          sampling: 'lttb',
          lineStyle: { width: 1.7, type: 'dashed' },
          emphasis: { focus: 'series' }
        })
      }
      this.equityChart.setOption({
        animationDuration: 350,
        color: ['#52c41a', '#f5a623'],
        grid: { left: 12, right: 18, top: 46, bottom: 58, containLabel: true },
        legend: { top: 4, left: 4, textStyle: { color: textColor }, data: benchmarkData.length ? [strategyName, benchmarkName] : [strategyName] },
        tooltip: {
          trigger: 'axis',
          confine: true,
          backgroundColor: this.isDarkTheme ? 'rgba(15,15,15,.97)' : 'rgba(255,255,255,.98)',
          borderColor: this.isDarkTheme ? '#383838' : '#d9e0e8',
          textStyle: { color: this.isDarkTheme ? '#f8fafc' : '#17233d' },
          axisPointer: { type: 'cross', snap: true, label: { backgroundColor: '#334155' } },
          formatter: params => {
            if (!params || !params.length) return ''
            const timestamp = params[0].value[0]
            const rows = params.map(item => `${item.marker}${item.seriesName}<b>${this.formatNumber(item.value[1])}</b>`).join('<br>')
            return `<div class="backtest-tooltip"><strong>${formatBacktestTime(timestamp, { locale: this.$i18n.locale })}</strong><span>${valueLabel}</span><br>${rows}</div>`
          }
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLine: { lineStyle: { color: gridColor } },
          axisLabel: { color: textColor, formatter: value => moment(value).format('YYYY-MM-DD') },
          splitLine: { show: false },
          axisPointer: { show: true }
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: { color: textColor, formatter: value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }) },
          splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
          axisPointer: { show: true, label: { formatter: params => this.formatNumber(params.value) } }
        },
        dataZoom: [
          { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
          { type: 'slider', xAxisIndex: 0, height: 22, bottom: 7, borderColor: 'transparent', backgroundColor: this.isDarkTheme ? '#0d0d0d' : '#f1f5f9', fillerColor: this.isDarkTheme ? 'rgba(82,196,26,.18)' : 'rgba(82,196,26,.12)', textStyle: { color: textColor }, showDetail: false }
        ],
        series
      }, true)
    },
    resizeEquityChart () {
      if (this.equityChart) this.equityChart.resize()
    },
    parseObject (value) {
      if (value && typeof value === 'object' && !Array.isArray(value)) return value
      if (typeof value !== 'string' || !value.trim()) return {}
      try { return JSON.parse(value) } catch (error) { return {} }
    },
    async refreshPage () {
      await Promise.all([this.loadSources(), this.loadHistory()])
    },
    async loadSources () {
      await registerCzscStrategies().catch(() => null)
      const factorRequest = getFactorCatalog().catch(() => ({ data: {} }))
      const [nativeResponse, czscResponse, factorResponse] = await Promise.all([
        getScriptSourceList(),
        listUnifiedStrategies({ engine: 'czsc' }).catch(() => ({ data: [] })),
        factorRequest
      ])
      const nativeSources = ((nativeResponse.data && nativeResponse.data.items) || [])
        .filter(item => String(item.engine || '').toLowerCase() !== 'czsc' || item.source_kind === 'graph' || item.asset_type === 'graph_strategy')
        .map(item => ({
        ...item,
        engine: String(item.engine || 'native').toLowerCase(),
        engine_origin: String(item.engine || 'native').toLowerCase(),
        // GraphSpec strategies execute through the product-owned Strategy V2
        // adapter while retaining the provider that supplied their signals.
        execution_engine: (item.source_kind === 'graph' || item.asset_type === 'graph_strategy') ? 'native' : String(item.engine || 'native').toLowerCase()
      }))
      const czscSources = (Array.isArray(czscResponse.data) ? czscResponse.data : [])
        .filter(item => item.source_kind !== 'graph' && item.asset_type !== 'graph_strategy')
        .map(item => ({
        ...item,
        id: `czsc:${item.strategy_version_id}`,
        source_id: item.id,
        engine: 'czsc',
        engine_origin: 'czsc',
        execution_engine: 'czsc',
        asset_type: item.kind === 'portfolio' ? 'portfolio_strategy' : 'script',
        param_schema: item.parameters || {},
        manifest: {
          strategyType: item.kind || 'cta',
          engine: 'czsc',
          primaryFrequency: '1d',
          subscriptions: [{ frequency: '1d' }],
          universe: { instruments: [{ market: 'CNStock', symbol: this.form.symbol, market_type: 'stock' }] }
        }
      }))
      this.czscFactors = (factorResponse.data && factorResponse.data.factor_library) || []
      const researchSource = {
        id: 'research:cnstock-factors',
        name: this.$t('unifiedFactor.assetName'),
        engine: 'czsc',
        engine_origin: 'czsc',
        execution_engine: 'czsc',
        research_asset: true,
        asset_type: 'portfolio_strategy',
        param_schema: {},
        manifest: {
          strategyType: 'portfolio',
          engine: 'czsc',
          primaryFrequency: '1d',
          subscriptions: [{ frequency: '1d' }],
          universe: { reference: 'CNStock' }
        }
      }
      this.sources = [...nativeSources, ...czscSources, researchSource]
      if (!this.czscFactors.some(item => (item.factor_id || item.id) === this.factorForm.factorId) && this.czscFactors.length) {
        this.factorForm.factorId = this.czscFactors[0].factor_id || this.czscFactors[0].id
      }
    },
    async loadHistory () {
      this.historyLoading = true
      try {
        const [portfolioResponse, factorResponse, engineFactorResponse, qualityResponse] = await Promise.all([
          getStrategyBacktestHistory({ limit: 24 }),
          getStrategyFactorResearchHistory({ limit: 24 }),
          listResearchResults({ result_type: 'factor', limit: 24 }).catch(() => ({ data: [] })),
          listResearchResults({ result_type: 'factor_quality', limit: 24 }).catch(() => ({ data: [] }))
        ])
        this.portfolioHistory = Array.isArray(portfolioResponse.data) ? portfolioResponse.data : []
        const nativeHistory = Array.isArray(factorResponse.data) ? factorResponse.data : []
        const engineHistory = [
          ...(Array.isArray(engineFactorResponse.data) ? engineFactorResponse.data : []),
          ...(Array.isArray(qualityResponse.data) ? qualityResponse.data : [])
        ].map(item => this.normalizeEngineFactorHistory(item))
        this.factorHistory = [...nativeHistory, ...engineHistory]
          .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
          .slice(0, 48)
      } finally {
        this.historyLoading = false
      }
    },
    async handleModeChange () {
      this.selectedRun = null
      this.historyVisible = false
      const currentId = String(this.form.sourceId || '')
      const currentAvailable = this.availableSources.some(item => String(item.id) === currentId)
      if (!currentAvailable) {
        const nextSource = this.availableSources[0]
        this.form.sourceId = nextSource ? nextSource.id : null
        if (nextSource) await this.selectSource(nextSource.id)
        else {
          this.source = null
          this.manifest = null
          this.backtestRangePolicy = null
        }
      }
      this.applyBacktestRangePolicy()
      this.$nextTick(() => this.resizeEquityChart())
    },
    async selectSource (sourceId) {
      this.result = null
      this.factorResult = null
      this.selectedRun = null
      this.form.leverageEnabled = false
      this.form.leverage = 1
      this.source = null
      this.manifest = null
      this.backtestRangePolicy = null
      this.params = {}
      const selected = this.sources.find(item => String(item.id) === String(sourceId))
      if (selected && selected.engine === 'czsc' && selected.source_kind !== 'graph' && selected.asset_type !== 'graph_strategy') {
        this.source = selected
        this.manifest = selected.manifest
        this.backtestRangePolicy = null
        this.params = {}
        if (selected.research_asset && this.czscFactors.length) {
          this.factorForm.factorId = this.czscFactors[0].factor_id || this.czscFactors[0].id
        }
        return
      }
      const response = await getScriptSourceDetail(sourceId)
      const compiled = await compileScriptSource({ sourceId, symbol: this.form.symbol, timeframe: this.form.timeframe })
      const sourceEngine = String((response.data && response.data.engine) || selected && selected.engine || 'native').toLowerCase()
      const isGraph = response.data && (response.data.source_kind === 'graph' || response.data.asset_type === 'graph_strategy')
      this.source = {
        ...response.data,
        engine: sourceEngine,
        engine_origin: sourceEngine,
        execution_engine: isGraph ? 'native' : sourceEngine
      }
      this.manifest = compiled.data && compiled.data.manifest
      this.backtestRangePolicy = compiled.data && compiled.data.backtestRangePolicy
      await this.hydrateManifestSymbolNames()
      this.applyBacktestRangePolicy()
      this.params = this.paramDefinitions.reduce((output, item) => {
        output[item.name] = item.default
        return output
      }, {})
    },
    sourceTypeLabel (item) {
      if (item.research_asset) return this.$t('strategyV2.factorResearch.independentMode')
      if (String(item.template_key || '').startsWith('robot_v2_')) return this.$t('strategyV2.robot')
      const kind = this.$t(item.asset_type === 'portfolio_strategy' ? 'strategyV2.portfolio' : 'strategyV2.cta')
      return item.engine === 'czsc' || item.engine_origin === 'czsc' ? `${kind} · CZSC` : kind
    },
    formatInstrument (item) {
      const marketType = String(item.market_type || item.marketType || '').toLowerCase()
      const marketTypeKey = marketType ? `marketContext.${marketType}` : ''
      const marketTypeLabel = marketTypeKey && this.$te(marketTypeKey) ? this.$t(marketTypeKey) : marketType
      const normalizedSymbol = normalizeCzscSymbol(item.symbol)
      const symbolName = item.symbol_name || item.symbolName || item.name || this.symbolNames[normalizedSymbol] || ''
      const symbolLabel = [item.symbol, symbolName && symbolName !== item.symbol ? symbolName : ''].filter(Boolean).join(' · ')
      return [symbolLabel, marketTypeLabel].filter(Boolean).join(' · ')
    },
    historySymbolLabel (item) {
      if (!item) return '-'
      const symbol = item.symbol || '-'
      const name = item.symbol_name || item.symbolName || item.name || this.symbolNames[normalizeCzscSymbol(symbol)] || ''
      return name && name !== symbol ? `${symbol} · ${name}` : symbol
    },
    symbolOptionLabel (item) {
      return formatCzscSymbolLabel(item, this.symbolNames)
    },
    rememberSymbolOptions (items) {
      const next = (items || []).map(item => czscSymbolDisplayItem(item)).filter(Boolean)
      const bySymbol = new Map(this.symbolOptions.map(item => [item.symbol, item]))
      const names = { ...this.symbolNames }
      next.forEach(item => {
        bySymbol.set(item.symbol, item)
        if (item.name) names[item.symbol] = item.name
      })
      this.symbolOptions = Array.from(bySymbol.values())
      this.symbolNames = names
    },
    async hydrateManifestSymbolNames () {
      const universe = (this.manifest && this.manifest.universe) || {}
      if (!this.manifest || this.manifest.strategyType !== 'cta') return
      const symbols = (Array.isArray(universe.instruments) ? universe.instruments : [])
        .map(item => normalizeCzscSymbol(item.symbol))
        .filter(symbol => symbol && !this.symbolNames[symbol])
      if (!symbols.length) return
      const responses = await Promise.all(symbols.map(symbol => searchMarketSymbols({
        market: 'CNStock',
        keyword: symbol.slice(0, 6),
        limit: 10
      }).catch(() => null)))
      const rows = []
      responses.forEach((response, index) => {
        if (!response || response.code !== 1 || !Array.isArray(response.data)) return
        const exact = response.data.find(item => normalizeCzscSymbol(item.symbol || item.code) === symbols[index])
        if (exact) rows.push(exact)
      })
      this.rememberSymbolOptions(rows)
    },
    searchBacktestSymbols (keyword) {
      if (this.symbolSearchTimer) clearTimeout(this.symbolSearchTimer)
      this.symbolSearchTimer = setTimeout(async () => {
        this.symbolSearching = true
        try {
          const response = await searchMarketSymbols({ market: 'CNStock', keyword: keyword || '', limit: 30 })
          if (response && response.code === 1) {
            this.rememberSymbolOptions(Array.isArray(response.data) ? response.data : [])
          }
        } finally {
          this.symbolSearching = false
        }
      }, keyword ? 250 : 0)
    },
    handleBacktestSymbolChange (value) {
      this.form.symbol = value ? normalizeCzscSymbol(value) : ''
    },
    parameterLabel (item) {
      if (!item.labelKey) return item.name
      const label = this.$t(item.labelKey)
      return label === item.labelKey ? item.name : label
    },
    setParam (name, value) {
      this.params = { ...this.params, [name]: value }
    },
    disabledStartDate (current) {
      if (!current || !this.form.endDate) return false
      const endDate = this.form.endDate.clone().startOf('day')
      if (current.isAfter(endDate, 'day')) return true
      if (this.backtestRangeLimitDays === null) return false
      return current.isBefore(endDate.clone().subtract(this.backtestRangeLimitDays, 'days'), 'day')
    },
    disabledEndDate (current) {
      if (!current || !this.form.startDate) return false
      const startDate = this.form.startDate.clone().startOf('day')
      if (current.isBefore(startDate, 'day')) return true
      if (this.backtestRangeLimitDays === null) return false
      return current.isAfter(startDate.clone().add(this.backtestRangeLimitDays, 'days'), 'day')
    },
    applyBacktestRangePolicy () {
      if (this.backtestRangeLimitDays === null || !this.form.startDate || !this.form.endDate) return
      if (this.selectedRangeDays <= this.backtestRangeLimitDays && this.selectedRangeDays >= 0) return
      this.form.startDate = this.form.endDate.clone().startOf('day').subtract(this.backtestRangeLimitDays, 'days')
      this.$message.info(this.$t('strategyV2.backtest.rangeLimitAdjusted', {
        timeframe: this.manifestFrequency,
        maxDays: this.backtestRangeLimitDays
      }))
    },
    ensureBacktestRangeAllowed () {
      if (!this.backtestRangeExceeded) return true
      this.$message.error(this.backtestRangeAlertDescription)
      return false
    },
    startRunTimer () {
      this.stopRunTimer()
      this.runElapsedSeconds = 0
      const startedAt = Date.now()
      this.runTimer = window.setInterval(() => {
        this.runElapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      }, 1000)
    },
    stopRunTimer () {
      if (this.runTimer) window.clearInterval(this.runTimer)
      this.runTimer = null
    },
    async run () {
      if (!this.form.sourceId) {
        this.$message.warning(this.$t('strategyV2.sourceContractRequired'))
        return
      }
      if (!this.ensureBacktestRangeAllowed()) return
      this.running = true
      this.result = null
      this.selectedRun = null
      this.startRunTimer()
      try {
        const response = this.isCzscSource
          ? await this.runCzscBacktest()
          : this.isGraphSource
            ? await this.runGraphBacktest()
          : await runStrategyBacktest({
            sourceId: this.form.sourceId,
            symbol: this.form.symbol,
            timeframe: this.form.timeframe,
            startDate: this.form.startDate.format('YYYY-MM-DD'),
            endDate: this.form.endDate.format('YYYY-MM-DD'),
            initialCapital: this.form.initialCapital,
            commission: this.form.commission,
            slippage: this.form.slippage,
            leverageEnabled: this.form.leverageEnabled,
            leverage: this.form.leverageEnabled ? this.form.leverage : 1,
            params: this.params
          })
        this.result = response.data
        this.selectedRun = { id: response.data && (response.data.runId || response.data.run_id) }
        const billing = response.data && response.data.billing
        if (billing && typeof billing.remaining !== 'undefined') {
          this.$root.$emit('credits-updated', billing.remaining)
        }
        await this.loadHistory()
      } catch (error) {
        this.$message.error((error && error.backendMessage) || this.$t('strategyV2.backtest.runFailed'))
      } finally {
        this.stopRunTimer()
        this.running = false
      }
    },
    async runCzscBacktest () {
      const specification = this.source.engine_specification || {}
      const response = await createCzscBacktest({
        strategy_id: this.source.source_id,
        strategy_version_id: this.source.strategy_version_id,
        strategy_name: this.source.name,
        template_id: specification.id || this.source.template_key,
        symbol: this.form.symbol.trim().toUpperCase(),
        timeframe: this.form.timeframe,
        start: this.form.startDate.format('YYYY-MM-DD'),
        end: this.form.endDate.format('YYYY-MM-DD'),
        limit: this.form.limit,
        initial_cash: this.form.initialCapital,
        commission_rate: this.form.commission,
        min_commission: 5,
        stamp_tax_rate: 0.0005,
        transfer_fee_rate: 0.00001,
        execution_assumptions: {
          adjustment: 'qfq',
          calendar: 'CNStock',
          t_plus_one: true,
          execution_price: 'next_bar_open',
          commission_rate: this.form.commission,
          min_commission: 5,
          stamp_tax_rate: 0.0005,
          transfer_fee_rate: 0.00001
        }
      }, `backtest-${this.source.strategy_version_id}-${this.form.symbol}-${Date.now()}`)
      if (!response || response.code !== 1) throw new Error(response && response.msg)
      const task = await this.waitResearchTask(response.data.task_id)
      const envelope = task.result || {}
      return {
        data: {
          ...this.normalizeCzscResult(envelope.payload || {}, envelope),
          run_id: envelope.backtest_run_id,
          task_id: task.task_id,
          billing: response.data.billing || (task.request && task.request._billing) || {}
        }
      }
    },
    async runGraphBacktest () {
      const response = await createCzscBacktest({
        strategy_id: this.source.source_id || this.source.id,
        strategy_version_id: this.source.strategy_version_id,
        strategy_name: this.source.name,
        symbol: this.form.symbol.trim().toUpperCase(),
        timeframe: this.form.timeframe,
        start: this.form.startDate.format('YYYY-MM-DD'),
        end: this.form.endDate.format('YYYY-MM-DD'),
        initial_cash: this.form.initialCapital,
        commission_rate: this.form.commission,
        slippage: this.form.slippage,
        leverage_enabled: this.form.leverageEnabled,
        leverage: this.form.leverage,
        parameters: this.params,
        execution_assumptions: {
          execution_price: 'next_bar_open',
          commission_rate: this.form.commission,
          slippage: this.form.slippage,
          leverage: this.form.leverage
        }
      }, `backtest-graph-${this.source.strategy_version_id}-${this.form.symbol}-${Date.now()}`)
      if (!response || response.code !== 1) throw new Error(response && response.msg)
      const task = await this.waitResearchTask(response.data.task_id)
      const envelope = task.result || {}
      const payload = envelope.payload || {}
      return {
        data: {
          ...payload,
          run_id: envelope.backtest_run_id,
          task_id: task.task_id,
          billing: response.data.billing || (task.request && task.request._billing) || {}
        }
      }
    },
    async waitResearchTask (taskId) {
      const deadline = Date.now() + 300000
      while (Date.now() < deadline) {
        const response = await getTask(taskId)
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        const task = response.data
        if (task.status === 'SUCCEEDED') return task
        if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(task.status)) {
          throw new Error(task.error_message || task.status)
        }
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
      throw new Error(this.$t('trendChart.taskTimeout'))
    },
    normalizeCzscResult (payload, envelope = {}) {
      const metrics = payload.metrics || {}
      const assumptions = envelope.execution_assumptions || payload.parameters || {}
      const percent = value => Number(value || 0) * 100
      const trades = (payload.trades || []).map((trade, index) => ({
        ...trade,
        id: trade.trade_id || index + 1,
        symbol: payload.symbol,
        side: 'long',
        entry_time: trade.entry_datetime,
        exit_time: trade.exit_datetime,
        profit: trade.pnl,
        close_reason: 'signal'
      }))
      const executions = (payload.orders || []).map((order, index) => ({
        ...order,
        id: index + 1,
        symbol: payload.symbol,
        side: order.action === 'open_long' ? 'buy' : 'sell',
        signal_time: order.datetime,
        time: order.datetime,
        commission: order.fee
      }))
      return {
        engine: envelope.engine || { name: 'czsc', version: '0.9.68' },
        totalReturn: percent(metrics.total_return),
        benchmarkTotalReturn: percent(metrics.benchmark_return),
        benchmarkStatus: 'available',
        excessReturn: percent(Number(metrics.total_return || 0) - Number(metrics.benchmark_return || 0)),
        maxDrawdown: percent(metrics.max_drawdown),
        totalExecutions: executions.length,
        totalTrades: trades.length,
        winRate: percent(metrics.win_rate),
        sharpeRatio: Number(metrics.sharpe_ratio || 0),
        resultStatus: trades.length ? 'completed_trades' : 'no_signals',
        audit: { passed: true },
        dataProvenance: { kind: 'market', source: 'local_parquet', snapshot: envelope.dataset_snapshot || {} },
        executionAssumptions: {
          ...assumptions,
          initialCapital: metrics.initial_cash || assumptions.initial_cash,
          startDate: payload.range && payload.range.start,
          endDate: payload.range && payload.range.end,
          commission: assumptions.commission_rate,
          slippage: 0,
          leverage: 1
        },
        equityCurve: (payload.equity_curve || []).map(point => ({
          time: point.datetime || point.timestamp,
          value: point.equity,
          cash: point.cash,
          grossExposure: point.equity ? Math.abs(Number(point.equity) - Number(point.cash || 0)) / Number(point.equity) : 0,
          netExposure: point.equity ? (Number(point.equity) - Number(point.cash || 0)) / Number(point.equity) : 0
        })),
        executions,
        rawTrades: executions,
        closedTrades: trades,
        trades,
        orderLedger: executions.map(item => ({ ...item, status: 'filled', filledQuantity: item.quantity })),
        attribution: {
          feeDrag: metrics.initial_cash ? (payload.orders || []).reduce((sum, item) => sum + Number(item.fee || 0), 0) / Number(metrics.initial_cash) : 0,
          orderStatus: { filled: executions.length, partial: 0, deferred: 0, rejected: 0 }
        }
      }
    },
    async runFactorResearch () {
      if (!this.form.sourceId) {
        this.$message.warning(this.$t('strategyV2.sourceContractRequired'))
        return
      }
      if (!this.ensureBacktestRangeAllowed()) return
      this.running = true
      this.factorResult = null
      this.startRunTimer()
      try {
        if (this.isCzscSource) {
          const quality = this.factorForm.researchType === 'quality'
          const payload = {
            research_type: quality ? 'quality' : 'factor',
            symbol: this.form.symbol.trim().toUpperCase(),
            timeframe: this.form.timeframe,
            limit: Math.max(quality ? 140 : 100, Number(this.form.limit || 1000))
          }
          if (quality) {
            payload.forward_bars = this.factorForm.forwardBars
            payload.sample_step = this.factorForm.sampleStep
          } else {
            payload.start = this.form.startDate.format('YYYY-MM-DD')
            payload.end = this.form.endDate.format('YYYY-MM-DD')
            payload.factor_ids = [this.factorForm.factorId]
          }
          const response = await createFactorResearch(payload, `factor-${this.factorForm.researchType}-${this.form.symbol}-${Date.now()}`)
          if (!response || response.code !== 1) throw new Error(response && response.msg)
          const task = await this.waitResearchTask(response.data.task_id)
          const record = task.result || {}
          this.factorResult = this.normalizeEngineFactorResult(record, this.factorForm.researchType)
          this.selectedRun = { id: `unified:${record.id || task.task_id}`, taskId: task.task_id }
        } else {
          const response = await runStrategyFactorResearch({
            sourceId: this.form.sourceId,
            startDate: this.form.startDate.format('YYYY-MM-DD'),
            endDate: this.form.endDate.format('YYYY-MM-DD'),
            commission: this.form.commission,
            slippage: this.form.slippage,
            factorId: this.factorForm.factorId,
            groups: this.factorForm.groups,
            holdingPeriod: this.factorForm.holdingPeriod,
            neutralizeIndustry: this.factorForm.neutralizeIndustry,
            timeout: 180000
          })
          this.factorResult = response.data
          this.selectedRun = { id: response.data && response.data.runId }
        }
        await this.loadHistory()
      } catch (error) {
        this.$message.error((error && error.backendMessage) || this.$t('strategyV2.factorResearch.runFailed'))
      } finally {
        this.stopRunTimer()
        this.running = false
      }
    },
    runActive () {
      return this.mode === 'portfolio' ? this.run() : this.runFactorResearch()
    },
    async openRun (item) {
      if (this.historyDetailLoading) return
      if (this.mode === 'factor') return this.openFactorRun(item)
      this.historyDetailLoading = true
      this.historyDetailRunId = item.id
      try {
        const response = await getStrategyBacktestRun(item.id)
        const run = response.data || {}
        this.selectedRun = run
        const isCzsc = run.engine_name === 'czsc' || (run.engine && run.engine.name === 'czsc')
        this.result = isCzsc ? this.normalizeCzscResult(run.result || {}, run) : (run.result || null)
        const assumptions = isCzsc
          ? (run.execution_assumptions || {})
          : ((run.result && run.result.executionAssumptions) || {})
        const initialCapital = run.initial_capital !== undefined && run.initial_capital !== null
          ? run.initial_capital
          : assumptions.initialCapital
        const leverage = run.leverage !== undefined && run.leverage !== null
          ? run.leverage
          : assumptions.leverage
        if (initialCapital !== undefined && initialCapital !== null) this.form.initialCapital = Number(initialCapital)
        if (run.commission !== undefined && run.commission !== null) this.form.commission = Number(run.commission)
        else if (assumptions.commission !== undefined) this.form.commission = Number(assumptions.commission)
        if (run.slippage !== undefined && run.slippage !== null) this.form.slippage = Number(run.slippage)
        else if (assumptions.slippage !== undefined) this.form.slippage = Number(assumptions.slippage)
        this.form.leverage = Math.max(1, Number(leverage || 1))
        this.form.leverageEnabled = assumptions.leverageEnabled !== undefined
          ? Boolean(assumptions.leverageEnabled)
          : this.form.leverage > 1
        if (run.start_date || assumptions.startDate) this.form.startDate = moment(run.start_date || assumptions.startDate)
        if (run.end_date || assumptions.endDate) this.form.endDate = moment(run.end_date || assumptions.endDate)
        this.params = run.params || {}
        if (isCzsc) {
          const source = this.sources.find(row => row.engine === 'czsc' && Number(row.strategy_version_id) === Number(run.strategy_version_id))
          if (source) {
            this.form.sourceId = source.id
            this.source = source
            this.manifest = source.manifest
            this.backtestRangePolicy = null
          }
          if (run.symbol) this.form.symbol = run.symbol
          if (run.timeframe) this.form.timeframe = run.timeframe
        } else if (run.source_id && Number(this.form.sourceId) !== Number(run.source_id)) {
          this.form.sourceId = Number(run.source_id)
          const detail = await getScriptSourceDetail(run.source_id)
          this.source = detail.data
          const compiled = await compileScriptSource({ sourceId: run.source_id })
          this.manifest = compiled.data && compiled.data.manifest
          this.backtestRangePolicy = compiled.data && compiled.data.backtestRangePolicy
        }
        this.historyVisible = false
      } catch (error) {
        this.$message.error((error && error.backendMessage) || this.$t('strategyV2.backtest.historyLoadFailed'))
      } finally {
        this.historyDetailLoading = false
        this.historyDetailRunId = null
      }
    },
    async openFactorRun (item) {
      if (this.historyDetailLoading) return
      this.historyDetailLoading = true
      this.historyDetailRunId = item.id
      try {
        if (item.unified_result) {
          this.selectedRun = item
          this.factorResult = this.normalizeEngineFactorResult(item.result_record, item.research_type)
          this.factorForm.researchType = item.research_type
          if (item.factor_id && item.factor_id !== 'signal_quality') this.factorForm.factorId = item.factor_id
          if (item.symbol) this.form.symbol = item.symbol
          if (item.timeframe) this.form.timeframe = item.timeframe
          const source = this.sources.find(row => row.research_asset)
          if (source) {
            this.form.sourceId = source.id
            this.source = source
            this.manifest = source.manifest
            this.backtestRangePolicy = null
          }
          this.historyVisible = false
          return
        }
        const response = await getStrategyFactorResearchRun(item.id)
        const run = response.data || {}
        this.selectedRun = run
        this.factorResult = run.result || null
        this.factorForm = {
          factorId: run.factor_id || 'momentum_20',
          groups: Number(run.groups_count || 5),
          holdingPeriod: Number(run.holding_period || 5),
          neutralizeIndustry: Boolean(run.neutralize_industry),
          researchType: 'factor',
          forwardBars: [5, 10, 20],
          sampleStep: 5
        }
        this.form.commission = Number(run.commission || 0)
        this.form.slippage = Number(run.slippage || 0)
        if (run.start_date) this.form.startDate = moment(run.start_date)
        if (run.end_date) this.form.endDate = moment(run.end_date)
        if (run.source_id && Number(this.form.sourceId) !== Number(run.source_id)) {
          this.form.sourceId = Number(run.source_id)
          const detail = await getScriptSourceDetail(run.source_id)
          this.source = detail.data
          const compiled = await compileScriptSource({ sourceId: run.source_id })
          this.manifest = compiled.data && compiled.data.manifest
          this.backtestRangePolicy = compiled.data && compiled.data.backtestRangePolicy
        }
        this.historyVisible = false
      } catch (error) {
        this.$message.error((error && error.backendMessage) || this.$t('strategyV2.factorResearch.historyLoadFailed'))
      } finally {
        this.historyDetailLoading = false
        this.historyDetailRunId = null
      }
    },
    normalizeEngineFactorResult (record, researchType) {
      return {
        ...((record && record.payload) || {}),
        researchType: researchType || (record && record.result_type === 'factor_quality' ? 'quality' : 'factor'),
        engine: (record && record.engine) || { name: 'czsc', version: '0.9.68' },
        datasetSnapshot: (record && record.dataset_snapshot) || {},
        executionAssumptions: (record && record.execution_assumptions) || {},
        resultId: record && record.id,
        taskId: record && record.task_id
      }
    },
    normalizeEngineFactorHistory (record) {
      const payload = (record && record.payload) || {}
      const quality = record.result_type === 'factor_quality'
      const factor = (payload.factors || [])[0] || {}
      return {
        id: `unified:${record.id}`,
        unified_result: true,
        result_record: record,
        research_type: quality ? 'quality' : 'factor',
        source_name: payload.name || payload.symbol || this.$t('unifiedFactor.assetName'),
        factor_id: quality ? 'signal_quality' : (factor.id || '-'),
        symbol: payload.symbol,
        market: 'CNStock',
        timeframe: payload.timeframe || '1d',
        groups_count: quality ? ((payload.summary && payload.summary.signal_types) || 0) : 1,
        holding_period: quality ? ((payload.summary && payload.summary.sample_count) || 0) : ((factor.series || []).length),
        rank_ic: quality ? ((payload.summary && payload.summary.best_quality_score) || 0) : factor.latest,
        icir: 0,
        net_long_short_return: 0,
        created_at: record.created_at
      }
    },
    factorLabel (factorId) {
      if (factorId === 'signal_quality') return this.$t('unifiedFactor.quality')
      const engineFactor = this.czscFactors.find(item => (item.factor_id || item.id) === factorId)
      if (engineFactor) return engineFactor.name_zh || engineFactor.name_en || factorId
      return this.$t(`strategyV2.factorResearch.factors.${{
        momentum_20: 'momentum20',
        volatility_20: 'volatility20',
        reversal_5: 'reversal5',
        value: 'value',
        quality: 'quality',
        size: 'size'
      }[factorId] || 'momentum20'}`)
    },
    factorTone (value) {
      const number = Number(value || 0)
      return number > 0 ? 'positive' : number < 0 ? 'negative' : ''
    },
    formatPercent (value, signed = true) {
      const number = Number(value || 0)
      return `${signed && number > 0 ? '+' : ''}${number.toFixed(2)}%`
    },
    formatRate (value) {
      return `${(Number(value || 0) * 100).toFixed(3)}%`
    },
    formatNumber (value, digits = 2) {
      const number = Number(value || 0)
      if (!Number.isFinite(number)) return '∞'
      return number.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    },
    formatSignedNumber (value, digits = 2) {
      const number = Number(value || 0)
      if (!Number.isFinite(number)) return '-'
      return `${number > 0 ? '+' : ''}${this.formatNumber(number, digits)}`
    },
    profitTone (value) {
      const number = Number(value || 0)
      if (number > 0) return 'positive'
      if (number < 0) return 'negative'
      return 'neutral'
    },
    formatDate (value) {
      return formatBacktestTime(value, { locale: this.$i18n.locale, fallback: '-' })
    },
    historyStatusLabel (item) {
      return this.$t(`strategyV2.backtest.status.${item.result_status || 'unknown'}`)
    },
    historyReturnTone (item) {
      if (item.result_status === 'no_signals') return 'neutral'
      return Number(item.total_return) >= 0 ? 'positive' : 'negative'
    }
  }
}
</script>

<style lang="less" scoped>
.backtest-page { min-height: 100%; padding: 18px 22px 28px; background: #f4f6f8; color: #182230; }
.hero-card, .panel { border: 1px solid #e4e9ef; border-radius: 12px; background: #fff; box-shadow: 0 10px 30px rgba(15, 35, 60, 0.055); }
.hero-card { display: flex; justify-content: space-between; align-items: center; gap: 22px; padding: 18px 22px; margin-bottom: 14px; }
.hero-card h1 { margin: 2px 0 4px; font-size: 24px; color: #17233d; }
.hero-card p, .section-hint, .history-title-row p { margin: 0; color: #718096; line-height: 1.55; }
.eyebrow { color: #52c41a; font-weight: 800; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
.engine-fields { margin-top: 14px; padding-top: 14px; border-top: 1px solid #e7ebf0; }
.hero-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.hero-stat { display: inline-flex; align-items: baseline; gap: 5px; padding: 7px 10px; border-radius: 8px; color: #718096; background: #f7f9fb; font-size: 12px; }
.hero-stat strong { color: #25364f; font-size: 16px; }
.workspace-grid { display: grid; grid-template-columns: minmax(340px, 420px) minmax(620px, 1fr); gap: 14px; align-items: start; }
.panel { padding: 18px; }
.config-panel { position: sticky; top: 74px; display: flex; overflow: hidden; max-height: calc(100vh - 230px); flex-direction: column; padding: 0; }
.config-scroll { min-height: 0; overflow-y: auto; padding: 18px 18px 10px; scrollbar-gutter: stable; }
.run-action-bar { position: relative; z-index: 2; flex: none; padding: 12px 18px 16px; border-top: 1px solid #e8edf2; background: #fff; box-shadow: 0 -10px 24px rgba(15, 35, 60, 0.06); }
.result-panel { min-height: calc(100vh - 190px); }
.panel-heading, .panel-heading > div, .subheading, .history-title-row, .history-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.panel-heading > div { justify-content: flex-start; }
.panel-heading h2, .history-title-row h2 { margin: 0; color: #17233d; font-size: 17px; }
.step-badge { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 7px; color: #397d16; background: #f0f9e8; font-size: 11px; font-weight: 800; }
.runtime-heading { margin-top: 22px; }
.full-width { width: 100%; }
.manifest-card { margin-top: 12px; padding: 13px; border: 1px solid #dfe8f1; border-radius: 9px; background: #f8fbff; }
.manifest-title { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; color: #315c85; font-weight: 700; }
.manifest-grid, .metrics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.manifest-grid div, .metric-card { display: flex; flex-direction: column; gap: 3px; }
.manifest-grid span, .metric-card span, .assumption-strip span { color: #7c8ca1; font-size: 11px; }
.manifest-grid strong { color: #23344d; overflow-wrap: anywhere; }
.universe-contract-hint { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; padding-top: 9px; border-top: 1px solid #e5edf5; color: #60758b; font-size: 11px; line-height: 1.55; }
.section-hint { margin: 7px 0 10px; font-size: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
.range-limit-alert { margin: 0 0 14px; }
.switch-row { display: flex; align-items: center; gap: 8px; min-height: 32px; color: #7c8ca1; font-size: 11px; }
.params-section { margin: 2px 0 14px; padding-top: 12px; border-top: 1px solid #eef2f6; }
.factor-contract-alert { margin: 10px 0 14px; }
.subheading h3 { margin: 0; color: #26364c; font-size: 14px; }
.subheading span { color: #7c8ca1; font-size: 11px; }
.metrics-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.metric-card { padding: 13px; border: 1px solid #edf0f4; border-radius: 9px; background: #f7f9fc; }
.metric-card strong { font-size: 20px; color: #20324a; }
.positive { color: var(--market-rise-color) !important; }
.negative { color: var(--market-fall-color) !important; }
.trade-profit { font-weight: 700; font-variant-numeric: tabular-nums; }
.neutral { color: #94a3b8 !important; }
.run-id { color: #8a97aa; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.result-empty { position: relative; min-height: calc(100vh - 265px); display: flex; overflow: hidden; flex-direction: column; align-items: center; justify-content: center; padding: 52px 30px; text-align: center; }
.result-empty::before, .result-empty::after { position: absolute; width: 320px; height: 320px; border-radius: 50%; content: ''; pointer-events: none; filter: blur(2px); }
.result-empty::before { top: 9%; right: 5%; background: radial-gradient(circle, rgba(82, 196, 26, .075), rgba(82, 196, 26, 0) 70%); }
.result-empty::after { bottom: 3%; left: 4%; background: radial-gradient(circle, rgba(24, 144, 255, .055), rgba(24, 144, 255, 0) 70%); }
.empty-hero-card { position: relative; z-index: 1; width: 100%; max-width: 700px; padding: 34px 42px 30px; border: 1px solid #e4ebf2; border-radius: 20px; background: linear-gradient(145deg, rgba(255, 255, 255, .98), rgba(248, 252, 246, .94)); box-shadow: 0 18px 48px rgba(36, 59, 85, .09); }
.empty-hero-card::before { position: absolute; top: 0; left: 18%; right: 18%; height: 3px; border-radius: 0 0 4px 4px; background: linear-gradient(90deg, rgba(82, 196, 26, 0), #52c41a, rgba(82, 196, 26, 0)); content: ''; }
.result-running { min-height: 390px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 30px; text-align: center; color: #718096; }
.result-running h3 { margin: 4px 0 0; color: #17233d; font-size: 18px; }
.result-running p { max-width: 620px; margin: 0; line-height: 1.6; }
.result-running > strong { color: #3f7f1f; font-variant-numeric: tabular-nums; }
.running-icon { display: inline-flex; width: 64px; height: 64px; align-items: center; justify-content: center; border: 1px solid #d9f7be; border-radius: 22px; color: #52c41a; background: #f6ffed; font-size: 27px; }
.running-contract { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 7px; }
.running-contract span { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid #e4e9ef; border-radius: 999px; color: #64748b; font-size: 11px; }
.empty-orbit { display: inline-flex; width: 72px; height: 72px; align-items: center; justify-content: center; border: 1px solid #d8edcd; border-radius: 24px; color: #52c41a; background: linear-gradient(145deg, #fbfff8, #eefbe6); box-shadow: 0 10px 26px rgba(82, 196, 26, .13), 0 0 0 8px rgba(82, 196, 26, .045); font-size: 29px; transform: rotate(-4deg); }
.empty-orbit > .anticon { transform: rotate(4deg); }
.result-empty h3 { margin: 20px 0 7px; color: #23344d; font-size: 19px; }
.result-empty p { max-width: 520px; margin: 0 auto; color: #7c8ca1; line-height: 1.65; }
.empty-checks { display: flex; justify-content: center; gap: 9px; flex-wrap: wrap; margin-top: 20px; }
.empty-checks span { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; border: 1px solid #e7ebf0; border-radius: 999px; color: #7c8ca1; font-size: 11px; }
.empty-checks span.done { color: #3f7f1f; border-color: #d9f7be; background: #f6ffed; }
.empty-preview-grid { position: relative; z-index: 1; display: grid; width: 100%; max-width: 860px; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.empty-preview-card { display: grid; min-width: 0; grid-template-columns: 34px 1fr; grid-template-rows: auto auto; column-gap: 11px; padding: 15px 16px; border: 1px solid #e5ebf1; border-radius: 12px; background: rgba(255, 255, 255, .92); box-shadow: 0 7px 20px rgba(36, 59, 85, .055); text-align: left; transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.empty-preview-card:hover { border-color: #cbe8ba; box-shadow: 0 10px 24px rgba(36, 59, 85, .08); transform: translateY(-2px); }
.empty-preview-card > .anticon { display: inline-flex; width: 34px; height: 34px; grid-row-start: 1; grid-row-end: 3; align-items: center; justify-content: center; align-self: center; border-radius: 10px; color: #52c41a; background: #f2faed; font-size: 17px; }
.empty-preview-card span { grid-column: 2; overflow: hidden; color: #7c8ca1; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.empty-preview-card strong { display: -webkit-box; min-width: 0; min-height: 32px; grid-column: 2; overflow: hidden; color: #27364a; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; word-break: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.result-trustbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding: 10px 12px; border: 1px solid; border-radius: 9px; }
.result-trustbar > div:first-child { display: flex; min-width: 0; align-items: center; gap: 8px; }
.result-trustbar strong { white-space: nowrap; }
.result-trustbar span { overflow: hidden; color: #64748b; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.result-trustbar.is-success { border-color: #b7eb8f; background: #f6ffed; color: #3f8600; }
.result-trustbar.is-warning { border-color: #ffe58f; background: #fffbe6; color: #ad6800; }
.result-trustbar.is-error { border-color: #ffccc7; background: #fff2f0; color: #cf1322; }
.trust-badges { display: flex; flex: none; }
.chart-card { margin-top: 14px; padding: 14px; border: 1px solid #edf0f4; border-radius: 9px; }
.subheading > div { min-width: 0; }
.benchmark-caption { display: block; margin-top: 3px; }
.equity-chart { display: block; width: 100%; height: 360px; margin-top: 8px; }
.assumption-strip { display: grid; grid-template-columns: 1fr 1.8fr 0.8fr 0.8fr; gap: 8px; margin-top: 12px; }
.assumption-strip div { min-width: 0; padding: 9px 10px; border-radius: 8px; background: #f8fafc; }
.assumption-strip strong { display: block; overflow: hidden; margin-top: 2px; color: #334155; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.result-tabs { margin-top: 14px; }
.history-header { margin: 16px 0 9px; }
.history-header h3 { margin: 0; color: #26364c; }
.history-title-row { align-items: flex-start; }
.history-title-row p { margin-top: 4px; font-size: 12px; }
.drawer-history-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.drawer-history-header p { margin: 0; color: #718096; font-size: 12px; line-height: 1.55; }
.drawer-run-list { display: flex; flex-direction: column; gap: 9px; }
.run-card { display: flex; min-width: 0; flex-direction: column; gap: 6px; padding: 11px; border: 1px solid #e6eaf0; border-radius: 9px; background: #fafbfc; color: inherit; text-align: left; cursor: pointer; transition: 0.16s ease; }
.run-card:hover, .run-card.active { border-color: #85ce62; background: #fbfff8; transform: translateY(-1px); }
.run-card__top, .run-card__metrics { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.run-card__top strong { min-width: 0; overflow: hidden; color: #2a3b52; text-overflow: ellipsis; white-space: nowrap; }
.run-card__top em { color: #9aa5b5; font-style: normal; font-size: 11px; }
.run-card__meta { overflow: hidden; color: #8491a4; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.run-card__status { width: fit-content; padding: 2px 6px; border-radius: 999px; color: #4d7c0f; background: #ecfccb; font-size: 9px; }
.run-card__status.status-no_signals, .run-card__status.status-open_position_only { color: #a16207; background: #fef3c7; }
.run-card__status.status-unknown { color: #64748b; background: #e2e8f0; }
.run-card__metrics b { font-size: 15px; }
.factor-history-metrics b { font-variant-numeric: tabular-nums; }
.run-card__metrics small { color: #8491a4; }
.theme-dark.backtest-page { background: #080808; color: rgba(255, 255, 255, 0.88); }
.theme-dark .hero-card, .theme-dark .panel { border-color: rgba(255, 255, 255, 0.1); background: #111; box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28); }
.theme-dark .run-action-bar { border-color: rgba(255, 255, 255, 0.1); background: #111; box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.34); }
.theme-dark .hero-card h1, .theme-dark .panel-heading h2, .theme-dark .history-title-row h2, .theme-dark .subheading h3, .theme-dark .history-header h3, .theme-dark .result-empty h3, .theme-dark .result-running h3 { color: #f3f4f6; }
.theme-dark .hero-stat, .theme-dark .metric-card, .theme-dark .assumption-strip div, .theme-dark .run-card { border-color: rgba(255, 255, 255, 0.1); background: #0d0d0d; }
.theme-dark .hero-stat strong, .theme-dark .manifest-grid strong, .theme-dark .metric-card strong, .theme-dark .assumption-strip strong, .theme-dark .run-card__top strong { color: #e5e7eb; }
.theme-dark .manifest-card { border-color: rgba(255, 255, 255, 0.1); background: #0d0d0d; }
.theme-dark .manifest-title { color: #73d13d; }
.theme-dark .chart-card { border-color: rgba(255, 255, 255, 0.1); }
.theme-dark .result-trustbar.is-success { border-color: #315d22; background: #13200f; color: #73d13d; }
.theme-dark .result-trustbar.is-warning { border-color: #664d03; background: #211b08; color: #ffc53d; }
.theme-dark .result-trustbar.is-error { border-color: #6b2525; background: #251111; color: #ff7875; }
.theme-dark .result-trustbar span { color: rgba(255, 255, 255, 0.52); }
.theme-dark .run-card:hover, .theme-dark .run-card.active { border-color: #52c41a; background: #15230f; }
.theme-dark .empty-hero-card { border-color: rgba(255, 255, 255, .11); background: linear-gradient(145deg, #121512, #0d0f0d); box-shadow: 0 20px 54px rgba(0, 0, 0, .32); }
.theme-dark .empty-preview-card { border-color: rgba(255, 255, 255, 0.1); background: #0d0d0d; }
.theme-dark .empty-preview-card strong { color: #e5e7eb; }
.theme-dark .result-running > strong { color: #73d13d; }
.theme-dark .running-icon { border-color: rgba(82, 196, 26, 0.38); background: #10190c; }
.theme-dark .running-contract span { border-color: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.58); background: #0d0d0d; }
.theme-dark /deep/ .ant-form-item-label > label, .theme-dark /deep/ .ant-table { color: rgba(255, 255, 255, 0.72); }
.theme-dark /deep/ .ant-table-thead > tr > th { border-color: rgba(255, 255, 255, 0.1); background: #0d0d0d; color: rgba(255, 255, 255, 0.68); }
.theme-dark /deep/ .ant-table-tbody > tr > td { border-color: rgba(255, 255, 255, 0.08); background: #111; color: rgba(255, 255, 255, 0.72); }
@media (max-width: 1100px) { .workspace-grid { grid-template-columns: 1fr; } .config-panel { position: static; overflow: visible; max-height: none; } .config-scroll { overflow: visible; } .result-panel { min-height: 560px; } .result-empty { min-height: 480px; } }
@media (max-width: 720px) { .backtest-page { padding: 12px; } .hero-card { align-items: flex-start; flex-direction: column; } .hero-actions { justify-content: flex-start; } .result-empty { padding: 34px 12px; }.empty-hero-card { padding: 30px 18px 26px; }.form-grid, .manifest-grid, .metrics-grid, .assumption-strip, .empty-preview-grid { grid-template-columns: 1fr; } }
</style>

<style lang="less">
.backtest-history-drawer .ant-drawer-header { border-bottom: 1px solid #e8edf2; }
.backtest-history-drawer .ant-drawer-body { padding: 16px; }
.drawer-detail-loading { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; padding: 10px 12px; border: 1px solid #b7eb8f; border-radius: 8px; color: #3f7f1f; background: #f6ffed; font-size: 12px; }
.run-card:disabled { cursor: wait; opacity: .68; }
.run-card.loading { border-color: #52c41a; opacity: 1; }
.run-card__top strong .anticon { margin-right: 6px; color: #52c41a; }
.backtest-history-drawer.theme-dark .ant-drawer-content,
.backtest-history-drawer.theme-dark .ant-drawer-header { background: #111; }
.backtest-history-drawer.theme-dark .ant-drawer-header { border-color: rgba(255, 255, 255, 0.1); }
.backtest-history-drawer.theme-dark .ant-drawer-title,
.backtest-history-drawer.theme-dark .ant-drawer-close { color: rgba(255, 255, 255, 0.88); }
.backtest-history-drawer.theme-dark .drawer-history-header p { color: rgba(255, 255, 255, 0.5); }
.backtest-history-drawer.theme-dark .run-card { border-color: rgba(255, 255, 255, 0.1); background: #0d0d0d; color: rgba(255, 255, 255, 0.72); }
.backtest-history-drawer.theme-dark .run-card:hover,
.backtest-history-drawer.theme-dark .run-card.active { border-color: #52c41a; background: #15230f; }
.backtest-history-drawer.theme-dark .drawer-detail-loading { border-color: rgba(82, 196, 26, .38); color: #73d13d; background: #10190c; }
.backtest-history-drawer.theme-dark .run-card__top strong { color: #e5e7eb; }
</style>
