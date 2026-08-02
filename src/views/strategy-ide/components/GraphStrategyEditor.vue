<template>
  <section class="graph-editor" :class="{ 'graph-editor--dark': isDark }">
    <header class="graph-editor__header">
      <div>
        <h2>{{ isZh ? '图形策略' : 'Graph strategy' }}</h2>
        <p>{{ isZh ? '将指标信号连接为可回测、可审核的策略。' : 'Connect signals into a backtestable, review-first strategy.' }}</p>
      </div>
      <div class="graph-editor__actions">
        <a-button icon="check" :loading="validating" @click="validate">{{ isZh ? '校验' : 'Validate' }}</a-button>
        <a-button icon="eye" :loading="previewing" @click="preview">{{ isZh ? '信号预览' : 'Preview signal' }}</a-button>
        <a-button icon="code" :loading="compiling" @click="compile">{{ isZh ? '编译计划' : 'Compile plan' }}</a-button>
        <a-button icon="bar-chart" @click="$emit('backtest')">{{ isZh ? '回测' : 'Backtest' }}</a-button>
        <a-button icon="thunderbolt" @click="$emit('live')">{{ isZh ? '创建运行' : 'Create run' }}</a-button>
        <a-button type="primary" icon="save" :loading="saving" @click="$emit('save')">{{ isZh ? '保存策略' : 'Save strategy' }}</a-button>
      </div>
    </header>

    <div class="graph-editor__toolbar">
      <a-button size="small" icon="plus" @click="addNode('subscription')">{{ isZh ? '订阅' : 'Subscription' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('signal')">{{ isZh ? '信号' : 'Signal' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('condition_group')">{{ isZh ? '条件组' : 'Condition' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('event')">{{ isZh ? '事件' : 'Event' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('position_rule')">{{ isZh ? '仓位' : 'Position' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('protection')">{{ isZh ? '保护' : 'Protection' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('action')">{{ isZh ? '动作' : 'Action' }}</a-button>
      <span class="graph-editor__status" :class="{ 'is-ok': validation && validation.valid }">
        {{ statusText }}
      </span>
    </div>

    <div class="graph-editor__body">
      <div class="graph-editor__nodes">
        <article v-for="node in local.nodes" :key="node.id" class="graph-node">
          <div class="graph-node__head">
            <span class="graph-node__type">{{ node.type }}</span>
            <strong>{{ node.id }}</strong>
            <a-button type="link" icon="delete" size="small" @click="removeNode(node.id)" />
          </div>
          <div class="graph-node__form">
            <a-input v-model="node.id" size="small" :addon-before="isZh ? 'ID' : 'ID'" @change="emitChange" />
            <a-select
              v-if="node.type === 'signal'"
              v-model="node.config.signal_id"
              size="small"
              show-search
              :placeholder="isZh ? '选择统一信号' : 'Select signal'"
              @change="handleSignalChange(node)"
            >
              <a-select-option v-for="item in signalOptions" :key="item.signal_id" :value="item.signal_id">
                {{ signalLabel(item) }}
              </a-select-option>
            </a-select>
            <template v-if="node.type === 'signal'">
              <div v-for="key in signalParameterKeys(node)" :key="`${node.id}-${key}`" class="graph-param">
                <label>{{ parameterLabel(node, key) }}</label>
                <a-select
                  v-if="parameterSchema(node, key).enum"
                  v-model="node.config.params[key]"
                  size="small"
                  @change="emitChange"
                >
                  <a-select-option v-for="option in parameterSchema(node, key).enum" :key="String(option)" :value="option">
                    {{ option }}
                  </a-select-option>
                </a-select>
                <a-input-number
                  v-else-if="['integer', 'number'].includes(parameterSchema(node, key).type)"
                  v-model="node.config.params[key]"
                  size="small"
                  :min="parameterSchema(node, key).minimum"
                  :max="parameterSchema(node, key).maximum"
                  :step="parameterSchema(node, key).type === 'integer' ? 1 : 0.05"
                  @change="emitChange"
                />
                <a-switch
                  v-else-if="parameterSchema(node, key).type === 'boolean'"
                  v-model="node.config.params[key]"
                  size="small"
                  @change="emitChange"
                />
                <a-input v-else v-model="node.config.params[key]" size="small" @change="emitChange" />
              </div>
            </template>
            <a-input v-if="node.type === 'subscription'" v-model="node.config.market" size="small" :placeholder="isZh ? '市场，如 Crypto' : 'Market, e.g. Crypto'" @change="emitChange" />
            <a-input v-if="node.type === 'subscription'" v-model="node.config.symbol" size="small" :placeholder="isZh ? '标的，如 BTC/USDT' : 'Symbol, e.g. BTC/USDT'" @change="emitChange" />
            <a-input v-if="node.type === 'subscription'" v-model="node.config.frequency" size="small" placeholder="1d" @change="emitChange" />
            <a-select v-if="node.type === 'condition_group'" v-model="node.config.operator" size="small" @change="emitChange">
              <a-select-option value="AND">AND</a-select-option>
              <a-select-option value="OR">OR</a-select-option>
              <a-select-option value="NOT">NOT</a-select-option>
            </a-select>
            <a-select v-if="node.type === 'event'" v-model="node.config.action" size="small" @change="emitChange">
              <a-select-option v-for="item in eventActions" :key="item" :value="item">{{ item }}</a-select-option>
            </a-select>
            <a-select v-if="node.type === 'position_rule'" v-model="node.config.mode" size="small" @change="emitChange">
              <a-select-option value="target">target</a-select-option>
              <a-select-option value="delta">delta</a-select-option>
              <a-select-option value="scale">scale</a-select-option>
              <a-select-option value="max_position">max_position</a-select-option>
            </a-select>
            <a-input-number
              v-if="node.type === 'position_rule'"
              v-model="node.config.target_percent"
              size="small"
              :min="-1"
              :max="1"
              :step="0.05"
              @change="emitChange"
            />
            <a-select v-if="node.type === 'protection'" v-model="node.config.kind" size="small" @change="emitChange">
              <a-select-option value="stop_loss">stop_loss</a-select-option>
              <a-select-option value="take_profit">take_profit</a-select-option>
              <a-select-option value="trailing_stop">trailing_stop</a-select-option>
              <a-select-option value="time_exit">time_exit</a-select-option>
              <a-select-option value="cooldown">cooldown</a-select-option>
            </a-select>
            <a-input-number
              v-if="node.type === 'protection' && !['time_exit', 'cooldown'].includes(node.config.kind)"
              v-model="node.config.percent"
              size="small"
              :min="0"
              :max="1"
              :step="0.01"
              @change="emitChange"
            />
            <a-input-number
              v-if="node.type === 'protection' && ['time_exit', 'cooldown'].includes(node.config.kind)"
              v-model="node.config.bars"
              size="small"
              :min="1"
              :step="1"
              @change="emitChange"
            />
            <a-select v-if="node.type === 'action'" v-model="node.config.kind" size="small" @change="emitChange">
              <a-select-option value="target_percent">target_percent</a-select-option>
              <a-select-option value="target_value">target_value</a-select-option>
              <a-select-option value="target_quantity">target_quantity</a-select-option>
              <a-select-option value="emit_signal">emit_signal</a-select-option>
            </a-select>
            <a-input-number v-if="node.type === 'action' && node.config.kind !== 'emit_signal'" v-model="node.config.value" size="small" :step="0.05" @change="emitChange" />
          </div>
        </article>
      </div>

      <aside class="graph-editor__side">
        <h3>{{ isZh ? '连接' : 'Connections' }}</h3>
        <div v-for="(edge, index) in local.edges" :key="`${edge.from}-${edge.to}-${index}`" class="graph-edge">
          <a-select v-model="edge.from" size="small" @change="emitChange">
            <a-select-option v-for="node in local.nodes" :key="`from-${node.id}`" :value="node.id">{{ node.id }}</a-select-option>
          </a-select>
          <span>→</span>
          <a-select v-model="edge.to" size="small" @change="emitChange">
            <a-select-option v-for="node in local.nodes" :key="`to-${node.id}`" :value="node.id">{{ node.id }}</a-select-option>
          </a-select>
          <a-button type="link" icon="delete" size="small" @click="local.edges.splice(index, 1); emitChange()" />
        </div>
        <a-button block size="small" icon="plus" @click="addEdge">{{ isZh ? '添加连接' : 'Add connection' }}</a-button>
        <h3>{{ isZh ? 'GraphSpec 预览' : 'GraphSpec preview' }}</h3>
        <a-textarea :value="prettySpec" :rows="12" readonly />
        <a-alert v-if="validationError" type="error" show-icon :message="validationError" />
        <a-alert v-if="catalogError" type="warning" show-icon :message="catalogError">
          <a-button slot="action" type="link" size="small" :loading="catalogLoading" @click="loadCatalog">
            {{ isZh ? '重试' : 'Retry' }}
          </a-button>
        </a-alert>
        <a-alert v-if="compiled" type="success" show-icon :message="isZh ? '编译器已生成 Strategy V2 计划' : 'Strategy V2 plan compiled'" />
        <div class="graph-preview">
          <h3>{{ isZh ? '预览标的' : 'Preview target' }}</h3>
          <a-input v-model="previewMarket" size="small" :placeholder="isZh ? '市场' : 'Market'" />
          <a-input v-model="previewSymbol" size="small" :placeholder="isZh ? '标的' : 'Symbol'" />
          <a-input v-model="previewTimeframe" size="small" placeholder="1d" />
          <a-button block size="small" icon="eye" :loading="previewing" @click="preview">
            {{ isZh ? `运行当前 K 线预览（至少 ${previewMinimumBars} 根）` : `Run bar preview (min ${previewMinimumBars})` }}
          </a-button>
          <a-alert
            v-if="previewResult"
            class="graph-preview__result"
            :type="previewResult.matched ? 'success' : 'info'"
            show-icon
            :message="previewResult.matched ? (isZh ? '当前 K 线命中策略' : 'Strategy matched') : (isZh ? '当前 K 线未命中' : 'No match on current bar')"
            :description="previewMeta"
          />
          <a-alert v-if="previewError" class="graph-preview__result" type="error" show-icon :message="previewError" />
          <pre v-if="previewResult" class="graph-preview__json">{{ previewJson }}</pre>
        </div>
      </aside>
    </div>
  </section>
</template>

<script>
import { compileSignalGraph, evaluateSignalGraph, getMarketBars, getSignalCatalog, validateSignalGraph } from '@/api/domain'

const ACTIONS = ['open_long', 'close_long', 'open_short', 'close_short', 'reverse', 'emit_signal']

function clone (value) {
  return JSON.parse(JSON.stringify(value || {}))
}

export default {
  name: 'GraphStrategyEditor',
  props: {
    value: { type: Object, default: () => ({}) },
    isDark: { type: Boolean, default: false },
    saving: { type: Boolean, default: false }
  },
  data () {
    return {
      local: clone(this.value),
      signals: [],
      catalogError: '',
      catalogLoading: false,
      validation: null,
      validationError: '',
      compiled: null,
      validating: false,
      compiling: false,
      previewing: false,
      previewResult: null,
      previewProvenance: null,
      previewError: '',
      previewBars: 0,
      previewMarket: '',
      previewSymbol: '',
      previewTimeframe: '1d',
      idSeed: 1,
      eventActions: ACTIONS
    }
  },
  computed: {
    isZh () {
      return String((this.$i18n && this.$i18n.locale) || '').toLowerCase().startsWith('zh')
    },
    signalOptions () {
      const rows = this.signals.filter(item => item && item.signal_id)
      const known = new Set(rows.map(item => item.signal_id))
      const currentNodes = this.local.nodes || []
      currentNodes.forEach(node => {
        const signalId = node && node.type === 'signal' && node.config && node.config.signal_id
        if (signalId && !known.has(signalId)) {
          rows.push({
            signal_id: signalId,
            name_zh: signalId,
            name_en: signalId,
            provider: String(signalId).startsWith('legacy.czsc.') ? 'legacy.czsc' : 'unknown',
            status: 'catalog_unavailable',
            minimum_bars: 20,
            parameter_schema: {}
          })
          known.add(signalId)
        }
      })
      return rows
    },
    prettySpec () {
      return JSON.stringify(this.local, null, 2)
    },
    previewMeta () {
      const decisions = Array.isArray(this.previewResult && this.previewResult.decisions)
        ? this.previewResult.decisions.length
        : 0
      const providers = this.previewResult && this.previewResult.diagnostics && this.previewResult.diagnostics.provider_versions
      const providerText = providers && providers.length ? ` · ${providers.join(', ')}` : ''
      const snapshot = this.previewProvenance && this.previewProvenance.snapshot_id
        ? ` · ${this.previewProvenance.snapshot_id.slice(0, 18)}...`
        : ''
      return `${this.previewMarket || '-'}:${this.previewSymbol || '-'} · ${this.previewTimeframe || '-'} · ${this.previewBars} bars · ${decisions} decisions${providerText}${snapshot}`
    },
    previewMinimumBars () {
      const minimums = (this.local.nodes || [])
        .filter(node => node && node.type === 'signal')
        .map(node => {
          const definition = this.signalDefinition(node)
          if (!definition) return 0
          const params = node.config && node.config.params ? node.config.params : {}
          const schema = definition.parameter_schema || {}
          const parameterMinimum = Object.keys(schema)
            .filter(key => ['integer', 'number'].includes(schema[key] && schema[key].type))
            .map(key => Number(params[key] || (schema[key] && schema[key].default) || 0))
          return Math.max(Number(definition.minimum_bars || 0), ...parameterMinimum)
        })
        .filter(value => value > 0)
      return minimums.length ? Math.max(...minimums) : 20
    },
    previewJson () {
      return JSON.stringify(this.previewResult, null, 2)
    },
    statusText () {
      if (this.validation && this.validation.valid) return this.isZh ? '校验通过' : 'Valid'
      if (this.validationError) return this.isZh ? '需要修正' : 'Needs fixes'
      return this.isZh ? '未校验' : 'Not validated'
    }
  },
  watch: {
    value: {
      deep: true,
      handler (value) {
        this.local = clone(value)
        this.normalizeLocalNodes()
        this.syncPreviewTarget()
      }
    }
  },
  mounted () {
    this.normalizeLocalNodes()
    this.loadCatalog()
    this.syncPreviewTarget()
  },
  methods: {
    async loadCatalog () {
      this.catalogLoading = true
      this.catalogError = ''
      try {
        const response = await getSignalCatalog()
        const payload = (response && response.data) || response || {}
        this.signals = Array.isArray(payload.signals) ? payload.signals : []
        if (!this.signals.length) throw new Error(this.isZh ? '信号目录为空' : 'Signal catalog is empty')
      } catch (_) {
        this.catalogError = this.isZh ? '信号目录暂时不可用，已保留当前策略中的信号。' : 'Signal catalog is temporarily unavailable; existing strategy signals are preserved.'
      } finally {
        this.catalogLoading = false
      }
    },
    signalLabel (item) {
      return `${this.isZh ? (item.name_zh || item.name_en) : (item.name_en || item.name_zh)} · ${item.signal_id}`
    },
    signalDefinition (node) {
      const signalId = node && node.config && node.config.signal_id
      return this.signalOptions.find(item => item.signal_id === signalId) || null
    },
    normalizeLocalNodes () {
      if (!Array.isArray(this.local.nodes)) this.$set(this.local, 'nodes', [])
      this.local.nodes.forEach(node => {
        if (!node.config) this.$set(node, 'config', {})
        if (node.type === 'signal' && !node.config.params) this.$set(node.config, 'params', {})
      })
    },
    signalParameterKeys (node) {
      const schema = this.signalDefinition(node)
      return schema && schema.parameter_schema ? Object.keys(schema.parameter_schema) : []
    },
    parameterSchema (node, key) {
      const definition = this.signalDefinition(node)
      return definition && definition.parameter_schema && definition.parameter_schema[key]
        ? definition.parameter_schema[key]
        : {}
    },
    parameterLabel (node, key) {
      const schema = this.parameterSchema(node, key)
      return schema.title || key
    },
    handleSignalChange (node) {
      const definition = this.signalDefinition(node)
      const schema = definition && definition.parameter_schema ? definition.parameter_schema : {}
      const params = { ...(node.config.params || {}) }
      Object.entries(schema).forEach(([key, item]) => {
        if (typeof params[key] === 'undefined' && item && Object.prototype.hasOwnProperty.call(item, 'default')) params[key] = item.default
      })
      this.$set(node.config, 'params', params)
      this.emitChange()
    },
    emitChange () {
      this.validation = null
      this.validationError = ''
      this.previewResult = null
      this.previewProvenance = null
      this.previewError = ''
      this.$emit('input', clone(this.local))
      this.$emit('change', clone(this.local))
    },
    syncPreviewTarget () {
      const node = (this.local.nodes || []).find(item => item && item.type === 'subscription')
      const config = node && node.config ? node.config : {}
      const configuredSymbols = config.symbols || config.instruments || config.symbol
      const firstSymbol = Array.isArray(configuredSymbols) ? configuredSymbols[0] : configuredSymbols
      const symbol = firstSymbol && typeof firstSymbol === 'object' ? firstSymbol.symbol : firstSymbol
      if (!this.previewMarket) this.previewMarket = config.market || ''
      if (!this.previewSymbol) this.previewSymbol = symbol || ''
      if (!this.previewTimeframe || this.previewTimeframe === '1d') {
        this.previewTimeframe = config.frequency || config.timeframe || this.previewTimeframe
      }
    },
    addNode (type) {
      const id = `${type}_${this.idSeed++}`
      const firstSignal = this.signalOptions[0]
      const signalParams = firstSignal && firstSignal.parameter_schema
        ? Object.fromEntries(Object.entries(firstSignal.parameter_schema).filter(([, item]) => item && Object.prototype.hasOwnProperty.call(item, 'default')).map(([key, item]) => [key, item.default]))
        : {}
      let config
      if (type === 'subscription') {
        config = { market: 'Crypto', symbol: 'BTC/USDT', frequency: '1d' }
      } else if (type === 'signal') {
        config = { signal_id: firstSignal ? firstSignal.signal_id : 'qd.technical.close_above_sma.v1', params: signalParams }
      } else if (type === 'condition_group') {
        config = { operator: 'AND' }
      } else if (type === 'event') {
        config = { action: 'open_long' }
      } else if (type === 'position_rule') {
        config = { mode: 'target', target_percent: 1 }
      } else if (type === 'protection') {
        config = { kind: 'stop_loss', percent: 0.03 }
      } else {
        config = { kind: 'target_percent', value: 1 }
      }
      this.local.nodes = [...(this.local.nodes || []), { id, type, config, position: {} }]
      this.emitChange()
    },
    removeNode (id) {
      this.local.nodes = (this.local.nodes || []).filter(item => item.id !== id)
      this.local.edges = (this.local.edges || []).filter(item => item.from !== id && item.to !== id)
      this.emitChange()
    },
    addEdge () {
      const nodes = this.local.nodes || []
      if (nodes.length < 2) return
      this.local.edges = [...(this.local.edges || []), { from: nodes[nodes.length - 2].id, to: nodes[nodes.length - 1].id }]
      this.emitChange()
    },
    async validate () {
      this.validating = true
      this.validationError = ''
      try {
        const response = await validateSignalGraph({ graph: this.local })
        const data = (response && response.data) || response || {}
        this.validation = data
        if (!data.valid) {
          const errors = Array.isArray(data.errors) ? data.errors : []
          this.validationError = errors.map(item => item && (item.message || item.code)).filter(Boolean).join('; ') || (this.isZh ? '图形策略校验失败' : 'Graph validation failed')
        }
        this.$emit('validated', !!data.valid)
        return !!data.valid
      } catch (error) {
        this.validationError = error.backendMessage || error.message || (this.isZh ? '图形策略校验失败' : 'Graph validation failed')
        this.validation = { valid: false }
        this.$emit('validated', false)
        return false
      } finally {
        this.validating = false
      }
    },
    async compile () {
      this.compiling = true
      this.validationError = ''
      try {
        const response = await compileSignalGraph({ graph: this.local })
        this.compiled = (response && response.data) || response || {}
        this.$emit('compiled', clone(this.compiled))
      } catch (error) {
        this.validationError = error.backendMessage || error.message || (this.isZh ? '图形策略编译失败' : 'Graph compilation failed')
      } finally {
        this.compiling = false
      }
    },
    async preview () {
      const valid = await this.validate()
      if (!valid) return false
      this.previewing = true
      this.previewError = ''
      this.previewResult = null
      this.previewProvenance = null
      this.previewBars = 0
      try {
        this.syncPreviewTarget()
        if (!this.previewSymbol) throw new Error(this.isZh ? '请填写预览标的' : 'Enter a preview symbol')
        const barsResponse = await getMarketBars({
          market: this.previewMarket,
          symbol: this.previewSymbol,
          timeframe: this.previewTimeframe || '1d',
          limit: 200
        })
        const barsPayload = (barsResponse && barsResponse.data) || barsResponse || {}
        const bars = Array.isArray(barsPayload.bars) ? barsPayload.bars : []
        if (bars.length < this.previewMinimumBars) throw new Error(this.isZh ? `预览至少需要 ${this.previewMinimumBars} 根 K 线` : `Preview needs at least ${this.previewMinimumBars} bars`)
        const response = await evaluateSignalGraph({
          graph: this.local,
          market: this.previewMarket,
          symbol: this.previewSymbol,
          timeframe: this.previewTimeframe || '1d',
          bars,
          snapshot_id: barsPayload.data_provenance && barsPayload.data_provenance.snapshot_id,
          dataset_version: barsPayload.data_provenance && (barsPayload.data_provenance.dataset_version || barsPayload.data_provenance.datasetVersion),
          timestamp: bars[bars.length - 1] && bars[bars.length - 1].timestamp
        })
        const payload = (response && response.data) || response || {}
        this.previewResult = payload.evaluation || payload
        this.previewProvenance = payload.data_provenance || barsPayload.data_provenance || null
        this.previewBars = bars.length
        this.$emit('previewed', clone(this.previewResult))
        return true
      } catch (error) {
        this.previewError = error.backendMessage || error.message || (this.isZh ? '信号预览失败' : 'Signal preview failed')
        return false
      } finally {
        this.previewing = false
      }
    }
  }
}
</script>

<style scoped>
.graph-editor { min-height: 640px; padding: 22px; background: #f6f8fb; color: #17202b; }
.graph-editor--dark { background: #141a22; color: #e9eef5; }
.graph-editor__header, .graph-editor__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.graph-editor__header { margin-bottom: 16px; }
.graph-editor__header h2 { margin: 0 0 4px; font-size: 20px; }
.graph-editor__header p { margin: 0; color: #778392; }
.graph-editor__actions, .graph-editor__toolbar { flex-wrap: wrap; }
.graph-editor__toolbar { justify-content: flex-start; padding: 10px 0; border-top: 1px solid #dfe5ec; border-bottom: 1px solid #dfe5ec; }
.graph-editor__status { margin-left: auto; color: #8b5f00; font-size: 12px; }
.graph-editor__status.is-ok { color: #21824b; }
.graph-editor__body { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .8fr); gap: 18px; margin-top: 18px; }
.graph-editor__nodes { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; align-content: start; }
.graph-node { padding: 12px; border: 1px solid #dfe5ec; border-radius: 6px; background: #fff; }
.graph-editor--dark .graph-node, .graph-editor--dark .graph-editor__side { background: #1d2530; border-color: #354252; }
.graph-node__head { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.graph-node__head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.graph-node__type { padding: 2px 5px; color: #2563a6; background: #e8f1fb; border-radius: 3px; font-size: 11px; }
.graph-node__head .ant-btn { margin-left: auto; }
.graph-node__form { display: grid; gap: 7px; }
.graph-editor__side { padding: 14px; border: 1px solid #dfe5ec; border-radius: 6px; background: #fff; }
.graph-editor__side h3 { margin: 0 0 8px; font-size: 13px; }
.graph-edge { display: grid; grid-template-columns: 1fr auto 1fr auto; align-items: center; gap: 5px; margin-bottom: 7px; }
.graph-editor__side .ant-alert { margin-top: 10px; }
.graph-preview { display: grid; gap: 7px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #dfe5ec; }
.graph-preview h3 { margin: 0; }
.graph-preview__result { margin-top: 3px; }
.graph-preview__json { max-height: 220px; overflow: auto; margin: 0; padding: 8px; background: #111820; color: #d6e2ef; font-size: 11px; white-space: pre-wrap; }
.graph-editor--dark .graph-preview { border-color: #354252; }
@media (max-width: 900px) { .graph-editor__body { grid-template-columns: 1fr; } .graph-editor__status { margin-left: 0; width: 100%; } }
</style>
